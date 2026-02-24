import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../supabase/client";

const AuthContext = createContext(null);

const DEV_LOGIN_KEY = "__dev_login__";

const DEV_USER = {
  id: "dev-user-00000000-0000-0000-0000-000000000000",
  email: "dev@localhost",
  user_metadata: { full_name: "Dev User", avatar_url: null },
  app_metadata: {},
  role: "authenticated",
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // DEV bypass — skip Supabase entirely when flag is set
    if (import.meta.env.DEV && localStorage.getItem(DEV_LOGIN_KEY) === "true") {
      setUser(DEV_USER);
      setIsLoading(false);
      return;
    }

    // Sessão inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    // Listener de auth (SEM redirect)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Email + senha
  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  }

  async function signUp(email, password) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;
  }

  // ✅ GOOGLE LOGIN COM REDIRECT CORRETO
  async function signInWithGoogle() {
    const redirect =
      localStorage.getItem("postLoginRedirect") || "/feed";

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}${redirect}`,
      },
    });

    if (error) throw error;
  }

  async function logout() {
    if (import.meta.env.DEV) localStorage.removeItem(DEV_LOGIN_KEY);
    await supabase.auth.signOut().catch(() => {});
    setUser(null);
  }

  function devLogin() {
    localStorage.setItem(DEV_LOGIN_KEY, "true");
    setUser(DEV_USER);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        signIn,
        signUp,
        signInWithGoogle,
        logout,
        ...(import.meta.env.DEV ? { devLogin } : {}),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
