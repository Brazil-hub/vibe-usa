import { useNavigate, useLocation } from "react-router-dom";
import styles from "./VisibilitySelect.module.css";

export default function VisibilitySelect() {
  const navigate = useNavigate();
  const { state } = useLocation();

  function choose(visibility) {
  navigate("/create/format", {
    state: {
      ...state,
      is_public: visibility === "public",
    },
  });
}


  return (
    <div className={styles.container}>
      {/* HEADER DO PROCESSO */}
      <div className={styles.processHeader}>
        <div className={styles.processTitle}>Create Event</div>
        <div className={styles.processStep}>
          Step 1 of 5 · Visibility
        </div>
      </div>

      {/* CONTEÚDO */}
      <div className={styles.content}>
        <h2 className={styles.title}>Who can see your event?</h2>

        <div className={styles.cards}>
          {/* EVENTO PÚBLICO */}
          <div
            className={styles.card}
            onClick={() => choose("public")}
          >
            <div className={styles.icon}>🌍</div>

            <div className={styles.textGroup}>
              <div className={styles.cardTitle}>Public Event</div>
              <div className={styles.cardDescription}>
                Anyone can join the event.
              </div>
            </div>
          </div>

          {/* EVENTO PRIVADO */}
          <div
            className={styles.card}
            onClick={() => choose("private")}
          >
            <div className={styles.icon}>🔒</div>

            <div className={styles.textGroup}>
              <div className={styles.cardTitle}>Private Event</div>
              <div className={styles.cardDescription}>
                Access only with a Private Link.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
