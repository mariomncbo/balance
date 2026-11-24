import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { Field } from "../components/Field";
import { BackButton } from "../components/Header";
import { supabase } from "../lib/supabase";
import { useAuth } from "../state/AuthContext";
import { clearPin } from "../state/pin";

export default function ForgotPin() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    const email = session?.user.email;
    if (!email || !password) return setError("Escribe tu contraseña");
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (err) return setError("Contraseña incorrecta");
    clearPin();
    navigate("/pin/crear", { replace: true });
  }

  return (
    <main className="b-screen" style={{ gap: 20 }}>
      <div>
        <BackButton to="/desbloqueo" />
      </div>
      <div className="stack" style={{ gap: 8 }}>
        <h1 className="b-h1">¿Olvidaste el código?</h1>
        <p className="b-lead">Escribe la contraseña de tu cuenta y podrás crear un código nuevo.</p>
      </div>
      <form className="b-tile stack" onSubmit={submit} noValidate>
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
        <button type="submit" className="b-btn b-btn--primary b-btn--block" disabled={busy}>
          {busy ? "Comprobando…" : "Continuar"}
        </button>
      </form>
    </main>
  );
}
