import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { getTicketById } from "../../supabase/tickets";
import { useToast } from "../../hooks/useToast";
import styles from "./TicketView.module.css";

export default function TicketView() {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast, ToastComponent } = useToast();

  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }

    async function load() {
      const { data, error } = await getTicketById(ticketId);
      if (error || !data) {
        setLoading(false);
        return;
      }
      setTicket(data);
      setLoading(false);
    }

    load();
  }, [ticketId, user, navigate]);

  function handleShare() {
    const text = `🎟️ My ticket for ${ticket?.events?.title}\nCode: ${ticket?.code}`;
    if (navigator.share) {
      navigator.share({ text, url: window.location.href });
    } else {
      navigator.clipboard.writeText(text);
      showToast("Ticket copied 📎");
    }
  }

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className={styles.notFound}>
        <p>Ticket not found.</p>
        <button onClick={() => navigate("/my-tickets")}>View my tickets</button>
      </div>
    );
  }

  const event = ticket.events;
  const date = event?.event_date ? new Date(event.event_date) : null;
  const dateLabel = date
    ? date.toLocaleDateString("en-US", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "Date TBD";
  const timeLabel = date
    ? date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  const statusMap = {
    active:    { label: "✅ Valid",     bg: "rgba(34,197,94,0.12)",   color: "#22c55e" },
    used:      { label: "☑️ Used",      bg: "rgba(107,114,128,0.12)", color: "#6b7280" },
    cancelled: { label: "❌ Cancelled", bg: "rgba(239,68,68,0.12)",   color: "#ef4444" },
  };
  const statusInfo = statusMap[ticket.status] || statusMap.active;

  const qrData = encodeURIComponent(ticket.code);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${qrData}&color=ff1493&bgcolor=0a0a0a&qzone=1`;

  const priceLabel =
    event?.is_paid && event?.price
      ? `$${Number(event.price).toFixed(2)}`
      : "Free";

  return (
    <div className={styles.page}>
      {/* HEADER */}
      <header className={styles.header}>
        <button className={styles.back} onClick={() => navigate("/my-tickets")}>
          ←
        </button>
        <h1 className={styles.headerTitle}>Ticket</h1>
        <button className={styles.shareBtn} onClick={handleShare}>
          Share
        </button>
      </header>

      {/* TICKET VISUAL */}
      <div className={styles.ticketWrapper}>
        <div className={styles.ticket}>
          {/* TOP */}
          {event?.image_url && (
            <img src={event.image_url} alt="" className={styles.cover} />
          )}

          <div className={styles.ticketTop}>
            {/* Status badge */}
            <div
              className={styles.statusBadge}
              style={{ background: statusInfo.bg, color: statusInfo.color }}
            >
              {statusInfo.label}
            </div>

            <h2 className={styles.eventTitle}>{event?.title || "Event"}</h2>

            <div className={styles.metaGrid}>
              <div className={styles.metaItem}>
                <span className={styles.metaIcon}>📅</span>
                <div>
                  <p className={styles.metaLabel}>Date</p>
                  <p className={styles.metaValue}>{dateLabel}</p>
                </div>
              </div>

              {timeLabel && (
                <div className={styles.metaItem}>
                  <span className={styles.metaIcon}>🕐</span>
                  <div>
                    <p className={styles.metaLabel}>Time</p>
                    <p className={styles.metaValue}>{timeLabel}</p>
                  </div>
                </div>
              )}

              {event?.location && (
                <div className={styles.metaItem}>
                  <span className={styles.metaIcon}>📍</span>
                  <div>
                    <p className={styles.metaLabel}>Venue</p>
                    <p className={styles.metaValue}>{event.location}</p>
                  </div>
                </div>
              )}

              {event?.online_url && (
                <div className={styles.metaItem}>
                  <span className={styles.metaIcon}>🔗</span>
                  <div>
                    <p className={styles.metaLabel}>Link</p>
                    <p className={styles.metaValue}>{event.online_url}</p>
                  </div>
                </div>
              )}

              <div className={styles.metaItem}>
                <span className={styles.metaIcon}>👤</span>
                <div>
                  <p className={styles.metaLabel}>Attendee</p>
                  <p className={styles.metaValue}>{ticket.attendee_name || "–"}</p>
                </div>
              </div>

              <div className={styles.metaItem}>
                <span className={styles.metaIcon}>💰</span>
                <div>
                  <p className={styles.metaLabel}>Amount</p>
                  <p className={styles.metaValue}>{priceLabel}</p>
                </div>
              </div>
            </div>
          </div>

          {/* PERFORATED SEPARATOR */}
          <div className={styles.perforation}>
            <div className={styles.perforationHoleLeft} />
            <div className={styles.perforationLine} />
            <div className={styles.perforationHoleRight} />
          </div>

          {/* BOTTOM — QR CODE */}
          <div className={styles.ticketBottom}>
            <p className={styles.scanLabel}>Show at entrance</p>

            <div className={styles.qrWrapper}>
              <img
                src={qrUrl}
                alt={`QR Code - ${ticket.code}`}
                className={styles.qr}
                loading="lazy"
              />
            </div>

            <p className={styles.ticketCode}>{ticket.code}</p>

            {ticket.is_generated && (
              <span className={styles.generatedBadge}>🎁 Generated ticket</span>
            )}

            <p className={styles.ticketId}>ID: {ticket.id.slice(0, 8).toUpperCase()}</p>
          </div>
        </div>
      </div>

      {/* ACTIONS */}
      <div className={styles.actions}>
        <button
          className={styles.btnOutline}
          onClick={() => navigate(`/event/${event?.id}`)}
        >
          View event
        </button>
      </div>

      <div className={styles.bottomSpacer} />
      {ToastComponent}
    </div>
  );
}
