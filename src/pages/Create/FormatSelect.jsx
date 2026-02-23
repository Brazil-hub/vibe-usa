import { useNavigate, useLocation } from "react-router-dom";
import styles from "./FormatSelect.module.css";

export default function FormatSelect() {
  const navigate = useNavigate();
  const { state } = useLocation();

  function choose(format) {
    navigate("/create/payment", {
      state: {
        ...state,
        event_format: format,
      },
    });
  }

  return (
    <div className={styles.container}>
      {/* HEADER DO PROCESSO */}
      <div className={styles.processHeader}>
        <div className={styles.processTitle}>Create Event</div>
        <div className={styles.processStep}>Step 2 of 5 · Format</div>
      </div>

      {/* CONTEÚDO */}
      <div className={styles.content}>
        <h2 className={styles.title}>Event Format</h2>

        <div className={styles.cards}>
          {/* PRESENCIAL */}
          <div
            className={styles.card}
            onClick={() => choose("in_person")}
          >
            <div className={styles.icon}>📍</div>

            <div className={styles.textGroup}>
              <div className={styles.cardTitle}>In-Person</div>
              <div className={styles.cardDescription}>
                People come to a physical location.
              </div>
            </div>
          </div>

          {/* ONLINE */}
          <div
            className={styles.card}
            onClick={() => choose("online")}
          >
            <div className={styles.icon}>💻</div>

            <div className={styles.textGroup}>
              <div className={styles.cardTitle}>Online</div>
              <div className={styles.cardDescription}>
                The event happens via a stream link.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
