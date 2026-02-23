import { useNavigate } from "react-router-dom";
import styles from "./OnboardingCard.module.css";

export default function OnboardingCard() {
  const navigate = useNavigate();

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>
        Your event.<br/>Your crew.<br/>Your way.
      </h2>

      <p className={styles.subtitle}>
        Create unforgettable moments and share one-of-a-kind experiences.
      </p>

      <button
        className={styles.button}
        onClick={() => navigate("/login")}
      >
        Sign In &amp; Explore ✨
      </button>
    </div>
  );
}