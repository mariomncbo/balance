// Lo que se escribe en el onboarding vive en el dispositivo hasta que se crea la cuenta; después se sube
// de una vez (acción `onboarding.import`) y se borra de aquí.
import type { AccountType } from "../lib/types";

export interface OnboardingAccount {
  name: string;
  type: AccountType;
  openingBalance: number;
}
export interface OnboardingLoan {
  concept: string;
  amount: number;
  day: number;
  pending: number;
  endMonth?: string;
}
export interface OnboardingData {
  accounts: OnboardingAccount[];
  loans: OnboardingLoan[];
  salary: { amount: number; day: number } | null;
}

const KEY = "balance.onboarding";
export const emptyOnboarding = (): OnboardingData => ({ accounts: [], loans: [], salary: null });

export function readOnboarding(): OnboardingData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyOnboarding();
    const p = JSON.parse(raw) as Partial<OnboardingData>;
    return {
      accounts: Array.isArray(p.accounts) ? p.accounts : [],
      loans: Array.isArray(p.loans) ? p.loans : [],
      salary: p.salary ?? null,
    };
  } catch {
    return emptyOnboarding();
  }
}

export function writeOnboarding(data: OnboardingData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* sin almacenamiento: se pierde al cerrar */
  }
}

export function clearOnboarding(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nada */
  }
}

export const isEmptyOnboarding = (d: OnboardingData): boolean =>
  d.accounts.length === 0 && d.loans.length === 0 && d.salary === null;

/** Parámetros de `onboarding.import`: los fijos del onboarding son ingresos (sueldo) y préstamos. */
export function toImportParams(d: OnboardingData): Record<string, unknown> {
  const recurring: Record<string, unknown>[] = [];
  if (d.salary)
    recurring.push({
      kind: "income",
      amount: d.salary.amount,
      concept: "Nómina",
      category: "ingresos",
      day: d.salary.day,
    });
  for (const l of d.loans) {
    recurring.push({
      kind: "loan",
      amount: l.amount,
      concept: l.concept,
      category: "hogar",
      day: l.day,
      pending: l.pending,
      ...(l.endMonth ? { endMonth: l.endMonth } : {}),
    });
  }
  return { accounts: d.accounts, recurring };
}
