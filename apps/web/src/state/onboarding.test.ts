import { beforeEach, describe, expect, it } from "vitest";
import {
  clearOnboarding,
  emptyOnboarding,
  isEmptyOnboarding,
  readOnboarding,
  toImportParams,
  writeOnboarding,
} from "./onboarding";

beforeEach(() => localStorage.clear());

describe("onboarding local", () => {
  it("empieza vacío y se recupera lo guardado", () => {
    expect(isEmptyOnboarding(readOnboarding())).toBe(true);
    writeOnboarding({ ...emptyOnboarding(), salary: { amount: 185000, day: 1 } });
    expect(readOnboarding().salary).toEqual({ amount: 185000, day: 1 });
    clearOnboarding();
    expect(isEmptyOnboarding(readOnboarding())).toBe(true);
  });

  it("no se rompe con datos corruptos", () => {
    localStorage.setItem("balance.onboarding", "{no es json");
    expect(readOnboarding()).toEqual(emptyOnboarding());
    localStorage.setItem("balance.onboarding", JSON.stringify({ accounts: "x", loans: null }));
    expect(readOnboarding()).toEqual(emptyOnboarding());
  });

  it("convierte sueldo y préstamos en fijos para la API", () => {
    const p = toImportParams({
      accounts: [{ name: "Mi dinero", type: "banco", openingBalance: 1248035 }],
      loans: [{ concept: "Hipoteca", amount: 64000, day: 5, pending: 9840000, endMonth: "2041-06" }],
      salary: { amount: 185000, day: 1 },
    });
    expect(p.accounts).toHaveLength(1);
    expect(p.recurring).toEqual([
      { kind: "income", amount: 185000, concept: "Nómina", category: "ingresos", day: 1 },
      {
        kind: "loan",
        amount: 64000,
        concept: "Hipoteca",
        category: "hogar",
        day: 5,
        pending: 9840000,
        endMonth: "2041-06",
      },
    ]);
  });
});
