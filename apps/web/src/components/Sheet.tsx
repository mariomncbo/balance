import { useEffect, useId, useRef, type ReactNode } from "react";

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Botón de la izquierda; por defecto "Cancelar". */
  leading?: ReactNode;
  trailing?: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Hoja modal: se cierra con Escape o tocando el fondo, atrapa el foco y lo devuelve al cerrar. */
export function Sheet({ title, onClose, children, leading, trailing }: Props) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>("input, textarea, select");
    (first ?? panel.current?.querySelector<HTMLElement>(FOCUSABLE))?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (!firstEl || !lastEl) return;
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  return (
    <div className="sheet-layer">
      <button type="button" className="b-scrim" aria-label="Cerrar" tabIndex={-1} onClick={onClose} />
      <div
        ref={panel}
        className="b-sheet sheet-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="b-sheet__grabber" />
        <div className="b-sheet__head">
          {leading ?? (
            <button
              type="button"
              className="b-btn b-btn--link"
              style={{ justifySelf: "start", paddingLeft: 0 }}
              onClick={onClose}
            >
              Cancelar
            </button>
          )}
          <h2 className="b-sheet__title" id={titleId}>
            {title}
          </h2>
          {trailing ?? <span />}
        </div>
        {children}
      </div>
    </div>
  );
}
