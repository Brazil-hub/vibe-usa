import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../supabase/client";
import { useAuth } from "../../auth/useAuth";
import { useToast } from "../../hooks/useToast";
import { DRAFT_SESSION_KEY } from "../../constants";
import ConfirmModal from "../../components/ui/ConfirmModal";
import "./overview.css";

export default function OverviewPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast, ToastComponent } = useToast();

  const [stats, setStats] = useState({
    eventsCount: 0,
    ticketsCount: 0,
    rsvpsCount: 0,
    checkinsCount: 0,
  });
  const [eventsWithMetrics, setEventsWithMetrics] = useState([]);
  const [loading, setLoading] = useState(true);

  const creatorId = useMemo(() => user?.id ?? null, [user]);

  const [confirmConfig, setConfirmConfig] = useState(null);

  function openConfirm(config) {
    setConfirmConfig(config);
  }

  function closeConfirm() {
    setConfirmConfig(null);
  }

  /* =========================
     EDITAR EVENTO
  ========================== */
  async function handleEditEvent(eventId) {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("id", eventId)
      .single();

    const { data: tickets } = await supabase
  .from("tickets")
  .select("*")
  .eq("event_id", eventId);

  const { data: ticketTypes } = await supabase
  .from("ticket_types")
  .select("*")
  .eq("event_id", eventId);



    if (error || !data) {
      console.error("Erro ao carregar evento para edição:", error);
      showToast("Error opening event for editing", "error");
      return;
    }

    sessionStorage.setItem(
  DRAFT_SESSION_KEY,
  JSON.stringify({
    ...data,
    is_paid: data.is_paid === true,
    price: data.price ?? 0,
    fromDashboardEdit: true,
  })
);



    navigate("/create/form", {
  state: {
    id: data.id, // 🔑 ISSO É O QUE DESTRAVA TUDO
    fromDashboardEdit: true,
  },
});

  }

  /* =========================
     CANCELAR EVENTO
  ========================== */
  async function handleCancelEvent(eventId) {
    openConfirm({
      title: "Cancel Event",
      message:
        "Are you sure you want to cancel this event? It will no longer be visible to the public.",
      danger: true,
      onConfirm: async () => {
        closeConfirm();

        const { error } = await supabase
          .from("events")
          .update({ status: "cancelled" })
          .eq("id", eventId)
          .eq("creator_id", user.id);

        if (error) {
          console.error("Erro ao cancelar evento:", error);
          showToast("Couldn't cancel the event", "error");
          return;
        }

        showToast("Event canceled successfully");

        setTimeout(() => {
          window.location.reload();
        }, 1200);
      },
    });
  }

  /* =========================
     DELETAR EVENTO (DRAFT/PENDING)
  ========================== */
  async function handleDeleteEvent(eventId) {
    openConfirm({
      title: "Delete Event",
      message:
        "This will permanently delete the event. This action cannot be undone.",
      danger: true,
      onConfirm: async () => {
        closeConfirm();

        const { error } = await supabase
          .from("events")
          .delete()
          .eq("id", eventId)
          .eq("creator_id", user.id)
          .in("status", ["draft", "pending"]);

        if (error) {
          console.error("Erro ao deletar evento:", error);
          showToast("Couldn't delete the event", "error");
          return;
        }

        showToast("Event deleted successfully");

        setTimeout(() => {
          window.location.reload();
        }, 1200);
      },
    });
  }

  /* =========================
     ARQUIVAR EVENTO
  ========================== */
  async function handleArchiveEvent(eventId) {
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

        if (error) {
          console.error("Erro ao arquivar evento:", error);
          showToast("Couldn't archive the event", "error");
          return;
        }

        showToast("Event archived");

        setTimeout(() => {
          window.location.reload();
        }, 1200);
      },
    });
  }

  /* =========================
     LOAD DASHBOARD
  ========================== */
  useEffect(() => {
    let cancelled = false;

    async function loadOverview() {
      if (!creatorId) {
        setLoading(false);
        return;
      }

      setLoading(true);

      const { data: events, error: eventsError } = await supabase
        .from("events")
        .select("id, title, event_date, location, image_url, is_private, status")
        .eq("creator_id", creatorId)
        .not("status", "eq", "archived")
        .order("event_date", { ascending: true });

      if (cancelled) return;

      if (eventsError) {
        console.error("Erro carregando eventos:", eventsError);
        showToast("Error loading events", "error");
        setLoading(false);
        return;
      }

      const eventIds = (events ?? []).map((e) => e.id);

      if (eventIds.length === 0) {
        setStats({
          eventsCount: 0,
          ticketsCount: 0,
          rsvpsCount: 0,
          checkinsCount: 0,
        });
        setEventsWithMetrics([]);
        setLoading(false);
        return;
      }

      const [
        { count: ticketsCount },
        { count: rsvpsCount },
        { count: checkinsCount },
      ] = await Promise.all([
        supabase
          .from("tickets")
          .select("*", { count: "exact", head: true })
          .in("event_id", eventIds),

        supabase
          .from("rsvps")
          .select("*", { count: "exact", head: true })
          .in("event_id", eventIds),

        supabase
          .from("checkins")
          .select("*", { count: "exact", head: true })
          .in("event_id", eventIds),
      ]);

      if (cancelled) return;

      setStats({
        eventsCount: events.length,
        ticketsCount: ticketsCount ?? 0,
        rsvpsCount: rsvpsCount ?? 0,
        checkinsCount: checkinsCount ?? 0,
      });

      const eventsMetrics = await Promise.all(
        events.map(async (ev) => {
          const [tRes, rRes, cRes] = await Promise.all([
            supabase
              .from("tickets")
              .select("*", { count: "exact", head: true })
              .eq("event_id", ev.id),

            supabase
              .from("rsvps")
              .select("*", { count: "exact", head: true })
              .eq("event_id", ev.id),

            supabase
              .from("checkins")
              .select("*", { count: "exact", head: true })
              .eq("event_id", ev.id),
          ]);

          return {
            ...ev,
            ticketsCount: tRes.count ?? 0,
            rsvpsCount: rRes.count ?? 0,
            checkinsCount: cRes.count ?? 0,
          };
        })
      );

      if (cancelled) return;

      setEventsWithMetrics(eventsMetrics);
      setLoading(false);
    }

    loadOverview();

    return () => {
      cancelled = true;
    };
  }, [creatorId]);

  if (!user) return null;

  if (loading) {
    return (
      <div className="overview-wrapper">
        <h2 className="overview-title">Overview</h2>
        <p className="no-events">Loading…</p>
      </div>
    );
  }

  return (
    <div className="overview-wrapper">
      <h2 className="overview-title">Overview</h2>

      <div className="stats-grid">
        <StatCard label="Events Created" value={stats.eventsCount} />
        <StatCard label="Tickets Sold" value={stats.ticketsCount} />
        <StatCard label="RSVPs" value={stats.rsvpsCount} />
        <StatCard label="Check-ins" value={stats.checkinsCount} />
      </div>

      <section className="events-section">
        <h3 className="events-section-title">Event Performance</h3>

        {eventsWithMetrics.length === 0 && (
          <p className="no-events">You haven't created any events yet.</p>
        )}

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
      </section>

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

/* =========================
   COMPONENTES AUXILIARES
========================== */

function StatCard({ label, value }) {
  return (
    <div className="stat-card">
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
    </div>
  );
}

function EventPerformanceCard({
  event,
  onManage,
  onEdit,
  onCancel,
  onDelete,
  onArchive,
}) {
  const date = event.event_date
    ? new Date(event.event_date).toLocaleDateString("en-US")
    : "No date";

  return (
    <div className="event-card">
      {event.image_url && (
        <img src={event.image_url} className="event-cover" alt="event cover" />
      )}

      <div className="event-header">
        <div>
          <p className="event-title">{event.title || "Untitled Event"}</p>
          <p className="event-meta">
            {date} · {event.location || "Venue TBD"}
          </p>

          <p className="event-privacy">
            {event.is_private ? "🔒 Private" : "🌎 Public"}
          </p>
        </div>
      </div>

      <div className="event-metrics-row">
        <MetricPill label="Tickets" value={event.ticketsCount} />
        <MetricPill label="RSVPs" value={event.rsvpsCount} />
        <MetricPill label="Check-ins" value={event.checkinsCount} />
      </div>

      <div className="event-actions-row">
        <button className="event-action-btn" onClick={onManage}>
          Manage
        </button>

        <button className="event-action-btn secondary" onClick={onEdit}>
          Edit
        </button>

        {event.status !== "cancelled" && (
          <button className="event-action-btn danger" onClick={onCancel}>
            Cancel
          </button>
        )}

        {["draft", "pending"].includes(event.status) && (
          <button className="event-action-btn danger" onClick={onDelete}>
            Delete
          </button>
        )}

        <button className="event-action-btn secondary" onClick={onArchive}>
          Archive
        </button>
      </div>
    </div>
  );
}

function MetricPill({ label, value }) {
  return (
    <div className="metric-pill">
      <span className="metric-pill-label">{label}</span>
      <span className="metric-pill-value">{value}</span>
    </div>
  );
}
