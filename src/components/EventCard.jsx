import styles from "./EventCard.module.css";
import { Link } from "react-router-dom";

/* ── Distance helpers ─────────────────────────────────────────────────── */
function haversineMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8; // Earth radius in miles
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

function formatMiles(miles) {
  if (miles < 0.1) return "nearby";
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

/* ── Venue label helper ───────────────────────────────────────────────── */
/**
 * Extracts a short, readable venue label from a full Nominatim display_name.
 * "Horsies Market, 19th Street, Mission District, San Francisco, ..." → "Horsies Market, Mission District"
 */
function shortVenueLabel(fullName) {
  if (!fullName) return "";
  const parts = fullName.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length <= 2) return parts.join(", ");
  // parts[0] = venue/street, parts[1] = street/area, parts[2] = neighbourhood
  // Skip the raw street segment (often just "19th Street") to get the neighbourhood
  return `${parts[0]}, ${parts[2]}`;
}

/* ── Component ────────────────────────────────────────────────────────── */
export default function EventCard({ event, userCoords }) {
  function getWeekday(date) {
    if (!date) return "";
    const d = new Date(date);
    return d
      .toLocaleDateString("en-US", { weekday: "short" })
      .replace(".", "")
      .replace(/^./, (c) => c.toUpperCase());
  }

  const weekday = getWeekday(event.event_date);

  const dateTime =
    weekday && event.date_label && event.time_label
      ? `${weekday} • ${event.date_label} • ${event.time_label}`
      : event.date_label || "";

  /* Short venue label — avoids the full Nominatim address */
  const venueLabel = shortVenueLabel(event.venue_name || event.city || "");

  /* Distance from user (requires both user coords and event lat/lng) */
  const distanceText = (() => {
    if (!userCoords) return null;
    if (event.lat == null || event.lng == null) return null;
    const miles = haversineMiles(
      userCoords.lat, userCoords.lng,
      event.lat,      event.lng
    );
    return formatMiles(miles);
  })();

  return (
    <Link to={`/event/${event.id}`} className={styles.card}>
      <div className={styles.imageWrap}>
        {event.image_url ? (
          <img
            src={event.image_url}
            alt={event.title}
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : null}
      </div>

      <div className={styles.body}>
        {/* Top row: category + price */}
        <div className={styles.topLine}>
          {event.category && (
            <div className={styles.category}>{event.category}</div>
          )}
          {event.is_paid && event.price ? (
            <div className={styles.price}>${event.price}</div>
          ) : (
            <div className={styles.price}>Free</div>
          )}
        </div>

        {/* Title */}
        <h3 className={styles.title}>{event.title}</h3>

        {/* Date + time */}
        <div className={styles.datetime}>
          <strong className={styles.weekday}>{weekday}</strong>
          <span className={styles.date}>• {event.date_label}</span>
          <span className={styles.time}>• {event.time_label}</span>
        </div>

        {/* Footer: venue name (short) + distance */}
        {(venueLabel || distanceText) && (
          <div className={styles.footer}>
            {venueLabel && (
              <span className={styles.venueText}>📍 {venueLabel}</span>
            )}
            {distanceText && (
              <span className={styles.distanceBadge}>{distanceText}</span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
