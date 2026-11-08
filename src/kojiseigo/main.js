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
// 読み上げ中の発話をここで保持する（Chrome は参照のない発話を破棄し、終了通知 onend が来なくなるため）
const liveUtterances = new Set();
function speakChunk(chunk, token) {
  return new Promise((resolve) => {
    if (token !== speechToken) return resolve();
    const rate = Number($("opt-rate").value);
    const u = new SpeechSynthesisUtterance(chunk);
    u.lang = "ja-JP";
    u.rate = rate;
    if (jaVoice) u.voice = jaVoice;
    liveUtterances.add(u);
    let done = false;
    let started = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(limitTimer);
      clearInterval(poll);
      liveUtterances.delete(u);
      resolve();
    };
    u.onend = u.onerror = finish;
    // onend が来ないまま止まる不具合（Safari / Chrome）対策：
    // 読み上げ状態を監視して終わったら次へ進み、長すぎるときは上限時間で打ち切る
    const startedAt = Date.now();
    const poll = setInterval(() => {
      const busy = speechSynthesis.speaking || speechSynthesis.pending;
      if (busy) started = true;
      else if (started || Date.now() - startedAt > 1500) finish();
    }, 300);
    const limitTimer = setTimeout(finish, 3000 + (chunk.length * 350) / rate);
    speechSynthesis.resume();
    speechSynthesis.speak(u);
  });
}
function speak(text) {
  if (!("speechSynthesis" in window) || !$("opt-voice").checked) return Promise.resolve(true);
  const token = ++speechToken;
  speechSynthesis.cancel();
  // Chrome は長文の読み上げが途中で止まるため、句点で区切って順番に読む
  const chunks = text.split(/(?<=[。！？])/).map((s) => s.trim()).filter(Boolean);
  return chunks
    .reduce((p, chunk) => p.then(() => speakChunk(chunk, token)), Promise.resolve())
    .then(() => token === speechToken);
}
function stopSpeaking() {
  speechToken++;
  if ("speechSynthesis" in window) speechSynthesis.cancel();
}

// ---------- 音声認識 ----------
// iOS Safari は認識オブジェクトを毎回作り直すと、数回で新しいマイクが開始できなくなる。
// そのため 1 つを使い回し、前回の聞き取りが完全に終わってから次を開始する。
// 開始しない・固まったときだけ作り直す。
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const MAX_AUTO_RETRY = 2; // 何も聞こえなかったとき、自動でマイクを入れ直す回数
const ERROR_TEXT = {
  "audio-capture": "マイクの音を取得できませんでした",
  network: "通信エラーで聞き取れませんでした",
  "not-allowed": "マイクの使用が許可されていません",
  "service-not-allowed": "マイクの使用が許可されていません",
  "no-speech": "声が聞こえませんでした",
};
let recognizer = null;
let recBusy = false; // start() してから onend が来るまで true
let handlers = {}; // 今の聞き取りのイベント処理
let idleWaiters = [];
let listening = false;
let recSession = 0;
let autoRetries = 0;

function createRecognizer() {
  const r = new SR();
  r.lang = "ja-JP";
  r.continuous = false;
  r.interimResults = true;
  r.maxAlternatives = 5;
  r.onstart = () => handlers.start?.();
  r.onresult = (e) => handlers.result?.(e);
  r.onerror = (e) => handlers.error?.(e);
  r.onend = () => {
    if (recognizer !== r) return;
    recBusy = false;
    const h = handlers;
    handlers = {};
    h.end?.();
    idleWaiters.splice(0).forEach((f) => f());
  };
  return r;
}
// 認識オブジェクトを捨てて、次回は新しく作る（固まったときの復旧用）
function resetRecognizer() {
  const old = recognizer;
  recognizer = null;
  recBusy = false;
  handlers = {};
  if (old) {
    old.onstart = old.onresult = old.onerror = old.onend = null;
    try { old.abort(); } catch { /* noop */ }
  }
  idleWaiters.splice(0).forEach((f) => f());
}
// 前回の聞き取りが終わるのを待つ（1.2 秒待っても終わらなければ作り直す）
function whenIdle() {
  if (!recBusy) return Promise.resolve();
  try { recognizer.abort(); } catch { /* noop */ }
  return new Promise((resolve) => {
    idleWaiters.push(resolve);
    setTimeout(() => { if (recBusy) resetRecognizer(); resolve(); }, 1200);
  });
}

async function listen(auto = false, startRetry = 0) {
  if (!SR || state.phase !== "question") return;
  if (listening && startRetry === 0) return;
  const session = ++recSession;
  listening = true;
  setMicUI();
  stopSpeaking();
  $("heard").textContent = "🎤 マイクを準備中…";
  // 空いていれば待たずにすぐ開始する（ボタン操作の直後に start() を呼ぶため）
  if (recBusy) await whenIdle();
  if (session !== recSession || state.phase !== "question") return;
  if (!recognizer) recognizer = createRecognizer();
  const r = recognizer;

  let lastAlts = null;
  let finalAlts = null;
  let errorCode = null;
  let started = false;
  let done = false;
  let silenceTimer = null;
  const stopRec = () => { try { r.stop(); } catch { /* 既に停止済み */ } };
  const cleanup = () => {
    done = true;
    clearTimeout(silenceTimer);
    clearTimeout(startTimer);
    clearTimeout(watchdog);
  };
  // マイクが開始しなかったとき：作り直して 1 回だけ自動でやり直す
  const restart = (reason) => {
    if (done) return;
    cleanup();
    resetRecognizer();
    if (session !== recSession || state.phase !== "question") return;
    if (startRetry < 1) { setTimeout(() => listen(auto, startRetry + 1), 300); return; }
    listening = false;
    setMicUI();
    $("heard").textContent = `マイクを開始できませんでした（${reason}）。もう一度 🎤 を押すか、下の入力欄に書いて回答してください。`;
  };

  handlers = {
    start: () => {
      started = true;
      clearTimeout(startTimer);
      $("heard").textContent = "🎤 どうぞ、答えてください（「分からない」でもOK）";
    },
    result: (e) => {
      started = true;
      const res = e.results[e.results.length - 1];
      const alts = Array.from(res).map((a) => a.transcript).filter(Boolean);
      if (!alts.length) return;
      lastAlts = alts;
      $("heard").textContent = `聞き取り中…「${alts[0]}」`;
      clearTimeout(silenceTimer);
      if (res.isFinal) { finalAlts = alts; stopRec(); return; }
      // Safari は確定結果（isFinal）を返さずに聞き続けることがあるため、話し終えて少し経ったら確定させる
      silenceTimer = setTimeout(stopRec, 1500);
    },
    error: (e) => { errorCode = e.error; },
    end: () => {
      if (done) return;
      cleanup();
      if (session !== recSession) return;
      const alts = finalAlts || lastAlts;
      if (alts && alts.length) { listening = false; setMicUI(); return answer(alts); }
      if (state.phase !== "question") { listening = false; setMicUI(); return; }
      // 音を拾えないまま終わった（iOS でマイクがつかめていない）→ 作り直してやり直す
      if (errorCode === "audio-capture" || (!started && errorCode !== "not-allowed" && errorCode !== "service-not-allowed")) {
        done = false;
        return restart(errorCode || "開始されませんでした");
      }
      listening = false;
      setMicUI();
      if (errorCode === "not-allowed" || errorCode === "service-not-allowed") {
        // Safari はボタン操作なしでマイクを入れると拒否することがある
        $("heard").textContent = auto
          ? "🎤 を押して答えてください。"
          : "マイクが使えません。ブラウザの設定でマイクを許可するか、下の入力欄に書いて回答してください。";
        return;
      }
      if ($("opt-autolisten").checked && autoRetries < MAX_AUTO_RETRY && errorCode !== "aborted") {
        autoRetries += 1;
        $("heard").textContent = "もう一度どうぞ…";
        setTimeout(() => listen(true), 400);
        return;
      }
      $("heard").textContent = `${ERROR_TEXT[errorCode] || "聞き取れませんでした"}。🎤 をもう一度押して答えてください。`;
    },
  };

  // start() しても 3 秒以内にマイクが開始しなければ固まったとみなす
  const startTimer = setTimeout(() => { if (!started) restart("応答なし"); }, 3000);
  // 終了通知が来ないまま固まった場合の保険（15 秒で打ち切る）
  const watchdog = setTimeout(() => {
    stopRec();
    setTimeout(() => { if (!done) { const end = handlers.end; resetRecognizer(); end?.(); } }, 1000);
  }, 15000);

  recBusy = true;
  try {
    r.start();
  } catch (err) {
    restart(err && err.name ? err.name : "開始エラー");
  }
}
function stopListening() {
  recSession++;
  handlers = {};
  if (recBusy && recognizer) { try { recognizer.abort(); } catch { /* noop */ } }
  listening = false;
  setMicUI();
}
function setMicUI() {
  $("mic").classList.toggle("on", listening);
  $("mic").textContent = listening ? "● 聞いています（タップで停止）" : "🎤 声で答える";
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
  autoRetries = 0;
  const qIdx = state.idx;
  const finished = await speak(`第${state.idx + 1}問。${item.meaning}`);
  // 読み上げ直後はスピーカーからマイクへの切り替えが間に合わないことがあるので少し待つ
  if (finished && $("opt-autolisten").checked)
    setTimeout(() => state.phase === "question" && state.idx === qIdx && listen(true), 350);
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
    const done = await speak(`正解！ ${item.yomi}。`);
    if (done && state.phase === "feedback") next();
  } else {
    const head = verdict === "dontknow" ? "大丈夫、覚えていきましょう。" : "残念、不正解です。";
    const done = await speak(`${head}正解は、${item.yomi}です。意味は、${item.meaning}${item.origin}`);
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
  const reviewText = wrong.length ? `間違えた問題は、${wrong.map((r) => KOJI[r.id].yomi).join("、")}です。` : "";
  speak(`今回の結果は、${state.results.length}問中、${correct}問正解です。${reviewText}`);
}

// ---------- イベント ----------
$("btn-start").onclick = startAll;
$("btn-next").onclick = () => { stopSpeaking(); nextSet(); };
$("btn-retry").onclick = () => { stopSpeaking(); retryWrong(); };
$("btn-all").onclick = () => { stopSpeaking(); startAll(); };
$("btn-quit").onclick = () => { stopSpeaking(); stopListening(); if (state.results.length) summary(); else show("screen-start"); };
$("mic").onclick = () => { if (listening) stopListening(); else { autoRetries = 0; listen(); } };
$("repeat").onclick = () => { const item = KOJI[state.set[state.idx]]; stopListening(); autoRetries = 0; speak(item.meaning).then((f) => f && $("opt-autolisten").checked && setTimeout(() => listen(true), 350)); };
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
