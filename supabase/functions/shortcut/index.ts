// Edge Function `shortcut` de Balance: el Atajo de iPhone envía aquí cada pago de Wallet.
// Pública (verify_jwt = false): se autentica con la cabecera X-Balance-Key. Ver handler.ts.
//
// POST /functions/v1/shortcut   X-Balance-Key: bal_…   { "amount": "12,40 €", "merchant": "Mercadona", "card": "BBVA" }
import { withSupabase } from "npm:@supabase/server@1.9.2";
import { importMasterKey } from "../_shared/crypto.ts";
import { SupabaseStore } from "../api/store.ts";
import { type Gate, ingest, MAX_BODY_BYTES } from "./handler.ts";

let keys: Promise<{ master: CryptoKey; dedupe: CryptoKey }> | null = null;
function loadKeys() {
  keys ??= (async () => {
    const secret = Deno.env.get("BALANCE_MASTER_KEY");
    if (!secret) throw new Error("Falta el secreto BALANCE_MASTER_KEY");
    // Clave HMAC propia para las huellas, derivada de la maestra (no se reutiliza la clave de cifrado).
    const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`balance:shortcut-dedupe:${secret}`));
    const dedupe = await crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    return { master: await importMasterKey(secret), dedupe };
  })();
  return keys;
}

/** Lee el cuerpo sin pasar de `max` bytes: si es más grande, se corta y se devuelve null. */
async function readLimited(req: Request, max: number): Promise<string | null> {
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    all.set(c, at);
    at += c.byteLength;
  }
  return new TextDecoder().decode(all);
}

function today(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
}

export default {
  fetch: withSupabase({ auth: "none" }, async (req, ctx) => {
    // deno-lint-ignore no-explicit-any
    const db: any = ctx.supabaseAdmin;
    const gate: Gate = {
      async consume(tokenHash, fingerprint) {
        const { data, error } = await db.rpc("shortcut_consume", { p_token_hash: tokenHash, p_fingerprint: fingerprint, p_limit: 30 });
        if (error) throw new Error(`Base de datos: ${error.message}`);
        const row = Array.isArray(data) ? data[0] : data;
        return { status: row?.out_status ?? "invalid", userId: row?.out_user_id ?? null, accountId: row?.out_account_id ?? null };
      },
      async forget(userId) {
        await db.from("shortcut_tokens").update({ last_fingerprint: null }).eq("user_id", userId);
      },
    };
    try {
      const length = Number(req.headers.get("content-length") ?? "0");
      if (Number.isFinite(length) && length > MAX_BODY_BYTES) return Response.json({ ok: false, error: "Petición demasiado grande" }, { status: 413 });
      const body = await readLimited(req, MAX_BODY_BYTES);
      if (body === null) return Response.json({ ok: false, error: "Petición demasiado grande" }, { status: 413 });
      const { master, dedupe } = await loadKeys();
      const result = await ingest(
        { method: req.method, key: req.headers.get("x-balance-key"), contentLength: Number.isFinite(length) ? length : null, body },
        { gate, store: new SupabaseStore(db), master, dedupeKey: dedupe, today: today() },
      );
      return Response.json(result.body, { status: result.status });
    } catch (e) {
      // Solo el tipo de error: nunca la clave ni el pago.
      console.error("shortcut: error interno", (e as { name?: string })?.name ?? "Error");
      return Response.json({ ok: false, error: "No se ha podido apuntar el pago. Inténtalo de nuevo." }, { status: 500 });
    }
  }),
};
