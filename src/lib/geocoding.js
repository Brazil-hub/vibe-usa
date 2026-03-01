const BASE = "https://nominatim.openstreetmap.org";
const HEADERS = {
  "User-Agent": "MissionSidewalk/1.0 (contact@missionsidewalk.com)",
  "Accept-Language": "en",
};

/**
 * Forward geocode: address string → { lat, lng, display_name }
 * Returns null if no result found.
 * Nominatim rate limit: 1 req/sec — callers must debounce.
 */
export async function geocodeAddress(query) {
  if (!query || query.trim().length < 4) return null;

  const url = new URL(`${BASE}/search`);
  url.searchParams.set("q", query.trim());
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");

  try {
    const res = await fetch(url.toString(), { headers: HEADERS });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.length) return null;
    const first = data[0];
    return {
      lat: parseFloat(first.lat),
      lng: parseFloat(first.lon),
      display_name: first.display_name,
    };
  } catch {
    return null;
  }
}

/**
 * Place search: query string → array of { lat, lng, display_name, short_name }
 * Returns up to `limit` results. Callers must debounce (Nominatim rate limit).
 */
export async function searchPlaces(query, limit = 5) {
  if (!query || query.trim().length < 3) return [];

  const url = new URL(`${BASE}/search`);
  url.searchParams.set("q", query.trim());
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", String(limit));

  try {
    const res = await fetch(url.toString(), { headers: HEADERS });
    if (!res.ok) return [];
    const data = await res.json();
    return data.map((item) => ({
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      display_name: item.display_name,
      short_name: item.name || item.display_name.split(",")[0].trim(),
    }));
  } catch {
    return [];
  }
}

/**
 * Reverse geocode: { lat, lng } → address string
 * Returns null on failure.
 */
export async function reverseGeocode(lat, lng) {
  const url = new URL(`${BASE}/reverse`);
  url.searchParams.set("lat", lat);
  url.searchParams.set("lon", lng);
  url.searchParams.set("format", "jsonv2");

  try {
    const res = await fetch(url.toString(), { headers: HEADERS });
    if (!res.ok) return null;
    const data = await res.json();
    return data.display_name || null;
  } catch {
    return null;
  }
}
