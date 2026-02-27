import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../supabase/client";
import EventGuestsPage from "./EventGuestsPage";
import EventTicketsPage from "./EventTicketsPage";
import styles from "./DashboardEventPage.module.css";

const TABS = [
  { key: "guests", label: "Convidados" },
  { key: "tickets", label: "Ingressos" },
];

export default function DashboardEventPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("guests");

  useEffect(() => {
    async function loadEvent() {
      const { data } = await supabase
        .from("events")
        .select("id, title, is_private, is_paid")
        .eq("id", id)
        .single();

      setEvent(data);
      setLoading(false);

      // Se for evento pago, começa na aba de ingressos
      if (data?.is_paid) setActiveTab("tickets");
    }

    loadEvent();
  }, [id]);

  if (loading) return <p style={{ padding: 24 }}>Carregando…</p>;
  if (!event) return <p style={{ padding: 24 }}>Evento não encontrado.</p>;

  return (
    <div className={styles.container}>
      {/* HEADER */}
      <header className={styles.header}>
        <button className={styles.back} onClick={() => navigate("/dashboard")}>
          ← Meus eventos
        </button>

        <h1 className={styles.title}>{event.title}</h1>

        <div className={styles.badgeRow}>
          {event.is_private && (
            <span className={styles.badge}>🔒 Privado</span>
          )}
          {event.is_paid && (
            <span className={`${styles.badge} ${styles.badgePaid}`}>💰 Pago</span>
          )}
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

      {/* CONTEÚDO */}
      {activeTab === "guests" && <EventGuestsPage />}
      {activeTab === "tickets" && <EventTicketsPage />}
    </div>
  );
}
