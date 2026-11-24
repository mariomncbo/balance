import { useNavigate } from "react-router";
import { Icon } from "../../components/Icon";
import { OnboardingFrame } from "../../components/OnboardingFrame";

export default function Shortcut() {
  const navigate = useNavigate();
  return (
    <OnboardingFrame
      step={4}
      back="/onboarding/sueldo"
      title="Tus pagos, apuntados solos"
      lead="Con un Atajo del iPhone, cada pago con tarjeta en Wallet aparece en Balance sin que hagas nada."
      footer={
        <button
          type="button"
          className="b-btn b-btn--primary b-btn--block"
          onClick={() => navigate("/onboarding/escaneo")}
        >
          Continuar
        </button>
      }
    >
      <div className="b-grid" aria-hidden="true">
        <div className="b-tile" style={{ gap: 6 }}>
          <span className="b-avatar">
            <Icon name="bank" />
          </span>
          <span className="b-eyebrow" style={{ marginTop: 6 }}>
            Pagas con Wallet
          </span>
          <span className="b-title">Mercadona</span>
          <span className="b-money">−12,40&nbsp;€</span>
        </div>
        <div className="b-tile b-tile--accent" style={{ gap: 6 }}>
          <span className="b-avatar" style={{ background: "var(--accent-hover)", color: "var(--on-accent)" }}>
            <Icon name="bolt" />
          </span>
          <span className="b-eyebrow" style={{ marginTop: 6 }}>
            Al instante
          </span>
          <span className="b-title">Apuntado</span>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Comida · Atajo</span>
        </div>
      </div>
      <div className="b-tile" style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <span className="b-avatar b-avatar--accent">
          <Icon name="settings" />
        </span>
        <span className="subhead" style={{ color: "var(--text-secondary)" }}>
          Lo configuras cuando tengas tu cuenta, desde Ajustes. Se tarda 2 minutos.
        </span>
      </div>
    </OnboardingFrame>
  );
}
