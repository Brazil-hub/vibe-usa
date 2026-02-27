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
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "system-ui",
      }}
    >
      Signing you in…
    </div>
  );
}