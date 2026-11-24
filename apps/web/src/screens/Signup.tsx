import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { Field } from "../components/Field";
import { LogoSymbol } from "../components/Logo";
import { authFn } from "../lib/api";
import { setPendingEmail } from "../lib/pending";
import { supabase } from "../lib/supabase";
import { validateSignup } from "../lib/validation";

type Errors = ReturnType<typeof validateSignup> & { form?: string };

export default function Signup() {
  const navigate = useNavigate();
  const [f, setF] = useState({ name: "", username: "", email: "", password: "", password2: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = k === "username" ? e.target.value.toLowerCase() : e.target.value;
    setF((s) => ({ ...s, [k]: v }));
    setErrors((s) => ({ ...s, [k]: undefined, form: undefined }));
  };

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    const e = validateSignup(f);
    if (Object.keys(e).length > 0) return setErrors(e);
    setBusy(true);
    try {
      const check = await authFn<{ available: boolean }>("username.check", { username: f.username });
      if (!check.available) return setErrors({ username: "Ese nombre de usuario ya está cogido" });
      const email = f.email.trim().toLowerCase();
      const { error } = await supabase.auth.signUp({
        email,
        password: f.password,
        options: { data: { name: f.name.trim(), username: f.username } },
      });
      if (error) {
        const exists = /already|registered/i.test(error.message);
        return setErrors(
          exists
            ? { email: "Ya hay una cuenta con este correo. ¿Quieres iniciar sesión?" }
            : { form: "No se ha podido crear la cuenta. Revisa los datos y vuelve a intentarlo." },
        );
      }
      setPendingEmail(email);
      navigate("/verificar", { state: { email } });
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : "Algo ha fallado. Inténtalo de nuevo." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="b-screen" style={{ gap: 20 }}>
      <div className="ob-top" style={{ gap: 12 }}>
        <span
          style={{
            width: 52,
            height: 52,
            borderRadius: 18,
            background: "var(--surface)",
            display: "grid",
            placeItems: "center",
          }}
        >
          <LogoSymbol size={34} />
        </span>
        <div>
          <h1 className="b-h1" style={{ fontSize: 24, lineHeight: "28px" }}>
            Crea tu cuenta
          </h1>
          <p className="b-sub">Para guardar lo que has añadido</p>
        </div>
      </div>
      <form className="b-tile stack" style={{ padding: 16 }} onSubmit={submit} noValidate>
        <div className="b-grid">
          <Field
            label="Nombre"
            autoComplete="name"
            value={f.name}
            onChange={set("name")}
            error={errors.name}
          />
          <Field
            label="Usuario"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={f.username}
            onChange={set("username")}
            error={errors.username}
          />
        </div>
        <Field
          label="Correo"
          type="email"
          autoComplete="email"
          value={f.email}
          onChange={set("email")}
          error={errors.email}
        />
        <Field
          label="Contraseña"
          type="password"
          autoComplete="new-password"
          value={f.password}
          onChange={set("password")}
          error={errors.password}
        />
        <Field
          label="Repite la contraseña"
          type="password"
          autoComplete="new-password"
          value={f.password2}
          onChange={set("password2")}
          error={errors.password2}
        />
        {errors.form && (
          <p className="b-help" role="alert" style={{ color: "var(--expense)" }}>
            {errors.form}
          </p>
        )}
        <button type="submit" className="b-btn b-btn--primary b-btn--block" disabled={busy}>
          {busy ? "Creando…" : "Crear cuenta"}
        </button>
      </form>
      <div className="b-actions">
        <Link to="/entrar" className="b-btn b-btn--link">
          ¿Ya tienes cuenta? Iniciar sesión
        </Link>
      </div>
    </main>
  );
}
