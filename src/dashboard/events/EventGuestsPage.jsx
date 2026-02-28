import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../supabase/client";
import styles from "./EventGuestsPage.module.css";

const STATUS_FILTERS = [
  { key: "all",       label: "All" },
  { key: "going",     label: "Going" },
  { key: "maybe",     label: "Maybe" },
  { key: "not_going", label: "Not Going" },
];

export default function EventGuestsPage() {
  const { id } = useParams();
  const [rsvps, setRsvps]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState("all");
  const [copied, setCopied]   = useState(false);

  useEffect(() => {
    async function fetchRsvps() {
      setLoading(true);
      const { data } = await supabase
        .from("rsvps")
        .select("id, status, created_at, users(id, name, email)")
        .eq("event_id", id)
        .order("created_at", { ascending: false });

      if (data) setRsvps(data);
      setLoading(false);
    }
    fetchRsvps();
  }, [id]);

  const eventLink = `${window.location.origin}/event/${id}`;

  function handleCopy() {
    navigator.clipboard.writeText(eventLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const going    = rsvps.filter((r) => r.status === "going");
  const maybe    = rsvps.filter((r) => r.status === "maybe");
  const notGoing = rsvps.filter((r) => r.status === "not_going");

  const filtered =
    filter === "going"    ? going    :
    filter === "maybe"    ? maybe    :
    filter === "not_going"? notGoing :
    rsvps;

  const counts = {
    all:       rsvps.length,
    going:     going.length,
    maybe:     maybe.length,
    not_going: notGoing.length,
  };

  return (
    <div className={styles.page}>
      {/* HEADER */}
      <div className={styles.header}>
        <div className={styles.headerText}>
          <h2 className={styles.headerTitle}>Guests</h2>
          <p className={styles.headerSub}>Share the link — anyone who opens it can RSVP.</p>
        </div>
        <button className={styles.copyBtn} onClick={handleCopy}>
          {copied ? "Copied!" : "Copy Link"}
        </button>
      </div>

      {/* FILTER TABS */}
      <div className={styles.filterRow}>
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.key}
            className={`${styles.filterTab} ${filter === f.key ? styles.filterActive : ""}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
            <span className={styles.filterCount}>{counts[f.key]}</span>
          </button>
        ))}
      </div>

      {/* LIST */}
      {loading ? (
        <div className={styles.list}>
          {[1, 2, 3].map((i) => (
            <div key={i} className={`${styles.guestRow} ${styles.skeletonRow}`} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className={styles.empty}>No guests found for this filter.</p>
      ) : (
        <div className={styles.list}>
          {filtered.map((item) => (
            <GuestRow key={item.id} rsvp={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function GuestRow({ rsvp }) {
  const name  = rsvp.users?.name  || rsvp.users?.email?.split("@")[0] || "User";
  const email = rsvp.users?.email || "";

  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const date = rsvp.created_at
    ? new Date(rsvp.created_at).toLocaleDateString("en-US", {
        month: "short", day: "numeric",
      })
    : "";

  const statusConfig = {
    going:     { label: "Going",     color: "#16a34a", bg: "rgba(22,163,74,0.12)" },
    maybe:     { label: "Maybe",     color: "#d97706", bg: "rgba(217,119,6,0.12)" },
    not_going: { label: "Not Going", color: "#dc2626", bg: "rgba(220,38,38,0.12)" },
  };
  const st = statusConfig[rsvp.status] || statusConfig.going;

  return (
    <div className={styles.guestRow}>
      <div className={styles.guestAvatar}>{initials}</div>
      <div className={styles.guestInfo}>
        <p className={styles.guestName}>{name}</p>
        {email && <p className={styles.guestEmail}>{email}</p>}
      </div>
      <div className={styles.guestRight}>
        <span
          className={styles.statusBadge}
          style={{ color: st.color, background: st.bg }}
        >
          {st.label}
        </span>
        {date && <span className={styles.guestDate}>{date}</span>}
      </div>
    </div>
  );
}
