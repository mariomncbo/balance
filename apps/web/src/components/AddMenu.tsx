import { useEffect } from "react";
import { useSheet } from "../state/SheetContext";
import { Icon } from "./Icon";

/** Menú del +: tres opciones de cristal sobre el fondo oscurecido. IA y Escaneo llegan en la fase 8. */
export function AddMenu() {
  const { open, close } = useSheet();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close]);

  return (
    <div className="sheet-layer" style={{ alignItems: "flex-end", justifyContent: "center" }}>
      <button type="button" className="b-scrim" aria-label="Cerrar menú" tabIndex={-1} onClick={close} />
      <div
        style={{
          position: "absolute",
          right: "max(16px, calc(50% - 224px))",
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          alignItems: "flex-end",
        }}
      >
        <div className="b-menu" role="menu" aria-label="Añadir movimiento">
          <button
            type="button"
            role="menuitem"
            className="b-menu__item b-glass"
            disabled
            aria-disabled="true"
            style={{ opacity: 0.7 }}
          >
            <Icon name="spark" />
            IA<span className="b-pill b-pill--accent menu-soon">Pronto</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="b-menu__item b-glass"
            autoFocus
            onClick={() => open({ kind: "movement", mode: "mano" })}
          >
            <Icon name="pencil" />A mano
          </button>
          <button
            type="button"
            role="menuitem"
            className="b-menu__item b-glass"
            disabled
            aria-disabled="true"
            style={{ opacity: 0.7 }}
          >
            <Icon name="camera" />
            Escaneo<span className="b-pill b-pill--accent menu-soon">Pronto</span>
          </button>
        </div>
        <button
          type="button"
          className="b-glass-btn b-glass-btn--lg b-glass"
          aria-label="Cerrar menú"
          aria-expanded="true"
          onClick={close}
        >
          <Icon name="close" />
        </button>
      </div>
    </div>
  );
}
