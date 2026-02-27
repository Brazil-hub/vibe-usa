import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase/client";
import { ensureUserProfile } from "./ensureUserProfile";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    async function processCallback() {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Auth callback error:", error);
          navigate("/login", { replace: true });
          return;
        }

        const session = data?.session;
        const user = session?.user ?? null;

        if (!user) {
          navigate("/login", { replace: true });
          return;
        }

        await ensureUserProfile(user);

        const redirect = localStorage.getItem("postLoginRedirect");
        if (redirect) {
          localStorage.removeItem("postLoginRedirect");
          navigate(redirect, { replace: true });
          return;
        }

        navigate("/", { replace: true });
      } catch (err) {
        console.error("Auth callback unexpected error:", err);
        navigate("/login", { replace: true });
      }
    }

    processCallback();
  }, [navigate]);

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        gap: 12,
        fontFamily: "system-ui",
        color: "#ff2d8d",
      }}
    >
      <div style={{ fontSize: 32 }}>✨</div>
      <p style={{ margin: 0, fontWeight: 600 }}>Signing you in…</p>
    </div>
  );
}
