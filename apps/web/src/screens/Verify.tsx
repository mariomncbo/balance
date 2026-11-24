import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Icon } from "../components/Icon";
import { PinBoxes } from "../components/PinBoxes";
import { api, ApiError } from "../lib/api";
import { clearPendingEmail, getPendingEmail } from "../lib/pending";
import { supabase } from "../lib/supabase";
import { useData } from "../state/DataContext";
import { clearOnboarding, isEmptyOnboarding, readOnboarding, toImportParams } from "../state/onboarding";

const RESEND_SECONDS = 60;

export default function Verify() {
  const navigate = useNavigate();
  const { invalidate } = useData();
  const location = useLocation();
  const email = (location.state as { email?: string } | null)?.email ?? getPendingEmail();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(RESEND_SECONDS);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const verify = useCallback(
    async (token: string) => {
      if (!email) return;
      setBusy(true);
      setError(null);
      const { error: err } = await supabase.auth.verifyOtp({ email, token, type: "signup" });
      if (err) {
        setBusy(false);
        setCode("");
        return setError(
          /expired|invalid/i.test(err.message)
            ? "El código no es válido o ha caducado. Pide uno nuevo."
            : "No se ha podido verificar el código. Inténtalo de nuevo.",
        );
      }
      // Ya hay sesión: se sube de una vez lo del onboarding y se sigue con el código de acceso.
      const data = readOnboarding();
      if (!isEmptyOnboarding(data)) {
        try {
          await api("onboarding.import", toImportParams(data));
        } catch (e) {
          if (!(e instanceof ApiError && e.status === 409)) {
            setBusy(false);
            return setError(
              "Tu correo está verificado, pero no se han podido guardar los datos del inicio. Se guardarán en cuanto vuelvas a intentarlo.",
            );
          }
        }
      }
      clearOnboarding();
      clearPendingEmail();
      invalidate();
      navigate("/pin/crear", { replace: true });
    },
    [email, invalidate, navigate],
  );

  const onChange = (v: string) => {
    setCode(v);
    setError(null);
    if (v.length === 6) void verify(v);
  };

  async function resend() {
    if (!email || wait > 0) return;
    const { error: err } = await supabase.auth.resend({ type: "signup", email });
    if (err) return setError("No se ha podido reenviar el código. Espera un momento e inténtalo de nuevo.");
    setResent(true);
    setWait(RESEND_SECONDS);
  }

  if (!email) {
    return (
      <main className="b-screen">
        <div className="b-empty">
          <p className="b-title">No sabemos qué correo verificar</p>
          <Link to="/registro" className="b-btn b-btn--primary">
            Crear cuenta
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="b-screen" style={{ gap: 24 }}>
      <div>
        <Link to="/registro" className="b-back" aria-label="Atrás">
          <Icon name="back" />
        </Link>
      </div>
      <div className="b-tile b-tile--soft" style={{ alignItems: "flex-start", gap: 14, padding: 20 }}>
        <span
          className="b-avatar"
          style={{ width: 52, height: 52, background: "var(--accent)", color: "var(--on-accent)" }}
        >
          <Icon name="mail" />
        </span>
        <h1 className="b-h1" style={{ fontSize: 26, lineHeight: "31px" }}>
          Te hemos enviado un código al correo
        </h1>
        <p className="subhead" style={{ color: "var(--accent-text)" }}>
          Escribe las 6 cifras que hemos enviado a <strong>{email}</strong>
        </p>
      </div>
      <div className="stack" style={{ alignItems: "center" }}>
        <PinBoxes
          label="Código de verificación de 6 cifras"
          length={6}
          value={code}
          onChange={onChange}
          error={Boolean(error)}
          autoFocus
        />
        {error && (
          <p className="b-help" role="alert" style={{ color: "var(--expense)", textAlign: "center" }}>
            {error}
          </p>
        )}
        {resent && !error && (
          <p className="b-help" role="status">
            Código enviado de nuevo.
          </p>
        )}
      </div>
      <div className="chips-wrap" style={{ justifyContent: "center" }}>
        <button
          type="button"
          className="b-chip"
          disabled={wait > 0}
          onClick={() => void resend()}
          style={{ opacity: wait > 0 ? 0.55 : 1 }}
        >
          {wait > 0 ? `Reenviar en 0:${String(wait).padStart(2, "0")}` : "Reenviar código"}
        </button>
        <Link to="/registro" className="b-chip" style={{ display: "inline-flex", alignItems: "center" }}>
          Cambiar el correo
        </Link>
      </div>
      <div className="b-spacer" />
      <button
        type="button"
        className="b-btn b-btn--primary b-btn--block"
        disabled={code.length < 6 || busy}
        onClick={() => void verify(code)}
      >
        {busy ? "Verificando…" : "Verificar"}
      </button>
    </main>
  );
}
