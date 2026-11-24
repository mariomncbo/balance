import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabase";

interface AuthValue {
  session: Session | null;
  /** false mientras se lee la sesión guardada al abrir la app. */
  ready: boolean;
  signOut: () => Promise<void>;
  setSessionTokens: (t: { access_token: string; refresh_token: string }) => Promise<void>;
}
const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);
  const setSessionTokens = useCallback(async (t: { access_token: string; refresh_token: string }) => {
    const { error } = await supabase.auth.setSession(t);
    if (error) throw error;
  }, []);

  const value = useMemo(
    () => ({ session, ready, signOut, setSessionTokens }),
    [session, ready, signOut, setSessionTokens],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth fuera de AuthProvider");
  return v;
}
