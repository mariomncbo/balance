// Dinero siempre en céntimos (enteros). Formato español: 1.250,00 € y signo − (U+2212).

const number = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: "always",
});
const integer = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0, useGrouping: "always" });

export function formatEuro(cents: number, opts: { signed?: boolean; round?: boolean } = {}): string {
  const abs = Math.abs(cents);
  const body = opts.round ? integer.format(Math.round(abs / 100)) : number.format(abs / 100);
  const sign = cents < 0 ? "−" : opts.signed && cents > 0 ? "+" : "";
  return `${sign}${body}\u00a0€`;
}

/** Convierte lo que escribe el usuario ("48,90", "1.250,5", "12") en céntimos. Devuelve null si no es válido. */
export function parseEuro(text: string): number | null {
  let t = text.replace(/[€\s\u00a0]/g, "").replace(/^[+−-]/, "");
  if (t === "") return null;
  const lastComma = t.lastIndexOf(",");
  const lastDot = t.lastIndexOf(".");
  if (lastComma >= 0) {
    t = t.replaceAll(".", "").replace(",", ".");
  } else if (lastDot >= 0) {
    // "1.250" = mil doscientos cincuenta; "12.5" = doce y medio
    const decimals = t.length - lastDot - 1;
    t = decimals === 3 && t.indexOf(".") === lastDot ? t.replace(".", "") : t;
  }
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const cents = Math.round(Number(t) * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}
