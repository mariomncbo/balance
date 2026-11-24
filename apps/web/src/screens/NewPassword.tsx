import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { Field } from "../components/Field";
import { supabase } from "../lib/supabase";
import { MIN_PASSWORD } from "../lib/validation";
import { useAuth } from "../state/AuthContext";

/** Llegada desde el enlace del correo de "recuperar contraseña": ya hay una sesión de recuperación. */
export default function NewPassword() {
  const navigate = useNavigate();
  const { session, ready } = useAuth();
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    if (p1.length < MIN_PASSWORD) return setError(`Mínimo ${MIN_PASSWORD} caracteres`);
    if (p1 !== p2) return setError("Las contraseñas no coinciden. Vuelve a escribirla.");
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password: p1 });
    setBusy(false);
    if (err) return setError("No se ha podido cambiar la contraseña. Pide un enlace nuevo.");
    navigate("/", { replace: true });
  }

  if (!ready)
    return (
      <main className="screen-center" role="status">
        <span className="visually-hidden">Cargando…</span>
      </main>
    );
  if (!session) {
    return (
      <main className="b-screen">
        <div className="b-empty">
          <p className="b-title">El enlace ha caducado</p>
          <p className="b-sub">Los enlaces para cambiar la contraseña duran poco. Pide uno nuevo.</p>
          <Link to="/recuperar" className="b-btn b-btn--primary">
            Pedir un enlace nuevo
          </Link>
        </div>
      </main>
    );
  }
  return (
    <main className="b-screen" style={{ gap: 20 }}>
      <div className="stack" style={{ gap: 8, paddingTop: 24 }}>
        <h1 className="b-h1">Elige tu nueva contraseña</h1>
        <p className="b-lead">Usarás esta contraseña para entrar en Balance.</p>
      </div>
      <form className="b-tile stack" onSubmit={submit} noValidate>
        <Field
          label="Contraseña nueva"
          type="password"
          autoComplete="new-password"
          value={p1}
          onChange={(e) => {
            setP1(e.target.value);
            setError(null);
          }}
        />
        <Field
          label="Repite la contraseña"
          type="password"
          autoComplete="new-password"
          value={p2}
          onChange={(e) => {
            setP2(e.target.value);
            setError(null);
          }}
          error={error}
        />
        <button type="submit" className="b-btn b-btn--primary b-btn--block" disabled={busy}>
          {busy ? "Guardando…" : "Guardar contraseña"}
        </button>
      </form>
    </main>
  );
}
