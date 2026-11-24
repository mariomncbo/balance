// Tipos de las respuestas de la Edge Function `api` (ver supabase/functions/api/handler.ts).
export type Cents = number;

export type Category =
  "comida" | "hogar" | "transporte" | "ocio" | "salud" | "compras" | "suscripciones" | "ingresos" | "otros";
export type AccountType = "banco" | "ahorro" | "efectivo" | "tarjeta" | "emergencia" | "empresa" | "otro";
export type Source = "manual" | "ia" | "ticket" | "atajo" | "fijo";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  openingBalance: Cents;
}
export interface AccountBalance {
  id: string;
  name: string;
  type: AccountType;
  balance: Cents;
  openingBalance: Cents;
  share: number;
}
export interface Balances {
  total: Cents;
  accounts: AccountBalance[];
}

export interface Transaction {
  id: string;
  accountId: string | null;
  amount: Cents;
  concept: string;
  category: Category;
  date: string;
  source: Source;
  note?: string;
  recurringId?: string;
}

export interface CategoryShare {
  category: Category;
  label: string;
  amount: Cents;
  share: number;
}
export interface MonthSummary {
  month: string;
  income: Cents;
  expense: Cents;
  saved: Cents;
  savedShare: number;
  pending: Cents;
  byCategory: CategoryShare[];
  previousExpense: Cents;
  vsPrevious: Cents | null;
}

export interface GoalPlan {
  id: string;
  name: string;
  target: Cents;
  saved: Cents;
  remaining: Cents;
  months: number;
  monthly: Cents;
  deadline: string;
  progress: number;
  behind: boolean;
  done: boolean;
}
export interface Goals {
  goals: GoalPlan[];
  monthlyTotal: Cents;
  saved: Cents;
  target: Cents;
}

export interface Recurring {
  id: string;
  kind: "income" | "expense" | "loan";
  amount: Cents;
  concept: string;
  category: Category;
  accountId: string | null;
  day: number;
  frequency: { unit: "month" | "year"; every: number };
  startDate: string;
  loan?: { pending: Cents; endMonth?: string; principal?: Cents };
  nextDate: string | null;
  progress: number | null;
}

export interface Home {
  today: string;
  balances: Balances;
  month: MonthSummary;
  lastDays: { days: { date: string; expense: Cents }[]; total: Cents };
  nextPayment: { id: string; concept: string; amount: Cents; date: string } | null;
  topGoal: GoalPlan | null;
  latest: Transaction[];
}
