export const LINE_KEYWORDS = ["小田急", "オダキュウ"] as const;

export const SUSPENDED_KEYWORDS = ["運転見合わせ", "運転を見合わせ", "全線運休"] as const;
export const DELAY_KEYWORDS = ["遅延", "遅れ", "見込みの遅れ"] as const;

// 小田急線の実際の始発・終電はおおむね 04:30〜翌01:30 頃。
// この時間帯の外側（深夜の運行がない時間帯）は監視しても無意味なので何もしない。
export const QUIET_HOURS_START = process.env.QUIET_HOURS_START ?? "01:30";
export const QUIET_HOURS_END = process.env.QUIET_HOURS_END ?? "04:30";

export const TIMEZONE = "Asia/Tokyo";

export const CHECK_INTERVAL_CRON = "*/5 * * * *";

/**
 * 公共交通オープンデータセンター（ODPT: Open Data Platform for Transportation）の
 * 運行情報（TrainInformation）API。
 * 利用には https://www.odpt.org / https://developer-dc.odpt.org でのアカウント登録と
 * consumerKey の取得が必要（無料）。
 *
 * 注意: このリポジトリの開発環境からは外部ネットワークへのアクセスが制限されており、
 * 実際のAPIレスポンス（フィールド名・事業者ID・路線IDの正確な表記）を直接検証できて
 * いない。本番投入前に、取得した consumerKey で実際にAPIを叩き、
 * `src/lib/odakyuStatus.ts` のパース処理（特に ODPT_OPERATOR の値や
 * odpt:trainInformationText / odpt:trainInformationStatus のフィールド名）が
 * 実レスポンスと一致しているか必ず確認すること。
 */
export const ODPT_API_BASE =
  process.env.ODPT_API_BASE ?? "https://api.odpt.org/api/v4/odpt:TrainInformation";

/** ODPTの事業者ID。小田急電鉄は odpt.Operator:Odakyu という表記が一般的（要確認）。 */
export const ODPT_OPERATOR = process.env.ODPT_OPERATOR ?? "odpt.Operator:Odakyu";

/** ODPTのAPIキー。developer-dc.odpt.org 等で登録して取得する。 */
export const ODPT_CONSUMER_KEY = process.env.ODPT_CONSUMER_KEY ?? "";

/**
 * APIキーを渡すクエリパラメータ名。ODPTのバージョンによって
 * `acl:consumerKey` が使われることが多いが、変更された場合に備えて
 * 環境変数で上書きできるようにしている。
 */
export const ODPT_CONSUMER_KEY_PARAM = process.env.ODPT_CONSUMER_KEY_PARAM ?? "acl:consumerKey";

export const REASON_KEYWORDS = [
  "人身事故",
  "急病人",
  "車両故障",
  "車両点検",
  "信号機故障",
  "信号トラブル",
  "ポイント故障",
  "架線",
  "踏切",
  "動物",
  "強風",
  "大雨",
  "降雪",
  "雪の影響",
  "地震",
  "落雷",
  "台風",
  "煙",
  "火災",
  "沿線火災",
  "安全確認",
  "線路内に人",
  "線路への立ち入り",
] as const;
