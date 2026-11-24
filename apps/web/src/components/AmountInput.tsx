import { useId } from "react";

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  tone?: "default" | "income";
  size?: "md" | "lg";
  autoFocus?: boolean;
  error?: string | null;
}

/** Importe grande en euros. El texto es libre ("48,90"); se convierte con parseEuro al guardar. */
export function AmountInput({
  label,
  value,
  onChange,
  tone = "default",
  size = "md",
  autoFocus,
  error,
}: Props) {
  const id = useId();
  return (
    <div className="amount-wrap">
      <label className="b-eyebrow" htmlFor={id}>
        {label}
      </label>
      <div className="b-amount" style={size === "lg" ? { fontSize: 48, lineHeight: "52px" } : undefined}>
        <input
          id={id}
          className="amount-input"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0,00"
          value={value}
          autoFocus={autoFocus}
          aria-invalid={error ? true : undefined}
          style={{
            color: tone === "income" && value ? "var(--income)" : undefined,
            width: `${Math.max(value.length, 4)}ch`,
          }}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="b-amount__currency" aria-hidden="true">
          €
        </span>
      </div>
      {error && (
        <span className="b-help" role="alert" style={{ color: "var(--expense)" }}>
          {error}
        </span>
      )}
    </div>
  );
}
