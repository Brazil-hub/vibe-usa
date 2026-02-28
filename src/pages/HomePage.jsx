import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { listPublicEvents } from "../supabase/events";
import EventCard from "../components/EventCard";
import styles from "./HomePage.module.css";
import PublicTopBar from "../components/PublicTopBar";
import { useAuth } from "../auth/useAuth";
import OnboardingCard from "../components/OnboardingCard";
import { useJsApiLoader } from "@react-google-maps/api";


const PAGE_SIZE = 6;

const CATEGORY_LABELS = {
  all: "Todos",
  party: "Festa",
  show: "Show",
  birthday: "Aniversário",
  class: "Aulas & Cursos",
  workshop: "Workshop",
  sport: "Esporte",
  art: "Arte",
  culture: "Cultura",
  teather: "Teatro",
};


/* 🔽 ADIÇÃO NECESSÁRIA — NORMALIZA DATA, HORA E LOCAL */
function normalizeEvent(ev) {
  let date_label = "";
  let time_label = "";
  let weekday_label = "";

  if (ev.event_date) {
    const d = new Date(ev.event_date);

    weekday_label = d
      .toLocaleDateString("pt-BR", { weekday: "short" })
      .replace(".", "")
      .replace(/^./, (c) => c.toUpperCase());

    date_label = d
      .toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
      })
      .replace("de ", "")
      .replace(".", "");

    time_label = d
      .toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })
      .replace(":00", "h")
      .replace(":", "h");
  }

  return {
    ...ev,
    weekday_label,
    date_label,
    time_label,
    venue_name: ev.location || "",
    city: ev.city || "",
    category: CATEGORY_LABELS[ev.category] || ev.category,
    distanceValue: ev.distanceValue ?? null,
    distanceText: ev.distanceText ?? null,
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
  const [userLocation, setUserLocation] = useState(null);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  });

  /* 🔽 filtro */
  const [selectedCategory, setSelectedCategory] = useState("all");

  /* 🔽 paginação */
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const loadMoreRef = useRef(null);

  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    // Get user's current position
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error("Error getting location: ", error);
        }
      );
    }
  }, []);

  useEffect(() => {
    async function load() {
      const { data, error } = await listPublicEvents();
      if (!error && data) {
        setEvents(data);
      }
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    // When events and userLocation are both available, calculate distances
    // We use the JS API to avoid CORS errors from the REST API
    if (events.length > 0 && userLocation && isLoaded) {
      const calculateDistances = async () => {
        const origin = new window.google.maps.LatLng(userLocation.lat, userLocation.lng);

        // We only calculate distances for offline events with a location
        const offlineEvents = events.filter(ev => ev.event_format !== "online" && ev.location);
        const destinations = offlineEvents.map(ev => ev.location);

        if (destinations.length === 0) return;

        try {
          // Note: DistanceMatrixService limits to 25 destinations per request.
          // For now, we take the first 25 locations to respect standard limits.
          // A robust app might chunk them, but typically page_size is small or we just order closest among upcoming.
          const maxDests = destinations.slice(0, 25);
          const service = new window.google.maps.DistanceMatrixService();

          service.getDistanceMatrix(
            {
              origins: [origin],
              destinations: maxDests,
              travelMode: window.google.maps.TravelMode.DRIVING,
              unitSystem: window.google.maps.UnitSystem.IMPERIAL,
            },
            (response, status) => {
              if (status === "OK" && response && response.rows.length > 0) {
                const newEvents = [...events];
                const activeOffline = newEvents.filter(ev => ev.event_format !== "online" && ev.location).slice(0, 25);

                response.rows[0].elements.forEach((element, index) => {
                  if (element.status === "OK") {
                    activeOffline[index].distanceValue = element.distance.value; // in meters

                    let text = element.distance.text;
                    if (text.includes("ft")) {
                      const ft = parseFloat(text.replace(/,/g, ''));
                      const yards = Math.round(ft / 3);
                      text = `${yards} yd`;
                    }
                    activeOffline[index].distanceText = text;
                  }
                });

                // Sort newEvents. Online events and events without distance go to the bottom
                newEvents.sort((a, b) => {
                  const distA = a.distanceValue ?? Infinity;
                  const distB = b.distanceValue ?? Infinity;
                  return distA - distB;
                });

                const changed = newEvents.some((ev, i) => ev.id !== events[i].id || ev.distanceValue !== events[i].distanceValue);
                if (changed) {
                  setEvents(newEvents);
                }
              }
            }
          );
        } catch (error) {
          console.error("Failed to calculate distances:", error);
        }
      };

      const needsCalculation = events.some(ev => ev.event_format !== "online" && ev.location && ev.distanceValue === undefined);
      if (needsCalculation) {
        calculateDistances();
      }
    }
  }, [events, userLocation, isLoaded]);


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
          <p className={styles.info}>✨ Carregando sua vibe... ✨</p>
        )}

        {!loading && events.length === 0 && (
          <p className={styles.info}>Nenhum evento encontrado.</p>
        )}

        {!loading && events.length > 0 && (
          <div className={styles.categoryFilter}>
            <button onClick={() => setSelectedCategory("all")}>Todos</button>
            <button onClick={() => setSelectedCategory("party")}>Festa</button>
            <button onClick={() => setSelectedCategory("show")}>Show</button>
            <button onClick={() => setSelectedCategory("birthday")}>
              Aniversário
            </button>
            <button onClick={() => setSelectedCategory("class")}>
              Aulas-Cursos
            </button>
            <button onClick={() => setSelectedCategory("workshop")}>
              Workshop
            </button>
            <button onClick={() => setSelectedCategory("sport")}>
              Esporte
            </button>
            <button onClick={() => setSelectedCategory("art")}>Arte</button>
            <button onClick={() => setSelectedCategory("culture")}>
              Cultura
            </button>
            <button onClick={() => setSelectedCategory("teather")}>
              Teatro
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
