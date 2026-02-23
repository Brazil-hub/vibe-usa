import { useNavigate } from "react-router-dom";
import styles from "./PublicTopBar.module.css";

export default function PublicTopBar() {
  const navigate = useNavigate();

  return (
    <div className={styles.wrapper}>
      <button className={styles.back} onClick={() => navigate("/")}>
        Events
      </button>

      <button className={styles.brand} onClick={() => navigate("/")}>
        VibeCultural.com
      </button>

      <button className={styles.login} onClick={() => navigate("/login")}>
        Sign In
      </button>
    </div>
  );
}
