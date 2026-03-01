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

export default function EventsMapView({ events }) {
  const [plotted, setPlotted] = useState([]);
  const queueRef      = useRef([]);
  const processingRef = useRef(false);
  const navigate      = useNavigate();

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

      // Events without coords — check sessionStorage cache first
      const query = [ev.venue_name || ev.location, ev.city].filter(Boolean).join(", ");
      if (!query) return;

      const cacheKey = query.toLowerCase();
      if (cache[cacheKey]) {
        immediate.push({ ...ev, resolvedLat: cache[cacheKey].lat, resolvedLng: cache[cacheKey].lng });
      } else {
        toGeocode.push({ ev, query, cacheKey });
      }
    });

    setPlotted(immediate);

    if (toGeocode.length === 0) return;
    queueRef.current = toGeocode;
    if (!processingRef.current) processQueue(cache);
  }, [events]);

  async function processQueue(cache) {
    processingRef.current = true;

    while (queueRef.current.length > 0) {
      const { ev, query, cacheKey } = queueRef.current.shift();
      try {
        const result = await geocodeAddress(query);
        if (result) {
          cache[cacheKey] = { lat: result.lat, lng: result.lng };
          writeCache(cache);
          setPlotted((prev) => [
            ...prev,
            { ...ev, resolvedLat: result.lat, resolvedLng: result.lng },
          ]);
        }
      } catch { /* silent */ }

      // Respect Nominatim 1 req/sec rate limit
      if (queueRef.current.length > 0) {
        await new Promise((r) => setTimeout(r, 1150));
      }
    }

    processingRef.current = false;
  }

  // Center on average of all plotted events, or default to Mission District
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
            {/* Tooltip aparece no hover (desktop) — mostra resumo rápido */}
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
                    📍 {[ev.venue_name, ev.city].filter(Boolean).join(", ")}
                  </span>
                )}
                <span className={styles.tooltipCta}>Tap to view →</span>
              </div>
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>

      {plotted.length === 0 && events.length > 0 && (
        <div className={styles.empty}>Locating events on the map…</div>
      )}
      {events.length === 0 && (
        <div className={styles.empty}>No events to show on the map.</div>
      )}
    </div>
  );
}
