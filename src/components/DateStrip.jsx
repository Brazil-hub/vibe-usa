// src/components/DateStrip.jsx
import { useRef } from "react";
import styles from "./DateStrip.module.css";

/**
 * Horizontal scrollable day-strip.
 * Days that have at least one event show a pink dot.
 * Clicking a day sets it as the date filter; clicking again clears it.
 */
export default function DateStrip({ events, selectedDate, onSelect }) {
  const scrollRef = useRef(null);

  // Build a Set of "YYYY-M-D" keys for days that have events
  const eventDays = new Set();
  events.forEach((ev) => {
    if (!ev.event_date) return;
    const d = new Date(ev.event_date);
    eventDays.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
  });

  // Generate the next 21 days starting from today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 21 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });

  function isSameDay(a, b) {
    if (!a || !b) return false;
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  return (
    <div className={styles.strip} ref={scrollRef}>
      {days.map((day, i) => {
        const dayKey = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
        const hasEvents = eventDays.has(dayKey);
        const isToday = i === 0;
        const isSelected = isSameDay(day, selectedDate);
        const label = isToday
          ? "Today"
          : day.toLocaleDateString("en-US", { weekday: "short" });

        return (
          <button
            key={dayKey}
            className={[
              styles.dayBtn,
              isSelected ? styles.selected : "",
              isToday && !isSelected ? styles.isToday : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => onSelect(isSelected ? null : day)}
          >
            <span className={styles.label}>{label}</span>
            <span className={styles.num}>{day.getDate()}</span>
            <span
              className={[styles.dot, hasEvents ? styles.dotOn : ""]
                .filter(Boolean)
                .join(" ")}
            />
          </button>
        );
      })}
    </div>
  );
}
