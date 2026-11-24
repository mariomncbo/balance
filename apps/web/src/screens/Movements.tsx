import { useState } from "react";
import { EmptyState, ErrorState, LoadingTiles } from "../components/States";
import { Icon } from "../components/Icon";
import { TransactionRow } from "../components/TransactionRow";
import { CATEGORY_LABEL } from "../lib/categories";
import { dayLabel, groupByDay, monthName, todayMadrid } from "../lib/dates";
import { formatEuro } from "../lib/money";
import type { Category, MonthSummary, Recurring, Transaction } from "../lib/types";
import { useApi } from "../lib/useApi";
import { useDebounced } from "../lib/useDebounced";
import { useSheet } from "../state/SheetContext";

type Period = "day" | "week" | "month";
const PERIODS: { id: Period; label: string }[] = [
  { id: "day", label: "Día" },
  { id: "week", label: "Sem." },
  { id: "month", label: "Mes" },
];

function FixedTag({ r, onOpen }: { r: Recurring; onOpen: () => void }) {
  const kind = r.kind === "income" ? "income" : r.kind === "loan" ? "loan" : "expense";
  const amount = formatEuro(r.kind === "income" ? r.amount : -r.amount, {
    signed: true,
    round: r.amount % 100 === 0,
  });
  const meta =
    r.kind === "loan" && r.loan
      ? `Día ${r.day} · quedan ${formatEuro(r.loan.pending, { round: true })}`
      : `Día ${r.day} · ${r.frequency.unit === "year" ? "anual" : "mensual"}`;
  return (
    <button
      type="button"
      className={`b-tag b-tag--${kind}`}
      style={{ border: 0, textAlign: "left" }}
      onClick={onOpen}
      aria-label={`${r.concept}, ${amount}. Editar`}
    >
      <span className="b-tag__top">
        <span className="b-tag__name">{r.concept}</span>
        <span className="b-num">{amount}</span>
      </span>
      <span className="b-tag__meta">{meta}</span>
      {r.kind === "loan" && r.progress !== null && (
        <span
          className="b-progress b-progress--loan"
          style={{ height: 6, marginTop: 4 }}
          role="progressbar"
          aria-label="Amortizado"
          aria-valuenow={r.progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span className="b-progress__fill" style={{ display: "block", width: `${r.progress}%` }} />
        </span>
      )}
    </button>
  );
}

export default function Movements() {
  const { open } = useSheet();
  const today = todayMadrid();
  const [period, setPeriod] = useState<Period>("month");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | null>(null);
  const q = useDebounced(query.trim());
  const list = useApi<{ items: Transaction[]; summary: MonthSummary }>("transactions.list", {
    period,
    ...(q ? { query: q } : {}),
    ...(category ? { category } : {}),
  });
  const fixed = useApi<Recurring[]>("recurring.list");
  const data = list.data;
  const filtering = Boolean(q || category);
  const summary = data?.summary;

  return (
    <main className="b-screen b-screen--tabs" style={{ gap: 12 }}>
      <div style={{ minHeight: 44, display: "flex", alignItems: "center", paddingRight: 104 }}>
        <h1 className="b-h1" style={{ fontSize: 24, lineHeight: "28px" }}>
          Movimientos
        </h1>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <label style={{ position: "relative", flexGrow: 1 }}>
          <span className="visually-hidden">Buscar movimientos</span>
          <span style={{ position: "absolute", left: 14, top: 12, color: "var(--text-secondary)" }}>
            <Icon name="search" size={20} />
          </span>
          <input
            className="b-input"
            type="search"
            placeholder="Buscar"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ minHeight: 46, paddingLeft: 42, borderRadius: 999, borderColor: "transparent" }}
          />
        </label>
        <div
          className="b-seg"
          role="group"
          aria-label="Periodo"
          style={{ flex: "none", width: 168, padding: 3 }}
        >
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={period === p.id}
              style={{ minHeight: 38 }}
              onClick={() => setPeriod(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {list.loading && !data && <LoadingTiles />}
      {list.error && !data && <ErrorState error={list.error} onRetry={list.reload} />}

      {summary && (
        <div className="b-grid">
          <div
            className="b-tile b-span2"
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "14px 16px",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span className="b-eyebrow">Gastado en {monthName(summary.month).toLowerCase()}</span>
              <span className="b-big" style={{ fontSize: 26, lineHeight: "30px" }}>
                {formatEuro(-summary.expense)}
              </span>
            </div>
            {summary.vsPrevious !== null && summary.vsPrevious !== 0 && (
              <span className={`b-pill ${summary.vsPrevious > 0 ? "b-pill--income" : "b-pill--expense"}`}>
                {formatEuro(Math.abs(summary.vsPrevious), { round: true })}{" "}
                {summary.vsPrevious > 0 ? "menos" : "más"}
              </span>
            )}
          </div>
          {summary.byCategory.slice(0, 4).map((c) => (
            <button
              key={c.category}
              type="button"
              className="b-tile"
              aria-pressed={category === c.category}
              aria-label={`Filtrar por ${c.label}: ${formatEuro(-c.amount)}, ${c.share} %`}
              style={{
                border: 0,
                textAlign: "left",
                gap: 6,
                padding: "12px 14px",
                outline: category === c.category ? "2px solid var(--accent-border)" : undefined,
                outlineOffset: -2,
              }}
              onClick={() => setCategory(category === c.category ? null : c.category)}
            >
              <span className="row-between" style={{ width: "100%" }}>
                <span className="subhead" style={{ fontWeight: 700 }}>
                  {c.label}
                </span>
                <span className="footnote" style={{ color: "var(--text-secondary)" }}>
                  {c.share} %
                </span>
              </span>
              <span className="b-money">{formatEuro(-c.amount)}</span>
              <span className="b-progress b-progress--loan" style={{ height: 6, width: "100%" }}>
                <span className="b-progress__fill" style={{ display: "block", width: `${c.share}%` }} />
              </span>
            </button>
          ))}
        </div>
      )}

      <section className="stack" style={{ gap: 8 }} aria-labelledby="fijos">
        <div className="row-between">
          <h2 className="b-eyebrow" id="fijos" style={{ paddingLeft: 4 }}>
            Fijos
          </h2>
          <button
            type="button"
            className="footnote"
            style={{ color: "var(--accent-text)", fontWeight: 700, background: "none", border: 0 }}
            onClick={() => open({ kind: "recurring" })}
          >
            Añadir
          </button>
        </div>
        {fixed.data && fixed.data.length > 0 ? (
          <div className="b-tags">
            {fixed.data.map((r) => (
              <FixedTag key={r.id} r={r} onOpen={() => open({ kind: "recurring", id: r.id })} />
            ))}
          </div>
        ) : (
          !fixed.loading && (
            <p className="b-sub">Tu sueldo, el alquiler, las suscripciones… Añádelos y se apuntarán solos.</p>
          )
        )}
      </section>

      {data &&
        data.items.length === 0 &&
        (filtering ? (
          <EmptyState
            icon="search"
            title="Sin resultados"
            text="No hay movimientos con ese filtro."
            action={
              <button
                type="button"
                className="b-btn b-btn--secondary"
                onClick={() => {
                  setQuery("");
                  setCategory(null);
                }}
              >
                Quitar filtros
              </button>
            }
          />
        ) : (
          <EmptyState
            icon="moves"
            title="Todavía no hay movimientos"
            text="Añade el primero con el botón + de abajo."
          />
        ))}

      {data &&
        groupByDay(data.items).map((g) => (
          <section key={g.date} className="stack" style={{ gap: 8 }} aria-label={dayLabel(g.date, today)}>
            <span className="b-eyebrow" style={{ paddingLeft: 4 }}>
              {dayLabel(g.date, today)}
            </span>
            <ul className="b-list">
              {g.items.map((t) => (
                <li key={t.id}>
                  <TransactionRow t={t} today={today} showDate={false} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      {category && (
        <p className="visually-hidden" role="status">
          Filtrando por {CATEGORY_LABEL[category]}
        </p>
      )}
    </main>
  );
}
