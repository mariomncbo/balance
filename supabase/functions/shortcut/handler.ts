// Lógica de la Edge Function `shortcut`: recibe un pago del Atajo de iPhone y lo apunta como movimiento cifrado.
// No depende de Supabase (recibe Gate y Store), así se puede probar en memoria.
//
// Seguridad:
// - Autenticación: cabecera X-Balance-Key con la clave del Atajo (256 bits). Se busca por su SHA-256; la clave no se guarda.
// - Respuestas genéricas: una clave inexistente y una mal formada dan el mismo 401, sin pistas.
// - Límite: 30 pagos por hora y clave; el mismo pago repetido en 2 minutos no se duplica (huella HMAC, no el pago).
// - Tamaño máximo del cuerpo: 4 KB. Solo POST con JSON.
// - Nunca se registra en los logs ni la clave ni el contenido del pago.
import { sha256Hex, uuidv7 } from "../_shared/crypto.ts";
import type { Account, Transaction } from "../_shared/domain.ts";
import { conceptFrom, formatExpense, guessCategory, normalize, parseAmount, pickAccount, TOKEN_PATTERN } from "../_shared/shortcut.ts";
import { type Store, Vault } from "../api/handler.ts";

export const MAX_BODY_BYTES = 4096;

export interface Gate {
  /** Valida la clave (por su hash) y aplica límite y deduplicación en una sola operación atómica. */
  consume(tokenHash: string, fingerprint: string): Promise<{ status: "ok" | "invalid" | "limited" | "duplicate"; userId: string | null; accountId: string | null }>;
  /** Olvida la huella del último pago (si al final no se pudo apuntar, para poder reintentarlo). */
  forget(userId: string): Promise<void>;
}

export interface Deps {
  gate: Gate;
  store: Store;
  master: CryptoKey;
  /** Clave HMAC para la huella de deduplicación. */
  dedupeKey: CryptoKey;
  today: string;
}

export interface Result {
  status: number;
  body: Record<string, unknown>;
}

const UNAUTHORIZED: Result = { status: 401, body: { ok: false, error: "Clave del Atajo no válida. Genera una nueva en Balance → Ajustes." } };

async function hmacHex(key: CryptoKey, text: string): Promise<string> {
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
}

const asText = (v: unknown, max = 200): string => (typeof v === "string" ? v.slice(0, max) : typeof v === "number" ? String(v) : "");

export async function ingest(req: { method: string; key: string | null; contentLength: number | null; body: string }, deps: Deps): Promise<Result> {
  if (req.method !== "POST") return { status: 405, body: { ok: false, error: "Usa POST" } };
  if ((req.contentLength ?? 0) > MAX_BODY_BYTES || req.body.length > MAX_BODY_BYTES) return { status: 413, body: { ok: false, error: "Petición demasiado grande" } };
  if (!req.key || !TOKEN_PATTERN.test(req.key)) return UNAUTHORIZED;

  let input: Record<string, unknown>;
  try {
    const parsed = JSON.parse(req.body);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error();
    input = parsed as Record<string, unknown>;
  } catch {
    return { status: 400, body: { ok: false, error: "El Atajo no ha enviado los datos del pago. Revisa que el cuerpo sea JSON." } };
  }

  const cents = parseAmount(input.amount);
  if (cents === null) return { status: 400, body: { ok: false, error: "Importe no válido" } };
  const merchant = asText(input.merchant);
  const card = asText(input.card);

  const tokenHash = await sha256Hex(req.key);
  const fingerprint = await hmacHex(deps.dedupeKey, `${tokenHash}\n${cents}\n${normalize(merchant)}\n${normalize(card)}`);
  const gate = await deps.gate.consume(tokenHash, fingerprint);
  if (gate.status === "invalid" || !gate.userId) return UNAUTHORIZED;
  if (gate.status === "limited") return { status: 429, body: { ok: false, error: "Demasiados pagos en poco tiempo. Espera un rato." } };
  if (gate.status === "duplicate") return { status: 200, body: { ok: true, duplicate: true, message: "Este pago ya estaba apuntado" } };

  try {
    const vault = new Vault({ userId: gate.userId, today: deps.today, store: deps.store, master: deps.master });
    const [accounts, history] = await Promise.all([vault.all<Account>("accounts"), vault.all<Transaction>("transactions")]);
    const concept = conceptFrom(merchant, card);
    const t: Transaction = {
      id: uuidv7(),
      accountId: pickAccount(card, gate.accountId, accounts),
      amount: -cents,
      concept,
      category: guessCategory(concept, history),
      date: deps.today,
      source: "atajo",
    };
    await vault.insert("transactions", [t]);
    return { status: 200, body: { ok: true, message: `Apuntado: ${formatExpense(cents)} · ${concept}` } };
  } catch (e) {
    await deps.gate.forget(gate.userId).catch(() => {});
    throw e;
  }
}
