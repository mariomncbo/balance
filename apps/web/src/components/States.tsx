import type { ReactNode } from "react";
import type { ApiError } from "../lib/api";
import { Icon, type IconName } from "./Icon";

export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: IconName;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="b-empty">
      <div className="b-empty__icon">
        <Icon name={icon} />
      </div>
      <p className="b-title">{title}</p>
      <p className="b-sub">{text}</p>
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: ApiError | Error; onRetry?: () => void }) {
  return (
    <div className="b-empty" role="alert">
      <div className="b-empty__icon" style={{ background: "var(--expense-subtle)", color: "var(--expense)" }}>
        <Icon name="warning" />
      </div>
      <p className="b-title">No se han podido cargar los datos</p>
      <p className="b-sub">{error.message}</p>
      {onRetry && (
        <button type="button" className="b-btn b-btn--primary" onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  );
}

/** Esqueleto de pantalla con fichas: se ve mientras llegan los datos. */
export function LoadingTiles({ rows = 4 }: { rows?: number }) {
  return (
    <div className="b-grid" aria-busy="true" aria-live="polite">
      <span className="visually-hidden">Cargando…</span>
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className={`skeleton${i === 0 ? " b-span2" : ""}`}
          style={{ height: i === 0 ? 150 : 110, borderRadius: "var(--radius-lg)" }}
        />
      ))}
    </div>
  );
}
