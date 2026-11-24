// Lógica de dominio de Balance. Pura: sin red ni base de datos, para poder probarla.
// Dinero siempre en céntimos (enteros). Fechas como texto "AAAA-MM-DD"; meses "AAAA-MM".

export type Cents = number;

export const CATEGORIES = {
  comida: "Comida",
  hogar: "Hogar",
  transporte: "Transporte",
  ocio: "Ocio",
  salud: "Salud",
  compras: "Compras",
  suscripciones: "Suscripciones",
  ingresos: "Nómina e ingresos",
  otros: "Otros",
} as const;
export type Category = keyof typeof CATEGORIES;

export const ACCOUNT_TYPES = ["banco", "ahorro", "efectivo", "tarjeta", "emergencia", "empresa", "otro"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export type Source = "manual" | "ia" | "ticket" | "atajo" | "fijo";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  openingBalance: Cents;
}

export interface Transaction {
  id: string;
  accountId: string | null;
  /** Negativo = gasto, positivo = ingreso. */
  amount: Cents;
  concept: string;
  category: Category;
  date: string;
  source: Source;
  note?: string;
  recurringId?: string;
}

export interface Recurring {
  id: string;
  kind: "income" | "expense" | "loan";
  /** Importe positivo de cada cobro o pago. */
  amount: Cents;
  concept: string;
  category: Category;
  accountId: string | null;
  /** Día del mes (1–31). Si el mes es más corto, se usa el último día. */
  day: number;
  frequency: { unit: "month" | "year"; every: number };
  startDate: string;
  /** Última fecha ya convertida en movimiento. */
  lastPosted?: string;
  loan?: { pending: Cents; endMonth?: string; principal?: Cents };
}

export interface Goal {
  id: string;
  name: string;
  target: Cents;
  saved: Cents;
  /** Mes en que se quiere conseguir. */
  deadline: string;
  /** Cuota mensual calculada al crearla, para detectar retrasos. */
  plannedMonthly?: Cents;
}

// ───────────────────────── Fechas ─────────────────────────

export function parseDate(d: string): { y: number; m: number; day: number } {
  const [y, m, day] = d.split("-").map(Number);
  return { y, m, day };
}

export function fmtDate(y: number, m: number, day: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function monthOf(d: string): string {
  return d.slice(0, 7);
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const idx = y * 12 + (m - 1) + n;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}

export function monthsBetween(from: string, to: string): number {
  const [y1, m1] = from.split("-").map(Number);
  const [y2, m2] = to.split("-").map(Number);
  return (y2 * 12 + m2) - (y1 * 12 + m1);
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function addDays(d: string, n: number): string {
  const { y, m, day } = parseDate(d);
  const t = new Date(Date.UTC(y, m - 1, day + n));
  return fmtDate(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

function dueIn(month: string, day: number): string {
  const [y, m] = month.split("-").map(Number);
  return fmtDate(y, m, Math.min(day, daysInMonth(y, m)));
}

// ───────────────────────── Fijos ─────────────────────────

/** Fechas de cobro de un fijo en el intervalo (from, to], ambos "AAAA-MM-DD". */
export function occurrences(r: Recurring, from: string, to: string): string[] {
  const step = r.frequency.unit === "year" ? 12 * r.frequency.every : r.frequency.every;
  const out: string[] = [];
  let month = monthOf(r.startDate);
  // primera fecha de cobro en o después del inicio
  if (dueIn(month, r.day) < r.startDate) month = addMonths(month, step);
  for (let i = 0; i < 1200; i++) {
    const due = dueIn(month, r.day);
    if (due > to) break;
    if (r.loan?.endMonth && monthOf(due) > r.loan.endMonth) break;
    if (due > from) out.push(due);
    month = addMonths(month, step);
  }
  return out;
}

export function signedAmount(r: Recurring): Cents {
  return r.kind === "income" ? r.amount : -r.amount;
}

/**
 * Convierte en movimientos los cobros de fijos que ya han llegado (hasta `today` incluido).
 * Devuelve los movimientos nuevos y los fijos actualizados (lastPosted y, en préstamos, lo pendiente).
 */
export function materializeRecurring(
  recurring: Recurring[],
  today: string,
  newId: () => string,
): { transactions: Transaction[]; updated: Recurring[] } {
  const transactions: Transaction[] = [];
  const updated: Recurring[] = [];
  for (const r of recurring) {
    const from = r.lastPosted ?? addDays(r.startDate, -1);
    let dates = occurrences(r, from, today);
    if (dates.length === 0) continue;
    const next = structuredClone(r);
    if (next.loan) {
      const left = Math.ceil(next.loan.pending / next.amount);
      dates = dates.slice(0, Math.max(0, left));
    }
    for (const date of dates) {
      const amount = next.loan ? Math.min(next.amount, next.loan.pending) : next.amount;
      if (next.loan) next.loan.pending -= amount;
      transactions.push({
        id: newId(),
        accountId: r.accountId,
        amount: r.kind === "income" ? amount : -amount,
        concept: r.concept,
        category: r.category,
        date,
        source: "fijo",
        recurringId: r.id,
      });
    }
    next.lastPosted = dates.at(-1) ?? next.lastPosted;
    updated.push(next);
  }
  return { transactions, updated };
}

/** Porcentaje amortizado de un préstamo (0–100), si se conoce el capital inicial. */
export function loanProgress(r: Recurring): number | null {
  if (!r.loan?.principal) return null;
  return Math.round(((r.loan.principal - r.loan.pending) / r.loan.principal) * 100);
}

/** Próximo pago fijo (gasto o préstamo) a partir de hoy, incluido. */
export function nextPayment(recurring: Recurring[], today: string): { recurring: Recurring; date: string } | null {
  let best: { recurring: Recurring; date: string } | null = null;
  const horizon = addDays(today, 400);
  for (const r of recurring) {
    if (r.kind === "income") continue;
    if (r.loan && r.loan.pending <= 0) continue;
    const [date] = occurrences(r, addDays(today, -1), horizon);
    if (date && (!best || date < best.date)) best = { recurring: r, date };
  }
  return best;
}

// ───────────────────────── Saldos y resúmenes ─────────────────────────

export function balances(accounts: Account[], txs: Transaction[]) {
  const byAccount = new Map<string, Cents>(accounts.map((a) => [a.id, a.openingBalance]));
  for (const t of txs) {
    if (t.accountId && byAccount.has(t.accountId)) byAccount.set(t.accountId, byAccount.get(t.accountId)! + t.amount);
  }
  const total = [...byAccount.values()].reduce((s, v) => s + v, 0);
  return {
    total,
    accounts: accounts.map((a) => {
      const balance = byAccount.get(a.id)!;
      return { id: a.id, name: a.name, type: a.type, balance, openingBalance: a.openingBalance, share: total > 0 ? Math.round((balance / total) * 100) : 0 };
    }),
  };
}

export function monthSummary(txs: Transaction[], recurring: Recurring[], month: string, today: string) {
  const inMonth = txs.filter((t) => monthOf(t.date) === month);
  const income = inMonth.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const expense = -inMonth.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0);

  const cats = new Map<Category, Cents>();
  for (const t of inMonth) if (t.amount < 0) cats.set(t.category, (cats.get(t.category) ?? 0) - t.amount);
  const byCategory = [...cats.entries()]
    .map(([category, amount]) => ({
      category,
      label: CATEGORIES[category],
      amount,
      share: expense > 0 ? Math.round((amount / expense) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const monthEnd = dueIn(month, 31);
  const pendingFrom = monthOf(today) === month ? today : addDays(`${month}-01`, -1);
  const pending = recurring
    .filter((r) => r.kind !== "income" && !(r.loan && r.loan.pending <= 0))
    .reduce((s, r) => s + occurrences(r, pendingFrom, monthEnd).length * r.amount, 0);

  const prev = addMonths(month, -1);
  const prevExpense = -txs.filter((t) => monthOf(t.date) === prev && t.amount < 0).reduce((s, t) => s + t.amount, 0);

  return {
    month,
    income,
    expense,
    saved: income - expense,
    savedShare: income > 0 ? Math.round(((income - expense) / income) * 100) : 0,
    pending,
    byCategory,
    previousExpense: prevExpense,
    vsPrevious: prevExpense > 0 ? prevExpense - expense : null,
  };
}

/** Gasto de cada uno de los últimos `days` días, terminando hoy. */
export function lastDays(txs: Transaction[], today: string, days = 7) {
  const out: { date: string; expense: Cents }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    const expense = -txs.filter((t) => t.date === date && t.amount < 0).reduce((s, t) => s + t.amount, 0);
    out.push({ date, expense });
  }
  return { days: out, total: out.reduce((s, d) => s + d.expense, 0) };
}

// ───────────────────────── Metas ─────────────────────────

/** Meses que quedan hasta la fecha objetivo, contando el mes objetivo (mínimo 1). */
export function monthsLeft(deadline: string, today: string): number {
  return Math.max(1, monthsBetween(monthOf(today), deadline));
}

/** Cuánto apartar al mes, redondeado al euro hacia arriba. */
export function monthlyFor(remaining: Cents, months: number): Cents {
  if (remaining <= 0) return 0;
  return Math.ceil(remaining / months / 100) * 100;
}

export function goalPlan(goal: Goal, today: string) {
  const remaining = Math.max(0, goal.target - goal.saved);
  const months = monthsLeft(goal.deadline, today);
  const monthly = monthlyFor(remaining, months);
  const progress = goal.target > 0 ? Math.min(100, Math.round((goal.saved / goal.target) * 100)) : 0;
  const behind = goal.plannedMonthly !== undefined && monthly > Math.round(goal.plannedMonthly * 1.05);
  return { id: goal.id, name: goal.name, target: goal.target, saved: goal.saved, remaining, months, monthly, deadline: goal.deadline, progress, behind, done: remaining === 0 };
}

/** Plan para una meta nueva: fecha objetivo a partir de un plazo en meses. */
export function planNewGoal(target: Cents, saved: Cents, months: number, today: string) {
  const deadline = addMonths(monthOf(today), months);
  return { deadline, monthly: monthlyFor(Math.max(0, target - saved), months) };
}
