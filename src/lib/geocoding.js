// Direct Nominatim calls — Nominatim supports browser CORS.
// The User-Agent header is a "forbidden" browser header; Nominatim accepts
// the browser's default UA fine (it only requires *some* identification).

const BASE    = "https://nominatim.openstreetmap.org";
// Bias geocoding toward San Francisco (W, S, E, N bounding box)
const SF_BOX  = "-122.5173,37.7073,-122.3580,37.8338";

function nominatimHeaders() {
  // User-Agent is a forbidden header in browser fetch — silently ignored.
  // Nominatim accepts the browser UA; Referer gives it app identity instead.
  return {
    "Accept-Language": "en",
    "Accept": "application/json",
  };
}

/**
 * Forward geocode: address string → { lat, lng, display_name }
 * Returns null if no result found.
 * Nominatim rate limit: 1 req/sec — callers must enforce delay between calls.
 */
export async function geocodeAddress(query) {
  if (!query || query.trim().length < 4) return null;

  const url = new URL(`${BASE}/search`);
  url.searchParams.set("q",            query.trim());
  url.searchParams.set("format",       "jsonv2");
  url.searchParams.set("limit",        "1");
  url.searchParams.set("countrycodes", "us");
  url.searchParams.set("viewbox",      SF_BOX);
  url.searchParams.set("bounded",      "0"); // bias, not hard limit

  console.log("[geocode] searching:", query, url.toString());

  try {
    const res = await fetch(url.toString(), { headers: nominatimHeaders() });
    if (!res.ok) {
      console.warn("[geocode] HTTP error:", res.status, res.statusText);
      return null;
    }
    const data = await res.json();
    console.log("[geocode] results for", JSON.stringify(query), "→", data.length, "hits", data[0] ?? "none");
    if (!data.length) return null;
    const first = data[0];
    return {
      lat:          parseFloat(first.lat),
      lng:          parseFloat(first.lon),
      display_name: first.display_name,
    };
  } catch (err) {
    console.error("[geocode] fetch error:", err);
    return null;
  }
}

/**
 * Place search: query string → array of { lat, lng, display_name, short_name }
 * Returns up to `limit` results. Callers must debounce (1 req/sec).
 */
export async function searchPlaces(query, limit = 5) {
  if (!query || query.trim().length < 3) return [];

  const url = new URL(`${BASE}/search`);
  url.searchParams.set("q",            query.trim());
  url.searchParams.set("format",       "jsonv2");
  url.searchParams.set("limit",        String(limit));
  url.searchParams.set("countrycodes", "us");
  url.searchParams.set("viewbox",      SF_BOX);
  url.searchParams.set("bounded",      "0");

  try {
    const res = await fetch(url.toString(), { headers: nominatimHeaders() });
    if (!res.ok) return [];
    const data = await res.json();
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
  const url = new URL(`${BASE}/reverse`);
  url.searchParams.set("lat",    lat);
  url.searchParams.set("lon",    lng);
  url.searchParams.set("format", "jsonv2");

  try {
    const res = await fetch(url.toString(), { headers: nominatimHeaders() });
    if (!res.ok) return null;
    const data = await res.json();
    return data.display_name || null;
  } catch {
    return null;
  }
}
