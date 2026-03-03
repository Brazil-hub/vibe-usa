import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase/client";
import { useAuth } from "../../auth/useAuth";
import { useToast } from "../../hooks/useToast";
import { DRAFT_SESSION_KEY } from "../../constants";
import ConfirmModal from "../../components/ui/ConfirmModal";
import styles from "./OverviewPage.module.css";

/* ─── Icon components ──────────────────────────────────── */
function IconEvents() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
function IconTickets() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 9a3 3 0 0 1 0 6V19a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-4a3 3 0 0 1 0-6V5a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z" />
      <line x1="9" y1="12" x2="15" y2="12" strokeDasharray="2 2" />
    </svg>
  );
}
function IconRsvp() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function IconCheckin() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function IconEmpty() {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
      <rect x="10" y="14" width="52" height="48" rx="6" fill="#fce7f3" />
      <rect x="10" y="14" width="52" height="12" rx="6" fill="#fbcfe8" />
      <rect x="22" y="32" width="28" height="4" rx="2" fill="#f9a8d4" />
      <rect x="22" y="42" width="18" height="4" rx="2" fill="#f9a8d4" />
      <circle cx="36" cy="12" r="6" fill="#fff" stroke="#fbcfe8" strokeWidth="2" />
      <line x1="36" y1="9" x2="36" y2="15" stroke="#f9a8d4" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/* ─── Status badge ─────────────────────────────────────── */
function getStatusInfo(event) {
  if (event.status === "cancelled") return { label: "Cancelled", color: "#dc2626", bg: "#fef2f2" };
  if (event.status === "draft")     return { label: "Draft",     color: "#6b7280", bg: "#f3f4f6" };
  if (event.status === "pending")   return { label: "In Review", color: "#d97706", bg: "#fffbeb" };

  const now = new Date();
  const eventDate = new Date(event.event_date);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const evStart    = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
  const diffDays   = (evStart - todayStart) / 86400000;

  if (diffDays < 0)  return { label: "Past",      color: "#6b7280", bg: "#f3f4f6" };
  if (diffDays === 0) return { label: "Today",    color: "#16a34a", bg: "#f0fdf4" };
  if (diffDays <= 7)  return { label: `${Math.round(diffDays)}d`, color: "#2563eb", bg: "#eff6ff" };
  return              { label: "Upcoming",         color: "#2563eb", bg: "#eff6ff" };
}

/* ─── Main component ──────────────────────────────────── */
export default function OverviewPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast, ToastComponent } = useToast();

  const [stats, setStats] = useState({ eventsCount: 0, ticketsCount: 0, rsvpsCount: 0, checkinsCount: 0 });
  const [eventsWithMetrics, setEventsWithMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmConfig, setConfirmConfig] = useState(null);

  const creatorId = useMemo(() => user?.id ?? null, [user]);

  /* ── helpers ─────────────────────────────────────────── */
  const openConfirm = (cfg) => setConfirmConfig(cfg);
  const closeConfirm = () => setConfirmConfig(null);

  /* ── edit ────────────────────────────────────────────── */
  async function handleEditEvent(eventId) {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("id", eventId)
      .single();

    if (error || !data) {
      showToast("Error opening event for editing", "error");
      return;
    }

    sessionStorage.setItem(
      DRAFT_SESSION_KEY,
      JSON.stringify({ ...data, is_paid: data.is_paid === true, price: data.price ?? 0, fromDashboardEdit: true })
    );

    navigate("/create/form", { state: { id: data.id, fromDashboardEdit: true } });
  }

  /* ── cancel ──────────────────────────────────────────── */
  function handleCancelEvent(eventId) {
    openConfirm({
      title: "Cancel Event",
      message: "Are you sure you want to cancel this event? It will no longer be visible to the public.",
      danger: true,
      onConfirm: async () => {
        closeConfirm();
        const { error } = await supabase
          .from("events")
          .update({ status: "cancelled" })
          .eq("id", eventId)
          .eq("creator_id", user.id);

        if (error) { showToast("Couldn't cancel the event", "error"); return; }
        showToast("Event canceled successfully");
        setEventsWithMetrics((prev) =>
          prev.map((ev) => ev.id === eventId ? { ...ev, status: "cancelled" } : ev)
        );
      },
    });
  }

  /* ── delete ──────────────────────────────────────────── */
  function handleDeleteEvent(eventId) {
    openConfirm({
      title: "Delete Event",
      message: "This will permanently delete the event. This action cannot be undone.",
      danger: true,
      onConfirm: async () => {
        closeConfirm();
        const { error } = await supabase
          .from("events")
          .delete()
          .eq("id", eventId)
          .eq("creator_id", user.id)
          .in("status", ["draft", "pending"]);

        if (error) { showToast("Couldn't delete the event", "error"); return; }
        showToast("Event deleted successfully");
        setEventsWithMetrics((prev) => prev.filter((ev) => ev.id !== eventId));
        setStats((prev) => ({ ...prev, eventsCount: Math.max(0, prev.eventsCount - 1) }));
      },
    });
  }

  /* ── archive ─────────────────────────────────────────── */
  function handleArchiveEvent(eventId) {
    openConfirm({
      title: "Archive Event",
      message: "Archive this event? It will be removed from your main dashboard.",
      danger: false,
      onConfirm: async () => {
        closeConfirm();
        const { error } = await supabase
          .from("events")
          .update({ status: "archived" })
          .eq("id", eventId)
          .eq("creator_id", user.id);

        if (error) { showToast("Couldn't archive the event", "error"); return; }
        showToast("Event archived");
        setEventsWithMetrics((prev) => prev.filter((ev) => ev.id !== eventId));
        setStats((prev) => ({ ...prev, eventsCount: Math.max(0, prev.eventsCount - 1) }));
      },
    });
  }

  /* ── load (batch queries, N+1 → 4 total) ─────────────── */
  useEffect(() => {
    let cancelled = false;

    async function loadOverview() {
      if (!creatorId) { setLoading(false); return; }
      setLoading(true);

      const { data: events, error: eventsError } = await supabase
        .from("events")
        .select("id, title, event_date, location, image_url, is_private, is_paid, price, status")
        .eq("creator_id", creatorId)
        .not("status", "eq", "archived")
        .order("event_date", { ascending: true });

      if (cancelled) return;
      if (eventsError) { showToast("Error loading events", "error"); setLoading(false); return; }

      const eventIds = (events ?? []).map((e) => e.id);

      if (eventIds.length === 0) {
        setStats({ eventsCount: 0, ticketsCount: 0, rsvpsCount: 0, checkinsCount: 0 });
        setEventsWithMetrics([]);
        setLoading(false);
        return;
      }

      /* batch fetch — 3 queries instead of 3×N */
      const [
        { data: allTickets },
        { data: allRsvps },
        { data: allCheckins },
      ] = await Promise.all([
        supabase.from("tickets").select("event_id, status").in("event_id", eventIds),
        supabase.from("rsvps").select("event_id").in("event_id", eventIds),
        supabase.from("checkins").select("event_id").in("event_id", eventIds),
      ]);

      if (cancelled) return;

      /* group in JS */
      const ticketMap = {};
      const rsvpMap   = {};
      const checkinMap = {};

      (allTickets  || []).forEach((t) => { ticketMap[t.event_id]   = (ticketMap[t.event_id]   || 0) + 1; });
      (allRsvps    || []).forEach((r) => { rsvpMap[r.event_id]     = (rsvpMap[r.event_id]     || 0) + 1; });
      (allCheckins || []).forEach((c) => { checkinMap[c.event_id]  = (checkinMap[c.event_id]  || 0) + 1; });

      setStats({
        eventsCount:  events.length,
        ticketsCount: allTickets?.length  ?? 0,
        rsvpsCount:   allRsvps?.length    ?? 0,
        checkinsCount: allCheckins?.length ?? 0,
      });

      setEventsWithMetrics(
        events.map((ev) => ({
          ...ev,
          ticketsCount:  ticketMap[ev.id]   || 0,
          rsvpsCount:    rsvpMap[ev.id]     || 0,
          checkinsCount: checkinMap[ev.id]  || 0,
          revenue: ev.is_paid ? (ev.price || 0) * (ticketMap[ev.id] || 0) : 0,
        }))
      );

      setLoading(false);
    }

    loadOverview();
    return () => { cancelled = true; };
  }, [creatorId]);

  if (!user) return null;

  /* ── skeleton ────────────────────────────────────────── */
  if (loading) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.pageHeader}>
          <div className={styles.skeletonLine} style={{ width: 140, height: 28 }} />
        </div>
        <div className={styles.statsGrid}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`${styles.statCard} ${styles.skeletonCard}`} />
          ))}
        </div>
        <div className={styles.sectionHeader}>
          <div className={styles.skeletonLine} style={{ width: 180, height: 20 }} />
        </div>
        {[1, 2].map((i) => (
          <div key={i} className={`${styles.eventCard} ${styles.skeletonCard}`} style={{ height: 160 }} />
        ))}
      </div>
    );
  }

  /* ── empty state ─────────────────────────────────────── */
  if (eventsWithMetrics.length === 0 && stats.eventsCount === 0) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.pageHeader}>
          <h2 className={styles.pageTitle}>My Events</h2>
        </div>
        <div className={styles.emptyState}>
          <IconEmpty />
          <p className={styles.emptyTitle}>No events yet</p>
          <p className={styles.emptyText}>
            Create your first event and manage everything here.
          </p>
          <button
            className={styles.emptyBtn}
            onClick={() => navigate("/create/visibility")}
          >
            + Create Event
          </button>
        </div>
        {ToastComponent}
      </div>
    );
  }

  /* ── main render ─────────────────────────────────────── */
  return (
    <div className={styles.wrapper}>
      {/* HEADER */}
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>My Events</h2>
        <button
          className={styles.headerCreateBtn}
          onClick={() => navigate("/create/visibility")}
        >
          + New Event
        </button>
      </div>

      {/* STATS */}
      <div className={styles.statsGrid}>
        <StatCard icon={<IconEvents />}  label="Events"    value={stats.eventsCount}   color="#ff3f8e" bg="#fff0f6" />
        <StatCard icon={<IconTickets />} label="Tickets"   value={stats.ticketsCount}  color="#7c3aed" bg="#f5f3ff" />
        <StatCard icon={<IconRsvp />}    label="RSVPs"     value={stats.rsvpsCount}    color="#2563eb" bg="#eff6ff" />
        <StatCard icon={<IconCheckin />} label="Check-ins" value={stats.checkinsCount} color="#16a34a" bg="#f0fdf4" />
      </div>

      {/* EVENT PERFORMANCE */}
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>Event Performance</h3>
      </div>

      {eventsWithMetrics.map((ev) => (
        <EventPerformanceCard
          key={ev.id}
          event={ev}
          onManage={() => navigate(`/dashboard/event/${ev.id}`)}
          onEdit={() => handleEditEvent(ev.id)}
          onCancel={() => handleCancelEvent(ev.id)}
          onDelete={() => handleDeleteEvent(ev.id)}
          onArchive={() => handleArchiveEvent(ev.id)}
        />
      ))}

      {ToastComponent}

      {confirmConfig && (
        <ConfirmModal
          open
          title={confirmConfig.title}
          message={confirmConfig.message}
          danger={confirmConfig.danger}
          onCancel={closeConfirm}
          onConfirm={confirmConfig.onConfirm}
        />
      )}
    </div>
  );
}

/* ─── StatCard ─────────────────────────────────────────── */
function StatCard({ icon, label, value, color, bg }) {
  return (
    <div className={styles.statCard} style={{ "--stat-color": color, "--stat-bg": bg }}>
      <div className={styles.statIconWrap}>{icon}</div>
      <div>
        <p className={styles.statValue}>{value}</p>
        <p className={styles.statLabel}>{label}</p>
      </div>
    </div>
  );
}

/* ─── EventPerformanceCard ─────────────────────────────── */
function EventPerformanceCard({ event, onManage, onEdit, onCancel, onDelete, onArchive }) {
  const statusInfo = getStatusInfo(event);

  const date = event.event_date
    ? new Date(event.event_date).toLocaleDateString("en-US", {
        weekday: "short", month: "short", day: "numeric",
      })
    : "No date";

  const revenueFormatted =
    event.revenue > 0
      ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(event.revenue)
      : null;

  return (
    <div className={styles.eventCard}>
      {/* Cover */}
      {event.image_url && (
        <img src={event.image_url} className={styles.eventCover} alt="" />
      )}

      {/* Header */}
      <div className={styles.eventBody}>
        <div className={styles.eventTopRow}>
          <div className={styles.eventBadges}>
            <span
              className={styles.statusBadge}
              style={{ color: statusInfo.color, background: statusInfo.bg }}
            >
              {statusInfo.label}
            </span>
            <span className={styles.privacyBadge}>
              {event.is_private ? "Private" : "Public"}
            </span>
            {event.is_paid && (
              <span className={styles.paidBadge}>Paid</span>
            )}
          </div>
        </div>

        <p className={styles.eventTitle}>{event.title || "Untitled Event"}</p>
        <p className={styles.eventMeta}>
          {date}
          {event.location ? ` · ${event.location}` : ""}
        </p>

        {/* Metrics */}
        <div className={styles.metricsRow}>
          <MetricPill label="Tickets"   value={event.ticketsCount}  color="#7c3aed" />
          <MetricPill label="RSVPs"     value={event.rsvpsCount}    color="#2563eb" />
          <MetricPill label="Check-ins" value={event.checkinsCount} color="#16a34a" />
          {revenueFormatted && (
            <MetricPill label="Revenue" value={revenueFormatted} color="#16a34a" />
          )}
        </div>

        {/* Actions */}
        <div className={styles.actionsRow}>
          <button className={styles.btnPrimary} onClick={onManage}>Manage</button>
          <button className={styles.btnSecondary} onClick={onEdit}>Edit</button>

          {event.status !== "cancelled" && (
            <button className={styles.btnDanger} onClick={onCancel}>Cancel</button>
          )}
          {["draft", "pending"].includes(event.status) && (
            <button className={styles.btnDanger} onClick={onDelete}>Delete</button>
          )}
          <button className={styles.btnSecondary} onClick={onArchive}>Archive</button>
        </div>
      </div>
    </div>
  );
}

/* ─── MetricPill ───────────────────────────────────────── */
function MetricPill({ label, value, color }) {
  return (
    <div className={styles.metricPill}>
      <span className={styles.metricLabel}>{label}</span>
      <span className={styles.metricValue} style={{ color }}>{value}</span>
    </div>
  );
}
