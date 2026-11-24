import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Header } from "../components/Header";
import { Icon } from "../components/Icon";
import { ErrorState, LoadingTiles } from "../components/States";
import { api } from "../lib/api";
import { CATEGORY_ICON, CATEGORY_LABEL, SOURCE_LABEL } from "../lib/categories";
import { longDate } from "../lib/dates";
import { formatEuro } from "../lib/money";
import type { Balances, Transaction } from "../lib/types";
import { useApi } from "../lib/useApi";
import { useData } from "../state/DataContext";
import { useSheet } from "../state/SheetContext";

export default function MovementDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { open } = useSheet();
  const { invalidate } = useData();
  const tx = useApi<Transaction>("transactions.get", { id });
  const accounts = useApi<Balances>("accounts.list");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = tx.data;
  const account = accounts.data?.accounts.find((a) => a.id === t?.accountId);
  const income = (t?.amount ?? 0) > 0;

  async function remove() {
    setBusy(true);
    try {
      await api("transactions.delete", { id });
      invalidate();
      navigate(-1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se ha podido borrar.");
      setBusy(false);
    }
  }

  return (
    <main className="b-screen" style={{ gap: 14 }}>
      <Header
        to="/movimientos"
        right={
          t ? (
            <button
              type="button"
              className="b-back"
              aria-label="Editar movimiento"
              onClick={() => open({ kind: "movement", mode: "mano", id })}
            >
              <Icon name="pencil" />
            </button>
          ) : undefined
        }
      />
      {tx.error && !t && <ErrorState error={tx.error} onRetry={tx.reload} />}
      {tx.loading && !t && <LoadingTiles rows={3} />}
      {t && (
        <>
          <div className="b-grid">
            <div className="b-tile b-span2" style={{ alignItems: "center", gap: 8, padding: "24px 16px" }}>
              <span
                className={`b-avatar${income ? " b-avatar--income" : ""}`}
                style={{ width: 56, height: 56, borderRadius: 20 }}
              >
                <Icon name={CATEGORY_ICON[t.category]} size={26} />
              </span>
              <h1 className="b-title" style={{ fontSize: 19, fontWeight: 800 }}>
                {t.concept}
              </h1>
              <span
                className="b-big"
                style={{ fontSize: 40, lineHeight: "44px", color: income ? "var(--income)" : undefined }}
              >
                {formatEuro(t.amount, { signed: true })}
              </span>
              <span className="b-sub">{longDate(t.date)}</span>
            </div>
            <div className="b-tile" style={{ gap: 2 }}>
              <span className="b-eyebrow">Categoría</span>
              <span className="b-title">{CATEGORY_LABEL[t.category]}</span>
            </div>
            <div className="b-tile" style={{ gap: 2 }}>
              <span className="b-eyebrow">Cuenta</span>
              <span className="b-title">{account?.name ?? "Sin cuenta"}</span>
            </div>
            <div className={`b-tile ${income ? "b-tile--income" : "b-tile--expense"}`} style={{ gap: 2 }}>
              <span
                className="footnote"
                style={{ color: income ? "var(--income)" : "var(--expense)", fontWeight: 700 }}
              >
                Tipo
              </span>
              <span className="b-title">{income ? "Ingreso" : "Gasto"}</span>
            </div>
            <div className="b-tile b-tile--soft" style={{ gap: 2 }}>
              <span className="footnote" style={{ color: "var(--accent-text)", fontWeight: 700 }}>
                Origen
              </span>
              <span className="b-title">{SOURCE_LABEL[t.source] || "A mano"}</span>
            </div>
            {t.note && (
              <div className="b-tile b-span2" style={{ gap: 2 }}>
                <span className="b-eyebrow">Nota</span>
                <span className="body">{t.note}</span>
              </div>
            )}
          </div>
          <div className="b-spacer" />
          {error && (
            <p className="b-help" role="alert" style={{ color: "var(--expense)", textAlign: "center" }}>
              {error}
            </p>
          )}
          {confirming ? (
            <div className="b-tile stack" role="alertdialog" aria-label="Confirmar borrado">
              <p className="b-title">¿Borrar este movimiento?</p>
              <p className="b-sub">No se puede deshacer. El saldo de la cuenta se recalculará.</p>
              <div className="b-grid" style={{ gap: 8 }}>
                <button
                  type="button"
                  className="b-btn b-btn--secondary b-btn--sm"
                  onClick={() => setConfirming(false)}
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
              onClick={() => setConfirming(true)}
            >
              Borrar movimiento
            </button>
          )}
        </>
      )}
    </main>
  );
}
