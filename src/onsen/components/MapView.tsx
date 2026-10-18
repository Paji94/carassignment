import { useEffect, useRef, type MutableRefObject } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import type { HotSpringResult } from "../App";
import { formatDistance, type LatLng } from "../geo";

type Props = {
  springs: HotSpringResult[];
  userLocation: LatLng | null;
  activeId: string | null;
  onSelect: (id: string) => void;
  onOpenDetail: (id: string) => void;
};

const JAPAN_CENTER: L.LatLngTuple = [36.5, 137.5];

const pinIcon = (active: boolean) =>
  L.divIcon({
    className: "",
    html: `<div class="onsen-pin${active ? " is-active" : ""}"><span>♨</span></div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -34],
  });

const ICON = pinIcon(false);
const ACTIVE_ICON = pinIcon(true);

const USER_ICON = L.divIcon({
  className: "",
  html: `<div class="user-pin"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

/** 検索結果・現在地・選択状態の変化に合わせて表示範囲を動かす */
function MapController({
  springs,
  userLocation,
  activeId,
  markers,
}: {
  springs: HotSpringResult[];
  userLocation: LatLng | null;
  activeId: string | null;
  markers: MutableRefObject<Map<string, L.Marker>>;
}) {
  const map = useMap();
  const resultKey = springs.map((s) => s.id).join(",");

  useEffect(() => {
    const points: L.LatLngTuple[] = userLocation
      ? // 現在地がある場合は、現在地と最寄りの3件が収まるように
        [[userLocation.lat, userLocation.lng], ...springs.slice(0, 3).map((s) => [s.lat, s.lng] as L.LatLngTuple)]
      : springs.map((s) => [s.lat, s.lng]);

    if (points.length === 0) return;
    if (points.length === 1) {
      map.flyTo(points[0], 12, { duration: 0.8 });
    } else {
      map.flyToBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 12, duration: 0.8 });
    }
    // springs の中身は resultKey で追跡している
  }, [map, resultKey, userLocation]);

  useEffect(() => {
    if (!activeId) return;
    const marker = markers.current.get(activeId);
    if (!marker) return;
    map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 11), { duration: 0.8 });
    marker.openPopup();
  }, [map, activeId, markers]);

  return null;
}

export default function MapView({ springs, userLocation, activeId, onSelect, onOpenDetail }: Props) {
  const markers = useRef(new Map<string, L.Marker>());

  return (
    <MapContainer center={JAPAN_CENTER} zoom={5} className="h-full w-full" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapController springs={springs} userLocation={userLocation} activeId={activeId} markers={markers} />

      {userLocation && (
        <Marker position={[userLocation.lat, userLocation.lng]} icon={USER_ICON} zIndexOffset={1000}>
          <Popup>現在地</Popup>
        </Marker>
      )}

      {springs.map((s) => (
        <Marker
          key={s.id}
          position={[s.lat, s.lng]}
          icon={s.id === activeId ? ACTIVE_ICON : ICON}
          zIndexOffset={s.id === activeId ? 500 : 0}
          eventHandlers={{ click: () => onSelect(s.id) }}
          ref={(m) => {
            if (m) markers.current.set(s.id, m);
            else markers.current.delete(s.id);
          }}
        >
          <Popup>
            <div className="w-56 space-y-1.5">
              <p className="text-xs text-yu-600">{s.prefecture}</p>
              <p className="text-base font-bold leading-tight text-sumi">{s.name}</p>
              <p className="text-xs text-stone-500">{s.facility}</p>
              <p className="text-xs leading-snug text-stone-700">
                <span className="font-semibold">泉質：</span>
                {s.springQuality}
              </p>
              <p className="text-xs text-stone-700">
                <span className="font-semibold">源泉温度：</span>
                {s.temperature.toFixed(1)}℃
                {s.distance !== undefined && (
                  <span className="ml-2 text-blue-700">現在地から {formatDistance(s.distance)}</span>
                )}
              </p>
              <button
                type="button"
                onClick={() => onOpenDetail(s.id)}
                className="mt-1 w-full rounded-md bg-yu-600 py-1.5 text-xs font-semibold text-white hover:bg-yu-700"
              >
                詳細を見る
              </button>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
