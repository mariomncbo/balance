import { beforeEach, describe, expect, it } from "vitest";
import { clearPin, hasPin, isValidPin, setPin, verifyPin } from "./pin";

beforeEach(() => {
  localStorage.clear();
});

describe("PIN local", () => {
  it("valida el formato de 4 cifras", () => {
    expect(isValidPin("1234")).toBe(true);
    for (const bad of ["123", "12345", "12a4", "", "١٢٣٤"]) expect(isValidPin(bad)).toBe(false);
  });

  it("guarda un hash, nunca el código", async () => {
    await setPin("4821", 1000);
    expect(hasPin()).toBe(true);
    expect(JSON.stringify(localStorage)).not.toContain("4821");
  });

  it("acepta el correcto y rechaza el incorrecto contando intentos", async () => {
    await setPin("4821", 1000);
    expect(await verifyPin("4821")).toEqual({ ok: true });
    expect(await verifyPin("0000")).toEqual({ ok: false, remaining: 4, lockedUntil: null });
    expect(await verifyPin("1111")).toEqual({ ok: false, remaining: 3, lockedUntil: null });
    expect(await verifyPin("4821")).toEqual({ ok: true });
    expect(await verifyPin("0000")).toMatchObject({ remaining: 4 }); // acertar reinicia el contador
  });

  it("bloquea 5 minutos tras 5 fallos, incluso con el código bueno", async () => {
    await setPin("4821", 1000);
    const t = 1_000_000;
    let r = await verifyPin("0000", t);
    for (let i = 0; i < 4; i++) r = await verifyPin("0000", t);
    expect(r).toEqual({ ok: false, remaining: 0, lockedUntil: t + 300_000 });
    expect(await verifyPin("4821", t + 1000)).toMatchObject({ ok: false, remaining: 0 });
    expect(await verifyPin("4821", t + 300_001)).toEqual({ ok: true });
  });

  it("clearPin lo quita todo", async () => {
    await setPin("4821", 1000);
    clearPin();
    expect(hasPin()).toBe(false);
  });
});
