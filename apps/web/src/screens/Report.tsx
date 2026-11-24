import { useState } from "react";
import { Header } from "../components/Header";
import { Icon } from "../components/Icon";
import { ErrorState, LoadingTiles } from "../components/States";
import { monthOf, monthTitle, shiftMonth, todayMadrid } from "../lib/dates";
import { formatEuro } from "../lib/money";
import type { Goals, MonthSummary } from "../lib/types";
import { useApi } from "../lib/useApi";

const SLICE = ["var(--text)", "var(--text-secondary)", "var(--border)", "var(--surface-selected)"];

export default function Report() {
  const current = monthOf(todayMadrid());
  const [month, setMonth] = useState(current);
  const { data, error, loading, reload } = useApi<{ summary: MonthSummary; goals: Goals }>("report.month", {
    month,
  });
  const s = data?.summary;

  return (
    <main className="b-screen" style={{ gap: 12 }}>
      <header className="b-head">
        <Header.Back />
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 2 }}>
          <button
            type="button"
            className="b-eye"
            aria-label="Mes anterior"
            style={{ width: 34, height: 34 }}
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
          >
            <Icon name="back" size={18} />
          </button>
          <h1 className="b-head__title" aria-live="polite">
            {monthTitle(month)}
          </h1>
          <button
            type="button"
            className="b-eye"
            aria-label="Mes siguiente"
            style={{ width: 34, height: 34 }}
            disabled={month >= current}
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
          >
            <Icon name="chevron" size={18} />
          </button>
        </div>
        <span />
      </header>
      {loading && !s && <LoadingTiles />}
      {error && !s && <ErrorState error={error} onRetry={reload} />}
      {s && (
        <div className="b-grid">
          <div
            className={`b-tile b-span2 ${s.saved >= 0 ? "b-tile--income" : "b-tile--expense"}`}
            style={{ gap: 2, padding: 18 }}
          >
            <span
              className="footnote"
              style={{ color: s.saved >= 0 ? "var(--income)" : "var(--expense)", fontWeight: 700 }}
            >
              {s.saved >= 0 ? "Has ahorrado" : "Has gastado de más"}
            </span>
            <div className="row-between">
              <span
                className="b-big"
                style={{
                  fontSize: 36,
                  lineHeight: "40px",
                  color: s.saved >= 0 ? "var(--income)" : "var(--expense)",
                }}
              >
                {formatEuro(s.saved, { signed: true })}
              </span>
              {s.income > 0 && (
                <span
                  className="b-pill"
                  style={{
                    background: "var(--surface)",
                    color: s.saved >= 0 ? "var(--income)" : "var(--expense)",
                  }}
                >
                  {s.savedShare} % de lo que entró
                </span>
              )}
            </div>
          </div>
          <div className="b-tile" style={{ gap: 2 }}>
            <span className="b-eyebrow">Ingresos</span>
            <span className="b-money b-money--income" style={{ fontSize: 18 }}>
              {formatEuro(s.income, { signed: true })}
            </span>
          </div>
          <div className="b-tile" style={{ gap: 2 }}>
            <span className="b-eyebrow">Gastos</span>
            <span className="b-money" style={{ fontSize: 18 }}>
              {formatEuro(-s.expense)}
            </span>
          </div>
          {s.vsPrevious !== null && s.vsPrevious !== 0 && (
            <div
              className="b-tile b-tile--soft b-span2"
              style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: "12px 14px" }}
            >
              <span className="b-avatar" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
                <Icon name={s.vsPrevious > 0 ? "arrowDown" : "arrowUp"} />
              </span>
              <span className="subhead">
                Has gastado{" "}
                <strong className="b-num">
                  {formatEuro(Math.abs(s.vsPrevious))} {s.vsPrevious > 0 ? "menos" : "más"}
                </strong>{" "}
                que el mes anterior.
              </span>
            </div>
          )}
          <div className="b-tile b-span2" style={{ gap: 10 }}>
            <span className="b-eyebrow">En qué se fue</span>
            {s.byCategory.length === 0 ? (
              <span className="b-sub">No hay gastos este mes.</span>
            ) : (
              <>
                <div
                  className="b-split"
                  role="img"
                  aria-label={s.byCategory.map((c) => `${c.label} ${c.share} %`).join(", ")}
                >
                  {s.byCategory.map((c, i) => (
                    <span
                      key={c.category}
                      style={{
                        width: `${Math.max(c.share, 1)}%`,
                        background: SLICE[Math.min(i, SLICE.length - 1)],
                      }}
                    />
                  ))}
                </div>
                <ul className="b-grid" style={{ gap: "6px 12px" }}>
                  {s.byCategory.map((c, i) => (
                    <li
                      key={c.category}
                      className="subhead"
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <span className="b-dot" style={{ background: SLICE[Math.min(i, SLICE.length - 1)] }} />
                      <span style={{ flexGrow: 1 }}>{c.label}</span>
                      <span className="b-num" style={{ fontWeight: 700 }}>
                        {formatEuro(c.amount, { round: true })}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
          {month === current && data.goals.goals.length > 0 && (
            <div className="b-tile b-span2" style={{ gap: 10 }}>
              <span className="b-eyebrow">Metas</span>
              {data.goals.goals.map((g) => (
                <div
                  key={g.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 90px 44px",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <span className="subhead">{g.name}</span>
                  <span
                    className="b-progress"
                    role="progressbar"
                    aria-label={g.name}
                    aria-valuenow={g.progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <span
                      className="b-progress__fill"
                      style={{ display: "block", width: `${g.progress}%` }}
                    />
                  </span>
                  <span className="subhead b-num" style={{ textAlign: "right" }}>
                    {g.progress} %
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
