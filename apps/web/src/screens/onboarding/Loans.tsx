import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Field } from "../../components/Field";
import { Icon } from "../../components/Icon";
import { OnboardingFrame } from "../../components/OnboardingFrame";
import { formatEuro, parseEuro } from "../../lib/money";
import { readOnboarding, writeOnboarding, type OnboardingLoan } from "../../state/onboarding";

interface Form {
  concept: string;
  amount: string;
  day: string;
  pending: string;
  end: string;
}
const EMPTY: Form = { concept: "", amount: "", day: "", pending: "", end: "" };

/** "06/2041" → "2041-06". Vacío es válido (sin fecha de fin). */
function parseEnd(text: string): { ok: boolean; value?: string } {
  if (text.trim() === "") return { ok: true };
  const m = /^(0?[1-9]|1[0-2])\/(\d{4})$/.exec(text.trim());
  return m ? { ok: true, value: `${m[2]}-${String(m[1]).padStart(2, "0")}` } : { ok: false };
}

export default function Loans() {
  const navigate = useNavigate();
  const [loans, setLoans] = useState<OnboardingLoan[]>(() => readOnboarding().loans);
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const total = useMemo(() => loans.reduce((s, l) => s + l.amount, 0), [loans]);

  const save = (next: OnboardingLoan[]) => {
    setLoans(next);
    writeOnboarding({ ...readOnboarding(), loans: next });
  };

  const add = () => {
    const amount = parseEuro(form.amount);
    const pending = parseEuro(form.pending);
    const day = Number(form.day);
    const end = parseEnd(form.end);
    const e: typeof errors = {};
    if (!form.concept.trim()) e.concept = "Ponle un nombre, por ejemplo Hipoteca";
    if (!amount) e.amount = "Escribe la cuota mensual";
    if (!Number.isInteger(day) || day < 1 || day > 31) e.day = "Un día entre 1 y 31";
    if (!pending) e.pending = "Escribe lo que te queda por pagar";
    if (!end.ok) e.end = "Usa el formato mm/aaaa";
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    save([
      ...loans,
      {
        concept: form.concept.trim(),
        amount: amount!,
        day,
        pending: pending!,
        ...(end.value ? { endMonth: end.value } : {}),
      },
    ]);
    setForm(EMPTY);
  };

  const hasDraft = Object.values(form).some((v) => v.trim() !== "");

  return (
    <OnboardingFrame
      step={2}
      back="/onboarding/saldo"
      title="¿Tienes hipoteca o préstamos?"
      lead="Los contaremos como gastos fijos y verás cuánto te queda por pagar."
      footer={
        <>
          <button
            type="button"
            className="b-btn b-btn--primary b-btn--block"
            onClick={() => navigate("/onboarding/sueldo")}
          >
            Continuar
          </button>
          {loans.length === 0 && !hasDraft && (
            <button
              type="button"
              className="b-btn b-btn--link"
              onClick={() => navigate("/onboarding/sueldo")}
            >
              No tengo
            </button>
          )}
        </>
      }
    >
      {loans.length > 0 && (
        <div className="stack">
          <ul className="stack">
            {loans.map((l, i) => (
              <li key={i} className="b-tile" style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <span className="b-avatar b-avatar--accent">
                  <Icon name="home2" />
                </span>
                <div style={{ flexGrow: 1, minWidth: 0 }}>
                  <p className="b-title">{l.concept}</p>
                  <p className="b-sub" style={{ fontSize: 13 }}>
                    Día {l.day} · te quedan {formatEuro(l.pending, { round: true })}
                  </p>
                </div>
                <span className="b-money">−{formatEuro(l.amount, { round: true })}</span>
                <button
                  type="button"
                  className="b-eye"
                  aria-label={`Quitar ${l.concept}`}
                  onClick={() => save(loans.filter((_, j) => j !== i))}
                >
                  <Icon name="close" size={18} />
                </button>
              </li>
            ))}
          </ul>
          <p className="footnote" style={{ color: "var(--text-secondary)" }}>
            Total al mes: {formatEuro(total)}
          </p>
        </div>
      )}
      <div className="b-tile stack" style={{ background: "var(--bg-subtle)" }}>
        <p className="b-title">{loans.length ? "Añadir otro préstamo" : "Añadir un préstamo"}</p>
        <Field
          label="Nombre"
          placeholder="Hipoteca, coche, estudios…"
          value={form.concept}
          onChange={set("concept")}
          error={errors.concept}
        />
        <div className="b-grid">
          <Field
            label="Cuota al mes"
            inputMode="decimal"
            placeholder="640,00"
            value={form.amount}
            onChange={set("amount")}
            error={errors.amount}
          />
          <Field
            label="Día de cobro"
            inputMode="numeric"
            placeholder="5"
            value={form.day}
            onChange={set("day")}
            error={errors.day}
          />
          <Field
            label="Te queda"
            inputMode="decimal"
            placeholder="98.400"
            value={form.pending}
            onChange={set("pending")}
            error={errors.pending}
          />
          <Field
            label="Termina en"
            placeholder="mm/aaaa"
            value={form.end}
            onChange={set("end")}
            error={errors.end}
          />
        </div>
        <button type="button" className="b-btn b-btn--secondary b-btn--sm" onClick={add}>
          Añadir préstamo
        </button>
      </div>
    </OnboardingFrame>
  );
}
