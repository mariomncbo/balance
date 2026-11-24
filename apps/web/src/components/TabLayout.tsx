import { NavLink, Outlet } from "react-router";
import { useSheet } from "../state/SheetContext";
import { Icon, type IconName } from "./Icon";

const TABS: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: "/", label: "Principal", icon: "home", end: true },
  { to: "/movimientos", label: "Movimientos", icon: "moves" },
  { to: "/metas", label: "Metas", icon: "target" },
];

/** Marco de las tres pestañas: botones de cristal arriba a la derecha y barra de cristal abajo. */
export function TabLayout() {
  const { open } = useSheet();
  return (
    <>
      <div className="top-fixed">
        <div className="b-topbar">
          <NavLink to="/chat" className="b-glass-btn b-glass" aria-label="Asistente de IA">
            <Icon name="spark" />
          </NavLink>
          <NavLink to="/ajustes" className="b-glass-btn b-glass" aria-label="Ajustes">
            <Icon name="settings" />
          </NavLink>
        </div>
      </div>
      <Outlet />
      <nav className="nav-fixed" aria-label="Principal">
        <div className="b-navbar">
          <div className="b-tabbar b-glass">
            {TABS.map((t) => (
              <NavLink key={t.to} to={t.to} end={t.end} className="b-tab" aria-label={t.label}>
                {({ isActive }) => (
                  <span style={{ display: "contents" }} aria-current={isActive ? "page" : undefined}>
                    <Icon name={t.icon} />
                    {t.label}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
          <button
            type="button"
            className="b-glass-btn b-glass-btn--lg b-glass"
            aria-label="Añadir movimiento"
            aria-haspopup="dialog"
            onClick={() => open({ kind: "menu" })}
          >
            <Icon name="plus" />
          </button>
        </div>
      </nav>
    </>
  );
}
