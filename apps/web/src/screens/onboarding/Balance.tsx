import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Icon } from "../../components/Icon";
import { AmountInput } from "../../components/AmountInput";
import { OnboardingFrame } from "../../components/OnboardingFrame";
import { formatEuro, parseEuro } from "../../lib/money";
import { useData } from "../../state/DataContext";
import { readOnboarding, writeOnboarding } from "../../state/onboarding";
import { useSheet } from "../../state/SheetContext";

const QUICK = "Mi dinero";

export default function Balance() {
  const navigate = useNavigate();
  const { open } = useSheet();
  const { version } = useData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const data = useMemo(() => readOnboarding(), [version]);
  const manual = data.accounts.filter((a) => a.name !== QUICK);
  const quick = data.accounts.find((a) => a.name === QUICK);
  const [text, setText] = useState(quick ? String(quick.openingBalance / 100).replace(".", ",") : "");
  const [error, setError] = useState<string | null>(null);

  const next = () => {
    const cents = text.trim() === "" ? 0 : parseEuro(text);
    if (cents === null) return setError("Escribe un importe válido, por ejemplo 1.250,00");
    const current = readOnboarding();
    const accounts = current.accounts.filter((a) => a.name !== QUICK);
    if (cents > 0 && accounts.length === 0)
      accounts.push({ name: QUICK, type: "banco", openingBalance: cents });
    writeOnboarding({ ...current, accounts });
    navigate("/onboarding/prestamos");
  };

  return (
    <OnboardingFrame
      step={1}
      back="/bienvenida"
      title="¿Cuánto tienes?"
      lead="Suma lo que tienes ahora en todas tus cuentas. Luego podrás separarlo."
      footer={
        <button type="button" className="b-btn b-btn--primary b-btn--block" onClick={next}>
          Continuar
        </button>
      }
    >
      {manual.length === 0 ? (
        <div className="b-tile" style={{ alignItems: "center", padding: "28px 16px 20px", gap: 14 }}>
          <AmountInput
            label="Saldo total"
            value={text}
            onChange={(v) => {
              setText(v);
              setError(null);
            }}
            size="lg"
            error={error}
          />
          <button
            type="button"
            className="b-btn b-btn--sm"
            style={{ background: "var(--accent-subtle)", color: "var(--accent-text)" }}
            onClick={() => open({ kind: "account", local: true })}
          >
            Prefiero añadirlas una a una
          </button>
        </div>
      ) : (
        <div className="stack">
          <ul className="b-list">
            {manual.map((a, i) => (
              <li key={i} className="b-row">
                <span className="b-avatar b-avatar--accent">
                  <Icon name="bank" />
                </span>
                <div className="b-row__main">
                  <p className="b-title">{a.name}</p>
                  <p className="b-sub">{a.type}</p>
                </div>
                <span className="b-money">{formatEuro(a.openingBalance)}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="b-btn b-btn--secondary b-btn--block"
            onClick={() => open({ kind: "account", local: true })}
          >
            <Icon name="plus" />
            Añadir otra cuenta
          </button>
        </div>
      )}
      <div
        className="b-tile b-tile--income"
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          padding: "12px 14px",
          color: "var(--income)",
        }}
      >
        <Icon name="lock" />
        <span className="subhead" style={{ fontWeight: 600 }}>
          Tus datos están en todo momento encriptados y seguros
        </span>
      </div>
    </OnboardingFrame>
  );
}
