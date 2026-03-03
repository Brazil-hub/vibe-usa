import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { usePublicEvents } from "../hooks/useSupabaseQuery";
import EventCard from "../components/EventCard";
import EventsMapView from "../components/EventsMapView";
import styles from "./HomePage.module.css";
import PublicTopBar from "../components/PublicTopBar";
import { useAuth } from "../auth/useAuth";
import OnboardingCard from "../components/OnboardingCard";

const PAGE_SIZE = 6;

const CATEGORY_LABELS = {
  all: "All",
  party: "Party",
  show: "Show",
  birthday: "Birthday",
  class: "Classes",
  workshop: "Workshop",
  sport: "Sports",
  art: "Art",
  culture: "Culture",
  teather: "Theater",
};

function normalizeEvent(ev) {
  let date_label = "";
  let time_label = "";
  let weekday_label = "";

  if (ev.event_date) {
    const d = new Date(ev.event_date);

    weekday_label = d
      .toLocaleDateString("en-US", { weekday: "short" })
      .replace(".", "")
      .replace(/^./, (c) => c.toUpperCase());

    date_label = d
      .toLocaleDateString("en-US", { day: "2-digit", month: "short" })
      .replace(".", "");

    time_label = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  }

  return {
    ...ev,
    weekday_label,
    date_label,
    time_label,
    venue_name: ev.location || "",
    city: ev.city || "",
    category: CATEGORY_LABELS[ev.category] || ev.category,
  };
}

function isEventStillVisible(ev) {
  if (!ev.event_date) return false;
  const eventDate = new Date(ev.event_date);
  const eventMidnight = new Date(
    eventDate.getFullYear(),
    eventDate.getMonth(),
    eventDate.getDate(),
    0, 0, 0, 0
  );
  const expiresAt = new Date(eventMidnight.getTime() + 25 * 60 * 60 * 1000);
  return expiresAt > new Date();
}

export default function HomePage() {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortMode, setSortMode] = useState("upcoming");
  const [viewMode, setViewMode] = useState("list");
  const [userCoords, setUserCoords] = useState(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const loadMoreRef = useRef(null);

  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: events = [], isLoading: loading } = usePublicEvents();

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setUserCoords({ lat: coords.latitude, lng: coords.longitude }),
      () => {}
    );
  }, []);

  const filteredEvents =
    selectedCategory === "all"
      ? events.filter(isEventStillVisible)
      : events.filter(
          (ev) =>
            String(ev.category || "").trim().toLowerCase() ===
              String(selectedCategory).trim().toLowerCase() &&
            isEventStillVisible(ev)
        );

  const sortedEvents =
    sortMode === "recent"
      ? [...filteredEvents].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      : filteredEvents;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [selectedCategory, sortMode]);

  const visibleEvents = sortedEvents.slice(0, visibleCount);

  useEffect(() => {
    if (!loadMoreRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setVisibleCount((prev) => prev + PAGE_SIZE);
      },
      { root: null, rootMargin: "200px", threshold: 0 }
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [sortedEvents]);

  return (
    <div className={styles.container}>
      {!user && <PublicTopBar />}

      <div className={styles.contentWrapper}>
        {!user && (
          <div className={styles.onboardingSlot}>
            <OnboardingCard />
          </div>
        )}

        {loading && <p className={styles.info}>✨ Loading your vibe... ✨</p>}

        {!loading && events.length === 0 && (
          <p className={styles.info}>No events found.</p>
        )}

        {!loading && events.length > 0 && (
          <>
            <div className={styles.categoryFilter}>
              <button onClick={() => setSelectedCategory("all")}>All</button>
              <button onClick={() => setSelectedCategory("party")}>Party</button>
              <button onClick={() => setSelectedCategory("show")}>Show</button>
              <button onClick={() => setSelectedCategory("birthday")}>Birthday</button>
              <button onClick={() => setSelectedCategory("class")}>Classes</button>
              <button onClick={() => setSelectedCategory("workshop")}>Workshop</button>
              <button onClick={() => setSelectedCategory("sport")}>Sports</button>
              <button onClick={() => setSelectedCategory("art")}>Art</button>
              <button onClick={() => setSelectedCategory("culture")}>Culture</button>
              <button onClick={() => setSelectedCategory("teather")}>Theater</button>
            </div>

            <div className={styles.controlsRow}>
              <div className={styles.sortToggle}>
                <button
                  className={sortMode === "upcoming" ? styles.sortBtnActive : styles.sortBtn}
                  onClick={() => setSortMode("upcoming")}
                >
                  📅 Upcoming
                </button>
                <button
                  className={sortMode === "recent" ? styles.sortBtnActive : styles.sortBtn}
                  onClick={() => setSortMode("recent")}
                >
                  🆕 New
                </button>
              </div>

              <div className={styles.viewToggle}>
                <button
                  className={viewMode === "list" ? styles.viewBtnActive : styles.viewBtn}
                  onClick={() => setViewMode("list")}
                  title="List view"
                >
                  ☰
                </button>
                <button
                  className={viewMode === "map" ? styles.viewBtnActive : styles.viewBtn}
                  onClick={() => setViewMode("map")}
                  title="Map view"
                >
                  🗺
                </button>
              </div>
            </div>
          </>
        )}

        {!loading && viewMode === "map" && (
          <EventsMapView
            events={events.filter((ev) => isEventStillVisible(ev) && !ev.is_private).map(normalizeEvent)}
          />
        )}

        {viewMode === "list" && (
          <div className={styles.list}>
            {visibleEvents.map((ev, index) => (
              <div
                key={ev.id}
                className={styles.cardWrapper}
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <EventCard event={normalizeEvent(ev)} userCoords={userCoords} />
              </div>
            ))}
          </div>
        )}

        {viewMode === "list" && visibleCount < sortedEvents.length && (
          <div ref={loadMoreRef} className={styles.loadMore} />
        )}
      </div>
    </div>
  );
}
