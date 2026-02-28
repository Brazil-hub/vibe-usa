const BASE = "https://nominatim.openstreetmap.org";
const HEADERS = {
  "User-Agent": "VibeCultural/1.0 (contact@vibecultural.com)",
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
