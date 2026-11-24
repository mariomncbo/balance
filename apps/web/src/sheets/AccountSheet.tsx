import { useState } from "react";
import { useNavigate } from "react-router";
import { AmountInput } from "../components/AmountInput";
import { Field } from "../components/Field";
import { Sheet } from "../components/Sheet";
import { api } from "../lib/api";
import { ACCOUNT_TYPE_LABEL } from "../lib/categories";
import { parseEuro } from "../lib/money";
import type { AccountType, Balances } from "../lib/types";
import { useApi } from "../lib/useApi";
import { useData } from "../state/DataContext";
import { readOnboarding, writeOnboarding } from "../state/onboarding";
import { useSheet } from "../state/SheetContext";

const TYPES = Object.keys(ACCOUNT_TYPE_LABEL) as AccountType[];

interface Props {
  id?: string;
  local?: boolean;
}

export default function AccountSheet({ id, local }: Props) {
  const { close } = useSheet();
  const { invalidate } = useData();
  // Al editar, se parte de los datos de la cuenta; el saldo inicial no viene en la lista, así que se edita el saldo actual.
  const accounts = useApi<Balances>("accounts.list");
  const editing = id ? accounts.data?.accounts.find((a) => a.id === id) : undefined;
  return (
    <AccountForm
      key={editing?.id ?? "new"}
      id={id}
      local={local}
      initial={
        editing
          ? {
              name: editing.name,
              type: editing.type,
              balance: editing.balance,
              opening: editing.openingBalance,
            }
          : undefined
      }
      loading={Boolean(id) && !editing}
      close={close}
      invalidate={invalidate}
    />
  );
}

function AccountForm({
  id,
  local,
  initial,
  loading,
  close,
  invalidate,
}: Props & {
  initial?: { name: string; type: AccountType; balance: number; opening: number };
  loading: boolean;
  close: () => void;
  invalidate: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<AccountType>(initial?.type ?? "banco");
  const [amount, setAmount] = useState(initial ? String(initial.balance / 100).replace(".", ",") : "");
  const [errors, setErrors] = useState<{ name?: string; amount?: string; form?: string }>({});
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function save() {
    const cents = amount.trim() === "" ? 0 : parseEuro(amount);
    const e: typeof errors = {};
    if (!name.trim()) e.name = "Ponle un nombre a la cuenta";
    if (cents === null) e.amount = "Escribe un importe válido, por ejemplo 1.250,00";
    setErrors(e);
    if (Object.keys(e).length > 0 || cents === null) return;
    // Al editar, el campo es el saldo actual: el saldo inicial se ajusta por la diferencia, sin tocar los movimientos.
    const openingBalance = initial ? initial.opening + (cents - initial.balance) : cents;
    const account = { name: name.trim(), type, openingBalance };
    if (local) {
      const o = readOnboarding();
      writeOnboarding({ ...o, accounts: [...o.accounts.filter((a) => a.name !== "Mi dinero"), account] });
      invalidate();
      return close();
    }
    setBusy(true);
    try {
      if (id) await api("accounts.update", { id, ...account });
      else await api("accounts.create", account);
      invalidate();
      close();
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : "No se ha podido guardar." });
      setBusy(false);
    }
  }

  async function remove() {
    if (!id) return;
    setBusy(true);
    try {
      await api("accounts.delete", { id });
      invalidate();
      close();
      navigate("/", { replace: true });
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : "No se ha podido borrar." });
      setBusy(false);
    }
  }

  return (
    <Sheet title={id ? "Editar cuenta" : "Nueva cuenta"} onClose={close}>
      {loading ? (
        <p className="b-sub" role="status">
          Cargando…
        </p>
      ) : (
        <>
          <div className="b-tile" style={{ alignItems: "center", padding: "22px 16px" }}>
            <AmountInput
              label="Saldo de la cuenta"
              value={amount}
              onChange={(v) => {
                setAmount(v);
                setErrors((s) => ({ ...s, amount: undefined }));
              }}
              error={errors.amount}
              autoFocus={!id}
            />
          </div>
          <Field
            label="Nombre"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setErrors((s) => ({ ...s, name: undefined }));
            }}
            error={errors.name}
            placeholder="Cuenta naranja"
          />
          <div className="stack" style={{ gap: 8 }}>
            <span className="b-label">Tipo de cuenta</span>
            <div
              style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}
              role="group"
              aria-label="Tipo de cuenta"
            >
              {TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={type === t}
                  onClick={() => setType(t)}
                  style={{
                    border: 0,
                    borderRadius: 18,
                    padding: "12px 4px",
                    font: "600 13px/16px var(--font-sans)",
                    background: type === t ? "var(--accent)" : "var(--surface)",
                    color: type === t ? "var(--on-accent)" : "var(--text)",
                  }}
                >
                  {ACCOUNT_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </div>
          {errors.form && (
            <p className="b-help" role="alert" style={{ color: "var(--expense)" }}>
              {errors.form}
            </p>
          )}
          <button
            type="button"
            className="b-btn b-btn--primary b-btn--block"
            disabled={busy}
            onClick={() => void save()}
          >
            {busy ? "Guardando…" : "Guardar"}
          </button>
          {id &&
            (confirmDelete ? (
              <div className="b-tile stack" role="alertdialog" aria-label="Confirmar borrado">
                <p className="b-title">¿Borrar esta cuenta?</p>
                <p className="b-sub">Se borrarán también todos sus movimientos. No se puede deshacer.</p>
                <div className="b-grid" style={{ gap: 8 }}>
                  <button
                    type="button"
                    className="b-btn b-btn--secondary b-btn--sm"
                    onClick={() => setConfirmDelete(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="b-btn b-btn--destructive b-btn--sm"
                    disabled={busy}
                    onClick={() => void remove()}
                  >
                    Borrar cuenta
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="b-btn b-btn--link"
                style={{ alignSelf: "center", color: "var(--expense)" }}
                onClick={() => setConfirmDelete(true)}
              >
                Borrar cuenta
              </button>
            ))}
        </>
      )}
    </Sheet>
  );
}
