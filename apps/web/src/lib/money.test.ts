import { describe, expect, it } from "vitest";
import { formatEuro, parseEuro } from "./money";

describe("formatEuro", () => {
  it("usa coma decimal, punto de miles y símbolo detrás", () => {
    expect(formatEuro(1248035)).toBe("12.480,35 €");
    expect(formatEuro(185000)).toBe("1.850,00 €");
    expect(formatEuro(0)).toBe("0,00 €");
  });
  it("agrupa también los miles de 4 cifras", () => {
    expect(formatEuro(123400)).toBe("1.234,00 €");
  });
  it("gasto con − y ingreso con + si se pide", () => {
    expect(formatEuro(-4890)).toBe("−48,90 €");
    expect(formatEuro(185000, { signed: true })).toBe("+1.850,00 €");
    expect(formatEuro(185000)).toBe("1.850,00 €");
  });
  it("redondea a euros", () => {
    expect(formatEuro(-124060, { round: true })).toBe("−1.241 €");
  });
});

describe("parseEuro", () => {
  it("entiende los formatos habituales", () => {
    expect(parseEuro("48,90")).toBe(4890);
    expect(parseEuro("12")).toBe(1200);
    expect(parseEuro("1.250,5")).toBe(125050);
    expect(parseEuro("1.250")).toBe(125000);
    expect(parseEuro("12.5")).toBe(1250);
    expect(parseEuro("12.480,35 €")).toBe(1248035);
  });
  it("acepta signo y lo ignora (el signo lo decide el tipo de movimiento)", () => {
    expect(parseEuro("−48,90")).toBe(4890);
    expect(parseEuro("+1.850")).toBe(185000);
  });
  it("rechaza lo que no es un importe", () => {
    expect(parseEuro("")).toBeNull();
    expect(parseEuro("abc")).toBeNull();
    expect(parseEuro("1,234")).toBeNull();
    expect(parseEuro("12,3,4")).toBeNull();
  });
});
