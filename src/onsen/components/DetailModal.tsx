import { useEffect, type ReactNode } from "react";
import type { HotSpringResult } from "../App";
import { formatDistance, temperatureClass } from "../geo";

type Props = {
  spring: HotSpringResult;
  onClose: () => void;
};

export default function DetailModal({ spring: s, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}`;

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/40 backdrop-blur-sm md:items-center md:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-title"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] w-full overflow-y-auto rounded-t-2xl bg-yu-50 shadow-2xl md:max-w-lg md:rounded-2xl"
      >
        <div className="relative bg-gradient-to-br from-yu-600 to-yu-500 px-5 pb-5 pt-6 text-white">
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="absolute right-3 top-3 grid size-8 place-items-center rounded-full bg-white/20 text-lg hover:bg-white/35"
          >
            ×
          </button>
          <p className="text-xs opacity-90">
            {s.prefecture}
            {s.distance !== undefined && <> ・ 現在地から {formatDistance(s.distance)}</>}
          </p>
          <h2 id="detail-title" className="mt-1 text-2xl font-bold">
            {s.name}
          </h2>
          <p className="mt-0.5 text-sm opacity-95">{s.facility}</p>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white p-3 shadow-sm">
              <p className="text-[11px] text-stone-500">源泉温度</p>
              <p className="text-2xl font-bold text-yu-700">
                {s.temperature.toFixed(1)}
                <span className="text-sm font-normal">℃</span>
              </p>
              <p className="text-[11px] text-stone-500">{temperatureClass(s.temperature)}</p>
            </div>
            <div className="rounded-xl bg-white p-3 shadow-sm">
              <p className="text-[11px] text-stone-500">pH値</p>
              <p className="text-2xl font-bold text-yu-700">{s.ph?.toFixed(1) ?? "—"}</p>
              {s.ph !== undefined && (
                <p className="text-[11px] text-stone-500">
                  {s.ph < 3 ? "酸性" : s.ph < 6 ? "弱酸性" : s.ph < 7.5 ? "中性" : s.ph < 8.5 ? "弱アルカリ性" : "アルカリ性"}
                </p>
              )}
            </div>
          </div>

          <Section title="泉質">
            <p className="font-semibold text-sumi">{s.springQuality}</p>
          </Section>

          <Section title="主な効能">
            <div className="flex flex-wrap gap-1.5">
              {s.benefits.map((b) => (
                <span key={b} className="rounded-full bg-yu-100 px-2.5 py-1 text-xs text-yu-900">
                  {b}
                </span>
              ))}
            </div>
          </Section>

          <Section title="特徴">
            <p className="text-sm leading-relaxed text-stone-700">{s.features}</p>
          </Section>

          <Section title="所在地・アクセス">
            <dl className="space-y-1.5 text-sm text-stone-700">
              <div className="flex gap-2">
                <dt className="w-12 shrink-0 text-stone-500">住所</dt>
                <dd>{s.address}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-12 shrink-0 text-stone-500">交通</dt>
                <dd>{s.access}</dd>
              </div>
            </dl>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block rounded-full bg-yu-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-yu-700"
            >
              Googleマップで開く ↗
            </a>
          </Section>

          <p className="text-[11px] leading-relaxed text-stone-400">
            ※ 掲載内容は代表的な源泉の目安です。最新の泉質・営業情報は各施設の公式情報をご確認ください。
          </p>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl bg-white p-4 shadow-sm">
      <h3 className="mb-2 border-l-4 border-yu-500 pl-2 text-xs font-bold tracking-wider text-yu-700">{title}</h3>
      {children}
    </section>
  );
}
