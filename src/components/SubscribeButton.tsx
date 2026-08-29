"use client";

import { useEffect, useState } from "react";
import {
  getExistingSubscription,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/pushClient";

export function SubscribeButton() {
  const [supported, setSupported] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isPushSupported()) {
      setSupported(false);
      return;
    }
    getExistingSubscription()
      .then((sub) => setSubscribed(Boolean(sub)))
      .catch(() => undefined);
  }, []);

  async function handleSubscribe() {
    setBusy(true);
    setError(null);
    try {
      await subscribeToPush();
      setSubscribed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "通知の登録に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  async function handleUnsubscribe() {
    setBusy(true);
    setError(null);
    try {
      await unsubscribeFromPush();
      setSubscribed(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "解除に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  if (!supported) {
    return (
      <div className="card">
        <h2>プッシュ通知</h2>
        <p>このブラウザはプッシュ通知に対応していません。Android版Chromeなどでホーム画面に追加してご利用ください。</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>プッシュ通知 {subscribed && <span className="pill">登録済み</span>}</h2>
      <p>
        遅延・運転見合わせを検知すると、この端末に通知します。通知をタップすると詳細画面が開きます。
      </p>
      {subscribed ? (
        <button className="button button--danger" onClick={handleUnsubscribe} disabled={busy}>
          通知をオフにする
        </button>
      ) : (
        <button className="button button--primary" onClick={handleSubscribe} disabled={busy}>
          通知をオンにする
        </button>
      )}
      {error && <p style={{ color: "var(--status-suspended)", marginTop: 10 }}>{error}</p>}
    </div>
  );
}
