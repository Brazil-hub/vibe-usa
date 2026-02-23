// src/pages/Create/PaymentSelect.jsx
import { useNavigate, useLocation } from "react-router-dom";
import styles from "./PaymentSelect.module.css";

export default function PaymentSelect() {
  const navigate = useNavigate();
  const { state } = useLocation();

  function choose(isPaid) {
    navigate("/create/form", {
      state: {
        ...state,
        is_paid: isPaid,
      },
    });
  }

  return (
    <div className={styles.container}>
      <div className={styles.processHeader}>
        <div className={styles.processTitle}>Create Event</div>
        <div className={styles.processStep}>Step 3 of 5 · Payment</div>
      </div>

      <div className={styles.content}>
        <div className={styles.title}>This event will be...</div>

        <div className={styles.cards}>
          <div className={styles.card} onClick={() => choose(false)}>
            <span className={styles.icon}>✨</span>
            <div className={styles.textGroup}>
              <div className={styles.cardTitle}>Free</div>
              <div className={styles.cardDescription}>
                Anyone can join at no cost.
              </div>
            </div>
          </div>

          <div className={styles.card} onClick={() => choose(true)}>
            <span className={styles.icon}>💰</span>
            <div className={styles.textGroup}>
              <div className={styles.cardTitle}>Paid</div>
              <div className={styles.cardDescription}>
                Attendees purchase a ticket.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
