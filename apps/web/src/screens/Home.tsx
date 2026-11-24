import { Link } from "react-router";
import { EmptyState, ErrorState, LoadingTiles } from "../components/States";
import { Icon } from "../components/Icon";
import { TransactionRow } from "../components/TransactionRow";
import { longDate, weekdayInitial } from "../lib/dates";
import { formatEuro } from "../lib/money";
import type { Home as HomeData } from "../lib/types";
import { useApi } from "../lib/useApi";
import { useProfile } from "../lib/useProfile";
import { useSheet } from "../state/SheetContext";

const DOT_COLORS = [
  "var(--accent)",
  "var(--income-solid)",
  "var(--text-secondary)",
  "var(--warning-solid)",
  "var(--expense-solid)",
];

function WeekBars({ days }: { days: HomeData["lastDays"]["days"] }) {
  const max = Math.max(1, ...days.map((d) => d.expense));
  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          gap: 4,
          alignItems: "end",
          height: 60,
        }}
        role="img"
        aria-label={`Gasto de los últimos 7 días: ${days.map((d) => `${weekdayInitial(d.date)} ${formatEuro(d.expense)}`).join(", ")}`}
      >
        {days.map((d, i) => (
          <span
            key={d.date}
            style={{
              display: "block",
              borderRadius: 5,
              height: Math.max(4, Math.round((d.expense / max) * 60)),
              background: i === days.length - 1 ? "var(--accent)" : "var(--surface-selected)",
            }}
          />
        ))}
      </div>
      <div
        aria-hidden="true"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          gap: 4,
          textAlign: "center",
          fontSize: 11,
          lineHeight: "13px",
          color: "var(--text-secondary)",
        }}
      >
        {days.map((d, i) => (
          <span
            key={d.date}
            style={i === days.length - 1 ? { color: "var(--accent-text)", fontWeight: 800 } : undefined}
          >
            {weekdayInitial(d.date)}
          </span>
        ))}
      </div>
    </>
  );
}

function Ring({ percent, label }: { percent: number; label: string }) {
  const c = 2 * Math.PI * 31;
  return (
    <div style={{ position: "relative", width: 76, height: 76 }}>
      <svg
        width="76"
        height="76"
        viewBox="0 0 76 76"
        role="img"
        aria-label={label}
        style={{ transform: "rotate(-90deg)" }}
      >
        <circle
          cx="38"
          cy="38"
          r="31"
          style={{ fill: "none", stroke: "var(--surface-selected)", strokeWidth: 9 }}
        />
        <circle
          cx="38"
          cy="38"
          r="31"
          style={{
            fill: "none",
            stroke: "var(--goal)",
            strokeWidth: 9,
            strokeLinecap: "round",
            strokeDasharray: `${(c * percent) / 100} ${c}`,
          }}
        />
      </svg>
      <span
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          fontSize: 15,
          fontWeight: 800,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {percent} %
      </span>
    </div>
  );
}

export default function Home() {
  const { data, error, loading, reload } = useApi<HomeData>("home");
  const profile = useProfile();
  const { open } = useSheet();

  return (
    <main className="b-screen b-screen--tabs" style={{ gap: 14 }}>
      <div
        style={{
          minHeight: 44,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          paddingRight: 104,
        }}
      >
        <span className="b-eyebrow">{data ? longDate(data.today) : " "}</span>
        <h1 className="b-h1" style={{ fontSize: 24, lineHeight: "28px" }}>
          {profile ? `Hola, ${profile.name}` : "Hola"}
        </h1>
      </div>

      {loading && !data && <LoadingTiles />}
      {error && !data && <ErrorState error={error} onRetry={reload} />}

      {data && data.balances.accounts.length === 0 && (
        <>
          <div className="b-tile">
            <span className="b-eyebrow">Saldo total</span>
            <span className="b-big" style={{ color: "var(--text-secondary)" }}>
              {formatEuro(0)}
            </span>
          </div>
          <EmptyState
            icon="bank"
            title="Añade tu primera cuenta"
            text="Tu banco, tu cuenta de ahorro o el efectivo. Aquí verás el saldo de todas juntas."
            action={
              <button
                type="button"
                className="b-btn b-btn--primary"
                onClick={() => open({ kind: "account" })}
              >
                Añadir cuenta
              </button>
            }
          />
        </>
      )}

      {data && data.balances.accounts.length > 0 && (
        <>
          <div className="b-grid">
            <Link to="/informe" className="b-tile b-span2">
              <span className="b-eyebrow">Saldo total</span>
              <div className="row-between">
                <span className="b-big">{formatEuro(data.balances.total)}</span>
                <span className={`b-pill ${data.month.saved >= 0 ? "b-pill--income" : "b-pill--expense"}`}>
                  {formatEuro(data.month.saved, { signed: true })} este mes
                </span>
              </div>
            </Link>

            <Link to="/movimientos" className="b-tile" style={{ gap: 10 }}>
              <span className="b-eyebrow">Últimos 7 días</span>
              <span className="b-money">{formatEuro(-data.lastDays.total)}</span>
              <WeekBars days={data.lastDays.days} />
            </Link>

            {data.topGoal ? (
              <Link to="/metas" className="b-tile" style={{ alignItems: "center", gap: 6 }}>
                <span className="b-eyebrow" style={{ alignSelf: "flex-start" }}>
                  Meta más cerca
                </span>
                <Ring
                  percent={data.topGoal.progress}
                  label={`${data.topGoal.name}: ${data.topGoal.progress} %`}
                />
                <span className="b-title">{data.topGoal.name}</span>
                <span className="footnote" style={{ color: "var(--accent-text)", fontWeight: 700 }}>
                  {formatEuro(data.topGoal.monthly, { round: true })}/mes
                </span>
              </Link>
            ) : (
              <Link to="/metas" className="b-tile b-tile--soft" style={{ gap: 6, justifyContent: "center" }}>
                <span className="b-avatar" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>
                  <Icon name="target" />
                </span>
                <span className="b-title" style={{ marginTop: 4 }}>
                  Crea tu primera meta
                </span>
                <span className="footnote" style={{ color: "var(--accent-text)" }}>
                  Te diremos cuánto apartar al mes
                </span>
              </Link>
            )}

            {data.nextPayment ? (
              <div className="b-tile b-tile--warning" style={{ gap: 4 }}>
                <span
                  className="b-avatar"
                  style={{ width: 32, height: 32, background: "var(--surface)", color: "var(--warning)" }}
                >
                  <Icon name="clock" size={18} />
                </span>
                <span className="footnote" style={{ color: "var(--warning)", fontWeight: 700, marginTop: 4 }}>
                  {data.nextPayment.date === data.today
                    ? "Hoy"
                    : `El ${Number(data.nextPayment.date.slice(8))}`}
                </span>
                <span className="b-title">{data.nextPayment.concept}</span>
                <span className="b-money">{formatEuro(-data.nextPayment.amount)}</span>
              </div>
            ) : (
              <div className="b-tile" style={{ gap: 4, justifyContent: "center" }}>
                <span className="b-eyebrow">Próximo pago</span>
                <span className="b-sub">Sin pagos fijos a la vista</span>
              </div>
            )}

            <Link to="/informe" className="b-tile" style={{ gap: 8 }}>
              <span className="b-eyebrow">Este mes</span>
              <span className="subhead row-between">
                <span style={{ color: "var(--text-secondary)" }}>Entra</span>
                <span className="b-num" style={{ color: "var(--income)", fontWeight: 700 }}>
                  {formatEuro(data.month.income, { signed: true, round: true })}
                </span>
              </span>
              <span className="subhead row-between">
                <span style={{ color: "var(--text-secondary)" }}>Sale</span>
                <span className="b-num" style={{ fontWeight: 700 }}>
                  {formatEuro(-data.month.expense, { round: true })}
                </span>
              </span>
              <span className="subhead row-between">
                <span style={{ color: "var(--text-secondary)" }}>Por pagar</span>
                <span className="b-num" style={{ fontWeight: 700 }}>
                  {formatEuro(-data.month.pending, { round: true })}
                </span>
              </span>
            </Link>

            <div className="b-tile b-span2" style={{ gap: 12 }}>
              <div className="row-between">
                <span className="b-eyebrow">Dónde está tu dinero</span>
                <button
                  type="button"
                  className="footnote"
                  style={{ color: "var(--accent-text)", fontWeight: 700, background: "none", border: 0 }}
                  onClick={() => open({ kind: "account" })}
                >
                  Añadir cuenta
                </button>
              </div>
              <div
                className="b-split"
                role="img"
                aria-label={data.balances.accounts.map((a) => `${a.name} ${a.share} %`).join(", ")}
              >
                {data.balances.accounts.map((a, i) => (
                  <span
                    key={a.id}
                    style={{
                      width: `${Math.max(a.share, 1)}%`,
                      background: DOT_COLORS[i % DOT_COLORS.length],
                    }}
                  />
                ))}
              </div>
              <ul className="stack subhead" style={{ gap: 8 }}>
                {data.balances.accounts.map((a, i) => (
                  <li key={a.id}>
                    <Link to={`/cuentas/${a.id}`} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="b-dot" style={{ background: DOT_COLORS[i % DOT_COLORS.length] }} />
                      <span style={{ flexGrow: 1 }}>{a.name}</span>
                      <span className="b-num" style={{ fontWeight: 600 }}>
                        {formatEuro(a.balance)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <section className="stack" style={{ gap: 10 }} aria-labelledby="latest">
            <div className="row-between">
              <h2 className="b-title" id="latest">
                Últimos movimientos
              </h2>
              <Link
                to="/movimientos"
                className="footnote"
                style={{ color: "var(--accent-text)", fontWeight: 700 }}
              >
                Ver todos
              </Link>
            </div>
            {data.latest.length === 0 ? (
              <p className="b-sub">Todavía no hay movimientos. Pulsa + para añadir el primero.</p>
            ) : (
              <ul className="b-list">
                {data.latest.map((t) => (
                  <li key={t.id}>
                    <TransactionRow t={t} today={data.today} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
