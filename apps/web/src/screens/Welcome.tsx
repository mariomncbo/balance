import { Link } from "react-router";
import { LogoHorizontal } from "../components/Logo";
import { Icon } from "../components/Icon";

export default function Welcome() {
  return (
    <main className="b-screen" style={{ gap: 24 }}>
      <LogoHorizontal width={150} />
      <div className="b-grid" aria-hidden="true">
        <div className="b-tile b-span2">
          <span className="b-eyebrow">Saldo total</span>
          <div className="row-between">
            <span className="b-big">12.480,35&nbsp;€</span>
            <span className="b-pill b-pill--income">+609&nbsp;€</span>
          </div>
        </div>
        <div className="b-tile b-tile--accent" style={{ gap: 4 }}>
          <svg width="52" height="52" viewBox="0 0 52 52" style={{ transform: "rotate(-90deg)" }}>
            <circle
              cx="26"
              cy="26"
              r="21"
              style={{ fill: "none", stroke: "var(--accent-hover)", strokeWidth: 7 }}
            />
            <circle
              cx="26"
              cy="26"
              r="21"
              style={{
                fill: "none",
                stroke: "var(--on-accent)",
                strokeWidth: 7,
                strokeLinecap: "round",
                strokeDasharray: "76.5 132",
              }}
            />
          </svg>
          <span className="b-title" style={{ marginTop: 6 }}>
            PS5
          </span>
          <span style={{ fontSize: 13, fontWeight: 600 }}>77 € al mes</span>
        </div>
        <div className="b-tile b-tile--warning" style={{ gap: 4 }}>
          <span
            className="b-avatar b-avatar--warning"
            style={{ width: 36, height: 36, background: "var(--surface)" }}
          >
            <Icon name="bolt" size={18} />
          </span>
          <span className="b-title" style={{ marginTop: 6 }}>
            Mercadona
          </span>
          <span className="footnote" style={{ color: "var(--warning)", fontWeight: 700 }}>
            Apuntado solo
          </span>
        </div>
      </div>
      <div className="stack" style={{ gap: 10 }}>
        <h1 className="b-h1" style={{ fontSize: 34, lineHeight: "38px", letterSpacing: "-1px" }}>
          Tu dinero, claro y a tu favor.
        </h1>
        <p className="b-lead">
          Mira cuánto tienes, en qué se va y cuánto apartar cada mes para conseguir lo que quieres.
        </p>
      </div>
      <div className="b-spacer" />
      <div className="b-actions">
        <Link to="/onboarding/saldo" className="b-btn b-btn--primary b-btn--block">
          Empezar
        </Link>
        <Link to="/entrar" className="b-btn b-btn--link">
          ¿Ya tienes cuenta? Iniciar sesión
        </Link>
      </div>
    </main>
  );
}
