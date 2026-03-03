import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { useTicket } from "../../hooks/useSupabaseQuery";
import { useToast } from "../../hooks/useToast";
import styles from "./TicketView.module.css";

export default function TicketView() {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast, ToastComponent } = useToast();

  const { data: ticket, isLoading: loading } = useTicket(ticketId, user?.id);

  if (!user) {
    navigate("/login");
    return null;
  }

  function handleShare() {
    const text = `🎟️ Meu ingresso para ${ticket?.events?.title}\nCódigo: ${ticket?.qr_code}`;
    if (navigator.share) {
      navigator.share({ text, url: window.location.href });
    } else {
      navigator.clipboard.writeText(text);
      showToast("Ingresso copiado 📎");
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
        <p>Ingresso não encontrado.</p>
        <button onClick={() => navigate("/my-tickets")}>Ver meus ingressos</button>
      </div>
    );
  }

  const event = ticket.events;
  const date = event?.event_date ? new Date(event.event_date) : null;
  const dateLabel = date
    ? date.toLocaleDateString("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "Data a confirmar";
  const timeLabel = date
    ? date.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  const statusMap = {
    active: { label: "✅ Válido", bg: "rgba(34,197,94,0.12)", color: "#22c55e" },
    used: { label: "☑️ Utilizado", bg: "rgba(107,114,128,0.12)", color: "#6b7280" },
    cancelled: { label: "❌ Cancelado", bg: "rgba(239,68,68,0.12)", color: "#ef4444" },
  };
  const statusInfo = statusMap[ticket.status] || statusMap.active;

  const qrData = encodeURIComponent(ticket.qr_code);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${qrData}&color=ff1493&bgcolor=0a0a0a&qzone=1`;

  const priceLabel =
    event?.is_paid && event?.price
      ? `R$ ${Number(event.price).toFixed(2)}`
      : "Gratuito";

  return (
    <div className={styles.page}>
      {/* HEADER */}
      <header className={styles.header}>
        <button className={styles.back} onClick={() => navigate("/my-tickets")}>
          ←
        </button>
        <h1 className={styles.headerTitle}>Ingresso</h1>
        <button className={styles.shareBtn} onClick={handleShare}>
          Compartilhar
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

            <h2 className={styles.eventTitle}>{event?.title || "Evento"}</h2>

            <div className={styles.metaGrid}>
              <div className={styles.metaItem}>
                <span className={styles.metaIcon}>📅</span>
                <div>
                  <p className={styles.metaLabel}>Data</p>
                  <p className={styles.metaValue}>{dateLabel}</p>
                </div>
              </div>

              {timeLabel && (
                <div className={styles.metaItem}>
                  <span className={styles.metaIcon}>🕐</span>
                  <div>
                    <p className={styles.metaLabel}>Horário</p>
                    <p className={styles.metaValue}>{timeLabel}</p>
                  </div>
                </div>
              )}

              {event?.location && (
                <div className={styles.metaItem}>
                  <span className={styles.metaIcon}>📍</span>
                  <div>
                    <p className={styles.metaLabel}>Local</p>
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
                  <p className={styles.metaLabel}>Participante</p>
                  <p className={styles.metaValue}>{ticket.name || "–"}</p>
                </div>
              </div>

              <div className={styles.metaItem}>
                <span className={styles.metaIcon}>💰</span>
                <div>
                  <p className={styles.metaLabel}>Valor</p>
                  <p className={styles.metaValue}>{priceLabel}</p>
                </div>
              </div>
            </div>
          </div>

          {/* SEPARADOR PERFURADO */}
          <div className={styles.perforation}>
            <div className={styles.perforationHoleLeft} />
            <div className={styles.perforationLine} />
            <div className={styles.perforationHoleRight} />
          </div>

          {/* BOTTOM — QR CODE */}
          <div className={styles.ticketBottom}>
            <p className={styles.scanLabel}>Apresente na entrada</p>

            <div className={styles.qrWrapper}>
              <img
                src={qrUrl}
                alt={`QR Code - ${ticket.qr_code}`}
                className={styles.qr}
                loading="lazy"
              />
            </div>

            <p className={styles.ticketCode}>{ticket.qr_code}</p>

            {ticket.payment_provider === "generated" && (
              <span className={styles.generatedBadge}>🎁 Ingresso gerado</span>
            )}

            <p className={styles.ticketId}>ID: {ticket.id.slice(0, 8).toUpperCase()}</p>
          </div>
        </div>
      </div>

      {/* AÇÕES */}
      <div className={styles.actions}>
        <button
          className={styles.btnOutline}
          onClick={() => navigate(`/event/${event?.id}`)}
        >
          Ver evento
        </button>
      </div>

      <div className={styles.bottomSpacer} />
      {ToastComponent}
    </div>
  );
}
