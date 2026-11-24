import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "./AuthContext";
import { useLock } from "./LockContext";

function Splash() {
  return (
    <div className="screen-center" role="status" aria-live="polite">
      <span className="visually-hidden">Cargando…</span>
    </div>
  );
}

/** Pantallas de la app: hace falta sesión y, si hay PIN, haberla desbloqueado. */
export function RequireAuth() {
  const { session, ready } = useAuth();
  const { locked } = useLock();
  const location = useLocation();
  if (!ready) return <Splash />;
  if (!session) return <Navigate to="/bienvenida" replace />;
  if (locked) return <Navigate to="/desbloqueo" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

/** Pantallas de entrada (bienvenida, registro, login): si ya hay sesión, se va a la app. */
export function PublicOnly() {
  const { session, ready } = useAuth();
  if (!ready) return <Splash />;
  if (session) return <Navigate to="/" replace />;
  return <Outlet />;
}

/** Pantallas que necesitan sesión pero no desbloqueo (crear PIN, desbloqueo, olvidé el PIN). */
export function RequireSession() {
  const { session, ready } = useAuth();
  if (!ready) return <Splash />;
  if (!session) return <Navigate to="/bienvenida" replace />;
  return <Outlet />;
}
