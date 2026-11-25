import { assert, assertEquals, assertRejects } from "jsr:@std/assert@1.0.13";
import { importMasterKey } from "../_shared/crypto.ts";
import { ApiError, type Ctx, handle } from "../api/handler.ts";
import { MemoryStore } from "./memory_store.ts";

const master = await importMasterKey(btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))));
const TODAY = "2026-11-25";

function setup() {
  const store = new MemoryStore();
  // deno-lint-ignore no-explicit-any
  const call = (userId: string, action: string, params: Record<string, unknown> = {}) => handle({ action, params }, { userId, today: TODAY, store, master } as Ctx) as Promise<any>;
  return { store, call };
}

async function seed(call: ReturnType<typeof setup>["call"]) {
  const bbva = await call("ana", "accounts.create", { name: "BBVA", type: "banco", openingBalance: 100000 });
  const ahorro = await call("ana", "accounts.create", { name: "Ahorro", type: "ahorro", openingBalance: 0 });
  await call("ana", "transactions.create", { accountId: bbva.id, amount: -2000, concept: "Mercadona", category: "comida", date: TODAY });
  const ps5 = await call("ana", "goals.create", { name: "PS5", target: 55000, saved: 0, months: 6 });
  return { bbva, ahorro, ps5 };
}

Deno.test("aportar mueve dinero entre cuentas sin contar como gasto ni cambiar el total", async () => {
  const { call } = setup();
  const { bbva, ahorro, ps5 } = await seed(call);
  const before = await call("ana", "home");
  const g = await call("ana", "goals.contribute", { id: ps5.id, amount: 5000, fromAccountId: bbva.id, toAccountId: ahorro.id });
  assertEquals([g.saved, g.accountId, g.contributions.length, g.contributions[0].amount], [5000, ahorro.id, 1, 5000]);
  assert(g.contributions[0].transferId);
  const after = await call("ana", "home");
  assertEquals(after.balances.total, before.balances.total, "el total no cambia");
  assertEquals(after.balances.accounts.map((a: { balance: number }) => a.balance), [100000 - 2000 - 5000, 5000]);
  assertEquals([after.month.expense, after.month.income, after.lastDays.total], [2000, 0, 2000], "no es gasto ni ingreso");
  const legs = (await call("ana", "transactions.list", { period: "day" })).items.filter((t: { transfer?: unknown }) => t.transfer);
  assertEquals(legs.map((t: { amount: number; concept: string }) => [t.amount, t.concept]).sort(), [[-5000, "Aportación a PS5"], [5000, "Aportación a PS5"]]);
  assertEquals((await call("ana", "report.month")).summary.expense, 2000);
});

Deno.test("deshacer una aportación lo deja todo como estaba", async () => {
  const { call } = setup();
  const { bbva, ahorro, ps5 } = await seed(call);
  const before = await call("ana", "home");
  const g = await call("ana", "goals.contribute", { id: ps5.id, amount: 2500, fromAccountId: bbva.id, toAccountId: ahorro.id });
  const undone = await call("ana", "goals.uncontribute", { id: ps5.id, contributionId: g.contributions[0].id });
  assertEquals([undone.saved, undone.contributions.length], [0, 0]);
  const after = await call("ana", "home");
  assertEquals(after.balances.accounts.map((a: { balance: number }) => a.balance), before.balances.accounts.map((a: { balance: number }) => a.balance));
  assertEquals((await call("ana", "transactions.list", { period: "day" })).items.length, 1, "solo queda Mercadona");
  await assertRejects(() => call("ana", "goals.uncontribute", { id: ps5.id, contributionId: g.contributions[0].id }), ApiError, "No existe");
});

Deno.test("sin cuentas indicadas solo sube la meta", async () => {
  const { call } = setup();
  const { ps5 } = await seed(call);
  const g = await call("ana", "goals.contribute", { id: ps5.id, amount: 1000 });
  assertEquals([g.saved, g.contributions[0].transferId, g.accountId], [1000, undefined, null]);
  assertEquals((await call("ana", "transactions.list", { period: "day" })).items.length, 1);
  const undone = await call("ana", "goals.uncontribute", { id: ps5.id, contributionId: g.contributions[0].id });
  assertEquals(undone.saved, 0);
});

Deno.test("las transferencias no se editan ni se borran sueltas desde Movimientos", async () => {
  const { call } = setup();
  const { bbva, ahorro, ps5 } = await seed(call);
  await call("ana", "goals.contribute", { id: ps5.id, amount: 3000, fromAccountId: bbva.id, toAccountId: ahorro.id });
  const leg = (await call("ana", "transactions.list", { period: "day" })).items.find((t: { transfer?: unknown }) => t.transfer);
  await assertRejects(() => call("ana", "transactions.delete", { id: leg.id }), ApiError, "se gestiona desde la meta");
  await assertRejects(() => call("ana", "transactions.update", { ...leg, amount: -1 }), ApiError, "se gestiona desde la meta");
});

Deno.test("valida importes, cuentas y que todo sea del mismo usuario", async () => {
  const { call } = setup();
  const { bbva, ahorro, ps5 } = await seed(call);
  const luisAccount = await call("luis", "accounts.create", { name: "Luis", type: "banco", openingBalance: 0 });
  const luisGoal = await call("luis", "goals.create", { name: "Moto", target: 100000, months: 12 });
  const bad: [Record<string, unknown>, string][] = [
    [{ id: ps5.id, amount: 0 }, "Importe no válido"],
    [{ id: ps5.id, amount: -100 }, "Importe no válido"],
    [{ id: ps5.id, amount: 12.5 }, "Importe no válido"],
    [{ id: ps5.id, amount: 100, fromAccountId: bbva.id }, "Elige la cuenta de origen y la de destino"],
    [{ id: ps5.id, amount: 100, fromAccountId: bbva.id, toAccountId: bbva.id }, "Elige dos cuentas distintas"],
    [{ id: ps5.id, amount: 100, fromAccountId: luisAccount.id, toAccountId: ahorro.id }, "La cuenta no existe"],
    [{ id: luisGoal.id, amount: 100 }, "No existe"],
  ];
  for (const [params, msg] of bad) await assertRejects(() => call("ana", "goals.contribute", params), ApiError, msg);
  await assertRejects(() => call("luis", "goals.uncontribute", { id: ps5.id, contributionId: "x" }), ApiError, "No existe");
  await assertRejects(() => call("ana", "goals.update", { id: ps5.id, name: "PS5", target: 55000, accountId: luisAccount.id }), ApiError, "La cuenta no existe");
  const withAccount = await call("ana", "goals.update", { id: ps5.id, name: "PS5", target: 55000, accountId: ahorro.id });
  assertEquals(withAccount.accountId, ahorro.id);
  const cleared = await call("ana", "goals.update", { id: ps5.id, name: "PS5", target: 55000, accountId: null });
  assertEquals(cleared.accountId, null);
});
