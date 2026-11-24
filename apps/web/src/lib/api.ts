import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function invoke<T>(fn: "api" | "auth", body: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body: body as Record<string, unknown> });
  if (!error) return data as T;
  if (error instanceof FunctionsHttpError) {
    const res = error.context as Response;
    const payload = (await res.json().catch(() => ({}))) as { error?: string; code?: string } & Record<
      string,
      unknown
    >;
    const { error: message, code, ...extra } = payload;
    throw new ApiError(message ?? "Algo ha fallado. Inténtalo de nuevo.", res.status, code, extra);
  }
  if (error instanceof FunctionsFetchError || error instanceof FunctionsRelayError) {
    throw new ApiError("Sin conexión. Comprueba internet y vuelve a intentarlo.", 0, "network");
  }
  throw new ApiError("Algo ha fallado. Inténtalo de nuevo.", 500);
}

/** Llama a una acción de la Edge Function `api` (requiere sesión). */
export async function api<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  const res = await invoke<{ data: T }>("api", { action, params });
  return res.data;
}

/** Llama a la Edge Function `auth` (no requiere sesión): comprobar usuario y entrar con usuario. */
export function authFn<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  return invoke<T>("auth", { action, params });
}
