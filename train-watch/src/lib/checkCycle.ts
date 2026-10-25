import { fetchOdakyuStatus, type OdakyuStatus } from "./odakyuStatus";
import { isOperatingHours } from "./operatingHours";
import { buildNotificationPayload, sendPushToAll } from "./push";
import { getState, getSubscriptions, setState } from "./store";

function notificationKey(status: OdakyuStatus): string | null {
  if (status.level === "normal") return null;
  return `${status.level}:${status.section ?? ""}:${status.reason ?? ""}`;
}

export interface CheckCycleResult {
  skipped: boolean;
  reason?: string;
  status?: OdakyuStatus;
  notified?: boolean;
  notifiedCount?: number;
}

/**
 * 1回分の監視サイクル。
 * - 営業時間外なら何もしない（機能①）
 * - 運行情報を取得し、遅延/運転見合わせを検知する（機能②）
 * - 新規検知時のみプッシュ通知する（機能③）。同一の遅延について連投はしない
 * - 検知しなければ何もしない（機能④）
 */
export async function runCheckCycle(now: Date = new Date()): Promise<CheckCycleResult> {
  if (!isOperatingHours(now)) {
    return { skipped: true, reason: "outside-operating-hours" };
  }

  const status = await fetchOdakyuStatus();
  const key = notificationKey(status);
  const state = await getState();

  let notified = false;
  let notifiedCount = 0;

  if (key && key !== state.lastNotifiedKey) {
    const subscriptions = await getSubscriptions();
    if (subscriptions.length > 0) {
      const payload = buildNotificationPayload(status);
      const result = await sendPushToAll(subscriptions, payload);
      notifiedCount = result.sent;
    }
    notified = true;
  }

  await setState({
    currentStatus: status,
    lastNotifiedKey: key ?? null,
    lastCheckedAt: now.toISOString(),
  });

  return { skipped: false, status, notified, notifiedCount };
}
