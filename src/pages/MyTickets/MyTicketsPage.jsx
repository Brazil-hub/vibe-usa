import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { getMyTickets } from "../../supabase/tickets";
import styles from "./MyTicketsPage.module.css";

export default function MyTicketsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }

    async function load() {
      const { data } = await getMyTickets();
      setTickets(data || []);
      setLoading(false);
    }

    load();
  }, [user, navigate]);

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
      </div>
    );
  }

  const active    = tickets.filter((t) => t.status === "active");
  const used      = tickets.filter((t) => t.status === "used");
  const cancelled = tickets.filter((t) => t.status === "cancelled");

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.back} onClick={() => navigate(-1)}>
          ←
        </button>
        <h1 className={styles.headerTitle}>My Tickets</h1>
      </header>

      {tickets.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>🎟️</span>
          <p className={styles.emptyTitle}>No tickets yet</p>
          <p className={styles.emptyText}>
            Your tickets will appear here after you purchase or receive one.
          </p>
          <button className={styles.btnPrimary} onClick={() => navigate("/")}>
            Browse events
          </button>
        </div>
      ) : (
        <div className={styles.content}>
          {active.length > 0 && (
            <section>
              <p className={styles.sectionLabel}>Active</p>
              <div className={styles.list}>
                {active.map((t) => (
                  <TicketCard
                    key={t.id}
                    ticket={t}
                    onClick={() => navigate(`/my-tickets/${t.id}`)}
                  />
                ))}
              </div>
            </section>
          )}

          {used.length > 0 && (
            <section>
              <p className={styles.sectionLabel}>Used</p>
              <div className={styles.list}>
                {used.map((t) => (
                  <TicketCard
                    key={t.id}
                    ticket={t}
                    onClick={() => navigate(`/my-tickets/${t.id}`)}
                    dimmed
                  />
                ))}
              </div>
            </section>
          )}

          {cancelled.length > 0 && (
            <section>
              <p className={styles.sectionLabel}>Cancelled</p>
              <div className={styles.list}>
                {cancelled.map((t) => (
                  <TicketCard
                    key={t.id}
                    ticket={t}
                    onClick={() => navigate(`/my-tickets/${t.id}`)}
                    dimmed
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <div className={styles.bottomSpacer} />
    </div>
  );
}

function TicketCard({ ticket, onClick, dimmed }) {
  const event = ticket.events;
  const date = event?.event_date ? new Date(event.event_date) : null;
  const dateLabel = date
    ? date.toLocaleDateString("en-US", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "Date TBD";

  const statusMap = {
    active:    { label: "Active",    color: "#22c55e" },
    used:      { label: "Used",      color: "#6b7280" },
    cancelled: { label: "Cancelled", color: "#ef4444" },
  };
  const status = statusMap[ticket.status] || statusMap.active;

  return (
    <button
      className={`${styles.ticketCard} ${dimmed ? styles.dimmed : ""}`}
      onClick={onClick}
    >
      {event?.image_url && (
        <img src={event.image_url} alt="" className={styles.ticketImg} />
      )}
      {!event?.image_url && (
        <div className={styles.ticketImgPlaceholder}>🎉</div>
      )}

      <div className={styles.ticketInfo}>
        <p className={styles.ticketEventTitle}>{event?.title || "Event"}</p>
        <p className={styles.ticketDate}>📅 {dateLabel}</p>
        <p className={styles.ticketCode}>{ticket.code}</p>
      </div>

      <div className={styles.ticketRight}>
        <span
          className={styles.statusBadge}
          style={{ color: status.color, borderColor: status.color }}
        >
          {status.label}
        </span>
        <span className={styles.arrow}>›</span>
      </div>
    </button>
  );
}
