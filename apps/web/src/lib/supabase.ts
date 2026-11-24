import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

// Solo clave pública: los datos del usuario nunca se leen de las tablas, sino de la Edge Function `api`.
export const supabase = createClient(env.supabaseUrl, env.supabaseKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" },
});
