import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { getEventById } from "../../supabase/events";
import { purchaseTicket, getUserTicketForEvent } from "../../supabase/tickets";
import { useToast } from "../../hooks/useToast";
import styles from "./BuyTicketPage.module.css";

export default function BuyTicketPage() {
  const { id: eventId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast, ToastComponent } = useToast();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existingTicket, setExistingTicket] = useState(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [step, setStep] = useState("form"); // "form" | "confirm" | "success"

  useEffect(() => {
    if (!user) {
      localStorage.setItem("postLoginRedirect", window.location.pathname);
      navigate("/login");
      return;
    }

    async function load() {
      const [{ data: ev }, { data: ticket }] = await Promise.all([
        getEventById(eventId),
        getUserTicketForEvent(eventId),
      ]);

      setEvent(ev);
      setExistingTicket(ticket);

      // Pré-preenche com dados do perfil
      setName(user.user_metadata?.full_name || "");
      setEmail(user.email || "");
      setLoading(false);
    }

    load();
  }, [eventId, user, navigate]);

  async function handlePurchase() {
    if (!name.trim() || !email.trim()) {
      showToast("Preencha seu nome e e-mail 👀");
      return;
    }

    setSubmitting(true);

    const { data, error } = await purchaseTicket({
      eventId,
      price: event.price || 0,
      attendeeName: name.trim(),
      attendeeEmail: email.trim(),
      paymentMethod: "simulated",
    });

    setSubmitting(false);

    if (error) {
      console.error(error);
      showToast("Erro ao processar ingresso. Tente novamente.", "error");
      return;
    }

    navigate(`/my-tickets/${data.ticket.id}`);
  }

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
      </div>
    );
  }

  if (!event) {
    return (
      <div className={styles.notFound}>
        <p>Evento não encontrado.</p>
      </div>
    );
  }

  if (existingTicket) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.alreadyIcon}>🎟️</div>
          <h2 className={styles.alreadyTitle}>Você já tem um ingresso!</h2>
          <p className={styles.alreadyText}>
            Você já comprou ingresso para <strong>{event.title}</strong>.
          </p>
          <button
            className={styles.btnPrimary}
            onClick={() => navigate(`/my-tickets/${existingTicket.id}`)}
          >
            Ver meu ingresso
          </button>
          <button
            className={styles.btnGhost}
            onClick={() => navigate(`/event/${eventId}`)}
          >
            Voltar ao evento
          </button>
        </div>
        {ToastComponent}
      </div>
    );
  }

  const priceLabel =
    event.price > 0
      ? `R$ ${Number(event.price).toFixed(2)}`
      : "Gratuito";

  const date = event.event_date ? new Date(event.event_date) : null;
  const dateLabel = date
    ? date.toLocaleDateString("pt-BR", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Data a confirmar";

  return (
    <div className={styles.page}>
      {/* HEADER */}
      <header className={styles.header}>
        <button className={styles.back} onClick={() => navigate(`/event/${eventId}`)}>
          ← Voltar
        </button>
        <h1 className={styles.headerTitle}>Comprar Ingresso</h1>
      </header>

      {/* EVENT INFO */}
      <div className={styles.eventCard}>
        {event.image_url && (
          <img src={event.image_url} alt="" className={styles.eventImg} />
        )}
        <div className={styles.eventInfo}>
          <p className={styles.eventTitle}>{event.title}</p>
          <p className={styles.eventMeta}>📅 {dateLabel}</p>
          {event.location && (
            <p className={styles.eventMeta}>📍 {event.location}</p>
          )}
        </div>
        <div className={styles.priceTag}>{priceLabel}</div>
      </div>

      {/* FORM */}
      <div className={styles.formCard}>
        <h2 className={styles.formTitle}>Dados do participante</h2>

        <div className={styles.field}>
          <label className={styles.label}>Nome completo</label>
          <input
            className={styles.input}
            type="text"
            placeholder="Seu nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>E-mail</label>
          <input
            className={styles.input}
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      </div>

      {/* RESUMO */}
      <div className={styles.summaryCard}>
        <div className={styles.summaryRow}>
          <span>Ingresso × 1</span>
          <span>{priceLabel}</span>
        </div>
        <div className={styles.summaryDivider} />
        <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
          <span>Total</span>
          <span className={styles.totalPrice}>{priceLabel}</span>
        </div>

        {event.price > 0 && (
          <p className={styles.paymentNote}>
            💳 Pagamento simulado (integração com gateway em breve)
          </p>
        )}
      </div>

      {/* CTA */}
      <div className={styles.ctaArea}>
        <button
          className={styles.btnPrimary}
          onClick={handlePurchase}
          disabled={submitting}
        >
          {submitting
            ? "Processando…"
            : event.price > 0
            ? `Pagar ${priceLabel}`
            : "Garantir ingresso gratuito"}
        </button>

        <button
          className={styles.btnGhost}
          onClick={() => navigate(`/event/${eventId}`)}
        >
          Cancelar
        </button>
      </div>

      <div className={styles.bottomSpacer} />
      {ToastComponent}
    </div>
  );
}
