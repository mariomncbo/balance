import { assertEquals } from "jsr:@std/assert@1.0.13";
import {
  type Account,
  addMonths,
  balances,
  goalPlan,
  lastDays,
  loanProgress,
  materializeRecurring,
  monthSummary,
  nextPayment,
  occurrences,
  planNewGoal,
  type Recurring,
  type Transaction,
} from "../_shared/domain.ts";

const TODAY = "2026-11-23";
let n = 0;
const id = () => `id-${++n}`;

function tx(date: string, amount: number, category: Transaction["category"], concept = "x", accountId = "bbva"): Transaction {
  return { id: id(), accountId, amount, concept, category, date, source: "manual" };
}

const netflix: Recurring = {
  id: "netflix", kind: "expense", amount: 1299, concept: "Netflix", category: "suscripciones",
  accountId: "bbva", day: 24, frequency: { unit: "month", every: 1 }, startDate: "2026-01-01", lastPosted: "2026-10-24",
};
const hipoteca: Recurring = {
  id: "hipoteca", kind: "loan", amount: 64000, concept: "Hipoteca", category: "hogar", accountId: "bbva", day: 5,
  frequency: { unit: "month", every: 1 }, startDate: "2016-06-01", lastPosted: "2026-11-05",
  loan: { pending: 9840000, principal: 15870968, endMonth: "2041-06" },
};

Deno.test("fechas: sumar meses y fin de mes", () => {
  assertEquals(addMonths("2026-11", 3), "2027-02");
  assertEquals(addMonths("2026-01", -1), "2025-12");
  const r: Recurring = { ...netflix, day: 31, startDate: "2027-01-01", lastPosted: undefined };
  assertEquals(occurrences(r, "2026-12-31", "2027-03-31"), ["2027-01-31", "2027-02-28", "2027-03-31"]);
});

Deno.test("fijos: el cobro de mañana todavía no se apunta y luego sí", () => {
  assertEquals(materializeRecurring([netflix], TODAY, id).transactions.length, 0);
  const { transactions, updated } = materializeRecurring([netflix], "2026-11-24", id);
  assertEquals(transactions.map((t) => [t.date, t.amount, t.source]), [["2026-11-24", -1299, "fijo"]]);
  assertEquals(updated[0].lastPosted, "2026-11-24");
});

Deno.test("fijos: si la app no se abre en meses, se apuntan todos los cobros pendientes", () => {
  const { transactions } = materializeRecurring([netflix], "2027-02-25", id);
  assertEquals(transactions.map((t) => t.date), ["2026-11-24", "2026-12-24", "2027-01-24", "2027-02-24"]);
});

Deno.test("préstamos: cada cuota reduce lo pendiente y no se pasa de la deuda", () => {
  const { transactions, updated } = materializeRecurring([hipoteca], "2026-12-05", id);
  assertEquals(transactions.length, 1);
  assertEquals(updated[0].loan!.pending, 9840000 - 64000);
  const casiPagado: Recurring = { ...hipoteca, loan: { pending: 10000, endMonth: "2041-06" } };
  const fin = materializeRecurring([casiPagado], "2027-03-05", id);
  assertEquals(fin.transactions.map((t) => t.amount), [-10000]);
  assertEquals(fin.updated[0].loan!.pending, 0);
  assertEquals(loanProgress(hipoteca), 38);
});

Deno.test("próximo pago: Netflix mañana antes que la hipoteca", () => {
  const next = nextPayment([hipoteca, netflix], TODAY);
  assertEquals([next?.recurring.id, next?.date], ["netflix", "2026-11-24"]);
});

Deno.test("saldos y reparto entre cuentas", () => {
  const accounts: Account[] = [
    { id: "bbva", name: "BBVA", type: "banco", openingBalance: 7500000 },
    { id: "naranja", name: "Cuenta naranja", type: "ahorro", openingBalance: 412020 },
    { id: "efectivo", name: "Efectivo", type: "efectivo", openingBalance: 12000 },
  ];
  const b = balances(accounts, [tx("2026-11-01", 185000, "ingresos"), tx("2026-11-02", -110985, "hogar")]);
  assertEquals(b.accounts.map((a) => a.balance), [7574015, 412020, 12000]);
  assertEquals(b.total, 7998035);
});

Deno.test("resumen del mes: categorías, lo ahorrado, lo pendiente y la comparación", () => {
  const txs = [
    tx("2026-11-01", 185000, "ingresos", "Nómina"),
    tx("2026-11-05", -70299, "hogar"),
    tx("2026-11-10", -31245, "comida"),
    tx("2026-11-12", -12800, "transporte"),
    tx("2026-11-20", -9716, "ocio"),
    tx("2026-10-15", -133690, "hogar"),
  ];
  const s = monthSummary(txs, [netflix, hipoteca], "2026-11", TODAY);
  assertEquals([s.income, s.expense, s.saved, s.savedShare], [185000, 124060, 60940, 33]);
  assertEquals(s.byCategory.map((c) => [c.label, c.share]), [["Hogar", 57], ["Comida", 25], ["Transporte", 10], ["Ocio", 8]]);
  assertEquals(s.pending, 1299);
  assertEquals(s.vsPrevious, 9630);
});

Deno.test("últimos 7 días", () => {
  const txs = [tx("2026-11-23", -4890, "comida"), tx("2026-11-20", -5500, "transporte"), tx("2026-11-10", -9999, "ocio")];
  const r = lastDays(txs, TODAY);
  assertEquals(r.days.length, 7);
  assertEquals(r.days[0].date, "2026-11-17");
  assertEquals(r.total, 10390);
});

Deno.test("metas: cuánto apartar y si vas con retraso (cifras del diseño)", () => {
  const ps5 = goalPlan({ id: "ps5", name: "PS5", target: 55000, saved: 32000, deadline: "2027-02", plannedMonthly: 7700 }, TODAY);
  assertEquals([ps5.monthly, ps5.months, ps5.progress, ps5.behind], [7700, 3, 58, false]);
  const japon = goalPlan({ id: "jp", name: "Japón", target: 300000, saved: 90000, deadline: "2027-03", plannedMonthly: 35000 }, TODAY);
  assertEquals([japon.monthly, japon.progress, japon.behind], [52500, 30, true]);
  assertEquals(planNewGoal(55000, 0, 6, TODAY), { deadline: "2027-05", monthly: 9200 });
});
