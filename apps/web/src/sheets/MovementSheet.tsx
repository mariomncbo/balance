import { useState } from "react";
import { Link } from "react-router";
import { AccountSelect } from "../components/AccountSelect";
import { AmountInput } from "../components/AmountInput";
import { Field } from "../components/Field";
import { Sheet } from "../components/Sheet";
import { api } from "../lib/api";
import { CATEGORY_LABEL, EXPENSE_CATEGORIES } from "../lib/categories";
import { todayMadrid } from "../lib/dates";
import { parseEuro } from "../lib/money";
import type { Balances, Category, Transaction } from "../lib/types";
import { useApi } from "../lib/useApi";
import { useData } from "../state/DataContext";
import { useSheet } from "../state/SheetContext";

const INCOME_CATEGORIES: Category[] = ["ingresos", "otros"];

export default function MovementSheet({ id }: { id?: string }) {
  const { close } = useSheet();
  const accounts = useApi<Balances>("accounts.list");
  const tx = useApi<Transaction>("transactions.get", id ? { id } : { id: "-" });
  const loading = (accounts.loading && !accounts.data) || (Boolean(id) && tx.loading && !tx.data);
  return (
    <Sheet title={id ? "Editar movimiento" : "Nuevo movimiento"} onClose={close}>
      {loading ? (
        <p className="b-sub" role="status">
          Cargando…
        </p>
      ) : (
        <MovementForm id={id} initial={id ? tx.data : undefined} accounts={accounts.data?.accounts ?? []} />
      )}
    </Sheet>
  );
}

function MovementForm({
  id,
  initial,
  accounts,
}: {
  id?: string;
  initial?: Transaction;
  accounts: Balances["accounts"];
}) {
  const { close } = useSheet();
  const { invalidate } = useData();
  const [income, setIncome] = useState((initial?.amount ?? -1) > 0);
  const [amount, setAmount] = useState(
    initial ? String(Math.abs(initial.amount) / 100).replace(".", ",") : "",
  );
  const [concept, setConcept] = useState(initial?.concept ?? "");
  const [category, setCategory] = useState<Category>(initial?.category ?? "comida");
  const [accountId, setAccountId] = useState(initial?.accountId ?? accounts[0]?.id ?? "");
  const [date, setDate] = useState(initial?.date ?? todayMadrid());
  const [note, setNote] = useState(initial?.note ?? "");
  const [errors, setErrors] = useState<{
    amount?: string;
    concept?: string;
    account?: string;
    date?: string;
    form?: string;
  }>({});
  const [busy, setBusy] = useState(false);
  const categories = income ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const pickType = (isIncome: boolean) => {
    setIncome(isIncome);
    setCategory(isIncome ? "ingresos" : "comida");
  };

  async function save() {
    const cents = parseEuro(amount);
    const e: typeof errors = {};
    if (!cents) e.amount = "Escribe un importe válido, por ejemplo 12,50";
    if (!concept.trim()) e.concept = "Escribe qué ha sido, por ejemplo Mercadona";
    if (!accountId) e.account = "Elige una cuenta";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) e.date = "Elige una fecha";
    setErrors(e);
    if (Object.keys(e).length > 0 || !cents) return;
    setBusy(true);
    try {
      const params = {
        accountId,
        amount: income ? cents : -cents,
        concept: concept.trim(),
        category,
        date,
        source: initial?.source === "fijo" ? undefined : (initial?.source ?? "manual"),
        ...(note.trim() ? { note: note.trim() } : {}),
      };
      if (id) await api("transactions.update", { id, ...params });
      else await api("transactions.create", params);
      invalidate();
      close();
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : "No se ha podido guardar." });
      setBusy(false);
    }
  }

  if (accounts.length === 0) {
    return (
      <div className="b-empty">
        <p className="b-title">Primero añade una cuenta</p>
        <p className="b-sub">Los movimientos se apuntan en una cuenta.</p>
        <Link to="/" className="b-btn b-btn--primary" onClick={close}>
          Ir a Principal
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="b-tile" style={{ alignItems: "center", padding: "18px 16px", gap: 10 }}>
        <div
          className="b-seg"
          role="group"
          aria-label="Tipo de movimiento"
          style={{ width: 220, padding: 3 }}
        >
          <button
            type="button"
            aria-pressed={!income}
            style={{ minHeight: 34 }}
            onClick={() => pickType(false)}
          >
            Gasto
          </button>
          <button
            type="button"
            aria-pressed={income}
            style={{ minHeight: 34 }}
            onClick={() => pickType(true)}
          >
            Ingreso
          </button>
        </div>
        <AmountInput
          label={income ? "Importe que entra" : "Importe que sale"}
          value={amount}
          onChange={(v) => {
            setAmount(v);
            setErrors((s) => ({ ...s, amount: undefined }));
          }}
          tone={income ? "income" : "default"}
          error={errors.amount}
          autoFocus={!id}
        />
      </div>
      <Field
        label="Concepto"
        value={concept}
        onChange={(e) => {
          setConcept(e.target.value);
          setErrors((s) => ({ ...s, concept: undefined }));
        }}
        error={errors.concept}
        placeholder="Mercadona"
      />
      <div className="stack" style={{ gap: 8 }}>
        <span className="b-label">Categoría</span>
        <div className="chips-wrap" role="group" aria-label="Categoría">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              className="b-chip"
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
            >
              {CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
      </div>
      <div className="b-grid">
        <AccountSelect label="Cuenta" value={accountId} accounts={accounts} onChange={setAccountId} />
        <Field
          label="Fecha"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          error={errors.date}
        />
      </div>
      <Field label="Nota (opcional)" value={note} maxLength={280} onChange={(e) => setNote(e.target.value)} />
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
    </>
  );
}
