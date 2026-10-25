import {
  DELAY_KEYWORDS,
  ODAKYU_STATUS_URL,
  REASON_KEYWORDS,
  RESUMED_KEYWORDS,
  SUSPENDED_KEYWORDS,
} from "./config";

export type DelayLevel = "normal" | "delay" | "suspended";

export interface OdakyuStatus {
  level: DelayLevel;
  /** 遅延区間（例: 新宿〜町田） */
  section: string | null;
  /** 遅延理由（例: 人身事故の影響） */
  reason: string | null;
  /** このステータスが観測された時刻（ISO文字列） */
  observedAt: string;
  /** 元データのテキスト全文（デバッグ・表示用） */
  rawText: string;
  source: "odakyu-official" | "unknown";
}

function includesAny(text: string, keywords: readonly string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function detectLevel(text: string): DelayLevel {
  if (includesAny(text, SUSPENDED_KEYWORDS)) return "suspended";
  if (includesAny(text, DELAY_KEYWORDS)) return "delay";
  // 既知のキーワードに一致しない場合は、未知の文言で誤通知しないよう平常運転扱いにする
  return "normal";
}

/**
 * HTML文字列から、タグを取り除いたプレーンテキストを生成する。
 * ページの正確なDOM構造が分からない状態でも、とりあえずテキストベースで
 * キーワード検出できるようにするための簡易変換。
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t　]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

/** 駅名の前方に紛れ込みやすい助詞・区切り文字。抽出後にこれらより前の部分を切り捨てる。 */
const LEADING_NOISE_CHARS = ["は", "が", "を", "に", "の", "と", "へ", "も", "で", "、", "。", "・"];

function trimLeadingNoise(name: string): string {
  let lastIndex = -1;
  for (const ch of LEADING_NOISE_CHARS) {
    const idx = name.lastIndexOf(ch);
    if (idx > lastIndex) lastIndex = idx;
  }
  return lastIndex >= 0 ? name.slice(lastIndex + 1) : name;
}

/**
 * テキストから遅延区間らしき部分を抽出するヒューリスティック。
 * 「新宿駅〜町田駅間」「小田原〜新宿」のような表記を想定。
 * 実データの表記ゆれに完全対応するものではなく、抽出できない場合は null を返す。
 */
export function extractSection(text: string): string | null {
  // 駅名本体は長くても10文字程度だが、「人身事故の影響で新宿駅」のように
  // 直前の理由フレーズを巻き込んで長めに一致することがあるため、
  // 一致範囲自体は広めに取り、抽出後に trimLeadingNoise で助詞以前を切り捨てる。
  const pattern =
    /([ぁ-んァ-ヶ一-龠a-zA-Z0-9]{1,14}?)(?:駅)?\s*[〜～\-－ー]\s*([ぁ-んァ-ヶ一-龠a-zA-Z0-9]{1,14}?)(?:駅)?(?=間|、|,|\s|$)/;
  const match = text.match(pattern);
  if (!match) return null;
  const from = trimLeadingNoise(match[1]);
  const to = trimLeadingNoise(match[2]);
  if (!from || !to) return null;
  return `${from}〜${to}`;
}

/**
 * テキストから遅延理由らしき部分を抽出するヒューリスティック。
 * 既知の事象キーワードにヒットしたら、その前後の文脈を短く切り出す。
 */
export function extractReason(text: string): string | null {
  for (const keyword of REASON_KEYWORDS) {
    const idx = text.indexOf(keyword);
    if (idx === -1) continue;
    const start = Math.max(0, idx - 10);
    const end = Math.min(text.length, idx + keyword.length + 15);
    const snippet = text.slice(start, end).replace(/^[、。\s]+/, "");
    return snippet;
  }
  return null;
}

function normalStatus(source: OdakyuStatus["source"], observedAt: string): OdakyuStatus {
  return {
    level: "normal",
    section: null,
    reason: null,
    observedAt,
    rawText: "",
    source,
  };
}

interface FetchOptions {
  fetchImpl?: typeof fetch;
  url?: string;
}

/**
 * 小田急電鉄公式の運行状況ページを取得し、小田急線の運行状況を判定する。
 * ページ内に複数の告知が並んでいる場合は、最も深刻な状態
 * （運転見合わせ > 遅延 > 平常）を採用する。既に運転再開済みの告知は無視する。
 */
export async function fetchOdakyuStatus(options: FetchOptions = {}): Promise<OdakyuStatus> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = options.url ?? ODAKYU_STATUS_URL;
  const observedAt = new Date().toISOString();

  const res = await fetchImpl(url, {
    headers: { "User-Agent": "TrainWatch/1.0 (+https://github.com/)" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Odakyu status page responded with ${res.status}`);
  }

  const html = await res.text();
  return parseHtml(html, observedAt);
}

/** HTML取得処理を含まない純粋関数。ユニットテスト用に公開。 */
export function parseHtml(html: string, observedAt: string): OdakyuStatus {
  return parseStatusText(htmlToText(html), observedAt);
}

/** テキスト抽出済みの内容から状態を判定する純粋関数。ユニットテスト用に公開。 */
export function parseStatusText(text: string, observedAt: string): OdakyuStatus {
  // 行・文単位に分割し、それぞれを独立した告知として扱う
  const segments = text
    .split(/\n+/)
    .flatMap((line) => line.split("。"))
    .map((s) => s.trim())
    .filter(Boolean);

  const severityOrder: DelayLevel[] = ["suspended", "delay", "normal"];
  let best: OdakyuStatus | null = null;

  for (const segment of segments) {
    if (includesAny(segment, RESUMED_KEYWORDS)) continue; // 運転再開済みの告知は現在の状態としてカウントしない

    const level = detectLevel(segment);
    if (level === "normal") continue;

    const candidate: OdakyuStatus = {
      level,
      section: extractSection(segment),
      reason: extractReason(segment) ?? segment.slice(0, 60),
      observedAt,
      rawText: segment,
      source: "odakyu-official",
    };

    if (!best || severityOrder.indexOf(candidate.level) < severityOrder.indexOf(best.level)) {
      best = candidate;
    }
  }

  return best ?? normalStatus("odakyu-official", observedAt);
}
