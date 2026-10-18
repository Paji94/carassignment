import type { GeoStatus } from "../App";

type Props = {
  query: string;
  onQueryChange: (value: string) => void;
  onLocate: () => void;
  onClearLocation: () => void;
  geoStatus: GeoStatus;
  hasLocation: boolean;
};

const SUGGESTIONS = ["箱根", "草津", "別府", "有馬", "東京", "硫黄", "美肌"];

export default function Header({
  query,
  onQueryChange,
  onLocate,
  onClearLocation,
  geoStatus,
  hasLocation,
}: Props) {
  const loading = geoStatus.state === "loading";

  return (
    <header className="z-10 border-b border-yu-200 bg-gradient-to-r from-yu-700 via-yu-600 to-yu-500 text-white shadow-md">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:gap-6">
        <h1 className="flex shrink-0 items-center gap-2 text-xl font-bold tracking-wide">
          <span className="text-2xl" aria-hidden>
            ♨
          </span>
          湯めぐりマップ
        </h1>

        <div className="flex flex-1 flex-col gap-2">
          <div className="flex gap-2">
            <label className="relative flex-1">
              <span className="sr-only">キーワード検索</span>
              <input
                type="search"
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder="地名・温泉名・泉質で検索（例：箱根、草津、東京）"
                className="w-full rounded-full border border-white/40 bg-white/95 py-2 pl-10 pr-4 text-sm text-sumi placeholder:text-stone-400 shadow-inner focus:outline-none focus:ring-2 focus:ring-yu-200"
              />
              <svg
                className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
            </label>

            <button
              type="button"
              onClick={hasLocation ? onClearLocation : onLocate}
              disabled={loading}
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-yu-700 shadow transition hover:bg-yu-100 disabled:cursor-wait disabled:opacity-70"
            >
              <svg
                className={`size-4 ${loading ? "animate-spin" : ""}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
              </svg>
              {loading ? "取得中…" : hasLocation ? "現在地を解除" : "現在地から探す"}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {SUGGESTIONS.map((word) => (
              <button
                key={word}
                type="button"
                onClick={() => onQueryChange(query === word ? "" : word)}
                className={`rounded-full px-2.5 py-0.5 transition ${
                  query === word
                    ? "bg-white text-yu-700"
                    : "bg-white/15 text-white hover:bg-white/30"
                }`}
              >
                {word}
              </button>
            ))}
            {geoStatus.state === "error" && (
              <span className="ml-1 rounded bg-red-50 px-2 py-0.5 text-red-700" role="alert">
                {geoStatus.message}
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
