import type { DataTable, Row, ShortcutInfo, Store } from "../api/handler.ts";

/** Almacén en memoria para probar el handler sin Supabase. */
export class MemoryStore implements Store {
  shortcuts = new Map<string, ShortcutInfo & { tokenHash: string; lastFingerprint: string | null; lastFingerprintAt: number; windowStart: number; windowCount: number }>();
  keys = new Map<string, string>();
  tables = new Map<string, (Row & { user_id: string })[]>();
  private t(table: DataTable) {
    if (!this.tables.has(table)) this.tables.set(table, []);
    return this.tables.get(table)!;
  }
  getWrappedKey(u: string) {
    return Promise.resolve(this.keys.get(u) ?? null);
  }
  putWrappedKeyIfMissing(u: string, w: string) {
    if (!this.keys.has(u)) this.keys.set(u, w);
    return Promise.resolve(this.keys.get(u)!);
  }
  list(table: DataTable, u: string) {
    return Promise.resolve(this.t(table).filter((r) => r.user_id === u).map(({ user_id: _, ...r }) => r));
  }
  insert(table: DataTable, u: string, rows: Row[], opts?: { ignoreDuplicates?: boolean }) {
    const list = this.t(table);
    const fresh = opts?.ignoreDuplicates ? rows.filter((r) => !list.some((x) => x.id === r.id)) : rows;
    list.push(...fresh.map((r) => ({ ...r, user_id: u })));
    return Promise.resolve();
  }
  update(table: DataTable, u: string, row: Row) {
    const r = this.t(table).find((x) => x.user_id === u && x.id === row.id);
    if (r) Object.assign(r, row);
    return Promise.resolve(Boolean(r));
  }
  remove(table: DataTable, u: string, id: string) {
    const list = this.t(table);
    const i = list.findIndex((x) => x.user_id === u && x.id === id);
    if (i >= 0) list.splice(i, 1);
    return Promise.resolve(i >= 0);
  }

  getShortcut(u: string) {
    const s = this.shortcuts.get(u);
    return Promise.resolve(s ? { hint: s.hint, createdAt: s.createdAt, lastUsedAt: s.lastUsedAt, accountId: s.accountId } : null);
  }
  putShortcut(u: string, tokenHash: string, hint: string) {
    const prev = this.shortcuts.get(u);
    this.shortcuts.set(u, { tokenHash, hint, createdAt: new Date().toISOString(), lastUsedAt: null, accountId: prev?.accountId ?? null, lastFingerprint: null, lastFingerprintAt: 0, windowStart: Date.now(), windowCount: 0 });
    return Promise.resolve();
  }
  deleteShortcut(u: string) {
    return Promise.resolve(this.shortcuts.delete(u));
  }
  setShortcutAccount(u: string, accountId: string | null) {
    const s = this.shortcuts.get(u);
    if (s) s.accountId = accountId;
    return Promise.resolve(Boolean(s));
  }

  profiles = new Map<string, { name: string; username: string }>();
  getProfile(u: string) {
    const p = this.profiles.get(u);
    return Promise.resolve(p ? { username: p.username } : null);
  }
  updateProfile(u: string, name: string, username: string) {
    if ([...this.profiles.entries()].some(([id, p]) => id !== u && p.username === username)) return Promise.resolve(false);
    this.profiles.set(u, { name, username });
    return Promise.resolve(true);
  }
  deleteUser(u: string, _username: string) {
    this.profiles.delete(u);
    this.keys.delete(u);
    this.shortcuts.delete(u);
    for (const list of this.tables.values()) {
      for (let i = list.length - 1; i >= 0; i--) if (list[i].user_id === u) list.splice(i, 1);
    }
    return Promise.resolve();
  }
}

/** Versión en memoria de public.shortcut_consume (misma lógica que la función SQL). */
export class MemoryGate {
  now = Date.now();
  constructor(private store: MemoryStore, private limit = 30) {}
  consume(tokenHash: string, fingerprint: string) {
    const entry = [...this.store.shortcuts.entries()].find(([, s]) => s.tokenHash === tokenHash);
    if (!entry) return Promise.resolve({ status: "invalid" as const, userId: null, accountId: null });
    const [userId, s] = entry;
    if (s.windowStart < this.now - 3_600_000) {
      s.windowStart = this.now;
      s.windowCount = 0;
    }
    if (s.windowCount >= this.limit) return Promise.resolve({ status: "limited" as const, userId, accountId: s.accountId });
    if (s.lastFingerprint === fingerprint && s.lastFingerprintAt > this.now - 120_000) {
      return Promise.resolve({ status: "duplicate" as const, userId, accountId: s.accountId });
    }
    s.windowCount++;
    s.lastUsedAt = new Date(this.now).toISOString();
    s.lastFingerprint = fingerprint;
    s.lastFingerprintAt = this.now;
    return Promise.resolve({ status: "ok" as const, userId, accountId: s.accountId });
  }
  forget(userId: string) {
    const s = this.store.shortcuts.get(userId);
    if (s) s.lastFingerprint = null;
    return Promise.resolve();
  }
}
