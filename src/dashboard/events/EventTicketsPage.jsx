import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../supabase/client";
import {
  getEventTickets,
  generateTicket,
  checkInTicket,
  cancelTicket,
} from "../../supabase/tickets";
import { useToast } from "../../hooks/useToast";
import styles from "./EventTicketsPage.module.css";

export default function EventTicketsPage() {
  const { id: eventId } = useParams();
  const { showToast, ToastComponent } = useToast();

  const [event, setEvent] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  // Geração de ingresso
  const [showGenModal, setShowGenModal] = useState(false);
  const [genName, setGenName] = useState("");
  const [genEmail, setGenEmail] = useState("");
  const [generating, setGenerating] = useState(false);

  // Filtro/busca
  const [search, setSearch] = useState("");

  async function loadData() {
    const [{ data: ev }, { data: tks }] = await Promise.all([
      supabase.from("events").select("id, title, is_private, is_paid, price").eq("id", eventId).single(),
      getEventTickets(eventId),
    ]);
    setEvent(ev);
    setTickets(tks || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [eventId]);

  async function handleGenerate() {
    if (!genName.trim() || !genEmail.trim()) {
      showToast("Preencha nome e e-mail 👀");
      return;
    }
    setGenerating(true);
    const { data, error } = await generateTicket({
      eventId,
      attendeeName: genName.trim(),
      attendeeEmail: genEmail.trim(),
    });
    setGenerating(false);

    if (error) {
      showToast(`Error: ${error?.message || "Couldn't generate ticket"}`, "error");
      console.error("generateTicket error:", error);
      return;
    }

    showToast(`Ticket generated! Code: ${data?.qr_code || "✓"} 🎟️`);
    setShowGenModal(false);
    setGenName("");
    setGenEmail("");
    await loadData();
  }

  async function handleCheckIn(ticketId) {
    const { error } = await checkInTicket(ticketId);
    if (error) {
      showToast("Erro ao fazer check-in", "error");
      return;
    }
    showToast("Check-in realizado ✅");
    await loadData();
  }

  async function handleCancel(ticketId) {
    const { error } = await cancelTicket(ticketId);
    if (error) {
      showToast("Erro ao cancelar ingresso", "error");
      return;
    }
    showToast("Ingresso cancelado");
    await loadData();
  }

  function copyCode(code) {
    navigator.clipboard.writeText(code);
    showToast("Código copiado!");
  }

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
      </div>
    );
  }

  const filtered = tickets.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      t.name?.toLowerCase().includes(q) ||
      t.attendee_email?.toLowerCase().includes(q) ||
      t.qr_code?.toLowerCase().includes(q)
    );
  });

  const stats = {
    total: tickets.length,
    active: tickets.filter((t) => t.status === "active").length,
    used: tickets.filter((t) => t.status === "used").length,
    cancelled: tickets.filter((t) => t.status === "cancelled").length,
  };

  const revenue = event?.is_paid && event?.price
    ? (stats.active + stats.used) * (event.price || 0)
    : 0;

  const revenueFormatted = revenue > 0
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(revenue)
    : null;

  return (
    <div className={styles.page}>
      {/* STATS */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <span className={styles.statNum}>{stats.total}</span>
          <span className={styles.statLabel}>Total</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statNum} style={{ color: "#22c55e" }}>{stats.active}</span>
          <span className={styles.statLabel}>Active</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statNum} style={{ color: "#6b7280" }}>{stats.used}</span>
          <span className={styles.statLabel}>Used</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statNum} style={{ color: "#ef4444" }}>{stats.cancelled}</span>
          <span className={styles.statLabel}>Cancelled</span>
        </div>
        {revenueFormatted && (
          <div className={styles.statCard}>
            <span className={styles.statNum} style={{ color: "#22c55e", fontSize: 16 }}>{revenueFormatted}</span>
            <span className={styles.statLabel}>Revenue</span>
          </div>
        )}
      </div>

      {/* ACTIONS */}
      <div className={styles.actionsRow}>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Search by name, email or code…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          className={styles.btnGenerate}
          onClick={() => setShowGenModal(true)}
        >
          + Generate Ticket
        </button>
      </div>

      {/* TICKET LIST */}
      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>🎟️</span>
          <p className={styles.emptyTitle}>
            {tickets.length === 0
              ? "No tickets yet"
              : "No results"}
          </p>
          {tickets.length === 0 && (
            <p className={styles.emptyText}>
              {event?.is_private
                ? "Generate tickets for your private event guests."
                : "Sold tickets will appear here."}
            </p>
          )}
        </div>
      ) : (
        <div className={styles.list}>
          {filtered.map((ticket) => (
            <TicketRow
              key={ticket.id}
              ticket={ticket}
              onCheckIn={() => handleCheckIn(ticket.id)}
              onCancel={() => handleCancel(ticket.id)}
              onCopyCode={() => copyCode(ticket.qr_code)}
            />
          ))}
        </div>
      )}

      {/* MODAL GERAR INGRESSO */}
      {showGenModal && (
        <div className={styles.overlay} onClick={() => setShowGenModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>🎟️ Generate Ticket</h3>
            <p className={styles.modalSubtitle}>
              Generate a ticket for a specific guest.
            </p>

            <div className={styles.field}>
              <label className={styles.label}>Attendee name</label>
              <input
                className={styles.input}
                type="text"
                placeholder="Full name"
                value={genName}
                onChange={(e) => setGenName(e.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Attendee email</label>
              <input
                className={styles.input}
                type="email"
                placeholder="email@example.com"
                value={genEmail}
                onChange={(e) => setGenEmail(e.target.value)}
              />
            </div>

            <div className={styles.modalActions}>
              <button
                className={styles.btnPrimary}
                onClick={handleGenerate}
                disabled={generating}
              >
                {generating ? "Generating…" : "Generate ticket"}
              </button>
              <button
                className={styles.btnCancel}
                onClick={() => setShowGenModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {ToastComponent}
    </div>
  );
}

// ─────────────────────────────────────────────
// TICKET ROW
// ─────────────────────────────────────────────

function TicketRow({ ticket, onCheckIn, onCancel, onCopyCode }) {
  const [expanded, setExpanded] = useState(false);

  const statusConfig = {
    active:    { label: "Active",    color: "#22c55e", bg: "rgba(34,197,94,0.1)" },
    used:      { label: "Used",      color: "#6b7280", bg: "rgba(107,114,128,0.1)" },
    cancelled: { label: "Cancelled", color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
  };
  const st = statusConfig[ticket.status] || statusConfig.active;

  const createdAt = new Date(ticket.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={styles.ticketRow}>
      <button
        className={styles.ticketRowHeader}
        onClick={() => setExpanded((v) => !v)}
      >
        <div className={styles.ticketRowLeft}>
          <span
            className={styles.statusDot}
            style={{ background: st.color }}
          />
          <div>
            <p className={styles.rowName}>{ticket.name || "—"}</p>
            <p className={styles.rowEmail}>{ticket.payment_provider === "generated" ? "🎁 Generated" : "🛒 Purchased"}</p>
          </div>
        </div>

        <div className={styles.ticketRowRight}>
          <span
            className={styles.rowStatus}
            style={{ color: st.color, background: st.bg }}
          >
            {st.label}
          </span>
          <span className={styles.expandIcon}>{expanded ? "▲" : "▼"}</span>
        </div>
      </button>

      {expanded && (
        <div className={styles.ticketRowDetails}>
          <div className={styles.codeRow}>
            <code className={styles.code}>{ticket.qr_code}</code>
            <button className={styles.copyBtn} onClick={onCopyCode}>
              Copy
            </button>
          </div>

          <p className={styles.detailMeta}>
            {ticket.payment_provider === "generated" ? "🎁 Generated by organizer" : "🛒 Purchase"} · {createdAt}
          </p>

          {ticket.used_at && (
            <p className={styles.detailMeta}>
              ✅ Check-in: {new Date(ticket.used_at).toLocaleString("en-US")}
            </p>
          )}

          <div className={styles.rowActions}>
            {ticket.status === "active" && (
              <button className={styles.btnCheckin} onClick={onCheckIn}>
                ✅ Check-in
              </button>
            )}
            {ticket.status !== "cancelled" && (
              <button className={styles.btnCancelRow} onClick={onCancel}>
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
