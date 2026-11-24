// PIN de 4 cifras solo en este dispositivo. Es un candado de la interfaz, no cifrado de datos.
// Se guarda un hash PBKDF2 con sal; tras 5 fallos se bloquea 5 minutos.

const KEY = "balance.pin";
const FAILS = "balance.pin.fails";
const ITERATIONS = 210_000;
const MAX_FAILS = 5;
const LOCK_MS = 5 * 60_000;

interface Stored {
  salt: string;
  hash: string;
  iterations: number;
}
interface Fails {
  count: number;
  lockedUntil: number;
}

const b64 = (b: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(b instanceof Uint8Array ? b : b)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(pin: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    256,
  );
  return b64(bits);
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* sin almacenamiento */
  }
};

export const hasPin = (): boolean => read<Stored>(KEY) !== null;
export const isValidPin = (pin: string): boolean => /^\d{4}$/.test(pin);

export async function setPin(pin: string, iterations = ITERATIONS): Promise<void> {
  if (!isValidPin(pin)) throw new Error("El código debe tener 4 cifras");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  write(KEY, { salt: b64(salt), hash: await derive(pin, salt, iterations), iterations } satisfies Stored);
  localStorage.removeItem(FAILS);
}

export function clearPin(): void {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(FAILS);
  } catch {
    /* nada */
  }
}

export type PinResult = { ok: true } | { ok: false; remaining: number; lockedUntil: number | null };

export async function verifyPin(pin: string, now = Date.now()): Promise<PinResult> {
  const fails = read<Fails>(FAILS) ?? { count: 0, lockedUntil: 0 };
  if (fails.lockedUntil > now) return { ok: false, remaining: 0, lockedUntil: fails.lockedUntil };
  const stored = read<Stored>(KEY);
  if (!stored) return { ok: true };
  const hash = await derive(pin, unb64(stored.salt), stored.iterations);
  if (hash === stored.hash) {
    localStorage.removeItem(FAILS);
    return { ok: true };
  }
  const count = fails.lockedUntil && fails.lockedUntil <= now ? 1 : fails.count + 1;
  if (count >= MAX_FAILS) {
    write(FAILS, { count: 0, lockedUntil: now + LOCK_MS });
    return { ok: false, remaining: 0, lockedUntil: now + LOCK_MS };
  }
  write(FAILS, { count, lockedUntil: 0 });
  return { ok: false, remaining: MAX_FAILS - count, lockedUntil: null };
}
