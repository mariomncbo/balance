// Edge Function `api` de Balance.
// POST { action: "home" | "accounts.create" | ..., params: {...} } con la sesión del usuario.
// Descifra en memoria, calcula y devuelve. Nunca registra datos del usuario en los logs.
import { withSupabase } from "npm:@supabase/server@1.9.2";
import { importMasterKey } from "../_shared/crypto.ts";
import { ApiError, handle } from "./handler.ts";
import { SupabaseStore } from "./store.ts";

let masterKey: Promise<CryptoKey> | null = null;
function master(): Promise<CryptoKey> {
  const secret = Deno.env.get("BALANCE_MASTER_KEY");
  if (!secret) throw new Error("Falta el secreto BALANCE_MASTER_KEY");
  masterKey ??= importMasterKey(secret);
  return masterKey;
}

/** Fecha de hoy en España (la app es solo para España). */
function today(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") return Response.json({ error: "Usa POST" }, { status: 405 });
    const userId = ctx.userClaims?.id;
    if (!userId) return Response.json({ error: "No autorizado" }, { status: 401 });
    try {
      const body = await req.json().catch(() => null);
      const data = await handle(body, { userId, today: today(), store: new SupabaseStore(ctx.supabaseAdmin), master: await master() });
      return Response.json({ data });
    } catch (e) {
      if (e instanceof ApiError) return Response.json({ error: e.message }, { status: e.status });
      console.error("api: error interno", e instanceof Error ? e.message : "desconocido");
      return Response.json({ error: "Error interno" }, { status: 500 });
    }
  }),
};
