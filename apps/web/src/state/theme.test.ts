import { beforeEach, describe, expect, it } from "vitest";
import { applyTheme, readTheme, saveTheme } from "./theme";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.head.innerHTML = '<meta name="theme-color" content="#f2f1fb">';
  window.matchMedia = ((q: string) => ({
    matches: false,
    media: q,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof matchMedia;
});

describe("tema", () => {
  it("por defecto es Sistema y no pone atributo", () => {
    expect(readTheme()).toBe("system");
    applyTheme("system");
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });
  it("guarda Claro y Oscuro y los aplica", () => {
    saveTheme("dark");
    expect(readTheme()).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute("content")).toBe("#14121d");
    saveTheme("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });
  it("volver a Sistema borra la preferencia", () => {
    saveTheme("dark");
    saveTheme("system");
    expect(localStorage.getItem("balance.theme")).toBeNull();
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });
  it("ignora un valor guardado no válido", () => {
    localStorage.setItem("balance.theme", "azul");
    expect(readTheme()).toBe("system");
  });
});
