import { useState, type FormEvent } from "react";
import { BackButton } from "../components/Header";
import { Field } from "../components/Field";
import { Icon } from "../components/Icon";
import { supabase } from "../lib/supabase";
import { EMAIL } from "../lib/validation";

export default function Recover() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    if (!EMAIL.test(email.trim())) return setError("Escribe un correo válido");
    setBusy(true);
    setError(null);
    // Siempre se enseña la misma confirmación: no se revela si el correo tiene cuenta.
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${location.origin}/nueva-contrasena`,
    });
    setBusy(false);
    if (err && err.status !== 400 && err.status !== 422)
      return setError("No se ha podido enviar el enlace. Inténtalo de nuevo en un rato.");
    setSent(true);
  }

  return (
    <main className="b-screen" style={{ gap: 20 }}>
      <div>
        <BackButton to="/entrar" />
      </div>
      <div className="stack" style={{ gap: 8 }}>
        <h1 className="b-h1">Recupera tu contraseña</h1>
        <p className="b-lead">
          Escribe el correo de tu cuenta y te enviaremos un enlace para crear una nueva.
        </p>
      </div>
      <form className="stack" onSubmit={submit} noValidate>
        <div className="b-tile">
          <Field
            label="Correo"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            error={error}
          />
        </div>
        {sent && (
          <div
            className="b-tile b-tile--income"
            style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            role="status"
          >
            <span
              className="b-avatar"
              style={{ background: "var(--income-solid)", color: "var(--on-accent)" }}
            >
              <Icon name="check" />
            </span>
            <div>
              <p className="b-title">Enlace enviado</p>
              <p className="subhead" style={{ color: "var(--income)" }}>
                Si hay una cuenta con ese correo, te llegará un enlace. Mira también en spam.
              </p>
            </div>
          </div>
        )}
        <div className="b-spacer" />
        <button type="submit" className="b-btn b-btn--primary b-btn--block" disabled={busy}>
          {busy ? "Enviando…" : sent ? "Enviar de nuevo" : "Enviar enlace"}
        </button>
      </form>
    </main>
  );
}
