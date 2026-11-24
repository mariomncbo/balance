import { useId, type InputHTMLAttributes, type ReactNode } from "react";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | null;
  help?: ReactNode;
}

export function Field({ label, error, help, id, ...input }: FieldProps) {
  const auto = useId();
  const inputId = id ?? auto;
  const describedBy = error || help ? `${inputId}-d` : undefined;
  return (
    <div className={`b-field${error ? " b-field--error" : ""}`}>
      <label className="b-label" htmlFor={inputId}>
        {label}
      </label>
      <input
        className="b-input"
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...input}
      />
      {(error || help) && (
        <span className="b-help" id={describedBy} role={error ? "alert" : undefined}>
          {error ?? help}
        </span>
      )}
    </div>
  );
}
