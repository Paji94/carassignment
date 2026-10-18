import { useMemo, useState } from "react";
import { hotSprings, type HotSpring } from "../data/hotsprings";
import { distanceKm, type LatLng } from "./geo";
import Header from "./components/Header";
import MapView from "./components/MapView";
import HotSpringList from "./components/HotSpringList";
import DetailModal from "./components/DetailModal";

export type HotSpringResult = HotSpring & { distance?: number };

export type GeoStatus =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "success" }
  | { state: "error"; message: string };

function matches(spring: HotSpring, query: string): boolean {
  const haystack = [
    spring.name,
    spring.facility,
    spring.area,
    spring.prefecture,
    spring.address,
    spring.springQuality,
    ...spring.tags,
    ...spring.benefits,
  ].join(" ");
  return query
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

function geoErrorMessage(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "位置情報の利用が許可されていません。ブラウザの設定をご確認ください。";
    case error.POSITION_UNAVAILABLE:
      return "現在地を取得できませんでした。";
    case error.TIMEOUT:
      return "現在地の取得がタイムアウトしました。";
    default:
      return "現在地の取得に失敗しました。";
  }
}

export default function App() {
  const [query, setQuery] = useState("");
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>({ state: "idle" });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const results = useMemo<HotSpringResult[]>(() => {
    const filtered = hotSprings.filter((s) => matches(s, query.trim()));
    if (!userLocation) return filtered;
    return filtered
      .map((s) => ({ ...s, distance: distanceKm(userLocation, s) }))
      .sort((a, b) => a.distance - b.distance);
  }, [query, userLocation]);

  const detail = results.find((s) => s.id === detailId) ?? null;

  const locate = () => {
    if (!("geolocation" in navigator)) {
      setGeoStatus({ state: "error", message: "このブラウザは位置情報に対応していません。" });
      return;
    }
    setGeoStatus({ state: "loading" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoStatus({ state: "success" });
        setActiveId(null);
      },
      (err) => setGeoStatus({ state: "error", message: geoErrorMessage(err) }),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const clearLocation = () => {
    setUserLocation(null);
    setGeoStatus({ state: "idle" });
  };

  const openDetail = (id: string) => {
    setActiveId(id);
    setDetailId(id);
  };

  return (
    <div className="flex h-full flex-col">
      <Header
        query={query}
        onQueryChange={setQuery}
        onLocate={locate}
        onClearLocation={clearLocation}
        geoStatus={geoStatus}
        hasLocation={userLocation !== null}
      />

      <main className="flex min-h-0 flex-1 flex-col md:flex-row">
        <section className="relative h-[45vh] shrink-0 md:order-2 md:h-auto md:flex-1">
          <MapView
            springs={results}
            userLocation={userLocation}
            activeId={activeId}
            onSelect={setActiveId}
            onOpenDetail={openDetail}
          />
        </section>

        <aside className="min-h-0 flex-1 overflow-y-auto border-yu-200 md:order-1 md:w-96 md:flex-none md:border-r">
          <HotSpringList
            springs={results}
            activeId={activeId}
            hasLocation={userLocation !== null}
            onSelect={setActiveId}
            onOpenDetail={openDetail}
          />
        </aside>
      </main>

      {detail && <DetailModal spring={detail} onClose={() => setDetailId(null)} />}
    </div>
  );
}
