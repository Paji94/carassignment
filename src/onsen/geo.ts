export type LatLng = { lat: number; lng: number };

/** 2点間の距離（km）をハバーサイン公式で求める */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(km < 10 ? 1 : 0)}km`;
}

/** 源泉温度による分類（温泉法・鉱泉分析法指針の区分） */
export function temperatureClass(t: number): string {
  if (t < 25) return "冷鉱泉";
  if (t < 34) return "低温泉";
  if (t < 42) return "温泉";
  return "高温泉";
}
