import { useNavigate } from "react-router";
import { Icon } from "../../components/Icon";
import { OnboardingFrame } from "../../components/OnboardingFrame";

export default function Scan() {
  const navigate = useNavigate();
  return (
    <OnboardingFrame
      step={5}
      back="/onboarding/atajo"
      title="Haz una foto y listo"
      lead="Fotografía un ticket, una factura o una captura de un pago. Leemos el importe, el comercio y la fecha; tú solo confirmas."
      footer={
        <button
          type="button"
          className="b-btn b-btn--primary b-btn--block"
          onClick={() => navigate("/registro")}
        >
          Continuar
        </button>
      }
    >
      <div className="b-grid" aria-hidden="true">
        <div className="b-tile" style={{ gap: 6, transform: "rotate(-2deg)" }}>
          <span style={{ fontSize: 13, fontWeight: 800, textAlign: "center", letterSpacing: 0.5 }}>
            MERCADONA
          </span>
          {[
            ["Leche", "3,96"],
            ["Pan", "1,20"],
            ["Fruta", "7,24"],
          ].map(([n, v]) => (
            <span key={n} className="footnote b-num row-between" style={{ color: "var(--text-secondary)" }}>
              <span>{n}</span>
              <span>{v}</span>
            </span>
          ))}
          <span className="footnote b-num row-between" style={{ fontWeight: 700 }}>
            <span>TOTAL</span>
            <span>12,40</span>
          </span>
        </div>
        <div className="b-tile b-tile--soft" style={{ gap: 8, justifyContent: "center" }}>
          <span
            className="b-avatar"
            style={{ width: 48, height: 48, background: "var(--accent)", color: "var(--on-accent)" }}
          >
            <Icon name="camera" />
          </span>
          <span className="footnote" style={{ color: "var(--accent-text)", fontWeight: 700, marginTop: 4 }}>
            Leído
          </span>
          <span className="b-money">−12,40&nbsp;€</span>
          <span className="footnote" style={{ color: "var(--accent-text)" }}>
            Mercadona · hoy
          </span>
        </div>
      </div>
      <span className="b-pill b-pill--accent" style={{ alignSelf: "flex-start", padding: "8px 14px" }}>
        <Icon name="plus" size={16} />
        Siempre en el botón + → Escaneo
      </span>
    </OnboardingFrame>
  );
}
