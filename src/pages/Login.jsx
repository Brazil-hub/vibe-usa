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
        title: "Conta já existe",
        message: "Este email já possui uma conta. Faça login.",
      };
    }

    if (msg.includes("invalid login credentials")) {
      return {
        title: "Dados incorretos",
        message: "Email ou senha incorretos.",
      };
    }

    if (msg.includes("password")) {
      return {
        title: "Senha inválida",
        message: "A senha deve ter pelo menos 6 caracteres.",
      };
    }

    return {
      title: "Erro",
      message:
        context === "signup"
          ? "Não foi possível criar a conta. Tente novamente."
          : "Não foi possível entrar. Tente novamente.",
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
          "Conta criada 🎉",
          "Sua conta foi criada com sucesso. Você já pode entrar.",
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
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
    } catch (err) {
      openModal(
        "Erro",
        "Não foi possível entrar com Google. Tente novamente."
      );
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>
        {mode === "login" ? "Entrar" : "Criar conta"}
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
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button type="submit" disabled={loading}>
          {loading
            ? "Aguarde..."
            : mode === "login"
            ? "Entrar"
            : "Criar conta"}
        </button>
      </form>

      <div className={styles.divider}>ou</div>

      <button
        className={styles.googleButton}
        onClick={handleGoogleLogin}
        disabled={loading}
      >
        Continuar com Google
      </button>

      <p className={styles.switch}>
        {mode === "login" ? (
          <>
            Não tem conta?{" "}
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setPassword("");
              }}
            >
              Criar agora
            </button>
          </>
        ) : (
          <>
            Já tem conta?{" "}
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setPassword("");
              }}
            >
              Entrar
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
