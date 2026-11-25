// Store sobre Supabase. Usa el cliente de administración (se salta RLS), así que
// TODAS las consultas filtran por user_id: es la única barrera entre usuarios.
import type { DataTable, Row, ShortcutInfo, Store } from "./handler.ts";

// deno-lint-ignore no-explicit-any
type Admin = any;

function fail(error: { message: string } | null): void {
  if (error) throw new Error(`Base de datos: ${error.message}`);
}

export class SupabaseStore implements Store {
  constructor(private db: Admin) {}

  async getWrappedKey(userId: string): Promise<string | null> {
    const { data, error } = await this.db.from("user_keys").select("wrapped_key").eq("user_id", userId).maybeSingle();
    fail(error);
    return data?.wrapped_key ?? null;
  }

  async putWrappedKeyIfMissing(userId: string, wrapped: string): Promise<string> {
    const { error } = await this.db
      .from("user_keys")
      .upsert({ user_id: userId, wrapped_key: wrapped }, { onConflict: "user_id", ignoreDuplicates: true });
    fail(error);
    const saved = await this.getWrappedKey(userId);
    if (!saved) throw new Error("No se pudo guardar la clave del usuario");
    return saved;
  }

  async list(table: DataTable, userId: string): Promise<Row[]> {
    const columns = table === "transactions" ? "id, payload, account_id" : "id, payload";
    const { data, error } = await this.db.from(table).select(columns).eq("user_id", userId).order("id").limit(20000);
    fail(error);
    return data ?? [];
  }

  async insert(table: DataTable, userId: string, rows: Row[], opts?: { ignoreDuplicates?: boolean }): Promise<void> {
    const values = rows.map((r) => ({ ...r, user_id: userId }));
    const { error } = opts?.ignoreDuplicates
      ? await this.db.from(table).upsert(values, { onConflict: "id", ignoreDuplicates: true })
      : await this.db.from(table).insert(values);
    fail(error);
  }

  async update(table: DataTable, userId: string, row: Row): Promise<boolean> {
    const values: Record<string, unknown> = { payload: row.payload };
    if (table === "transactions") values.account_id = row.account_id ?? null;
    const { data, error } = await this.db.from(table).update(values).eq("user_id", userId).eq("id", row.id).select("id");
    fail(error);
    return (data?.length ?? 0) > 0;
  }

  async remove(table: DataTable, userId: string, id: string): Promise<boolean> {
    const { data, error } = await this.db.from(table).delete().eq("user_id", userId).eq("id", id).select("id");
    fail(error);
    return (data?.length ?? 0) > 0;
  }

  async getShortcut(userId: string): Promise<ShortcutInfo | null> {
    const { data, error } = await this.db.from("shortcut_tokens").select("token_hint, created_at, last_used_at, account_id").eq("user_id", userId).maybeSingle();
    fail(error);
    return data ? { hint: data.token_hint, createdAt: data.created_at, lastUsedAt: data.last_used_at, accountId: data.account_id } : null;
  }

  async putShortcut(userId: string, tokenHash: string, hint: string): Promise<void> {
    // Mantiene la cuenta elegida, pero reinicia el uso: es otra clave.
    const { error } = await this.db.from("shortcut_tokens").upsert(
      { user_id: userId, token_hash: tokenHash, token_hint: hint, created_at: new Date().toISOString(), last_used_at: null, window_start: new Date().toISOString(), window_count: 0, last_fingerprint: null, last_fingerprint_at: null },
      { onConflict: "user_id" },
    );
    fail(error);
  }

  async deleteShortcut(userId: string): Promise<boolean> {
    const { data, error } = await this.db.from("shortcut_tokens").delete().eq("user_id", userId).select("user_id");
    fail(error);
    return (data?.length ?? 0) > 0;
  }

  async setShortcutAccount(userId: string, accountId: string | null): Promise<boolean> {
    const { data, error } = await this.db.from("shortcut_tokens").update({ account_id: accountId }).eq("user_id", userId).select("user_id");
    fail(error);
    return (data?.length ?? 0) > 0;
  }
}
