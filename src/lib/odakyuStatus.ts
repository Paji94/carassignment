import {
  DELAY_API_ENDPOINT,
  DELAY_KEYWORDS,
  LINE_KEYWORDS,
  REASON_KEYWORDS,
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
  source: "rti-giken" | "unknown";
}

interface RawDelayEntry {
  [key: string]: unknown;
}

function pickString(entry: RawDelayEntry, keys: string[]): string {
  for (const key of keys) {
    const value = entry[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return "";
}

function includesAny(text: string, keywords: readonly string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function matchesOdakyu(entry: RawDelayEntry): boolean {
  const name = pickString(entry, ["name", "line", "company", "railway"]);
  const title = pickString(entry, ["title"]);
  return includesAny(name, LINE_KEYWORDS) || includesAny(title, LINE_KEYWORDS);
}

function detectLevel(text: string): DelayLevel {
  if (includesAny(text, SUSPENDED_KEYWORDS)) return "suspended";
  if (includesAny(text, DELAY_KEYWORDS)) return "delay";
  return "normal";
}

/**
 * テキストから遅延区間らしき部分を抽出するヒューリスティック。
 * 「新宿駅〜町田駅間」「小田原〜新宿」のような表記を想定。
 * 実データの表記ゆれに完全対応するものではなく、抽出できない場合は null を返す。
 */
export function extractSection(text: string): string | null {
  // 駅名は概ね10文字以内という前提で、区切り文字（〜など）の前後を最短一致で取り出す。
  // 2つ目の駅名の直後は「間」「、」「,」「空白」「文末」のいずれかで終わっている想定。
  const pattern =
    /([ぁ-んァ-ヶ一-龠a-zA-Z0-9]{1,10}?)(?:駅)?\s*[〜～\-－ー]\s*([ぁ-んァ-ヶ一-龠a-zA-Z0-9]{1,10}?)(?:駅)?(?=間|、|,|\s|$)/;
  const match = text.match(pattern);
  if (!match) return null;
  const [, from, to] = match;
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
  endpoint?: string;
}

/**
 * 遅延情報APIから小田急線の運行状況を取得する。
 * 複数路線がヒットした場合は最も深刻な状態（運転見合わせ > 遅延 > 平常）を採用する。
 */
export async function fetchOdakyuStatus(options: FetchOptions = {}): Promise<OdakyuStatus> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const endpoint = options.endpoint ?? DELAY_API_ENDPOINT;
  const observedAt = new Date().toISOString();

  const res = await fetchImpl(endpoint, {
    headers: { "User-Agent": "TrainWatch/1.0 (+https://github.com/)" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`delay info api responded with ${res.status}`);
  }

  const json = (await res.json()) as unknown;
  const entries = Array.isArray(json) ? (json as RawDelayEntry[]) : [];
  return parseEntries(entries, observedAt);
}

/** network / JSON パース処理を含まない純粋関数。ユニットテスト用に公開。 */
export function parseEntries(entries: RawDelayEntry[], observedAt: string): OdakyuStatus {
  const odakyuEntries = entries.filter(matchesOdakyu);
  if (odakyuEntries.length === 0) {
    return normalStatus("rti-giken", observedAt);
  }

  const severityOrder: DelayLevel[] = ["suspended", "delay", "normal"];
  let best: OdakyuStatus | null = null;

  for (const entry of odakyuEntries) {
    const text = pickString(entry, ["description", "title", "body", "text"]);
    const level = detectLevel(text);
    const candidate: OdakyuStatus = {
      level,
      section: extractSection(text),
      reason: extractReason(text) ?? (level === "normal" ? null : text.slice(0, 60)),
      observedAt,
      rawText: text,
      source: "rti-giken",
    };

    if (!best || severityOrder.indexOf(candidate.level) < severityOrder.indexOf(best.level)) {
      best = candidate;
    }
  }

  return best ?? normalStatus("rti-giken", observedAt);
}
