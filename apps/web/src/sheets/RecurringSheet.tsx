import { useState } from "react";
import { AccountSelect } from "../components/AccountSelect";
import { AmountInput } from "../components/AmountInput";
import { Field } from "../components/Field";
import { Icon, type IconName } from "../components/Icon";
import { Sheet } from "../components/Sheet";
import { api } from "../lib/api";
import { CATEGORY_LABEL, EXPENSE_CATEGORIES } from "../lib/categories";
import { parseEuro } from "../lib/money";
import type { Balances, Category, Recurring } from "../lib/types";
import { useApi } from "../lib/useApi";
import { useData } from "../state/DataContext";
import { useSheet } from "../state/SheetContext";

type Kind = Recurring["kind"];
const KINDS: { id: Kind; label: string; icon: IconName }[] = [
  { id: "income", label: "Ingreso", icon: "arrowUp" },
  { id: "expense", label: "Gasto", icon: "arrowDown" },
  { id: "loan", label: "Préstamo", icon: "home2" },
];

const fromEnd = (e?: string) => (e ? `${e.slice(5)}/${e.slice(0, 4)}` : "");
function parseEnd(text: string): { ok: boolean; value?: string } {
  if (text.trim() === "") return { ok: true };
  const m = /^(0?[1-9]|1[0-2])\/(\d{4})$/.exec(text.trim());
  return m ? { ok: true, value: `${m[2]}-${String(m[1]).padStart(2, "0")}` } : { ok: false };
}
const euros = (c?: number) => (c ? String(c / 100).replace(".", ",") : "");

export default function RecurringSheet({ id }: { id?: string }) {
  const { close } = useSheet();
  const accounts = useApi<Balances>("accounts.list");
  const list = useApi<Recurring[]>("recurring.list");
  const initial = id ? list.data?.find((r) => r.id === id) : undefined;
  const loading = (accounts.loading && !accounts.data) || (Boolean(id) && list.loading && !list.data);
  return (
    <Sheet title={id ? "Editar fijo" : "Nuevo fijo"} onClose={close}>
      {loading ? (
        <p className="b-sub" role="status">
          Cargando…
        </p>
      ) : (
        <RecurringForm id={id} initial={initial} accounts={accounts.data?.accounts ?? []} />
      )}
    </Sheet>
  );
}

function RecurringForm({
  id,
  initial,
  accounts,
}: {
  id?: string;
  initial?: Recurring;
  accounts: Balances["accounts"];
}) {
  const { close } = useSheet();
  const { invalidate } = useData();
  const [kind, setKind] = useState<Kind>(initial?.kind ?? "expense");
  const [amount, setAmount] = useState(euros(initial?.amount));
  const [concept, setConcept] = useState(initial?.concept ?? "");
  const [day, setDay] = useState(String(initial?.day ?? ""));
  const [yearly, setYearly] = useState(initial?.frequency.unit === "year");
  const [category, setCategory] = useState<Category>(initial?.category ?? "suscripciones");
  const [accountId, setAccountId] = useState(initial?.accountId ?? accounts[0]?.id ?? "");
  const [pending, setPending] = useState(euros(initial?.loan?.pending));
  const [principal, setPrincipal] = useState(euros(initial?.loan?.principal));
  const [end, setEnd] = useState(fromEnd(initial?.loan?.endMonth));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const pickKind = (k: Kind) => {
    setKind(k);
    setCategory(k === "income" ? "ingresos" : k === "loan" ? "hogar" : "suscripciones");
  };
  const clear = (k: string) => setErrors((s) => ({ ...s, [k]: "" }));

  async function save() {
    const cents = parseEuro(amount);
    const d = Number(day);
    const e: Record<string, string> = {};
    if (!cents) e.amount = "Escribe un importe válido, por ejemplo 9,99";
    if (!concept.trim()) e.concept = "Ponle un nombre, por ejemplo Netflix";
    if (!Number.isInteger(d) || d < 1 || d > 31) e.day = "Un día entre 1 y 31";
    const pend = parseEuro(pending);
    const prin = principal.trim() ? parseEuro(principal) : undefined;
    const endM = parseEnd(end);
    if (kind === "loan") {
      if (!pend) e.pending = "Escribe lo que te queda por pagar";
      if (prin === null) e.principal = "Importe no válido";
      if (!endM.ok) e.end = "Usa el formato mm/aaaa";
    }
    setErrors(e);
    if (Object.keys(e).length > 0 || !cents) return;
    setBusy(true);
    try {
      const params: Record<string, unknown> = {
        kind,
        amount: cents,
        concept: concept.trim(),
        category,
        day: d,
        frequencyUnit: yearly ? "year" : "month",
        frequencyEvery: 1,
        ...(accountId ? { accountId } : {}),
        ...(kind === "loan"
          ? {
              pending: pend,
              ...(endM.value ? { endMonth: endM.value } : {}),
              ...(prin ? { principal: prin } : {}),
            }
          : {}),
      };
      if (id) await api("recurring.update", { id, ...params });
      else await api("recurring.create", params);
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
      await api("recurring.delete", { id });
      invalidate();
      close();
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : "No se ha podido borrar." });
      setBusy(false);
    }
  }

  const categories = kind === "income" ? (["ingresos", "otros"] as Category[]) : EXPENSE_CATEGORIES;
  return (
    <>
      <div
        style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}
        role="group"
        aria-label="Tipo de fijo"
      >
        {KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            className="seg-btn"
            aria-pressed={kind === k.id}
            onClick={() => pickKind(k.id)}
          >
            <Icon name={k.icon} size={20} />
            {k.label}
          </button>
        ))}
      </div>
      <div className="b-tile" style={{ alignItems: "center", padding: 16, gap: 4 }}>
        <AmountInput
          label={yearly ? "Cada año" : "Cada mes"}
          value={amount}
          onChange={(v) => {
            setAmount(v);
            clear("amount");
          }}
          error={errors.amount}
          autoFocus={!id}
        />
      </div>
      <Field
        label="Concepto"
        value={concept}
        onChange={(e) => {
          setConcept(e.target.value);
          clear("concept");
        }}
        error={errors.concept}
        placeholder={kind === "income" ? "Nómina" : kind === "loan" ? "Hipoteca" : "Netflix"}
      />
      <div className="b-grid">
        <Field
          label="Día de cobro"
          inputMode="numeric"
          value={day}
          onChange={(e) => {
            setDay(e.target.value.replace(/\D/g, "").slice(0, 2));
            clear("day");
          }}
          error={errors.day}
          placeholder="5"
        />
        <div className="b-field">
          <span className="b-label">Frecuencia</span>
          <div
            className="b-seg"
            role="group"
            aria-label="Frecuencia"
            style={{ minHeight: 54, alignItems: "center" }}
          >
            <button type="button" aria-pressed={!yearly} onClick={() => setYearly(false)}>
              Mensual
            </button>
            <button type="button" aria-pressed={yearly} onClick={() => setYearly(true)}>
              Anual
            </button>
          </div>
        </div>
      </div>
      {kind !== "income" && (
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
      )}
      {accounts.length > 0 && (
        <AccountSelect
          label="Cuenta"
          value={accountId}
          accounts={accounts}
          onChange={setAccountId}
          allowNone
        />
      )}
      {kind === "loan" && (
        <div className="b-tile b-tile--soft stack" style={{ padding: 14 }}>
          <div className="b-grid">
            <Field
              label="Te queda por pagar"
              inputMode="decimal"
              value={pending}
              onChange={(e) => {
                setPending(e.target.value);
                clear("pending");
              }}
              error={errors.pending}
              placeholder="98.400"
            />
            <Field
              label="Termina en"
              value={end}
              onChange={(e) => {
                setEnd(e.target.value);
                clear("end");
              }}
              error={errors.end}
              placeholder="mm/aaaa"
            />
          </div>
          <Field
            label="Importe inicial del préstamo (opcional)"
            inputMode="decimal"
            value={principal}
            onChange={(e) => {
              setPrincipal(e.target.value);
              clear("principal");
            }}
            error={errors.principal}
            help="Con él se dibuja cuánto llevas amortizado."
          />
        </div>
      )}
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
            <p className="b-title">¿Borrar este fijo?</p>
            <p className="b-sub">Dejará de apuntarse solo. Los movimientos que ya se apuntaron se quedan.</p>
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
                Borrar
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
            Borrar fijo
          </button>
        ))}
    </>
  );
}
