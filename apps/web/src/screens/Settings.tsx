import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Header } from "../components/Header";
import { Icon, type IconName } from "../components/Icon";
import { clearProfileCache, useProfile } from "../lib/useProfile";
import { useAuth } from "../state/AuthContext";
import { useLock } from "../state/LockContext";
import { clearPin, hasPin } from "../state/pin";
import { useTheme } from "../state/ThemeContext";
import type { ThemeChoice } from "../state/theme";

const MODES: { id: ThemeChoice; label: string; icon: IconName }[] = [
  { id: "system", label: "Sistema", icon: "settings" },
  { id: "light", label: "Claro", icon: "target" },
  { id: "dark", label: "Oscuro", icon: "clock" },
];

export default function Settings() {
  const navigate = useNavigate();
  const profile = useProfile();
  const { choice, setChoice } = useTheme();
  const { signOut } = useAuth();
  const { lock } = useLock();
  const [pinOn, setPinOn] = useState(hasPin());

  async function logout() {
    clearProfileCache();
    await signOut();
    navigate("/bienvenida", { replace: true });
  }

  return (
    <main className="b-screen" style={{ gap: 14 }}>
      <Header title="Ajustes" to="/" />
      <div className="b-grid">
        <div className="b-tile b-span2" style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <span
            className="b-avatar"
            style={{
              width: 52,
              height: 52,
              background: "var(--accent)",
              color: "var(--on-accent)",
              fontSize: 22,
              fontWeight: 800,
            }}
            aria-hidden="true"
          >
            {profile?.name.charAt(0).toUpperCase() ?? ""}
          </span>
          <div style={{ minWidth: 0 }}>
            <p className="b-title" style={{ fontSize: 19, fontWeight: 800 }}>
              {profile?.name ?? " "}
            </p>
            <p className="b-sub" style={{ fontSize: 14, overflow: "hidden", textOverflow: "ellipsis" }}>
              {profile ? `@${profile.username} · ${profile.email}` : " "}
            </p>
          </div>
        </div>

        <fieldset className="b-tile b-span2" style={{ gap: 10, border: 0, margin: 0 }}>
          <legend className="b-eyebrow" style={{ padding: 0 }}>
            Apariencia
          </legend>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={choice === m.id}
                onClick={() => setChoice(m.id)}
                style={{
                  border: 0,
                  borderRadius: 18,
                  padding: "12px 8px",
                  display: "grid",
                  justifyItems: "center",
                  gap: 6,
                  font: "600 14px/18px var(--font-sans)",
                  background: choice === m.id ? "var(--accent)" : "var(--bg)",
                  color: choice === m.id ? "var(--on-accent)" : "var(--text)",
                }}
              >
                <Icon name={m.icon} />
                {m.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="b-tile" style={{ gap: 6 }}>
          <span className="b-avatar b-avatar--accent">
            <Icon name="lock" />
          </span>
          <span className="b-title" style={{ marginTop: 4 }}>
            Código
          </span>
          <span
            className="footnote"
            style={{ color: pinOn ? "var(--income)" : "var(--text-secondary)", fontWeight: 700 }}
          >
            {pinOn ? "Activado" : "Desactivado"}
          </span>
          <div className="stack" style={{ gap: 4, marginTop: 4 }}>
            <Link
              to="/pin/crear"
              className="footnote"
              style={{ color: "var(--accent-text)", fontWeight: 700 }}
            >
              {pinOn ? "Cambiar" : "Activar"}
            </Link>
            {pinOn && (
              <>
                <button
                  type="button"
                  className="footnote"
                  style={{
                    color: "var(--accent-text)",
                    fontWeight: 700,
                    background: "none",
                    border: 0,
                    textAlign: "left",
                    padding: 0,
                  }}
                  onClick={() => lock()}
                >
                  Bloquear ahora
                </button>
                <button
                  type="button"
                  className="footnote"
                  style={{
                    color: "var(--expense)",
                    fontWeight: 700,
                    background: "none",
                    border: 0,
                    textAlign: "left",
                    padding: 0,
                  }}
                  onClick={() => {
                    clearPin();
                    setPinOn(false);
                  }}
                >
                  Quitar
                </button>
              </>
            )}
          </div>
        </div>
        <div className="b-tile" style={{ gap: 6 }}>
          <span className="b-avatar b-avatar--accent">
            <Icon name="faceid" />
          </span>
          <span className="b-title" style={{ marginTop: 4 }}>
            Face ID
          </span>
          <span className="footnote" style={{ color: "var(--text-secondary)" }}>
            Solo en la app del iPhone
          </span>
        </div>

        <Link
          to="/atajo"
          className="b-tile b-tile--soft b-span2"
          style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
        >
          <span className="b-avatar" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
            <Icon name="bolt" />
          </span>
          <div style={{ flexGrow: 1 }}>
            <p className="b-title" style={{ fontSize: 16 }}>
              ¿Cómo hacer registro automático de pagos?
            </p>
            <p className="footnote" style={{ margin: 0, color: "var(--accent-text)", fontWeight: 600 }}>
              Guía del Atajo de iPhone
            </p>
          </div>
          <Icon name="chevron" />
        </Link>
      </div>
      <div className="b-spacer" />
      <button
        type="button"
        className="b-btn b-btn--secondary b-btn--block"
        style={{ color: "var(--expense)" }}
        onClick={() => void logout()}
      >
        Cerrar sesión
      </button>
    </main>
  );
}
