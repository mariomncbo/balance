import { useState } from "react";
import { useNavigate } from "react-router";
import { Icon } from "../components/Icon";
import { PinBoxes } from "../components/PinBoxes";
import { useAuth } from "../state/AuthContext";
import { useLock } from "../state/LockContext";
import { isValidPin, setPin } from "../state/pin";

export default function CreatePin() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { unlock } = useLock();
  const [pin, setPinText] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const mismatch = confirm.length === 4 && pin !== confirm;

  async function save() {
    if (!isValidPin(pin) || pin !== confirm) return;
    setBusy(true);
    await setPin(pin);
    unlock();
    navigate("/", { replace: true });
  }

  return (
    <main className="b-screen" style={{ gap: 20 }}>
      <div className="stack" style={{ gap: 12, paddingTop: 24 }}>
        <span
          className="b-avatar"
          style={{
            width: 56,
            height: 56,
            borderRadius: 20,
            background: "var(--accent)",
            color: "var(--on-accent)",
          }}
        >
          <Icon name="lock" size={26} />
        </span>
        <h1 className="b-h1">Crea un código para acceder a tu cuenta</h1>
        {session?.user.email && (
          <span className="b-pill b-pill--accent" style={{ alignSelf: "flex-start" }}>
            {session.user.email}
          </span>
        )}
      </div>
      <div className="b-tile stack" style={{ gap: 10 }}>
        <span className="b-eyebrow">Código de 4 cifras</span>
        <PinBoxes label="Código de 4 cifras" value={pin} onChange={setPinText} canReveal autoFocus />
      </div>
      <div className="b-tile stack" style={{ gap: 10 }}>
        <span className="b-eyebrow">Repite el código</span>
        <PinBoxes label="Repite el código" value={confirm} onChange={setConfirm} error={mismatch} />
        {mismatch && (
          <span className="b-pill b-pill--expense" role="alert" style={{ alignSelf: "flex-start" }}>
            Los códigos no coinciden. Vuelve a escribirlo.
          </span>
        )}
      </div>
      <p className="footnote" style={{ color: "var(--text-secondary)" }}>
        El código se guarda solo en este dispositivo. Si lo olvidas, podrás crear otro con tu contraseña.
      </p>
      <div className="b-spacer" />
      <div className="b-actions">
        <button
          type="button"
          className="b-btn b-btn--primary b-btn--block"
          disabled={!isValidPin(pin) || pin !== confirm || busy}
          onClick={() => void save()}
        >
          Crear código de acceso
        </button>
        <button type="button" className="b-btn b-btn--link" onClick={() => navigate("/", { replace: true })}>
          En otro momento
        </button>
      </div>
    </main>
  );
}
