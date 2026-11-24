// Lógica pura del Atajo de iPhone (sin red ni base de datos).
import { b64urlEncode } from "./crypto.ts";
import type { Category } from "./domain.ts";

/** Clave del Atajo: "bal_" + 32 bytes aleatorios en base64url (43 caracteres). 256 bits: imposible de adivinar. */
export const TOKEN_PATTERN = /^bal_[A-Za-z0-9_-]{43}$/;

export function generateToken(): string {
  return `bal_${b64urlEncode(crypto.getRandomValues(new Uint8Array(32)))}`;
}

/** Máximo que se acepta en un solo pago: 1.000.000 €. Evita importes absurdos por un error de formato. */
export const MAX_CENTS = 100_000_000;

/**
 * Convierte el importe que envía Wallet en céntimos positivos. Acepta "12,40 €", "€12.40", "1.234,56 €",
 * "1,234.56", "-12,40" o un número. Devuelve null si no es un importe válido.
 */
export function parseAmount(input: unknown): number | null {
  let value: number;
  if (typeof input === "number") {
    value = input;
  } else if (typeof input === "string") {
    let t = input.replace(/[^\d.,]/g, "");
    if (!/\d/.test(t)) return null;
    const lastComma = t.lastIndexOf(",");
    const lastDot = t.lastIndexOf(".");
    const decimalAt = Math.max(lastComma, lastDot);
    if (decimalAt >= 0) {
      const decimals = t.length - decimalAt - 1;
      const sep = t[decimalAt];
      const onlyOne = t.indexOf(sep) === decimalAt;
      const otherSep = sep === "," ? "." : ",";
      // Es decimal si hay 1 o 2 cifras detrás, o si conviven los dos separadores (el último es el decimal).
      const isDecimal = (decimals >= 1 && decimals <= 2 && onlyOne) || t.includes(otherSep);
      const intRaw = t.slice(0, isDecimal ? decimalAt : t.length);
      // Los separadores de miles tienen que separar grupos de 3 cifras ("1.234.567"); "1,2,3" no es un importe.
      const groups = intRaw.split(/[.,]/);
      if (groups.length > 1 && (groups[0] === "" || groups.slice(1).some((g) => g.length !== 3))) return null;
      const intPart = groups.join("");
      const decPart = isDecimal ? t.slice(decimalAt + 1).replace(/[.,]/g, "") : "";
      if (isDecimal && (decPart.length === 0 || decPart.length > 2)) return null;
      t = decPart ? `${intPart}.${decPart}` : intPart;
    }
    value = Number(t);
  } else {
    return null;
  }
  if (!Number.isFinite(value)) return null;
  const cents = Math.round(Math.abs(value) * 100);
  return cents > 0 && cents <= MAX_CENTS ? cents : null;
}

/** Texto limpio para comparar: minúsculas, sin acentos ni símbolos. */
export function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const KEYWORDS: [Category, string[]][] = [
  ["comida", ["mercadona", "carrefour", "lidl", "aldi", "dia", "eroski", "alcampo", "consum", "hipercor", "supermercado", "super", "bonpreu", "caprabo", "ahorramas", "gadis", "froiz", "masymas", "spar", "panaderia", "fruteria", "carniceria", "restaurante", "bar", "cafeteria", "mcdonald", "mcdonalds", "burger", "telepizza", "domino", "dominos", "kfc", "glovo", "just eat", "uber eats", "starbucks", "foodles", "goiko", "taco bell", "100 montaditos", "vips"]],
  ["transporte", ["repsol", "cepsa", "bp", "galp", "shell", "petronor", "ballenoil", "plenoil", "gasolinera", "renfe", "metro", "emt", "tmb", "bicimad", "uber", "cabify", "bolt", "freenow", "free now", "blablacar", "alsa", "iberia", "vueling", "ryanair", "parking", "aparcamiento", "peaje", "autopista", "taxi", "ouigo", "iryo"]],
  ["suscripciones", ["netflix", "spotify", "hbo", "max", "disney", "prime video", "amazon prime", "apple com bill", "icloud", "youtube", "dazn", "movistar", "filmin", "chatgpt", "openai", "patreon", "audible", "xbox", "playstation", "nintendo"]],
  ["salud", ["farmacia", "clinica", "hospital", "dentista", "optica", "fisioterapia", "veterinario", "sanitas", "adeslas", "dkv", "gimnasio", "gym", "basic fit", "mcfit", "anytime fitness", "dreamfit"]],
  ["hogar", ["ikea", "leroy merlin", "bricomart", "bauhaus", "iberdrola", "endesa", "naturgy", "holaluz", "canal de isabel", "aguas", "vodafone", "orange", "digi", "masmovil", "pepephone", "lowi", "jazztel", "comunidad", "alquiler"]],
  ["ocio", ["cine", "cines", "yelmo", "cinesa", "kinepolis", "teatro", "concierto", "ticketmaster", "entradas", "steam", "museo", "bowling", "escape", "booking", "airbnb", "hotel"]],
  ["compras", ["amazon", "zara", "primark", "el corte ingles", "corte ingles", "mango", "pull bear", "bershka", "stradivarius", "decathlon", "media markt", "mediamarkt", "fnac", "pccomponentes", "aliexpress", "shein", "h m", "uniqlo", "sephora", "druni", "apple store", "lefties", "kiabi"]],
];

/** Categoría por palabras clave del comercio. "otros" si no encaja ninguna. */
export function categoryFromKeywords(merchant: string): Category {
  const words = ` ${normalize(merchant)} `;
  for (const [category, keys] of KEYWORDS) {
    if (keys.some((k) => words.includes(` ${k} `))) return category;
  }
  return "otros";
}

/**
 * Categoría para un pago nuevo: primero la que ya usó el usuario con ese mismo comercio (aprende de sus
 * correcciones), después las palabras clave. `history` es la lista de movimientos, cualquier orden.
 */
export function guessCategory(merchant: string, history: { concept: string; category: Category; date: string; amount: number }[]): Category {
  const key = normalize(merchant);
  if (key) {
    const previous = history
      .filter((t) => t.amount < 0 && normalize(t.concept) === key)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    if (previous) return previous.category;
  }
  return categoryFromKeywords(merchant);
}

/**
 * Cuenta donde apuntar el pago: la que se llame como la tarjeta de Wallet (p. ej. tarjeta "BBVA Aqua" → cuenta "BBVA"),
 * si no la cuenta elegida en la app, si no la primera. null si el usuario no tiene cuentas.
 */
export function pickAccount(card: string, preferredId: string | null, accounts: { id: string; name: string }[]): string | null {
  const c = normalize(card);
  if (c) {
    const byName = accounts.find((a) => {
      const n = normalize(a.name);
      return n.length >= 3 && (c.includes(n) || n.includes(c));
    });
    if (byName) return byName.id;
  }
  if (preferredId && accounts.some((a) => a.id === preferredId)) return preferredId;
  return accounts[0]?.id ?? null;
}

/** Concepto del movimiento: el comercio, o la tarjeta si Wallet no lo da. Máximo 80 caracteres. */
export function conceptFrom(merchant: string, card: string): string {
  const clean = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 80);
  return clean(merchant) || (clean(card) ? `Pago con ${clean(card)}`.slice(0, 80) : "Pago con tarjeta");
}

const euro = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: "always" } as Intl.NumberFormatOptions);
/** "−12,40 €" para el mensaje que muestra el Atajo. */
export function formatExpense(cents: number): string {
  return `−${euro.format(cents / 100)} €`;
}
