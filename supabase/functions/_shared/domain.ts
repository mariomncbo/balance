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
  /** Mitad de una transferencia entre cuentas (dos movimientos con el mismo id). No cuenta como gasto ni ingreso. */
  transfer?: { id: string; goalId?: string; contributionId?: string };
}

export interface Recurring {
  id: string;
  kind: "income" | "expense" | "loan";
  /** Importe positivo de cada cobro o pago. */
  amount: Cents;
  concept: string;
  category: Category;
  accountId: string | null;
  /** Día del mes (1–31). Si el mes es más corto, se usa el último día. Con días o semanas es el día de `startDate`. */
  day: number;
  frequency: { unit: DurationUnit; every: number };
  /** Con días o semanas es la fecha del primer cobro; con meses o años, desde cuándo cuenta. */
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
  /** Fecha en que se quiere conseguir: "AAAA-MM-DD" (o "AAAA-MM" en las metas creadas antes de los plazos libres). */
  deadline: string;
  /** Cuota mensual calculada al crearla, para detectar retrasos. */
  plannedMonthly?: Cents;
  /** Cuenta donde se guarda el dinero de la meta (destino de las aportaciones). */
  accountId?: string | null;
  contributions?: Contribution[];
}

/** Aportación a una meta. Si movió dinero entre cuentas, `transferId` apunta a sus dos movimientos. */
export interface Contribution {
  id: string;
  date: string;
  amount: Cents;
  transferId?: string;
}

/** Movimientos que cuentan como gasto o ingreso: todos menos las transferencias entre cuentas propias. */
export function spending(txs: Transaction[]): Transaction[] {
  return txs.filter((t) => !t.transfer);
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

/** Días de `from` a `to` (negativo si `to` es anterior). */
export function daysBetween(from: string, to: string): number {
  const a = parseDate(from), b = parseDate(to);
  return Math.round((Date.UTC(b.y, b.m - 1, b.day) - Date.UTC(a.y, a.m - 1, a.day)) / 86_400_000);
}

/** Suma meses a una fecha conservando el día (o el último del mes si es más corto): 31 ene + 1 = 28 feb. */
export function addMonthsToDate(d: string, n: number): string {
  const { day } = parseDate(d);
  const month = addMonths(monthOf(d), n);
  const [y, m] = month.split("-").map(Number);
  return fmtDate(y, m, Math.min(day, daysInMonth(y, m)));
}

// ───────────────────────── Plazos ─────────────────────────

export const DURATION_UNITS = ["day", "week", "month", "year"] as const;
export type DurationUnit = (typeof DURATION_UNITS)[number];
/** Máximo que se puede escribir en cada unidad (unos 10 años; 50 en años). */
export const DURATION_MAX: Record<DurationUnit, number> = { day: 3650, week: 520, month: 600, year: 50 };

/** Fecha que resulta de sumar `n` días, semanas, meses o años a `d`. */
export function addDuration(d: string, n: number, unit: DurationUnit): string {
  switch (unit) {
    case "day": return addDays(d, n);
    case "week": return addDays(d, 7 * n);
    case "month": return addMonthsToDate(d, n);
    case "year": return addMonthsToDate(d, 12 * n);
  }
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
  if (r.frequency.unit === "day" || r.frequency.unit === "week") return dailyOccurrences(r, from, to);
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

/** Cobros cada N días o semanas, contando desde `startDate` (el primer cobro). Calcula el primero sin recorrer los anteriores. */
function dailyOccurrences(r: Recurring, from: string, to: string): string[] {
  const step = r.frequency.every * (r.frequency.unit === "week" ? 7 : 1);
  const out: string[] = [];
  // primer índice k con startDate + k·step > from
  let k = Math.max(0, Math.floor(daysBetween(r.startDate, from) / step) + 1);
  if (daysBetween(r.startDate, from) < 0) k = 0;
  for (let i = 0; i < 1200; i++, k++) {
    const due = addDays(r.startDate, k * step);
    if (due > to) break;
    if (r.loan?.endMonth && monthOf(due) > r.loan.endMonth) break;
    if (due > from) out.push(due);
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
  const horizon = addMonthsToDate(today, 12 * 51); // cubre hasta "cada 50 años"
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

export function monthSummary(allTxs: Transaction[], recurring: Recurring[], month: string, today: string) {
  const txs = spending(allTxs);
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
export function lastDays(allTxs: Transaction[], today: string, days = 7) {
  const txs = spending(allTxs);
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

/** Meses completos de `today` a `deadline` ("AAAA-MM-DD"): 25 nov → 24 dic es 0; → 25 dic es 1. */
export function fullMonthsUntil(today: string, deadline: string): number {
  let m = monthsBetween(monthOf(today), monthOf(deadline));
  while (m > 0 && addMonthsToDate(today, m) > deadline) m--;
  return Math.max(0, m);
}

/**
 * Cuánto apartar para una meta. Con un mes o más por delante, al mes (`short: false`).
 * Con menos de un mes, el total que falta (`short: true`).
 * Las metas antiguas, con fecha "AAAA-MM", siguen con el cálculo de siempre (mínimo un mes).
 */
export function goalSchedule(deadline: string, remaining: Cents, today: string) {
  if (deadline.length === 7) {
    const months = monthsLeft(deadline, today);
    const end = fmtDate(...(deadline.split("-").map(Number) as [number, number]), daysInMonth(...(deadline.split("-").map(Number) as [number, number])));
    return { months, monthly: monthlyFor(remaining, months), short: false, daysLeft: Math.max(0, daysBetween(today, end)) };
  }
  const months = fullMonthsUntil(today, deadline);
  const short = months < 1;
  return { months, monthly: monthlyFor(remaining, Math.max(1, months)), short, daysLeft: Math.max(0, daysBetween(today, deadline)) };
}

export function goalPlan(goal: Goal, today: string) {
  const remaining = Math.max(0, goal.target - goal.saved);
  const { months, monthly, short, daysLeft } = goalSchedule(goal.deadline, remaining, today);
  const progress = goal.target > 0 ? Math.min(100, Math.round((goal.saved / goal.target) * 100)) : 0;
  const behind = goal.plannedMonthly !== undefined && monthly > Math.round(goal.plannedMonthly * 1.05);
  const contributions = [...(goal.contributions ?? [])].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  return {
    id: goal.id, name: goal.name, target: goal.target, saved: goal.saved, remaining, months, monthly, deadline: goal.deadline, progress, behind,
    done: remaining === 0, accountId: goal.accountId ?? null, contributions, short, daysLeft,
  };
}

/** Plan para una meta nueva: fecha objetivo a partir de un plazo libre (N días, semanas, meses o años). */
export function planNewGoal(target: Cents, saved: Cents, amount: number, unit: DurationUnit, today: string) {
  const deadline = addDuration(today, amount, unit);
  const { monthly, short } = goalSchedule(deadline, Math.max(0, target - saved), today);
  return { deadline, monthly, short };
}
