"use client";

import { useEffect, useState } from "react";
import { LineHeader } from "@/components/LineHeader";
import { StatusCard } from "@/components/StatusCard";
import { SubscribeButton } from "@/components/SubscribeButton";
import { playThreeSecondChime } from "@/lib/chime";
import type { OdakyuStatus } from "@/lib/odakyuStatus";

interface StatusResponse {
  currentStatus: OdakyuStatus | null;
  lastCheckedAt: string | null;
}

const POLL_INTERVAL_MS = 30_000;

export default function HomePage() {
  const [data, setData] = useState<StatusResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/status", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as StatusResponse;
        if (!cancelled) setData(json);
      } catch {
        // ネットワークエラーは静かに無視し、次のポーリングで再試行する
      }
    }

    load();
    const timer = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("from") === "push") {
      playThreeSecondChime();
      params.delete("from");
      params.delete("at");
      const rest = params.toString();
      const newUrl = window.location.pathname + (rest ? `?${rest}` : "");
      window.history.replaceState({}, "", newUrl);
    }
  }, []);

  return (
    <div className="page">
      <LineHeader />
      <main className="content">
        <StatusCard status={data?.currentStatus ?? null} lastCheckedAt={data?.lastCheckedAt ?? null} />
        <SubscribeButton />
        <div className="card">
          <h2>監視について</h2>
          <p>
            始発から終電までの間、小田急線の運行情報を5分おきに自動でチェックします。「遅延」または「運転見合わせ」を検知した場合のみプッシュ通知でお知らせし、平常運転の間は通知しません。
          </p>
        </div>
      </main>
      <p className="footer-note">Train Watch &mdash; 小田急線非公式運行監視アプリ</p>
    </div>
  );
}
