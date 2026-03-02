// All Nominatim calls are proxied through /api/geocode (Vercel serverless)
// so the server can set a proper User-Agent header — browsers forbid it in fetch().

const PROXY = "/api/geocode";

/**
 * Forward geocode: address string → { lat, lng, display_name }
 * Returns null if no result found.
 */
export async function geocodeAddress(query) {
  if (!query || query.trim().length < 4) return null;

  try {
    const url = new URL(PROXY, window.location.origin);
    url.searchParams.set("q", query.trim());
    url.searchParams.set("limit", "1");

    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const first = data[0];
    return {
      lat:          parseFloat(first.lat),
      lng:          parseFloat(first.lon),
      display_name: first.display_name,
    };
  } catch {
    return null;
  }
}

/**
 * Place search: query string → array of { lat, lng, display_name, short_name }
 * Returns up to 5 suggestions. Callers should debounce (Nominatim: 1 req/sec).
 */
export async function searchPlaces(query, limit = 5) {
  if (!query || query.trim().length < 3) return [];

  try {
    const url = new URL(PROXY, window.location.origin);
    url.searchParams.set("q", query.trim());
    url.searchParams.set("limit", String(limit));

    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    return data.map((item) => ({
      lat:          parseFloat(item.lat),
      lng:          parseFloat(item.lon),
      display_name: item.display_name,
      short_name:   item.name || item.display_name.split(",")[0].trim(),
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
  try {
    const url = new URL(PROXY, window.location.origin);
    url.searchParams.set("mode", "reverse");
    url.searchParams.set("lat", lat);
    url.searchParams.set("lon", lng);

    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = await res.json();
    return data.display_name || null;
  } catch {
    return null;
  }
}
