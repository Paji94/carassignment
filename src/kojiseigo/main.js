import { KOJI, DONT_KNOW } from "./data.js";

const SET_SIZE = 10;
const $ = (id) => document.getElementById(id);

// ---------- 文字列の正規化・判定 ----------
const toHira = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
function norm(s) {
  return toHira(s.normalize("NFKC"))
    .replace(/[\s、。，．,.!?！？・「」『』（）()ー〜~"'”“]/g, "")
    .replace(/分か/g, "わか").replace(/知ら/g, "しら").replace(/知り/g, "しり");
}
function editDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}
const isHiraOnly = (s) => /^[ぁ-ゟ]+$/.test(s);

// 戻り値: "correct" | "dontknow" | "wrong"
function judge(candidates, item) {
  const accepts = item.accept.map(norm);
  const yomi = norm(item.yomi);
  for (const raw of candidates) {
    const c = norm(raw);
    if (!c) continue;
    if (accepts.some((a) => c.includes(a))) return "correct";
    // ひらがなだけの認識結果は、読みに 1〜2 文字の誤差まで許容（音声認識のぶれ対策）
    if (isHiraOnly(c) && yomi.length >= 4) {
      const core = c.replace(/(です|だとおもいます|かな)$/, "");
      if (editDistance(core, yomi) <= (yomi.length >= 9 ? 2 : 1)) return "correct";
    }
  }
  if (candidates.some((raw) => DONT_KNOW.some((d) => norm(raw).includes(d)))) return "dontknow";
  return "wrong";
}

// ---------- 音声合成 ----------
let jaVoice = null;
function pickVoice() {
  const voices = speechSynthesis.getVoices().filter((v) => v.lang.replace("_", "-").startsWith("ja"));
  jaVoice = voices.find((v) => /Google|Kyoko|O-ren|Nanami|Haruka/.test(v.name)) || voices[0] || null;
}
if ("speechSynthesis" in window) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}
let speechToken = 0;
function speak(text) {
  if (!("speechSynthesis" in window) || !$("opt-voice").checked) return Promise.resolve();
  const token = ++speechToken;
  speechSynthesis.cancel();
  // Chrome は長文の読み上げが途中で止まるため、句点で区切って順番に読む
  const chunks = text.split(/(?<=[。！？])/).map((s) => s.trim()).filter(Boolean);
  return chunks.reduce((p, chunk) => p.then(() => new Promise((resolve) => {
    if (token !== speechToken) return resolve();
    const u = new SpeechSynthesisUtterance(chunk);
    u.lang = "ja-JP";
    u.rate = Number($("opt-rate").value);
    if (jaVoice) u.voice = jaVoice;
    u.onend = u.onerror = () => resolve();
    speechSynthesis.speak(u);
  })), Promise.resolve()).then(() => token === speechToken);
}
function stopSpeaking() {
  speechToken++;
  if ("speechSynthesis" in window) speechSynthesis.cancel();
}

// ---------- 音声認識 ----------
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null;
let listening = false;
function listen() {
  if (!SR || listening || state.phase !== "question") return;
  stopSpeaking();
  rec = new SR();
  rec.lang = "ja-JP";
  rec.interimResults = true;
  rec.maxAlternatives = 5;
  let finalAlts = null;
  rec.onresult = (e) => {
    const r = e.results[e.results.length - 1];
    $("heard").textContent = `聞き取り中…「${r[0].transcript}」`;
    if (r.isFinal) finalAlts = Array.from(r).map((a) => a.transcript);
  };
  rec.onerror = (e) => {
    if (e.error === "not-allowed" || e.error === "service-not-allowed")
      $("heard").textContent = "マイクが使えません。下の入力欄に書いて回答してください。";
  };
  rec.onend = () => {
    listening = false;
    setMicUI();
    if (finalAlts && finalAlts.length) answer(finalAlts);
    else if (state.phase === "question" && !$("heard").textContent.startsWith("マイク"))
      $("heard").textContent = "聞き取れませんでした。🎤 をもう一度押して答えてください。";
  };
  listening = true;
  setMicUI();
  $("heard").textContent = "🎤 どうぞ、答えてください（「分からない」でもOK）";
  try { rec.start(); } catch { listening = false; setMicUI(); }
}
function stopListening() {
  if (rec && listening) { rec.onend = () => { listening = false; setMicUI(); }; rec.abort(); }
  listening = false;
  setMicUI();
}
function setMicUI() {
  $("mic").classList.toggle("on", listening);
  $("mic").textContent = listening ? "● 聞いています" : "🎤 声で答える";
}

// ---------- 進行管理 ----------
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// 前回と同じ並びにならないシャッフル。前回の順番は localStorage に保存し、ページを開き直しても引き継ぐ。
// 候補を何通りか作り、「前回と同じ位置に来る語」と「最初の10問が前回の最初の10問と重なる語」が最も少ないものを選ぶ。
const ORDER_KEY = "kojiseigo:lastOrder";
const lastOrders = {};
function loadOrder(key) {
  if (key in lastOrders) return lastOrders[key];
  try { return JSON.parse(localStorage.getItem(`${ORDER_KEY}:${key}`)) || []; } catch { return []; }
}
function saveOrder(key, order) {
  lastOrders[key] = order;
  try { localStorage.setItem(`${ORDER_KEY}:${key}`, JSON.stringify(order)); } catch { /* 保存できなくても続行 */ }
}
function freshShuffle(ids, key) {
  const prev = loadOrder(key);
  const prevHead = new Set(prev.slice(0, SET_SIZE));
  const score = (o) => o.reduce((n, id, i) => n + (prev[i] === id ? 2 : 0) + (i < SET_SIZE && prevHead.has(id) ? 1 : 0), 0);
  let best = shuffle(ids);
  for (let t = 0; t < 30 && ids.length > 1; t++) {
    const cand = shuffle(ids);
    if (score(cand) < score(best)) best = cand;
  }
  saveOrder(key, best);
  return best;
}
const state = { pool: [], set: [], idx: 0, results: [], phase: "start", setNo: 0, mode: "normal" };

function show(screen) {
  for (const s of ["screen-start", "screen-quiz", "screen-summary"]) $(s).hidden = s !== screen;
}

function startAll() {
  state.pool = freshShuffle(KOJI.map((_, i) => i), "all");
  state.setNo = 0;
  nextSet();
}
function nextSet() {
  state.set = state.pool.splice(0, SET_SIZE);
  state.mode = "normal";
  beginSet();
}
function retryWrong() {
  state.set = freshShuffle(state.results.filter((r) => !r.correct).map((r) => r.id), "retry");
  state.mode = "retry";
  beginSet();
}
function beginSet() {
  state.setNo += 1;
  state.idx = 0;
  state.results = [];
  show("screen-quiz");
  ask();
}

async function ask() {
  const item = KOJI[state.set[state.idx]];
  state.phase = "question";
  $("progress").textContent = `${state.mode === "retry" ? "再挑戦 " : `第${state.setNo}セット `}${state.idx + 1} / ${state.set.length}問`;
  $("bar").style.width = `${(state.idx / state.set.length) * 100}%`;
  $("meaning").textContent = item.meaning;
  $("result").hidden = true;
  $("answer-area").hidden = false;
  $("heard").textContent = SR ? "🎤 を押して答えるか、下に入力してください。" : "このブラウザは音声認識に対応していません。下に入力して答えてください。";
  $("typed").value = "";
  const finished = await speak(`第${state.idx + 1}問。${item.meaning}`);
  if (finished && state.phase === "question" && $("opt-autolisten").checked) listen();
}

async function answer(candidates) {
  if (state.phase !== "question") return;
  const item = KOJI[state.set[state.idx]];
  const verdict = judge(candidates, item);
  state.phase = "feedback";
  stopListening();
  const said = candidates[0] || "";
  state.results.push({ id: state.set[state.idx], correct: verdict === "correct", said, verdict });
  renderFeedback(item, verdict, said);
  if (verdict === "correct") {
    const done = await speak(`正解！ ${item.word}。`);
    if (done && state.phase === "feedback") next();
  } else {
    const head = verdict === "dontknow" ? "大丈夫、覚えていきましょう。" : "残念、不正解です。";
    const done = await speak(`${head}正解は、${item.yomi}。${item.word}です。意味は、${item.meaning}${item.origin}`);
    if (done && state.phase === "feedback" && $("opt-autonext").checked) setTimeout(() => state.phase === "feedback" && next(), 1200);
  }
}

function renderFeedback(item, verdict, said) {
  $("answer-area").hidden = true;
  $("result").hidden = false;
  const label = { correct: "⭕ 正解！", wrong: "❌ 不正解", dontknow: "📖 解説" }[verdict];
  $("verdict").textContent = label;
  $("verdict").className = `verdict ${verdict}`;
  $("your-answer").textContent = said ? `あなたの回答：「${said}」` : "";
  $("ans-word").textContent = item.word;
  $("ans-yomi").textContent = item.yomi;
  $("explain").hidden = verdict === "correct";
  $("explain-meaning").textContent = item.meaning;
  $("explain-origin").textContent = item.origin;
  $("override").hidden = verdict !== "wrong";
}

function next() {
  stopSpeaking();
  state.idx += 1;
  if (state.idx < state.set.length) ask();
  else summary();
}

function summary() {
  state.phase = "summary";
  stopListening();
  show("screen-summary");
  const correct = state.results.filter((r) => r.correct).length;
  const wrong = state.results.filter((r) => !r.correct);
  $("score").textContent = `${correct} / ${state.results.length}`;
  $("score-msg").textContent = correct === state.results.length ? "全問正解！すばらしい！" : correct >= state.results.length * 0.7 ? "あと少し！間違えた語を復習しよう。" : "振り返りをして、もう一度挑戦しよう。";
  const list = $("review");
  list.innerHTML = "";
  for (const r of wrong) {
    const k = KOJI[r.id];
    const li = document.createElement("li");
    li.innerHTML = `<div class="rv-word"></div><div class="rv-yomi"></div><div class="rv-meaning"></div>`;
    li.querySelector(".rv-word").textContent = k.word;
    li.querySelector(".rv-yomi").textContent = k.yomi;
    li.querySelector(".rv-meaning").textContent = k.meaning;
    list.appendChild(li);
  }
  $("review-wrap").hidden = wrong.length === 0;
  $("btn-retry").hidden = wrong.length === 0;
  const left = state.pool.length;
  $("btn-next").hidden = left === 0;
  $("btn-next").textContent = `次の${Math.min(SET_SIZE, left)}問へ（残り${left}語）`;
  $("btn-all").textContent = left === 0 ? `全${KOJI.length}語 完了！もう一度最初から` : "全問シャッフルして最初から";
  const reviewText = wrong.length ? `間違えた問題は、${wrong.map((r) => KOJI[r.id].word).join("、")}です。` : "";
  speak(`今回の結果は、${state.results.length}問中、${correct}問正解です。${reviewText}`);
}

// ---------- イベント ----------
$("btn-start").onclick = startAll;
$("btn-next").onclick = () => { stopSpeaking(); nextSet(); };
$("btn-retry").onclick = () => { stopSpeaking(); retryWrong(); };
$("btn-all").onclick = () => { stopSpeaking(); startAll(); };
$("btn-quit").onclick = () => { stopSpeaking(); stopListening(); if (state.results.length) summary(); else show("screen-start"); };
$("mic").onclick = () => (listening ? stopListening() : listen());
$("repeat").onclick = () => { const item = KOJI[state.set[state.idx]]; stopListening(); speak(item.meaning).then((f) => f && $("opt-autolisten").checked && listen()); };
$("dontknow").onclick = () => answer(["分からない"]);
$("answer-form").onsubmit = (e) => { e.preventDefault(); const v = $("typed").value.trim(); if (v) answer([v]); };
$("btn-nextq").onclick = next;
$("override").onclick = () => {
  const last = state.results[state.results.length - 1];
  last.correct = true;
  last.verdict = "correct";
  stopSpeaking();
  next();
};
$("opt-rate").oninput = () => ($("rate-val").textContent = `${Number($("opt-rate").value).toFixed(1)}倍`);
$("word-count").textContent = KOJI.length;
if (!SR) $("mic").disabled = true;
