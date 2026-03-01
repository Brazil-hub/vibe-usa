import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { listPublicEvents } from "../supabase/events";
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


/* 🔽 ADIÇÃO NECESSÁRIA — NORMALIZA DATA, HORA E LOCAL */
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
      .toLocaleDateString("en-US", {
        day: "2-digit",
        month: "short",
      })
      .replace(".", "");

    time_label = d
      .toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      })
;
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

/**
 * Evento permanece visível até 1h da manhã do DIA SEGUINTE ao evento.
 * Ex: evento na Sexta 22h → some do feed no Sábado às 01h00.
 */
function isEventStillVisible(ev) {
  if (!ev.event_date) return false;
  const eventDate = new Date(ev.event_date);
  // Meia-noite do dia do evento (horário local do browser)
  const eventMidnight = new Date(
    eventDate.getFullYear(),
    eventDate.getMonth(),
    eventDate.getDate(),
    0, 0, 0, 0
  );
  // Expira às 01h do dia seguinte = meia-noite + 25 horas
  const expiresAt = new Date(eventMidnight.getTime() + 25 * 60 * 60 * 1000);
  return expiresAt > new Date();
}



export default function HomePage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  /* filtro de categoria */
  const [selectedCategory, setSelectedCategory] = useState("all");

  /* ordenação: "upcoming" = mais próximo primeiro (padrão) | "recent" = mais novo */
  const [sortMode, setSortMode] = useState("upcoming");

  /* visualização: "list" | "map" */
  const [viewMode, setViewMode] = useState("list");

  /* paginação do scroll infinito */
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const loadMoreRef = useRef(null);

  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    async function load() {
      const { data, error } = await listPublicEvents();
      if (!error && data) setEvents(data);
      setLoading(false);
    }
    load();
  }, []);

  /* filtro de categoria */
  const filteredEvents =
    selectedCategory === "all"
      ? events.filter(isEventStillVisible)
      : events.filter(
          (ev) =>
            String(ev.category || "").trim().toLowerCase() ===
              String(selectedCategory).trim().toLowerCase() &&
            isEventStillVisible(ev)
        );

  /* ordenação */
  const sortedEvents =
    sortMode === "recent"
      ? [...filteredEvents].sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at)
        )
      : filteredEvents; // já vem ASC por event_local_at do DB (mais próximo primeiro)

  /* resetar scroll infinito ao trocar filtro ou sort */
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [selectedCategory, sortMode]);

  /* eventos visíveis (paginados) */
  const visibleEvents = sortedEvents.slice(0, visibleCount);


  /* 🔽 infinite scroll */
  useEffect(() => {
    if (!loadMoreRef.current) return;

    const observer = new IntersectionObserver(
  (entries) => {
    if (entries[0].isIntersecting) {
      setVisibleCount((prev) => prev + PAGE_SIZE);
    }
  },
  {
    root: null,
    rootMargin: "200px",
    threshold: 0,
  }
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

        {loading && (
          <p className={styles.info}>✨ Loading your vibe... ✨</p>
        )}

        {!loading && events.length === 0 && (
          <p className={styles.info}>No events found.</p>
        )}

        {!loading && events.length > 0 && (
          <>
            {/* Filtros de categoria */}
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

            {/* Controles: ordenação + toggle de visualização */}
            <div className={styles.controlsRow}>
              {/* Sort */}
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

              {/* View toggle */}
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

        {/* Map view — mostra TODOS eventos não-expirados (ignora filtro de categoria) */}
        {!loading && viewMode === "map" && (
          <EventsMapView events={events.filter(isEventStillVisible).map(normalizeEvent)} />
        )}

        {/* List view */}
        {viewMode === "list" && (
          <div className={styles.list}>
            {visibleEvents.map((ev, index) => (
              <div
                key={ev.id}
                className={styles.cardWrapper}
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <EventCard event={normalizeEvent(ev)} />
              </div>
            ))}
          </div>
        )}

        {/* Sentinel do infinite scroll (só no modo lista) */}
        {viewMode === "list" && visibleCount < sortedEvents.length && (
          <div ref={loadMoreRef} className={styles.loadMore} />
        )}
      </div>
    </div>
  );
}
