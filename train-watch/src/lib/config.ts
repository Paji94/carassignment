export const SUSPENDED_KEYWORDS = ["運転見合わせ", "運転を見合わせ", "全線運休"] as const;
export const DELAY_KEYWORDS = ["遅延", "遅れ", "見込みの遅れ"] as const;

/**
 * 既に運転再開済みの告知を「現在進行中の遅延」として誤検知しないためのキーワード。
 * 運行状況ページは当日の履歴（解決済みのものも含む）を並べて表示することが多いため、
 * これらの語を含む記述は「現在のステータス」としてはカウントしない。
 */
export const RESUMED_KEYWORDS = [
  "運転再開",
  "運転を再開",
  "運転を再開しました",
  "平常運転に戻り",
  "解消しました",
] as const;

// 小田急線の実際の始発・終電はおおむね 04:30〜翌01:30 頃。
// この時間帯の外側（深夜の運行がない時間帯）は監視しても無意味なので何もしない。
export const QUIET_HOURS_START = process.env.QUIET_HOURS_START ?? "01:30";
export const QUIET_HOURS_END = process.env.QUIET_HOURS_END ?? "04:30";

export const TIMEZONE = "Asia/Tokyo";

export const CHECK_INTERVAL_CRON = "*/5 * * * *";

/**
 * 小田急電鉄公式の列車運行状況ページ。APIキー等は不要で、HTMLをそのまま取得して
 * テキスト抽出する方式。
 *
 * 注意: このリポジトリの開発環境からは外部ネットワークへのアクセスが制限されており、
 * 実際のページのHTML構造を直接確認できていない。本番投入前に、実際のレスポンスで
 * `src/lib/odakyuStatus.ts` の抽出ロジック（平常運転/遅延/運転見合わせの判定、
 * 区間・理由の抽出）が意図通り動くか必ず確認すること。
 */
export const ODAKYU_STATUS_URL =
  process.env.ODAKYU_STATUS_URL ?? "https://traininfo.odakyu-rt.jp/train_status";

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
