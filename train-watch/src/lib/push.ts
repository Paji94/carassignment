import webpush from "web-push";
import type { OdakyuStatus } from "./odakyuStatus";
import { removeSubscriptions, type StoredPushSubscription } from "./store";

let configured = false;

function ensureConfigured(): void {
  if (configured) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const contact = process.env.VAPID_CONTACT_EMAIL ?? "mailto:example@example.com";

  if (!publicKey || !privateKey) {
    throw new Error(
      "VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY が未設定です。`npm run generate-vapid-keys` で生成し .env.local に設定してください。"
    );
  }

  webpush.setVapidDetails(contact, publicKey, privateKey);
  configured = true;
}

export interface NotificationPayload {
  title: string;
  body: string;
  url: string;
  level: OdakyuStatus["level"];
  section: string | null;
  reason: string | null;
  observedAt: string;
}

export function buildNotificationPayload(status: OdakyuStatus): NotificationPayload {
  const levelLabel = status.level === "suspended" ? "運転見合わせ" : "遅延";
  const title = `【小田急線】${levelLabel}が発生しています`;
  const bodyParts = [
    status.section ? `区間: ${status.section}` : null,
    status.reason ? `理由: ${status.reason}` : null,
  ].filter(Boolean);

  return {
    title,
    body: bodyParts.length > 0 ? bodyParts.join(" / ") : "詳細はアプリでご確認ください。",
    url: `/?from=push&at=${encodeURIComponent(status.observedAt)}`,
    level: status.level,
    section: status.section,
    reason: status.reason,
    observedAt: status.observedAt,
  };
}

/** 全購読者に通知を送信し、無効になった購読（410/404）はストアから削除する。 */
export async function sendPushToAll(
  subscriptions: StoredPushSubscription[],
  payload: NotificationPayload
): Promise<{ sent: number; removed: number }> {
  ensureConfigured();

  const staleEndpoints: string[] = [];
  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        JSON.stringify(payload)
      )
    )
  );

  results.forEach((result, i) => {
    if (result.status === "rejected") {
      const statusCode = (result.reason as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        staleEndpoints.push(subscriptions[i].endpoint);
      }
    }
  });

  if (staleEndpoints.length > 0) {
    await removeSubscriptions(staleEndpoints);
  }

  const sent = results.filter((r) => r.status === "fulfilled").length;
  return { sent, removed: staleEndpoints.length };
}
