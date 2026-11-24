import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type SheetState =
  | {
      kind: "account";
      id?: string;
      /** En el onboarding se guarda en el dispositivo, no en la API. */ local?: boolean;
    }
  | { kind: "movement"; mode?: "mano" | "ia" | "escaneo"; id?: string }
  | { kind: "recurring"; id?: string }
  | { kind: "goal"; id?: string }
  | { kind: "menu" }
  | null;

interface SheetValue {
  sheet: SheetState;
  open: (s: Exclude<SheetState, null>) => void;
  close: () => void;
}
const Ctx = createContext<SheetValue | null>(null);

export function SheetProvider({ children }: { children: ReactNode }) {
  const [sheet, setSheet] = useState<SheetState>(null);
  const open = useCallback((s: Exclude<SheetState, null>) => setSheet(s), []);
  const close = useCallback(() => setSheet(null), []);
  const value = useMemo(() => ({ sheet, open, close }), [sheet, open, close]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSheet(): SheetValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSheet fuera de SheetProvider");
  return v;
}
