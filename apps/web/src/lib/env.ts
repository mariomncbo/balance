const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/** Falta configuración: se enseña un aviso claro en vez de romper la app. */
export const configError: string | null =
  typeof url === "string" && url && typeof key === "string" && key
    ? null
    : "Falta VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY en apps/web/.env.local";

export const env = { supabaseUrl: url ?? "http://localhost", supabaseKey: key ?? "missing" };
