import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { applyTheme, readTheme, saveTheme, type ThemeChoice } from "./theme";

interface ThemeValue {
  choice: ThemeChoice;
  setChoice: (c: ThemeChoice) => void;
}
const Ctx = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setState] = useState<ThemeChoice>(readTheme);
  const setChoice = useCallback((c: ThemeChoice) => {
    saveTheme(c);
    setState(c);
  }, []);
  // En modo Sistema, el color de la barra del navegador sigue al dispositivo.
  useEffect(() => {
    applyTheme(choice);
    if (choice !== "system") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const on = () => applyTheme("system");
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [choice]);
  const value = useMemo(() => ({ choice, setChoice }), [choice, setChoice]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTheme fuera de ThemeProvider");
  return v;
}
