import styles from "./EventCard.module.css";
import { Link } from "react-router-dom";

export default function EventCard({ event }) {
      function getWeekday(date) {
        if (!date) return "";

        const d = new Date(date);
        return d
          .toLocaleDateString("en-US", { weekday: "short" })
          .replace(".", "")
          .replace(/^./, c => c.toUpperCase());
      }
    const location =
    event.venue_name && event.city
      ? `${event.venue_name}, ${event.city}`
      : event.city || event.venue_name || "";

  const weekday = getWeekday(event.event_date);

  const dateTime =
  weekday && event.date_label && event.time_label
    ? `${weekday} • ${event.date_label} • ${event.time_label}`
    : event.date_label || "";


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
        <div className={styles.topLine}>
          {event.category && (
            <div className={styles.category}>
              {event.category}
            </div>
          )}

          {event.is_paid && event.price ? (
            <div className={styles.price}>
              ${event.price}
            </div>
          ) : (
            <div className={styles.price}>
              Free
            </div>
          )}
        </div>

        <h3 className={styles.title}>{event.title}</h3>

        <div className={styles.datetime}>
        <strong className={styles.weekday}>{weekday}</strong>
        <span className={styles.date}>• {event.date_label}</span>
        <span className={styles.time}>• {event.time_label}</span>
      </div>



        {/* LOCAL */}
        {location && (
          <div className={styles.location}>
            {location}
          </div>
        )}
      </div>
    </Link>
  );
}
