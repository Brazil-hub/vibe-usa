import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Tooltip } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { geocodeAddress } from "../lib/geocoding";
import styles from "./EventsMapView.module.css";

// Pink marker pin — SVG DivIcon, no PNG/Vite issues
const PINK_MARKER = L.divIcon({
  className: "",
  html: `<svg width="28" height="36" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 0C7.163 0 0 7.163 0 16c0 10.5 16 24 16 24S32 26.5 32 16C32 7.163 24.837 0 16 0z" fill="#ff3f8e" stroke="white" stroke-width="2"/>
    <circle cx="16" cy="16" r="5.5" fill="white"/>
  </svg>`,
  iconSize: [28, 36],
  iconAnchor: [14, 36],
  tooltipAnchor: [0, -38],
});

const GEO_CACHE_KEY = "vg_geo_cache";

function readCache() {
  try { return JSON.parse(sessionStorage.getItem(GEO_CACHE_KEY) || "{}"); }
  catch { return {}; }
}
function writeCache(cache) {
  try { sessionStorage.setItem(GEO_CACHE_KEY, JSON.stringify(cache)); }
  catch {}
}

const DEFAULT_CENTER = [37.7599, -122.4148]; // Mission District, San Francisco
const DEFAULT_ZOOM   = 13;

/**
 * Build the best possible Nominatim query from an event.
 * After normalizeEvent(), the address lives in venue_name (= ev.location).
 * Falls back through all available address fields before using city context.
 */
/**
 * Returns [primaryQuery, fallbackQuery].
 *
 * The DB `location` field stores the full Nominatim display_name, e.g.:
 *   "El Rio, 3158, Mission Street, Bernal Heights, Mission District,
 *    San Francisco, California, 94143, United States"
 *
 * The first segment is the venue name — OSM may not index it (especially
 * small/new venues). Stripping it leaves the street address which OSM
 * reliably geocodes.
 *
 * primaryQuery  = address-only (first segment stripped when it's a venue name)
 * fallbackQuery = original full string (in case primary returns nothing)
 */
function buildGeoQueries(ev) {
  const place = (ev.venue_name || ev.location || "").trim();
  const city  = (ev.city && ev.city.trim()) ? ev.city.trim() : "San Francisco, CA";

  if (!place) return [city, null];

  const lower = place.toLowerCase();
  const isFullDisplayName =
    lower.includes("california") ||
    lower.includes("united states") ||
    lower.includes("san francisco");

  if (isFullDisplayName) {
    const parts    = place.split(",").map((s) => s.trim()).filter(Boolean);
    const firstNum = /^\d/.test(parts[0]); // starts with house number → already an address

    if (!firstNum && parts.length > 2) {
      // First segment is a venue name — strip it for the primary query
      const addressOnly = parts.slice(1).join(", ");
      return [addressOnly, place]; // try address first, fall back to full string
    }
    return [place, null]; // already starts with a number, use as-is
  }

  // Short name — append city
  return [`${place}, ${city}`, null];
}


export default function EventsMapView({ events }) {
  const [plotted,       setPlotted]       = useState([]);
  const [pendingCount,  setPendingCount]  = useState(0);
  const queueRef        = useRef([]);
  const processingRef   = useRef(false);
  const navigate        = useNavigate();

  useEffect(() => {
    const cache     = readCache();
    const immediate = [];
    const toGeocode = [];

    events.forEach((ev) => {
      // Events that already have coordinates stored in DB
      if (ev.lat != null && ev.lng != null) {
        immediate.push({ ...ev, resolvedLat: ev.lat, resolvedLng: ev.lng });
        return;
      }

      // Build geocoding queries; skip events with no usable location text
      const [query, fallback] = buildGeoQueries(ev);
      const cacheKey = query.toLowerCase().trim();

      if (!cacheKey || cacheKey.length < 3) return;

      if (cache[cacheKey]) {
        immediate.push({ ...ev, resolvedLat: cache[cacheKey].lat, resolvedLng: cache[cacheKey].lng });
      } else {
        toGeocode.push({ ev, query, fallback, cacheKey });
      }
    });

    setPlotted(immediate);
    setPendingCount(toGeocode.length);

    if (toGeocode.length === 0) return;
    queueRef.current = toGeocode;
    if (!processingRef.current) processQueue(cache);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  async function processQueue(cache) {
    processingRef.current = true;

    while (queueRef.current.length > 0) {
      const { ev, query, fallback, cacheKey } = queueRef.current.shift();
      try {
        // Try primary (address-only) query first
        let result = await geocodeAddress(query);

        // If no result and a fallback exists, wait 1s then try it
        if (!result && fallback) {
          await new Promise((r) => setTimeout(r, 1150));
          result = await geocodeAddress(fallback);
        }

        if (result) {
          cache[cacheKey] = { lat: result.lat, lng: result.lng };
          writeCache(cache);
          setPlotted((prev) => [
            ...prev,
            { ...ev, resolvedLat: result.lat, resolvedLng: result.lng },
          ]);
        }
      } catch { /* silent */ }

      setPendingCount(queueRef.current.length);

      // Nominatim rate limit: 1 req/sec
      if (queueRef.current.length > 0) {
        await new Promise((r) => setTimeout(r, 1150));
      }
    }

    processingRef.current = false;
  }

  // Center on average of all plotted events, fallback to Mission District
  const center =
    plotted.length > 0
      ? [
          plotted.reduce((s, e) => s + e.resolvedLat, 0) / plotted.length,
          plotted.reduce((s, e) => s + e.resolvedLng, 0) / plotted.length,
        ]
      : DEFAULT_CENTER;

  const zoom = plotted.length > 0 ? 13 : DEFAULT_ZOOM;

  return (
    <div className={styles.wrapper}>
      <MapContainer
        center={center}
        zoom={zoom}
        className={styles.map}
        scrollWheelZoom={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'
        />

        {plotted.map((ev) => (
          <Marker
            key={ev.id}
            position={[ev.resolvedLat, ev.resolvedLng]}
            icon={PINK_MARKER}
            eventHandlers={{
              click: () => navigate(`/event/${ev.id}`),
            }}
          >
            {/* Tooltip on hover — quick preview before navigating */}
            <Tooltip direction="top" offset={[0, -2]} opacity={1}>
              <div className={styles.tooltip}>
                <strong className={styles.tooltipTitle}>{ev.title}</strong>
                {(ev.weekday_label || ev.date_label) && (
                  <span className={styles.tooltipDate}>
                    {ev.weekday_label} {ev.date_label}
                    {ev.time_label ? ` · ${ev.time_label}` : ""}
                  </span>
                )}
                {(ev.venue_name || ev.city) && (
                  <span className={styles.tooltipLocation}>
                    {[ev.venue_name, ev.city].filter(Boolean).join(", ")}
                  </span>
                )}
                <span className={styles.tooltipCta}>Tap to view →</span>
              </div>
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>

      {/* Geocoding progress pill */}
      {pendingCount > 0 && (
        <div className={styles.geocodingPill}>
          <span className={styles.geocodingDot} />
          Locating {pendingCount} event{pendingCount !== 1 ? "s" : ""}…
        </div>
      )}

      {/* No events at all */}
      {events.length === 0 && (
        <div className={styles.empty}>No events to show on the map.</div>
      )}

      {/* Events exist but none could be located */}
      {events.length > 0 && plotted.length === 0 && pendingCount === 0 && (
        <div className={styles.empty}>
          No location data found for current events.
        </div>
      )}
    </div>
  );
}
