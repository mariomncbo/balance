import { assert, assertEquals, assertRejects } from "jsr:@std/assert@1.0.13";
import { importMasterKey } from "../_shared/crypto.ts";
import { ApiError, type Ctx, type DataTable, handle, type Row, type Store } from "../api/handler.ts";

class MemoryStore implements Store {
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
  insert(table: DataTable, u: string, rows: Row[]) {
    this.t(table).push(...rows.map((r) => ({ ...r, user_id: u })));
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
}

const master = await importMasterKey(btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))));
const store = new MemoryStore();
const ana: Ctx = { userId: "ana", today: "2026-11-23", store, master };
const luis: Ctx = { userId: "luis", today: "2026-11-23", store, master };
// deno-lint-ignore no-explicit-any
const call = (ctx: Ctx, action: string, params: Record<string, unknown> = {}) => handle({ action, params }, ctx) as Promise<any>;

Deno.test("flujo completo con las cifras del diseño", async () => {
  const bbva = await call(ana, "accounts.create", { name: "BBVA", type: "banco", openingBalance: 7500000 });
  await call(ana, "accounts.create", { name: "Cuenta naranja", type: "ahorro", openingBalance: 412020 });
  await call(ana, "transactions.create", { accountId: bbva.id, amount: 185000, concept: "Nómina", category: "ingresos", date: "2026-11-01" });
  await call(ana, "transactions.create", { accountId: bbva.id, amount: -4890, concept: "Mercadona", category: "comida", date: "2026-11-23", source: "atajo" });
  await call(ana, "recurring.create", { kind: "expense", amount: 1299, concept: "Netflix", category: "suscripciones", accountId: bbva.id, day: 24, startDate: "2026-01-24" });
  await call(ana, "goals.create", { name: "PS5", target: 55000, saved: 32000, months: 3 });

  const home = await call(ana, "home");
  assertEquals(home.balances.total, 7500000 + 412020 + 185000 - 4890);
  assertEquals([home.month.income, home.month.expense, home.month.pending], [185000, 4890, 1299]);
  assertEquals([home.nextPayment.concept, home.nextPayment.date], ["Netflix", "2026-11-24"]);
  assertEquals([home.topGoal.name, home.topGoal.monthly, home.topGoal.progress], ["PS5", 7700, 58]);
  assertEquals(home.latest[0].concept, "Mercadona");

  // Al día siguiente, Netflix se apunta solo como movimiento.
  const tomorrow = { ...ana, today: "2026-11-24" };
  const list = await call(tomorrow, "transactions.list", { period: "day" });
  assertEquals(list.items.map((t: { concept: string; source: string }) => [t.concept, t.source]), [["Netflix", "fijo"]]);
  // Y no se duplica en la siguiente llamada.
  assertEquals((await call(tomorrow, "transactions.list", { period: "day" })).items.length, 1);
});

Deno.test("en el almacén solo hay texto cifrado", () => {
  const dump = JSON.stringify([...store.tables.values()]);
  for (const word of ["BBVA", "Mercadona", "Netflix", "PS5", "185000", "comida"]) {
    assert(!dump.includes(word), `"${word}" aparece en claro`);
  }
});

Deno.test("un usuario no ve ni toca los datos de otro", async () => {
  assertEquals((await call(luis, "accounts.list")).accounts.length, 0);
  const anaAccount = (await call(ana, "accounts.list")).accounts[0];
  await assertRejects(() => call(luis, "accounts.delete", { id: anaAccount.id }), ApiError, "No existe");
  await assertRejects(
    () => call(luis, "accounts.update", { id: anaAccount.id, name: "Mía", type: "banco", openingBalance: 0 }),
    ApiError,
    "No existe",
  );
  await assertRejects(
    () => call(luis, "transactions.create", { accountId: anaAccount.id, amount: -100, concept: "x", category: "otros", date: "2026-11-23" }),
    ApiError,
    "La cuenta no existe",
  );
  assertEquals((await call(ana, "accounts.list")).accounts.length, 2);
});

Deno.test("onboarding: importa cuentas y fijos una sola vez", async () => {
  const eva: Ctx = { userId: "eva", today: "2026-11-23", store, master };
  const r = await call(eva, "onboarding.import", {
    accounts: [{ name: "Mi dinero", type: "banco", openingBalance: 1248035 }],
    recurring: [
      { kind: "income", amount: 185000, concept: "Nómina", category: "ingresos", day: 1 },
      { kind: "loan", amount: 64000, concept: "Hipoteca", category: "hogar", day: 5, pending: 9840000, endMonth: "2041-06" },
    ],
  });
  assertEquals(r, { accounts: 1, recurring: 2 });
  const fixed = await call(eva, "recurring.list");
  assertEquals(fixed.map((f: { concept: string; nextDate: string }) => [f.concept, f.nextDate]), [["Nómina", "2026-12-01"], ["Hipoteca", "2026-12-05"]]);
  // No se cobra nada hacia atrás.
  assertEquals((await call(eva, "home")).balances.total, 1248035);
  await assertRejects(() => call(eva, "onboarding.import", { accounts: [] }), ApiError, "La cuenta ya tiene datos");
});

Deno.test("valida la entrada", async () => {
  await assertRejects(() => call(ana, "nada"), ApiError, "Acción desconocida");
  await assertRejects(() => call(ana, "accounts.create", { name: "", type: "banco", openingBalance: 0 }), ApiError);
  await assertRejects(() => call(ana, "accounts.create", { name: "X", type: "cripto", openingBalance: 0 }), ApiError);
  await assertRejects(() => call(ana, "transactions.create", { amount: 12.5, concept: "x", category: "comida", date: "2026-11-23" }), ApiError);
  await assertRejects(() => call(ana, "transactions.create", { amount: -100, concept: "x", category: "comida", date: "2026-13-40" }), ApiError);
  await assertRejects(() => handle("texto", ana), ApiError);
});
