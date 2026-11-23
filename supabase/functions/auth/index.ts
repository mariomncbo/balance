// Edge Function `auth` de Balance: acciones previas al inicio de sesión.
// Se llama con la clave pública en `apikey` (sin sesión). verify_jwt = false.
//
// POST { action: "username.check", params: { username } } → { available }
// POST { action: "login", params: { username, password } } → sesión de Supabase
//
// El correo del usuario nunca sale del servidor salvo que la contraseña sea correcta.
import { withSupabase } from "npm:@supabase/server@1.9.2";

const USERNAME = /^[a-z0-9._]{3,30}$/;
const GENERIC = "Usuario o contraseña incorrectos";

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

export default {
  fetch: withSupabase({ auth: "publishable" }, async (req, ctx) => {
    if (req.method !== "POST") return json({ error: "Usa POST" }, 405);
    const body = await req.json().catch(() => null) as { action?: string; params?: Record<string, unknown> } | null;
    const p = body?.params ?? {};
    const db = ctx.supabaseAdmin;

    try {
      if (body?.action === "username.check") {
        const username = typeof p.username === "string" ? p.username.trim().toLowerCase() : "";
        if (!USERNAME.test(username)) return json({ available: false, reason: "invalid" });
        const { data, error } = await db.from("profiles").select("id").eq("username", username).maybeSingle();
        if (error) throw error;
        return json({ available: !data });
      }

      if (body?.action === "login") {
        const username = typeof p.username === "string" ? p.username.trim().toLowerCase() : "";
        const password = typeof p.password === "string" ? p.password : "";
        if (!USERNAME.test(username) || password.length < 1 || password.length > 200) return json({ error: GENERIC }, 401);

        const { data: attempt } = await db.from("login_attempts").select("locked_until").eq("username", username).maybeSingle();
        if (attempt?.locked_until && new Date(attempt.locked_until) > new Date()) {
          return json({ error: "Demasiados intentos. Vuelve a probar en unos minutos." }, 429);
        }

        const fail = async () => {
          const { data: lockedUntil } = await db.rpc("register_login_failure", { p_username: username });
          return lockedUntil
            ? json({ error: "Demasiados intentos. Vuelve a probar en 15 minutos." }, 429)
            : json({ error: GENERIC }, 401);
        };

        const { data: profile, error: profileError } = await db.from("profiles").select("email").eq("username", username).maybeSingle();
        if (profileError) throw profileError;
        if (!profile) return await fail();

        const { data, error } = await ctx.supabase.auth.signInWithPassword({ email: profile.email, password });
        if (error) {
          if (error.code === "email_not_confirmed") {
            // La contraseña es correcta: se puede decir a quién reenviar el código.
            return json({ error: "Confirma tu correo para entrar.", code: "email_not_confirmed", email: profile.email }, 403);
          }
          return await fail();
        }

        await db.from("login_attempts").delete().eq("username", username);
        const s = data.session!;
        return json({
          session: { access_token: s.access_token, refresh_token: s.refresh_token, expires_in: s.expires_in, expires_at: s.expires_at, token_type: s.token_type },
          user: { id: data.user!.id },
        });
      }

      return json({ error: "Acción desconocida" }, 400);
    } catch (e) {
      console.error("auth: error interno", (e as { message?: string; code?: string })?.code ?? "", (e as { message?: string })?.message ?? String(e));
      return json({ error: "Error interno" }, 500);
    }
  }),
};
