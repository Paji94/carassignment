export const LINE_KEYWORDS = ["小田急", "オダキュウ"] as const;

export const SUSPENDED_KEYWORDS = ["運転見合わせ", "運転を見合わせ", "全線運休"] as const;
export const DELAY_KEYWORDS = ["遅延", "遅れ", "見込みの遅れ"] as const;

// 小田急線の実際の始発・終電はおおむね 04:30〜翌01:30 頃。
// この時間帯の外側（深夜の運行がない時間帯）は監視しても無意味なので何もしない。
export const QUIET_HOURS_START = process.env.QUIET_HOURS_START ?? "01:30";
export const QUIET_HOURS_END = process.env.QUIET_HOURS_END ?? "04:30";

export const TIMEZONE = "Asia/Tokyo";

export const CHECK_INTERVAL_CRON = "*/5 * * * *";

export const DELAY_API_ENDPOINT =
  process.env.DELAY_API_ENDPOINT ?? "https://tetsudo.rti-giken.jp/free/delay.json";

export const ODAKYU_STATUS_PAGE = process.env.ODAKYU_STATUS_PAGE ?? "https://www.odakyu.jp/unko/";

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
