import { useState } from "react";
import { supabase } from "../supabase/client";
import { useNavigate } from "react-router-dom";
import styles from "./Login.module.css";

export default function Login() {
  const navigate = useNavigate();

  const [mode, setMode] = useState("login"); // login | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // modal genérico (erro / sucesso)
  const [showModal, setShowModal] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const [modalAction, setModalAction] = useState(null);

  function openModal(title, message, action = null) {
    setModalTitle(title);
    setModalMessage(message);
    setModalAction(() => action);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setModalAction(null);
  }

  function mapSupabaseError(err, context) {
    const msg = err?.message?.toLowerCase() || "";

    if (msg.includes("already registered")) {
      return {
        title: "Account already exists",
        message: "This email is already registered. Sign in instead.",
      };
    }

    if (msg.includes("invalid login credentials")) {
      return {
        title: "Incorrect credentials",
        message: "Email or password is incorrect.",
      };
    }

    if (msg.includes("password")) {
      return {
        title: "Invalid password",
        message: "Password must be at least 6 characters.",
      };
    }

    return {
      title: "Error",
      message:
        context === "signup"
          ? "Couldn't create account. Please try again."
          : "Couldn't sign in. Please try again.",
    };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;

    setLoading(true);

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        const redirect =
          localStorage.getItem("postLoginRedirect") || "/";
        localStorage.removeItem("postLoginRedirect");
        navigate(redirect);
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;

        // signup bem-sucedido → feedback + redirect neutro
        localStorage.removeItem("postLoginRedirect");

        openModal(
          "Account created 🎉",
          "Your account was created successfully. You can now sign in.",
          () => navigate("/")
        );
      }
    } catch (err) {
      const { title, message } = mapSupabaseError(err, mode);
      openModal(title, message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    if (loading) return;
    setLoading(true);

    try {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });
    } catch (err) {
      openModal(
        "Error",
        "Couldn't sign in with Google. Please try again."
      );
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>
        {mode === "login" ? "Sign In" : "Create Account"}
      </h2>

      <form onSubmit={handleSubmit} className={styles.form}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button type="submit" disabled={loading}>
          {loading
            ? "Please wait..."
            : mode === "login"
            ? "Sign In"
            : "Create Account"}
        </button>
      </form>

      <div className={styles.divider}>or</div>

      <button
        className={styles.googleButton}
        onClick={handleGoogleLogin}
        disabled={loading}
      >
        Continue with Google
      </button>

      <p className={styles.switch}>
        {mode === "login" ? (
          <>
            Don't have an account?{" "}
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setPassword("");
              }}
            >
              Sign up
            </button>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setPassword("");
              }}
            >
              Sign In
            </button>
          </>
        )}
      </p>

      {/* MODAL GENÉRICO (erro / sucesso) */}
      {showModal && (
        <div
          onClick={closeModal}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 14,
              padding: 20,
              width: "90%",
              maxWidth: 320,
              textAlign: "center",
            }}
          >
            <h3 style={{ marginTop: 0 }}>{modalTitle}</h3>

            <p style={{ margin: "8px 0", fontSize: 14, color: "#555" }}>
              {modalMessage}
            </p>

            <button
              style={{
                marginTop: 16,
                width: "100%",
                padding: "12px",
                borderRadius: 12,
                border: "none",
                background: "#ff2f92",
                color: "#fff",
                fontWeight: 700,
                fontSize: 14,
              }}
              onClick={() => {
                closeModal();
                if (modalAction) modalAction();
              }}
            >
              Ok
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
