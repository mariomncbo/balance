// Lógica de la Edge Function `api`. No depende de Supabase: recibe un Store,
// así se puede probar con un almacén en memoria.
import {
  createWrappedUserKey,
  decryptPayload,
  encryptPayload,
  rowAad,
  type TableName,
  unwrapUserKey,
  uuidv7,
} from "../_shared/crypto.ts";
import {
  type Account,
  ACCOUNT_TYPES,
  addDays,
  balances,
  CATEGORIES,
  type Category,
  type Goal,
  goalPlan,
  lastDays,
  loanProgress,
  materializeRecurring,
  monthOf,
  monthSummary,
  nextPayment,
  planNewGoal,
  type Recurring,
  type Source,
  type Transaction,
} from "../_shared/domain.ts";

export type DataTable = "accounts" | "transactions" | "recurring" | "goals";

export interface Row {
  id: string;
  payload: string;
  account_id?: string | null;
}

export interface Store {
  getWrappedKey(userId: string): Promise<string | null>;
  /** Guarda la clave si no existe y devuelve la que quede guardada (evita carreras). */
  putWrappedKeyIfMissing(userId: string, wrapped: string): Promise<string>;
  list(table: DataTable, userId: string): Promise<Row[]>;
  insert(table: DataTable, userId: string, rows: Row[]): Promise<void>;
  update(table: DataTable, userId: string, row: Row): Promise<boolean>;
  remove(table: DataTable, userId: string, id: string): Promise<boolean>;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface Ctx {
  userId: string;
  today: string;
  store: Store;
  master: CryptoKey;
}

// ───────────────────────── Bóveda: cifrar y descifrar filas ─────────────────────────

class Vault {
  private dek?: CryptoKey;
  constructor(private ctx: Ctx) {}

  private async key(): Promise<CryptoKey> {
    if (this.dek) return this.dek;
    const { store, master, userId } = this.ctx;
    let wrapped = await store.getWrappedKey(userId);
    if (!wrapped) wrapped = await store.putWrappedKeyIfMissing(userId, await createWrappedUserKey(master, userId));
    this.dek = await unwrapUserKey(master, wrapped, userId);
    return this.dek;
  }

  async all<T extends { id: string }>(table: DataTable): Promise<T[]> {
    const dek = await this.key();
    const rows = await this.ctx.store.list(table, this.ctx.userId);
    return await Promise.all(
      rows.map(async (r) => ({ ...(await decryptPayload<Omit<T, "id">>(dek, rowAad(table as TableName, this.ctx.userId, r.id), r.payload)), id: r.id }) as T),
    );
  }

  private async row<T extends { id: string }>(table: DataTable, item: T): Promise<Row> {
    const { id, ...data } = item;
    const payload = await encryptPayload(await this.key(), rowAad(table as TableName, this.ctx.userId, id), data);
    const row: Row = { id, payload };
    if (table === "transactions") row.account_id = (item as unknown as Transaction).accountId;
    return row;
  }

  async insert<T extends { id: string }>(table: DataTable, items: T[]): Promise<void> {
    if (items.length === 0) return;
    await this.ctx.store.insert(table, this.ctx.userId, await Promise.all(items.map((i) => this.row(table, i))));
  }

  async update<T extends { id: string }>(table: DataTable, item: T): Promise<void> {
    if (!(await this.ctx.store.update(table, this.ctx.userId, await this.row(table, item)))) throw new ApiError(404, "No existe");
  }

  async remove(table: DataTable, id: string): Promise<void> {
    if (!(await this.ctx.store.remove(table, this.ctx.userId, id))) throw new ApiError(404, "No existe");
  }
}

// ───────────────────────── Validación ─────────────────────────

type P = Record<string, unknown>;

function str(p: P, k: string, max = 80, optional = false): string {
  const v = p[k];
  if (v === undefined && optional) return "";
  if (typeof v !== "string" || v.trim().length === 0 || v.length > max) throw new ApiError(400, `Campo no válido: ${k}`);
  return v.trim();
}
function cents(p: P, k: string, { positive = false, optional = false } = {}): number {
  const v = p[k];
  if (v === undefined && optional) return 0;
  if (typeof v !== "number" || !Number.isSafeInteger(v) || Math.abs(v) > 1e12 || (positive && v <= 0)) {
    throw new ApiError(400, `Importe no válido: ${k}`);
  }
  return v;
}
function oneOf<T extends string>(p: P, k: string, values: readonly T[]): T {
  const v = p[k];
  if (typeof v !== "string" || !values.includes(v as T)) throw new ApiError(400, `Valor no válido: ${k}`);
  return v as T;
}
function date(p: P, k: string): string {
  const v = p[k];
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) throw new ApiError(400, `Fecha no válida: ${k}`);
  return v;
}
function month(p: P, k: string): string {
  const v = p[k];
  if (typeof v !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(v)) throw new ApiError(400, `Mes no válido: ${k}`);
  return v;
}
function int(p: P, k: string, min: number, max: number): number {
  const v = p[k];
  if (typeof v !== "number" || !Number.isInteger(v) || v < min || v > max) throw new ApiError(400, `Número no válido: ${k}`);
  return v;
}
const CATEGORY_KEYS = Object.keys(CATEGORIES) as Category[];
const SOURCES: Source[] = ["manual", "ia", "ticket", "atajo"];

function parseAccount(p: P, id: string): Account {
  return { id, name: str(p, "name", 40), type: oneOf(p, "type", ACCOUNT_TYPES), openingBalance: cents(p, "openingBalance") };
}

function parseTransaction(p: P, id: string, accounts: Account[]): Transaction {
  const accountId = p.accountId === null || p.accountId === undefined ? null : str(p, "accountId", 40);
  if (accountId && !accounts.some((a) => a.id === accountId)) throw new ApiError(400, "La cuenta no existe");
  const t: Transaction = {
    id,
    accountId,
    amount: cents(p, "amount"),
    concept: str(p, "concept", 80),
    category: oneOf(p, "category", CATEGORY_KEYS),
    date: date(p, "date"),
    source: p.source === undefined ? "manual" : oneOf(p, "source", SOURCES),
  };
  if (t.amount === 0) throw new ApiError(400, "El importe no puede ser 0");
  const note = str(p, "note", 280, true);
  if (note) t.note = note;
  return t;
}

function parseRecurring(p: P, id: string, today: string): Recurring {
  const kind = oneOf(p, "kind", ["income", "expense", "loan"] as const);
  const r: Recurring = {
    id,
    kind,
    amount: cents(p, "amount", { positive: true }),
    concept: str(p, "concept", 60),
    category: oneOf(p, "category", CATEGORY_KEYS),
    accountId: p.accountId ? str(p, "accountId", 40) : null,
    day: int(p, "day", 1, 31),
    frequency: {
      unit: p.frequencyUnit === undefined ? "month" : oneOf(p, "frequencyUnit", ["month", "year"] as const),
      every: p.frequencyEvery === undefined ? 1 : int(p, "frequencyEvery", 1, 24),
    },
    startDate: p.startDate === undefined ? today : date(p, "startDate"),
  };
  if (kind === "loan") {
    r.loan = { pending: cents(p, "pending", { positive: true }) };
    if (p.endMonth !== undefined) r.loan.endMonth = month(p, "endMonth");
    if (p.principal !== undefined) r.loan.principal = cents(p, "principal", { positive: true });
  }
  return r;
}

// ───────────────────────── Acciones ─────────────────────────

/** Convierte en movimientos los fijos que ya han vencido. Se ejecuta antes de leer datos. */
async function syncRecurring(v: Vault, ctx: Ctx) {
  const recurring = await v.all<Recurring>("recurring");
  const { transactions, updated } = materializeRecurring(recurring, ctx.today, () => uuidv7());
  await v.insert("transactions", transactions);
  for (const r of updated) await v.update("recurring", r);
  const byId = new Map(updated.map((r) => [r.id, r]));
  return recurring.map((r) => byId.get(r.id) ?? r);
}

function recurringView(r: Recurring, today: string) {
  const next = nextPayment([{ ...r, kind: r.kind === "income" ? "expense" : r.kind }], today);
  return { ...r, nextDate: next?.date ?? null, progress: loanProgress(r) };
}

function goalsView(goals: Goal[], today: string) {
  const plans = goals.map((g) => goalPlan(g, today));
  return { goals: plans, monthlyTotal: plans.reduce((s, g) => s + g.monthly, 0), saved: plans.reduce((s, g) => s + g.saved, 0), target: plans.reduce((s, g) => s + g.target, 0) };
}

type Handler = (p: P, v: Vault, ctx: Ctx) => Promise<unknown>;

const actions: Record<string, Handler> = {
  "home": async (_p, v, ctx) => {
    const recurring = await syncRecurring(v, ctx);
    const [accounts, txs, goals] = await Promise.all([v.all<Account>("accounts"), v.all<Transaction>("transactions"), v.all<Goal>("goals")]);
    const plans = goalsView(goals, ctx.today).goals.filter((g) => !g.done).sort((a, b) => b.progress - a.progress);
    const next = nextPayment(recurring, ctx.today);
    return {
      today: ctx.today,
      balances: balances(accounts, txs),
      month: monthSummary(txs, recurring, monthOf(ctx.today), ctx.today),
      lastDays: lastDays(txs, ctx.today),
      nextPayment: next ? { id: next.recurring.id, concept: next.recurring.concept, amount: next.recurring.amount, date: next.date } : null,
      topGoal: plans[0] ?? null,
      latest: [...txs].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).slice(0, 5),
    };
  },

  "accounts.list": async (_p, v, ctx) => {
    await syncRecurring(v, ctx);
    const [accounts, txs] = await Promise.all([v.all<Account>("accounts"), v.all<Transaction>("transactions")]);
    return balances(accounts, txs);
  },
  "accounts.create": async (p, v) => {
    const a = parseAccount(p, uuidv7());
    await v.insert("accounts", [a]);
    return a;
  },
  "accounts.update": async (p, v) => {
    const a = parseAccount(p, str(p, "id", 40));
    await v.update("accounts", a);
    return a;
  },
  "accounts.delete": async (p, v) => {
    await v.remove("accounts", str(p, "id", 40));
    return { ok: true };
  },

  "transactions.list": async (p, v, ctx) => {
    await syncRecurring(v, ctx);
    const txs = await v.all<Transaction>("transactions");
    const m = p.month === undefined ? monthOf(ctx.today) : month(p, "month");
    const period = p.period === undefined ? "month" : oneOf(p, "period", ["day", "week", "month"] as const);
    const from = period === "day" ? ctx.today : period === "week" ? addDays(ctx.today, -6) : `${m}-01`;
    const to = period === "month" ? `${m}-31` : ctx.today;
    const q = typeof p.query === "string" ? p.query.trim().toLowerCase().slice(0, 60) : "";
    const category = p.category === undefined ? null : oneOf(p, "category", CATEGORY_KEYS);
    const accountId = typeof p.accountId === "string" ? p.accountId : null;
    const items = txs
      .filter((t) => t.date >= from && t.date <= to)
      .filter((t) => !category || t.category === category)
      .filter((t) => !accountId || t.accountId === accountId)
      .filter((t) => !q || t.concept.toLowerCase().includes(q) || (t.note ?? "").toLowerCase().includes(q))
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
    const recurring = await v.all<Recurring>("recurring");
    return { items, summary: monthSummary(txs, recurring, m, ctx.today) };
  },
  "transactions.create": async (p, v) => {
    const t = parseTransaction(p, uuidv7(), await v.all<Account>("accounts"));
    await v.insert("transactions", [t]);
    return t;
  },
  "transactions.update": async (p, v) => {
    const t = parseTransaction(p, str(p, "id", 40), await v.all<Account>("accounts"));
    await v.update("transactions", t);
    return t;
  },
  "transactions.delete": async (p, v) => {
    await v.remove("transactions", str(p, "id", 40));
    return { ok: true };
  },

  "recurring.list": async (_p, v, ctx) => (await syncRecurring(v, ctx)).map((r) => recurringView(r, ctx.today)),
  "recurring.create": async (p, v, ctx) => {
    const r = parseRecurring(p, uuidv7(), ctx.today);
    // No se cobra hacia atrás: lo anterior a hoy ya está en el saldo.
    r.lastPosted = addDays(ctx.today, -1) > addDays(r.startDate, -1) ? addDays(ctx.today, -1) : undefined;
    await v.insert("recurring", [r]);
    return recurringView(r, ctx.today);
  },
  "recurring.update": async (p, v, ctx) => {
    const id = str(p, "id", 40);
    const current = (await v.all<Recurring>("recurring")).find((r) => r.id === id);
    if (!current) throw new ApiError(404, "No existe");
    const r = { ...parseRecurring(p, id, ctx.today), lastPosted: current.lastPosted };
    await v.update("recurring", r);
    return recurringView(r, ctx.today);
  },
  "recurring.delete": async (p, v) => {
    await v.remove("recurring", str(p, "id", 40));
    return { ok: true };
  },

  "goals.list": async (_p, v, ctx) => goalsView(await v.all<Goal>("goals"), ctx.today),
  "goals.preview": async (p, _v, ctx) => planNewGoal(cents(p, "target", { positive: true }), cents(p, "saved", { optional: true }), int(p, "months", 1, 600), ctx.today),
  "goals.create": async (p, v, ctx) => {
    const target = cents(p, "target", { positive: true });
    const saved = cents(p, "saved", { optional: true });
    const plan = planNewGoal(target, saved, int(p, "months", 1, 600), ctx.today);
    const g: Goal = { id: uuidv7(), name: str(p, "name", 60), target, saved, deadline: plan.deadline, plannedMonthly: plan.monthly };
    await v.insert("goals", [g]);
    return goalPlan(g, ctx.today);
  },
  "goals.update": async (p, v, ctx) => {
    const id = str(p, "id", 40);
    const current = (await v.all<Goal>("goals")).find((g) => g.id === id);
    if (!current) throw new ApiError(404, "No existe");
    const target = cents(p, "target", { positive: true });
    const saved = cents(p, "saved", { optional: true });
    const g: Goal = { ...current, name: str(p, "name", 60), target, saved };
    if (p.months !== undefined) {
      const plan = planNewGoal(target, saved, int(p, "months", 1, 600), ctx.today);
      g.deadline = plan.deadline;
      g.plannedMonthly = plan.monthly;
    }
    await v.update("goals", g);
    return goalPlan(g, ctx.today);
  },
  "goals.delete": async (p, v) => {
    await v.remove("goals", str(p, "id", 40));
    return { ok: true };
  },

  "report.month": async (p, v, ctx) => {
    const recurring = await syncRecurring(v, ctx);
    const [txs, goals] = await Promise.all([v.all<Transaction>("transactions"), v.all<Goal>("goals")]);
    const m = p.month === undefined ? monthOf(ctx.today) : month(p, "month");
    return { summary: monthSummary(txs, recurring, m, ctx.today), goals: goalsView(goals, ctx.today) };
  },

  "meta.categories": async () => CATEGORIES,
};

export async function handle(body: unknown, ctx: Ctx): Promise<unknown> {
  if (typeof body !== "object" || body === null) throw new ApiError(400, "Petición no válida");
  const { action, params } = body as { action?: unknown; params?: unknown };
  if (typeof action !== "string" || !Object.hasOwn(actions, action)) throw new ApiError(400, "Acción desconocida");
  const p = (typeof params === "object" && params !== null ? params : {}) as P;
  return await actions[action](p, new Vault(ctx), ctx);
}
