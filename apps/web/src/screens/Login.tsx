import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { Field } from "../components/Field";
import { LogoHorizontal, LogoSymbol } from "../components/Logo";
import { authFn, ApiError } from "../lib/api";
import { setPendingEmail } from "../lib/pending";
import { supabase } from "../lib/supabase";
import { useAuth } from "../state/AuthContext";
import { useLock } from "../state/LockContext";

interface LoginResponse {
  session: { access_token: string; refresh_token: string };
}

export default function Login() {
  const navigate = useNavigate();
  const { setSessionTokens } = useAuth();
  const { unlock } = useLock();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    if (!username.trim() || !password) return setError("Escribe tu usuario y tu contraseña");
    setBusy(true);
    setError(null);
    try {
      const res = await authFn<LoginResponse>("login", { username: username.trim().toLowerCase(), password });
      await setSessionTokens(res.session);
      unlock(); // acaba de escribir la contraseña: no hace falta pedirle además el código
      navigate("/", { replace: true });
    } catch (e) {
      if (e instanceof ApiError && e.code === "email_not_confirmed" && typeof e.extra?.email === "string") {
        await supabase.auth.resend({ type: "signup", email: e.extra.email });
        setPendingEmail(e.extra.email);
        return navigate("/verificar", { state: { email: e.extra.email } });
      }
      setError(e instanceof Error ? e.message : "Algo ha fallado. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="b-screen" style={{ gap: 20 }}>
      <div style={{ height: 40 }} />
      <div
        className="b-tile b-tile--accent"
        style={{ alignItems: "flex-start", gap: 16, padding: 22, position: "relative", overflow: "hidden" }}
      >
        <span
          className="on-accent"
          aria-hidden="true"
          style={{ position: "absolute", right: -26, top: -18, opacity: 0.22, display: "flex" }}
        >
          <LogoSymbol size={150} />
        </span>
        <span style={{ position: "relative", display: "flex" }}>
          <LogoHorizontal width={130} onAccent />
        </span>
        <h1 className="b-h1" style={{ position: "relative" }}>
          Hola de nuevo
        </h1>
      </div>
      <form className="b-tile stack" onSubmit={submit} noValidate>
        <Field
          label="Nombre de usuario"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
            setError(null);
          }}
        />
        <Field
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(null);
          }}
          error={error}
        />
        <Link
          to="/recuperar"
          className="b-btn b-btn--link"
          style={{ alignSelf: "flex-end", paddingRight: 4, minHeight: 36 }}
        >
          ¿Olvidaste tu contraseña?
        </Link>
        <button type="submit" className="b-btn b-btn--primary b-btn--block" disabled={busy}>
          {busy ? "Entrando…" : "Iniciar sesión"}
        </button>
      </form>
      <div className="b-spacer" />
      <div className="b-actions">
        <Link to="/registro" className="b-btn b-btn--link">
          ¿No tienes cuenta? Crear cuenta
        </Link>
      </div>
    </main>
  );
}
