import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import { Icon } from "./Icon";

export function BackButton({ to, label = "Atrás" }: { to?: string; label?: string }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className="b-back"
      aria-label={label}
      onClick={() => (to ? navigate(to) : navigate(-1))}
    >
      <Icon name="back" />
    </button>
  );
}

/** Cabecera de pantalla secundaria: atrás a la izquierda, título centrado, acción opcional a la derecha. */
export function Header({ title, to, right }: { title?: string; to?: string; right?: ReactNode }) {
  return (
    <header className="b-head">
      <BackButton to={to} />
      <h1 className="b-head__title">{title}</h1>
      {right ?? <span />}
    </header>
  );
}

Header.Back = BackButton;
