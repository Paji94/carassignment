import {
  DELAY_KEYWORDS,
  LINE_KEYWORDS,
  ODPT_API_BASE,
  ODPT_CONSUMER_KEY,
  ODPT_CONSUMER_KEY_PARAM,
  ODPT_OPERATOR,
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
  source: "odpt" | "unknown";
}

interface OdptLocalizedText {
  ja?: string;
  en?: string;
  [lang: string]: string | undefined;
}

interface OdptTrainInformationEntry {
  "odpt:operator"?: string;
  "odpt:railway"?: string;
  "odpt:trainInformationStatus"?: OdptLocalizedText | string;
  "odpt:trainInformationText"?: OdptLocalizedText | string;
  [key: string]: unknown;
}

function localizedJa(value: OdptLocalizedText | string | undefined): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.ja?.trim() ?? "";
}

function includesAny(text: string, keywords: readonly string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function matchesOdakyu(entry: OdptTrainInformationEntry): boolean {
  const operator = entry["odpt:operator"] ?? "";
  const railway = entry["odpt:railway"] ?? "";
  if (operator.includes("Odakyu") || railway.includes("Odakyu")) return true;
  // 事業者ID/路線IDの表記が想定と異なるケースに備え、日本語名でも保険をかける
  return includesAny(operator, LINE_KEYWORDS) || includesAny(railway, LINE_KEYWORDS);
}

function detectLevel(text: string): DelayLevel {
  if (includesAny(text, SUSPENDED_KEYWORDS)) return "suspended";
  if (includesAny(text, DELAY_KEYWORDS)) return "delay";
  // NORMAL_KEYWORDSに一致しなくても、遅延/見合わせの既知キーワードが
  // 含まれていない時点で平常運転とみなす（未知の文言で誤通知しないため）
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
  consumerKey?: string;
}

/**
 * ODPT（公共交通オープンデータセンター）のTrainInformation APIから
 * 小田急線の運行状況を取得する。
 * 複数路線がヒットした場合は最も深刻な状態（運転見合わせ > 遅延 > 平常）を採用する。
 */
export async function fetchOdakyuStatus(options: FetchOptions = {}): Promise<OdakyuStatus> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const consumerKey = options.consumerKey ?? ODPT_CONSUMER_KEY;

  if (!consumerKey) {
    throw new Error(
      "ODPT_CONSUMER_KEY が未設定です。https://www.odpt.org でアカウント登録し、取得したconsumerKeyを設定してください。"
    );
  }

  const base = options.endpoint ?? ODPT_API_BASE;
  const url = new URL(base);
  url.searchParams.set("odpt:operator", ODPT_OPERATOR);
  url.searchParams.set(ODPT_CONSUMER_KEY_PARAM, consumerKey);

  const observedAt = new Date().toISOString();

  const res = await fetchImpl(url.toString(), {
    headers: { "User-Agent": "TrainWatch/1.0 (+https://github.com/)" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`ODPT TrainInformation API responded with ${res.status}`);
  }

  const json = (await res.json()) as unknown;
  const entries = Array.isArray(json) ? (json as OdptTrainInformationEntry[]) : [];
  return parseEntries(entries, observedAt);
}

/** network / JSON パース処理を含まない純粋関数。ユニットテスト用に公開。 */
export function parseEntries(entries: OdptTrainInformationEntry[], observedAt: string): OdakyuStatus {
  const odakyuEntries = entries.filter(matchesOdakyu);
  if (odakyuEntries.length === 0) {
    return normalStatus("odpt", observedAt);
  }

  const severityOrder: DelayLevel[] = ["suspended", "delay", "normal"];
  let best: OdakyuStatus | null = null;

  for (const entry of odakyuEntries) {
    const statusText = localizedJa(entry["odpt:trainInformationStatus"]);
    const detailText = localizedJa(entry["odpt:trainInformationText"]);
    const text = [statusText, detailText].filter(Boolean).join(" ") || detailText || statusText;
    const level = detectLevel(text || statusText);

    const candidate: OdakyuStatus = {
      level,
      section: extractSection(text),
      reason: extractReason(text) ?? (level === "normal" ? null : text.slice(0, 60) || null),
      observedAt,
      rawText: text,
      source: "odpt",
    };

    if (!best || severityOrder.indexOf(candidate.level) < severityOrder.indexOf(best.level)) {
      best = candidate;
    }
  }

  return best ?? normalStatus("odpt", observedAt);
}
