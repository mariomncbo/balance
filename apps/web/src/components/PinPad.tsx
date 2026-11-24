import { Icon } from "./Icon";

interface Props {
  onDigit: (d: string) => void;
  onDelete: () => void;
  onBiometric?: () => void;
  disabled?: boolean;
}

/** Teclado numérico redondo de la pantalla de desbloqueo. */
export function PinPad({ onDigit, onDelete, onBiometric, disabled }: Props) {
  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 76px)",
        gap: "14px 28px",
        justifyContent: "center",
      }}
    >
      {digits.map((d) => (
        <button
          key={d}
          type="button"
          className="b-key"
          disabled={disabled}
          onClick={() => onDigit(d)}
          aria-label={d}
        >
          {d}
        </button>
      ))}
      {onBiometric ? (
        <button
          type="button"
          className="b-key b-key--ghost"
          style={{ color: "var(--accent-text)" }}
          onClick={onBiometric}
          aria-label="Usar Face ID"
        >
          <Icon name="faceid" size={32} />
        </button>
      ) : (
        <span />
      )}
      <button type="button" className="b-key" disabled={disabled} onClick={() => onDigit("0")} aria-label="0">
        0
      </button>
      <button
        type="button"
        className="b-key b-key--ghost"
        style={{ color: "var(--text-secondary)" }}
        disabled={disabled}
        onClick={onDelete}
        aria-label="Borrar"
      >
        <Icon name="backspace" size={28} />
      </button>
    </div>
  );
}
