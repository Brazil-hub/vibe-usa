import { useParams } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

import {
  getEventById,
  canUserAccessEvent,
} from "../supabase/events";

import {
  getUserRsvp,
  setRsvp,
  deleteRsvp,
  getEventAttendance,
} from "../supabase/rsvp";

import { getUserTicketForEvent } from "../supabase/tickets";

import styles from "./EventDetailsPage.module.css";
import EventPostFeed from "../components/EventPostFeed";
import Button from "../components/ui/Button";
import { useToast } from "../hooks/useToast";
import { useAuth } from "../auth/useAuth";
import PublicTopBar from "../components/PublicTopBar";



export default function EventDetailsPage() {
  
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();

  const [showAttendees, setShowAttendees] = useState(false);


  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);

  const [error, setError] = useState(false);

  const [rsvpStatus, setRsvpStatus] = useState(null);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [acceptedInvite, setAcceptedInvite] = useState(false);
  const [userTicket, setUserTicket] = useState(null);

  const [attendance, setAttendance] = useState({
  going: [],
  maybe: [],
  no: [],
});

const { showToast, ToastComponent } = useToast();

async function loadAttendance(eventId) {
  try {
    const { data, error } = await getEventAttendance(eventId);

    if (error) {
      console.error("Erro getEventAttendance:", error);
      return;
    }

    if (data) {
      setAttendance({
        going: data.going || [],
        maybe: data.maybe || [],
        no: data.no || [],
      });
    }
  } catch (e) {
    console.error("Erro carregando attendance:", e);
  }
}

useEffect(() => {
  if (
    !user &&
    !isLoading &&
    !localStorage.getItem("postLoginRedirect")
  ) {
    localStorage.setItem(
      "postLoginRedirect",
      window.location.pathname
    );
  }
}, [user, isLoading]);

useEffect(() => {
  async function loadEvent() {
    try {
      setLoading(true);

      // ✅ CHAMA ATTENDANCE AQUI (não depende de nada além do id)
      await loadAttendance(id);

      // ... daqui pra baixo continua exatamente como já está no seu arquivo


      // 1️⃣ BUSCA O EVENTO (UMA ÚNICA VEZ)
      const { data } = await getEventById(id);
      setEvent(data);

      // 2️⃣ SE USUÁRIO LOGADO, BUSCA RSVP + PRESENÇAS + INGRESSO
      if (user) {
        const rsvp = await getUserRsvp(id);
        if (rsvp?.data?.status) {
          setRsvpStatus(rsvp.data.status);
        }

        await loadAttendance(id);

        const { data: ticket } = await getUserTicketForEvent(id);
        setUserTicket(ticket || null);
      }

    } catch (err) {
      console.error("Erro ao carregar evento:", err);
    } finally {
      setLoading(false);
    }
  }

  loadEvent();
}, [id, user]);


  // -----------------------
  // ESTADOS DE BLOQUEIO
  // -----------------------

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingSkeleton} />
        <div className={styles.loadingContent}>
          <div className={styles.loadingLine} />
          <div className={styles.loadingLineShort} />
        </div>
      </div>
    );
  }

  if (forbidden && !acceptedInvite) {

  const storageKey = `invited_event_${id}`;

  // 🔹 USUÁRIO NÃO LOGADO
  if (!user) {
    return (
      <div className={styles.notFound}>
        <h2>🔒 Private Event</h2>
        <p>
          This event is private. Sign in or create an account to access it.
        </p>

        <button
          className={styles.primaryButton}
          onClick={() => {
  localStorage.setItem(
    "postLoginRedirect",
    window.location.pathname
  );
  navigate("/login");
}}

        >
          Sign in to access
        </button>
      </div>
    );
  }

  // 🔹 USUÁRIO LOGADO (fluxo que já existia)
  return (
    <div className={styles.notFound}>
      <h2>🔒 Private Event</h2>
      <p>You've been invited to this event.</p>

      <button
  className={styles.primaryButton}
  onClick={() => {
    localStorage.setItem(storageKey, "true");
    setAcceptedInvite(true);
  }}
>
  Join event
</button>

    </div>
  );
}


  // -----------------------
  // DADOS DERIVADOS
  // -----------------------

  const isOnline = event.event_format === "online";
  const isPaid = Boolean(event.is_paid);
  const hasImage = Boolean(event.image_url);

  const date = event.event_date ? new Date(event.event_date) : null;

  const dateLabel = date
    ? date.toLocaleDateString("en-US", {
        weekday: "short",
        day: "2-digit",
        month: "short",
      })
    : "Date TBD";

  const timeLabel = date
    ? date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  const priceLabel =
    isPaid && event.price
      ? `$${Number(event.price).toFixed(2)}`
      : "Free";

  const goingCount = attendance.going.length;
  const maybeCount = attendance.maybe.length;
  const noCount = attendance.no.length;
  const totalAttendance = goingCount + maybeCount + noCount;

  const mergedAttendees = [
    ...attendance.going,
    ...attendance.maybe,
    ...attendance.no,
  ];

  const MAX_AVATARS = 5;

  const slotsForGuests = Math.max(MAX_AVATARS - 1, 0);

  const slicedGuests = mergedAttendees.slice(0, slotsForGuests);

  const remainingGuests = Math.max(
    mergedAttendees.length - slicedGuests.length,
    0
  );

  const avatarList = slicedGuests;


  // -----------------------
  // RSVP
  // -----------------------

  async function updateRsvp(newStatus) {
    if (!user) {
  showToast("Sign in or create an account to RSVP 🔒");
  return;
  }
    if (rsvpLoading) return;
    setRsvpLoading(true);

    try {
      if (newStatus === rsvpStatus) {
        await deleteRsvp(id);
        setRsvpStatus(null);
        showToast("RSVP removed.");
      } else {
        const { error } = await setRsvp(id, newStatus);
        if (!error) {
          setRsvpStatus(newStatus);
          if (newStatus === "going") showToast("You're in! 🎉");
          if (newStatus === "maybe") showToast("Saved as 'Maybe' ⭐");
          if (newStatus === "no") showToast("Marked as 'Not going'.");
        }
      }

      await loadAttendance(id);
    } catch {
      showToast("Error saving RSVP.");
    }

    setRsvpLoading(false);
  }

  function handleShare() {
    const url = window.location.href;

    if (navigator.share) {
      navigator.share({
        title: event.title,
        text: "Join me at this event?",
        url,
      });
    } else {
      navigator.clipboard.writeText(url);
      showToast("Link copied 📎");
    }
  }

  // -----------------------
  // RENDER
  // -----------------------

  return (
    <div className={styles.page}>
      <div className={styles.scrollArea}>
    {!user && <PublicTopBar />}

        {/* CAPA */}
        <div className={styles.hero}>
          {hasImage ? (
            <img
              src={event.image_url}
              alt="Event cover"
              className={styles.cover}
            />
          ) : (
            <div className={styles.coverPlaceholder}>
              <span className={styles.coverEmoji}>✨</span>
              <span className={styles.coverText}>No cover image</span>
            </div>
          )}

          <div className={styles.heroOverlay}>
  <div className={styles.chipRow}>
    {event.category && (
      <span className={styles.chipCategory}>
        {event.category}
      </span>
    )}

    <span className={styles.chipPrimary}>{dateLabel}</span>

    {timeLabel && (
      <span className={styles.chip}>{timeLabel}</span>
    )}

    <span className={styles.chip}>
      {isOnline ? "Online" : "In-Person"}
    </span>

    <span className={styles.chipPrice}>{priceLabel}</span>
  </div>

  <h1 className={styles.title}>{event.title}</h1>
</div>

        </div>

       {/* CTA PRINCIPAL — INGRESSO (pago) ou RSVP (gratuito) */}
{event?.is_private && !user ? (
  <div className={styles.inviteGateCard}>
    <h3>You've been invited to this event</h3>
    <p>
      To RSVP, comment, or interact, you'll need to sign in or create an account.
    </p>
    <button
      className={styles.primaryButton}
      onClick={() => {
        localStorage.setItem(
          "postLoginRedirect",
          window.location.pathname + window.location.search
        );
        navigate("/login");
      }}
    >
      Sign in to respond
    </button>
  </div>
) : isPaid ? (
  /* ── EVENTO PAGO: botão de compra/ingresso ── */
  <div className={styles.rsvpCard}>
    {userTicket ? (
      <>
        <div className={styles.ticketOwnedBadge}>🎟️ Você tem ingresso!</div>
        <Button
          onClick={() => navigate(`/my-tickets/${userTicket.id}`)}
          className={styles.rsvpPrimary}
        >
          Ver meu ingresso
        </Button>
      </>
    ) : (
      <>
        <div className={styles.priceHighlight}>{priceLabel}</div>
        <Button
          onClick={() => {
            if (!user) {
              localStorage.setItem("postLoginRedirect", window.location.pathname);
              navigate("/login");
              return;
            }
            navigate(`/event/${id}/buy-ticket`);
          }}
          className={styles.rsvpPrimary}
        >
          Comprar ingresso 🎟️
        </Button>
      </>
    )}
  </div>
) : (
  /* ── EVENTO GRATUITO: RSVP normal ── */
  <div className={styles.rsvpCard}>
    <Button
      onClick={() => updateRsvp("going")}
      disabled={rsvpLoading}
      className={`${styles.rsvpPrimary} ${
        rsvpStatus === "going" ? styles.activeGoing : ""
      }`}
    >
      I'm in 🔥
    </Button>

    <div className={styles.rsvpSecondaryRow}>
      <Button
        onClick={() => updateRsvp("maybe")}
        disabled={rsvpLoading}
        className={`${styles.rsvpSecondary} ${
          rsvpStatus === "maybe" ? styles.activeMaybe : ""
        }`}
      >
        Maybe ⭐
      </Button>

      <Button
        onClick={() => updateRsvp("no")}
        disabled={rsvpLoading}
        className={`${styles.rsvpSecondary} ${
          rsvpStatus === "no" ? styles.activeNo : ""
        }`}
      >
        Not going ❌
      </Button>
    </div>
  </div>
)}


        {/* INFO */}
        <section className={styles.section}>
          <div className={styles.infoCard}>
            <h3 className={styles.sectionTitle}>Where it's happening</h3>

            {!isOnline && event.location && (
              <p className={styles.locationRow}>📍 {event.location}</p>
            )}

            {isOnline && event.online_url && (
              <p className={styles.locationRow}>🔗 {event.online_url}</p>
            )}
          </div>

          <div className={styles.infoCard}>
            <h3 className={styles.sectionTitle}>About this event</h3>
            <div
              className={styles.description}
              dangerouslySetInnerHTML={{
                __html: event.description || "No description available.",
              }}
            />

          </div>
        </section>

        {/* PRESENÇAS */}
        {totalAttendance > 0 && (
          <section className={styles.section}>
            <div className={styles.attendanceCard}>
              <div className={styles.attendanceCounters}>
                <span>🎉 {goingCount} going</span>
                <span>⭐ {maybeCount} maybe</span>
                <span>❌ {noCount} not going</span>
              </div>

              <div
                className={styles.avatarRow}
                onClick={() => setShowAttendees(true)}
                style={{ cursor: "pointer" }}
              >

                {avatarList.slice(0, 5).map((person, index) => (
                  <div
                    key={person.id ?? `attendee-${index}`}
                    className={styles.avatar}
                    title={person.name}
                    style={{
                      left: `${index * 18}px`,
                      zIndex: 10 - index,
                    }}
                  >
                    {person.avatar_url ? (
                      <img
                        src={person.avatar_url}
                        alt={person.name}
                        className={styles.avatarImg}
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <span>{person.initial}</span>
                    )}
                  </div>


                ))}

                {remainingGuests > 0 && (
                  <div className={styles.moreAvatar}>+{remainingGuests}</div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* FEED */}
        <EventPostFeed
  eventId={id}
  rsvpStatus={rsvpStatus}
/>


        {/* COMPARTILHAR */}
        <section className={styles.section}>
          <div className={styles.organizerCard}>
            <Button onClick={handleShare} className={styles.shareButton}>
              Share Event 🔗
            </Button>
          </div>
        </section>

        <div className={styles.bottomSpacer} />
      </div>
        {showAttendees && (
        <div
          className={styles.attendeesOverlay}
          onClick={() => setShowAttendees(false)}
        >
          <div
            className={styles.attendeesModal}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className={styles.attendeesTitle}>
              Going ({attendance.going.length})
            </h3>

            <div className={styles.attendeesList}>
              {attendance.going.map((person, index) => (
                <div
                  key={person.id ?? `attendee-${index}`}
                  className={styles.attendeeItem}
                >
                  <div className={styles.attendeeAvatar}>
                    {person.avatar_url ? (
                      <img
                        src={person.avatar_url}
                        alt={person.name}
                        className={styles.avatarImg}
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <span>{person.initial}</span>
                    )}
                  </div>

                  <span className={styles.attendeeName}>
                    {person.name}
                  </span>
                </div>
              ))}
            </div>

            <button
              className={styles.closeButton}
              onClick={() => setShowAttendees(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {ToastComponent}
    </div>
  );
}