import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { LogoSymbol } from "../components/Logo";
import { PinPad } from "../components/PinPad";
import { useAuth } from "../state/AuthContext";
import { useLock } from "../state/LockContext";
import { hasPin, verifyPin } from "../state/pin";

function minutesLeft(until: number): number {
  return Math.max(1, Math.ceil((until - Date.now()) / 60_000));
}

export default function Unlock() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useAuth();
  const { locked, unlock } = useLock();
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const from = (location.state as { from?: string } | null)?.from ?? "/";
  const name = (session?.user.user_metadata as { name?: string } | undefined)?.name;

  useEffect(() => {
    if (pin.length !== 4) return;
    let alive = true;
    void verifyPin(pin).then((r) => {
      if (!alive) return;
      if (r.ok) {
        unlock();
        return navigate(from, { replace: true });
      }
      setPin("");
      if (r.lockedUntil) {
        setLockedUntil(r.lockedUntil);
        setMsg(`Demasiados intentos. Prueba de nuevo en ${minutesLeft(r.lockedUntil)} min.`);
      } else {
        setMsg(`Código incorrecto. Te quedan ${r.remaining} ${r.remaining === 1 ? "intento" : "intentos"}.`);
      }
    });
    return () => {
      alive = false;
    };
  }, [pin, unlock, navigate, from]);

  useEffect(() => {
    if (lockedUntil === null) return;
    const t = setTimeout(
      () => {
        setLockedUntil(null);
        setMsg(null);
      },
      Math.max(0, lockedUntil - Date.now()),
    );
    return () => clearTimeout(t);
  }, [lockedUntil]);

  if (!hasPin() || !locked) return <Navigate to="/" replace />;

  return (
    <main className="b-screen" style={{ alignItems: "center", gap: 24 }}>
      <div className="stack" style={{ alignItems: "center", gap: 10, paddingTop: 20 }}>
        <span
          style={{
            width: 64,
            height: 64,
            borderRadius: 22,
            background: "var(--surface)",
            display: "grid",
            placeItems: "center",
          }}
        >
          <LogoSymbol size={42} />
        </span>
        <h1 className="b-h1" style={{ fontSize: 24, lineHeight: "28px" }}>
          {name ? `Hola, ${name}` : "Hola"}
        </h1>
        <p className="b-sub">Introduce tu código</p>
      </div>
      <div className="stack" style={{ alignItems: "center", minHeight: 100 }} aria-live="polite">
        <div className={`b-pin${msg ? " b-pin--error" : ""}`} aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`b-pin__box${i === pin.length ? " b-pin__box--focus" : ""}`}>
              {i < pin.length && <span className="b-pin__dot" />}
            </div>
          ))}
        </div>
        <span className="visually-hidden">{pin.length} de 4 cifras</span>
        {msg && (
          <span className="b-pill b-pill--expense" role="alert">
            {msg}
          </span>
        )}
      </div>
      <PinPad
        disabled={lockedUntil !== null}
        onDigit={(d) => {
          setMsg(null);
          setPin((p) => (p.length < 4 ? p + d : p));
        }}
        onDelete={() => setPin((p) => p.slice(0, -1))}
      />
      <div className="b-spacer" />
      <Link to="/olvido-pin" className="b-btn b-btn--link">
        ¿Olvidaste el código?
      </Link>
    </main>
  );
}
