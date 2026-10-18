import type { HotSpringResult } from "../App";
import { formatDistance } from "../geo";

type Props = {
  springs: HotSpringResult[];
  activeId: string | null;
  hasLocation: boolean;
  onSelect: (id: string) => void;
  onOpenDetail: (id: string) => void;
};

export default function HotSpringList({ springs, activeId, hasLocation, onSelect, onOpenDetail }: Props) {
  return (
    <div className="p-3">
      <p className="mb-2 px-1 text-xs text-stone-500">
        {hasLocation ? "現在地から近い順" : "検索結果"}：{springs.length}件
      </p>

      {springs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-yu-200 bg-white p-6 text-center text-sm text-stone-500">
          該当する温泉が見つかりませんでした。
          <br />
          別のキーワードでお試しください。
        </div>
      ) : (
        <ul className="space-y-2">
          {springs.map((s, i) => {
            const active = s.id === activeId;
            return (
              <li key={s.id}>
                <div
                  className={`group rounded-xl border bg-white p-3 shadow-sm transition hover:shadow-md ${
                    active ? "border-yu-500 ring-2 ring-yu-200" : "border-yu-100"
                  }`}
                >
                  <button type="button" onClick={() => onSelect(s.id)} className="block w-full text-left">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium text-yu-600">{s.prefecture}</p>
                        <h2 className="truncate font-bold text-sumi">{s.name}</h2>
                        <p className="truncate text-xs text-stone-500">{s.facility}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-lg font-bold leading-none text-yu-700">
                          {s.temperature.toFixed(1)}
                          <span className="text-xs font-normal">℃</span>
                        </p>
                        {s.distance !== undefined && (
                          <p
                            className={`mt-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              i === 0 ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-700"
                            }`}
                          >
                            {i === 0 && "最寄り "}
                            {formatDistance(s.distance)}
                          </p>
                        )}
                      </div>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-stone-600">{s.springQuality}</p>
                  </button>
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    {s.benefits.slice(0, 3).map((b) => (
                      <span key={b} className="rounded-full bg-yu-50 px-2 py-0.5 text-[11px] text-yu-700">
                        {b}
                      </span>
                    ))}
                    <button
                      type="button"
                      onClick={() => onOpenDetail(s.id)}
                      className="ml-auto rounded-full px-2.5 py-1 text-xs font-semibold text-yu-600 hover:bg-yu-50"
                    >
                      詳細 ›
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
