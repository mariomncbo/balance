import { useId } from "react";
import type { AccountBalance } from "../lib/types";

interface Props {
  label: string;
  value: string;
  accounts: AccountBalance[];
  onChange: (id: string) => void;
  allowNone?: boolean;
}

export function AccountSelect({ label, value, accounts, onChange, allowNone }: Props) {
  const id = useId();
  return (
    <div className="b-field">
      <label className="b-label" htmlFor={id}>
        {label}
      </label>
      <select id={id} className="b-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {allowNone && <option value="">Sin cuenta</option>}
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
    </div>
  );
}
