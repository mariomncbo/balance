import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { hasPin } from "./pin";

// Se vuelve a pedir el código si la app estuvo en segundo plano más de este tiempo.
const RELOCK_AFTER_MS = 30_000;

interface LockValue {
  locked: boolean;
  unlock: () => void;
  lock: () => void;
}
const Ctx = createContext<LockValue | null>(null);

export function LockProvider({ children }: { children: ReactNode }) {
  const [locked, setLocked] = useState<boolean>(() => hasPin());
  const hiddenAt = useRef<number | null>(null);

  useEffect(() => {
    const onChange = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
      } else if (hiddenAt.current !== null) {
        if (hasPin() && Date.now() - hiddenAt.current > RELOCK_AFTER_MS) setLocked(true);
        hiddenAt.current = null;
      }
    };
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);

  const unlock = useCallback(() => setLocked(false), []);
  const lock = useCallback(() => setLocked(hasPin()), []);
  const value = useMemo(() => ({ locked, unlock, lock }), [locked, unlock, lock]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLock(): LockValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useLock fuera de LockProvider");
  return v;
}
