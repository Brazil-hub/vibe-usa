import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { listPublicEvents } from "../supabase/events";
import EventCard from "../components/EventCard";
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

function isEventStillVisible(ev) {
  if (!ev.event_date) return false;

  // data do evento (UTC → Date)
  const eventDate = new Date(ev.event_date);

  // agora (local)
  const now = new Date();

  // fim do dia local de hoje (23:59:00)
  const endOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    0,
    0
  );

  // evento é visível se:
  // - é hoje (local) OU
  // - é no futuro
  return eventDate <= endOfToday
    ? eventDate >= new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        0,
        0,
        0,
        0
      )
    : true;
}



export default function HomePage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  /* 🔽 filtro */
  const [selectedCategory, setSelectedCategory] = useState("all");

  /* 🔽 paginação */
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

  /* 🔽 filtro */
  const filteredEvents =
  selectedCategory === "all"
    ? events.filter(isEventStillVisible)
    : events.filter(
        (ev) =>
          (String(ev.category || "").trim().toLowerCase() === String(selectedCategory).trim().toLowerCase()) &&
          isEventStillVisible(ev)
      );


      /* 🔽 resetar scroll infinito ao trocar filtro */
      useEffect(() => {
        setVisibleCount(PAGE_SIZE);
      }, [selectedCategory]);



  /* 🔽 eventos visíveis */
  const visibleEvents = filteredEvents.slice(0, visibleCount);


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
  }, [filteredEvents]);

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
          <div className={styles.categoryFilter}>
            <button onClick={() => setSelectedCategory("all")}>All</button>
            <button onClick={() => setSelectedCategory("party")}>Party</button>
            <button onClick={() => setSelectedCategory("show")}>Show</button>
            <button onClick={() => setSelectedCategory("birthday")}>
              Birthday
            </button>
            <button onClick={() => setSelectedCategory("class")}>
              Classes
            </button>
            <button onClick={() => setSelectedCategory("workshop")}>
              Workshop
            </button>
            <button onClick={() => setSelectedCategory("sport")}>
              Sports
            </button>
            <button onClick={() => setSelectedCategory("art")}>Art</button>
            <button onClick={() => setSelectedCategory("culture")}>
              Culture
            </button>
            <button onClick={() => setSelectedCategory("teather")}>
              Theater
            </button>
          </div>
        )}

        <div className={styles.list}>
          {visibleEvents.map((ev, index) => (
            <div
              key={ev.id}
              className={styles.cardWrapper}
              style={{ animationDelay: `${index * 60}ms` }}
            >
              {/* 🔽 ÚNICA MUDANÇA AQUI */}
              <EventCard event={normalizeEvent(ev)} />
            </div>
          ))}
        </div>

        {/* 🔽 sentinel do infinite scroll */}
        {visibleCount < filteredEvents.length && (
          <div ref={loadMoreRef} className={styles.loadMore} />
        )}
      </div>
    </div>
  );
}
