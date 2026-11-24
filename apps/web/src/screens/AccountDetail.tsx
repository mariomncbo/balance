import { useParams } from "react-router";
import { Header } from "../components/Header";
import { Icon } from "../components/Icon";
import { EmptyState, ErrorState, LoadingTiles } from "../components/States";
import { TransactionRow } from "../components/TransactionRow";
import { ACCOUNT_TYPE_LABEL } from "../lib/categories";
import { dayLabel, groupByDay, todayMadrid } from "../lib/dates";
import { formatEuro } from "../lib/money";
import type { Balances, MonthSummary, Transaction } from "../lib/types";
import { useApi } from "../lib/useApi";
import { useSheet } from "../state/SheetContext";

export default function AccountDetail() {
  const { id = "" } = useParams();
  const { open } = useSheet();
  const today = todayMadrid();
  const accounts = useApi<Balances>("accounts.list");
  const list = useApi<{ items: Transaction[]; summary: MonthSummary }>("transactions.list", {
    accountId: id,
    period: "month",
  });
  const account = accounts.data?.accounts.find((a) => a.id === id);
  const items = list.data?.items ?? [];
  const inflow = items.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const outflow = items.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0);

  return (
    <main className="b-screen" style={{ gap: 14 }}>
      <Header
        title={account?.name ?? "Cuenta"}
        to="/"
        right={
          account ? (
            <button
              type="button"
              className="b-back"
              aria-label="Editar cuenta"
              onClick={() => open({ kind: "account", id })}
            >
              <Icon name="pencil" />
            </button>
          ) : undefined
        }
      />
      {accounts.error && !account && <ErrorState error={accounts.error} onRetry={accounts.reload} />}
      {accounts.loading && !account && <LoadingTiles rows={3} />}
      {accounts.data && !account && (
        <EmptyState icon="bank" title="Esta cuenta ya no existe" text="Puede que la hayas borrado." />
      )}
      {account && (
        <>
          <div className="b-grid">
            <div className="b-tile b-tile--accent b-span2" style={{ gap: 4, padding: 20 }}>
              <div className="row-between">
                <span className="b-eyebrow">{ACCOUNT_TYPE_LABEL[account.type]} · saldo actual</span>
                <span
                  className="b-avatar"
                  style={{
                    width: 36,
                    height: 36,
                    background: "var(--accent-hover)",
                    color: "var(--on-accent)",
                  }}
                >
                  <Icon name="bank" size={18} />
                </span>
              </div>
              <span className="b-big" style={{ fontSize: 36, lineHeight: "40px" }}>
                {formatEuro(account.balance)}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{account.share} % de todo tu dinero</span>
            </div>
            <div className="b-tile b-tile--income" style={{ gap: 2 }}>
              <span className="footnote" style={{ color: "var(--income)", fontWeight: 700 }}>
                Entradas del mes
              </span>
              <span className="b-money" style={{ fontSize: 19, color: "var(--income)" }}>
                {formatEuro(inflow, { signed: true })}
              </span>
            </div>
            <div className="b-tile b-tile--expense" style={{ gap: 2 }}>
              <span className="footnote" style={{ color: "var(--expense)", fontWeight: 700 }}>
                Salidas del mes
              </span>
              <span className="b-money" style={{ fontSize: 19 }}>
                {formatEuro(outflow)}
              </span>
            </div>
          </div>
          {list.data && items.length === 0 && (
            <EmptyState
              icon="moves"
              title="Sin movimientos este mes"
              text="Los movimientos de esta cuenta aparecerán aquí."
            />
          )}
          {groupByDay(items).map((g) => (
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
        </>
      )}
    </main>
  );
}
