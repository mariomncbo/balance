import { useState } from "react";
import { useNavigate } from "react-router";
import { AmountInput } from "../../components/AmountInput";
import { Field } from "../../components/Field";
import { OnboardingFrame } from "../../components/OnboardingFrame";
import { formatEuro, parseEuro } from "../../lib/money";
import { readOnboarding, writeOnboarding } from "../../state/onboarding";

const PRESETS: { label: string; day: number }[] = [
  { label: "Día 1", day: 1 },
  { label: "Día 25", day: 25 },
  { label: "Último día", day: 31 },
];

export default function Salary() {
  const navigate = useNavigate();
  const saved = readOnboarding().salary;
  const [amount, setAmount] = useState(saved ? String(saved.amount / 100).replace(".", ",") : "");
  const [day, setDay] = useState<number>(saved?.day ?? 1);
  const [other, setOther] = useState(Boolean(saved) && !PRESETS.some((p) => p.day === saved?.day));
  const [error, setError] = useState<string | null>(null);

  const next = () => {
    const current = readOnboarding();
    if (amount.trim() === "") {
      writeOnboarding({ ...current, salary: null });
      return navigate("/onboarding/atajo");
    }
    const cents = parseEuro(amount);
    if (!cents) return setError("Escribe un importe válido, por ejemplo 1.850,00");
    if (!Number.isInteger(day) || day < 1 || day > 31) return setError("El día tiene que estar entre 1 y 31");
    writeOnboarding({ ...current, salary: { amount: cents, day } });
    navigate("/onboarding/atajo");
  };

  const cents = parseEuro(amount);
  return (
    <OnboardingFrame
      step={3}
      back="/onboarding/prestamos"
      title="Tu sueldo"
      lead="¿Qué te entra al mes? Lo guardaremos como ingreso fijo."
      footer={
        <>
          <button type="button" className="b-btn b-btn--primary b-btn--block" onClick={next}>
            Continuar
          </button>
          {amount.trim() === "" && (
            <button type="button" className="b-btn b-btn--link" onClick={next}>
              Prefiero no ponerlo
            </button>
          )}
        </>
      }
    >
      <div
        className="b-tile b-tile--income"
        style={{ alignItems: "center", padding: "28px 16px 22px", gap: 18 }}
      >
        <AmountInput
          label="Sueldo mensual"
          value={amount}
          onChange={(v) => {
            setAmount(v);
            setError(null);
          }}
          tone="income"
          size="lg"
          error={error}
        />
      </div>
      <div className="stack" style={{ gap: 10 }}>
        <span className="b-label">¿Qué día cobras?</span>
        <div className="chips-wrap" role="group" aria-label="Día de cobro">
          {PRESETS.map((p) => (
            <button
              key={p.day}
              type="button"
              className="b-chip"
              aria-pressed={!other && day === p.day}
              onClick={() => {
                setDay(p.day);
                setOther(false);
              }}
            >
              {p.label}
            </button>
          ))}
          <button type="button" className="b-chip" aria-pressed={other} onClick={() => setOther(true)}>
            Otro…
          </button>
        </div>
        {other && (
          <Field
            label="Día del mes"
            inputMode="numeric"
            value={String(day || "")}
            onChange={(e) => setDay(Number(e.target.value.replace(/\D/g, "")))}
          />
        )}
      </div>
      {cents ? (
        <div className="b-tile" style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <span className="subhead">
            Cada <strong>día {day}</strong> lo verás entrar como{" "}
            <strong style={{ color: "var(--income)" }}>
              Nómina {formatEuro(cents, { signed: true, round: true })}
            </strong>
            .
          </span>
        </div>
      ) : null}
    </OnboardingFrame>
  );
}
