import type { OdakyuStatus } from "../lib/odakyuStatus";

const LEVEL_META: Record<OdakyuStatus["level"], { label: string; color: string; icon: string }> = {
  normal: { label: "平常運転", color: "var(--status-normal)", icon: "✓" },
  delay: { label: "遅延発生中", color: "var(--status-delay)", icon: "⚠" },
  suspended: { label: "運転見合わせ", color: "var(--status-suspended)", icon: "✕" },
};

function formatTime(iso: string | null): string {
  if (!iso) return "--:--";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    month: "numeric",
    day: "numeric",
  }).format(new Date(iso));
}

export function StatusCard({
  status,
  lastCheckedAt,
}: {
  status: OdakyuStatus | null;
  lastCheckedAt: string | null;
}) {
  const level = status?.level ?? "normal";
  const meta = LEVEL_META[level];

  return (
    <section
      className="status-card"
      style={{ ["--status-level-color" as string]: meta.color }}
    >
      <span className="status-card__badge">
        {meta.icon} {meta.label}
      </span>
      <p className="status-card__headline">
        {level === "normal" ? "小田急線は平常通り運転しています" : "小田急線に影響が発生しています"}
      </p>
      <p className="status-card__updated">最終確認: {formatTime(lastCheckedAt)}</p>

      {level !== "normal" && (
        <dl className="detail-list">
          <li>
            <dt>区間</dt>
            <dd>{status?.section ?? "情報を確認中です"}</dd>
          </li>
          <li>
            <dt>発生時刻</dt>
            <dd>{formatTime(status?.observedAt ?? null)}</dd>
          </li>
          <li>
            <dt>理由</dt>
            <dd>{status?.reason ?? "情報を確認中です"}</dd>
          </li>
        </dl>
      )}
    </section>
  );
}
