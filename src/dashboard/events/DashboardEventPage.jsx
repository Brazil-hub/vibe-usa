import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../supabase/client";
import EventGuestsPage from "./EventGuestsPage";
import EventTicketsPage from "./EventTicketsPage";
import styles from "./DashboardEventPage.module.css";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "guests",   label: "Guests" },
  { key: "tickets",  label: "Tickets" },
];

export default function DashboardEventPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    async function loadEvent() {
      const { data } = await supabase
        .from("events")
        .select("id, title, is_private, is_paid, price, event_date, location, description, status")
        .eq("id", id)
        .single();

      setEvent(data);
      setLoading(false);

      if (data?.is_paid) setActiveTab("tickets");
    }

    loadEvent();
  }, [id]);

  if (loading) return <p style={{ padding: 24, color: "#9ca3af" }}>Loading…</p>;
  if (!event)  return <p style={{ padding: 24, color: "#9ca3af" }}>Event not found.</p>;

  return (
    <div className={styles.container}>
      {/* HEADER */}
      <header className={styles.header}>
        <button className={styles.back} onClick={() => navigate("/dashboard")}>
          ← My Events
        </button>
        <h1 className={styles.title}>{event.title}</h1>
        <div className={styles.badgeRow}>
          {event.is_private && <span className={styles.badge}>Private</span>}
          {event.is_paid    && <span className={`${styles.badge} ${styles.badgePaid}`}>Paid · {formatCurrency(event.price)}</span>}
          <span className={`${styles.badge} ${getStatusBadgeClass(event.status, styles)}`}>
            {getStatusLabel(event.status)}
          </span>
        </div>
      </header>

      {/* TABS */}
      <div className={styles.tabs}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* CONTENT */}
      {activeTab === "overview" && <EventOverviewTab event={event} navigate={navigate} />}
      {activeTab === "guests"   && <EventGuestsPage />}
      {activeTab === "tickets"  && <EventTicketsPage />}
    </div>
  );
}

/* ─── Overview Tab ─────────────────────────────────────── */
function EventOverviewTab({ event, navigate }) {
  const eventLink = `${window.location.origin}/event/${event.id}`;

  const dateStr = event.event_date
    ? new Date(event.event_date).toLocaleDateString("en-US", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
      })
    : "Date TBD";

  const timeStr = event.event_date
    ? new Date(event.event_date).toLocaleTimeString("en-US", {
        hour: "2-digit", minute: "2-digit",
      })
    : "";

  return (
    <div className={styles.overviewTab}>
      {/* Info cards */}
      <div className={styles.infoGrid}>
        <InfoRow icon="📅" label="Date" value={`${dateStr}${timeStr ? ` · ${timeStr}` : ""}`} />
        {event.location && <InfoRow icon="📍" label="Location" value={event.location} />}
        {event.description && (
          <InfoRow icon="📝" label="Description" value={event.description} multiline />
        )}
      </div>

      {/* Share link */}
      <div className={styles.shareBox}>
        <p className={styles.shareLabel}>Event link</p>
        <div className={styles.shareRow}>
          <code className={styles.shareLink}>{eventLink}</code>
          <button
            className={styles.copyBtn}
            onClick={() => navigator.clipboard.writeText(eventLink)}
          >
            Copy
          </button>
        </div>
      </div>

      {/* Quick actions */}
      <div className={styles.quickActions}>
        <button
          className={styles.actionBtn}
          onClick={() => navigate(`/event/${event.id}`)}
        >
          View Public Page
        </button>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value, multiline }) {
  return (
    <div className={styles.infoRow}>
      <span className={styles.infoIcon}>{icon}</span>
      <div>
        <p className={styles.infoLabel}>{label}</p>
        <p className={`${styles.infoValue} ${multiline ? styles.infoMultiline : ""}`}>{value}</p>
      </div>
    </div>
  );
}

/* ─── Helpers ──────────────────────────────────────────── */
function formatCurrency(val) {
  if (!val) return "Free";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
}

function getStatusLabel(status) {
  const map = { active: "Active", cancelled: "Cancelled", draft: "Draft", pending: "In Review", archived: "Archived" };
  return map[status] || status;
}

function getStatusBadgeClass(status, styles) {
  if (status === "cancelled") return styles.badgeDanger;
  if (status === "draft" || status === "pending") return styles.badgeWarning;
  return styles.badgeActive;
}
