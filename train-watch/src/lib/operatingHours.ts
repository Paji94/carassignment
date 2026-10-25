import { QUIET_HOURS_END, QUIET_HOURS_START, TIMEZONE } from "./config";

function parseHHMM(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + (m ?? 0);
}

function minutesSinceMidnightInTz(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

/**
 * 小田急線の始発〜終電の時間帯かどうかを判定する。
 * QUIET_HOURS_START〜QUIET_HOURS_END の間（深夜の運行がない時間帯）だけ false を返す。
 */
export function isOperatingHours(now: Date = new Date(), timeZone: string = TIMEZONE): boolean {
  const nowMinutes = minutesSinceMidnightInTz(now, timeZone);
  const quietStart = parseHHMM(QUIET_HOURS_START);
  const quietEnd = parseHHMM(QUIET_HOURS_END);

  if (quietStart === quietEnd) {
    // quiet window is disabled (24h monitoring)
    return true;
  }

  if (quietStart < quietEnd) {
    return !(nowMinutes >= quietStart && nowMinutes < quietEnd);
  }

  // wraps past midnight (not expected with current defaults, handled defensively)
  return !(nowMinutes >= quietStart || nowMinutes < quietEnd);
}
