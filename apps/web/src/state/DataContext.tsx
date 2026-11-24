import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

// `version` sube cada vez que algo cambia (guardar una cuenta, un movimiento...). Las pantallas que
// dependen de él vuelven a pedir sus datos a la API.
interface DataValue {
  version: number;
  invalidate: () => void;
}
const Ctx = createContext<DataValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0);
  const invalidate = useCallback(() => setVersion((v) => v + 1), []);
  const value = useMemo(() => ({ version, invalidate }), [version, invalidate]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData(): DataValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useData fuera de DataProvider");
  return v;
}
