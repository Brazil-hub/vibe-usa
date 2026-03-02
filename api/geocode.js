// Vercel serverless proxy for Nominatim geocoding.
// Forwards ?q= and ?lat/lon= to Nominatim with proper server-side headers,
// bypassing the browser's restriction on setting User-Agent.

const BASE    = "https://nominatim.openstreetmap.org";
const UA      = "MissionSidewalk/1.0 (contact@missionsidewalk.com)";
const SF_BOX  = "-122.5173,37.7073,-122.3580,37.8338"; // SF bounding box (W,S,E,N)

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { q, lat, lon, mode = "search" } = req.query;

  let upstream;

  if (mode === "reverse" && lat && lon) {
    const url = new URL(`${BASE}/reverse`);
    url.searchParams.set("lat", lat);
    url.searchParams.set("lon", lon);
    url.searchParams.set("format", "jsonv2");
    upstream = url.toString();

  } else if (q) {
    const url = new URL(`${BASE}/search`);
    url.searchParams.set("q", q.trim());
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "5");
    url.searchParams.set("countrycodes", "us");       // USA only
    url.searchParams.set("viewbox", SF_BOX);          // bias toward SF
    url.searchParams.set("bounded", "0");             // bias, not hard limit
    upstream = url.toString();

  } else {
    return res.status(400).json({ error: "Missing q or lat/lon" });
  }

  try {
    const nomRes = await fetch(upstream, {
      headers: {
        "User-Agent":      UA,
        "Accept-Language": "en",
        "Referer":         "https://www.missionsidewalk.com",
      },
    });

    if (!nomRes.ok) {
      return res.status(nomRes.status).json({ error: "Nominatim error" });
    }

    const data = await nomRes.json();
    // Cache for 1 hour — geocoded addresses rarely change
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    return res.status(200).json(data);

  } catch (err) {
    console.error("geocode proxy error:", err);
    return res.status(500).json({ error: String(err) });
  }
}
