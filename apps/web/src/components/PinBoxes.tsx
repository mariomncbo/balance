import { useState } from "react";
import { Icon } from "./Icon";

interface Props {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: boolean;
  reveal?: boolean;
  /** Muestra el botón del ojo. */
  canReveal?: boolean;
  autoFocus?: boolean;
  /** Número de casillas: 4 para el PIN, 6 para el código del correo. */
  length?: 4 | 6;
}

/** Cuatro casillas sobre un único campo real: el móvil abre su teclado numérico. */
export function PinBoxes({ label, value, onChange, error, canReveal, autoFocus, length = 4 }: Props) {
  const [shown, setShown] = useState(false);
  return (
    <div className="pin-wrap">
      <div
        className={`b-pin${error ? " b-pin--error" : ""}`}
        style={length === 6 ? { gap: 8 } : undefined}
        role="group"
        aria-label={label}
      >
        {Array.from({ length }, (_, i) => {
          const digit = value[i];
          const active = i === Math.min(value.length, length - 1);
          return (
            <div
              key={i}
              className={`b-pin__box${active ? " pin-box-active" : ""}`}
              style={length === 6 ? { width: 46, height: 58, borderRadius: 16 } : undefined}
              aria-hidden="true"
            >
              {digit === undefined ? null : shown ? digit : <span className="b-pin__dot" />}
            </div>
          );
        })}
      </div>
      <input
        className="pin-input"
        aria-label={label}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={length}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, length))}
      />
      {canReveal && (
        <button
          type="button"
          className="b-eye"
          aria-label={shown ? "Ocultar código" : "Mostrar código"}
          aria-pressed={shown}
          onClick={() => setShown((s) => !s)}
        >
          <Icon name={shown ? "eyeOff" : "eye"} />
        </button>
      )}
    </div>
  );
}
