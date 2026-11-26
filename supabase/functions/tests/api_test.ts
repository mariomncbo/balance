import { assert, assertEquals, assertRejects } from "jsr:@std/assert@1.0.13";
import { importMasterKey } from "../_shared/crypto.ts";
import { ApiError, type Ctx, handle } from "../api/handler.ts";
import { MemoryStore } from "./memory_store.ts";

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

Deno.test("plazos libres en metas y fijos", async () => {
  const u: Ctx = { userId: "plazos", today: "2026-11-23", store, master };
  const corta = await call(u, "goals.preview", { target: 12000, durationAmount: 10, durationUnit: "day" });
  assertEquals(corta, { deadline: "2026-12-03", monthly: 12000, short: true });
  const meta = await call(u, "goals.create", { name: "Bici", target: 60000, durationAmount: 10, durationUnit: "week" });
  assertEquals([meta.deadline, meta.monthly, meta.short], ["2027-02-01", 30000, false]);
  const cambiada = await call(u, "goals.update", { id: meta.id, name: "Bici", target: 60000, durationAmount: 1, durationUnit: "year" });
  assertEquals([cambiada.deadline, cambiada.months], ["2027-11-23", 12]);
  await assertRejects(() => call(u, "goals.preview", { target: 100, durationAmount: 0, durationUnit: "week" }), ApiError);
  await assertRejects(() => call(u, "goals.preview", { target: 100, durationAmount: 3, durationUnit: "siglos" }), ApiError);
  await assertRejects(() => call(u, "goals.preview", { target: 100, durationAmount: 51, durationUnit: "year" }), ApiError);

  const gym = await call(u, "recurring.create", { kind: "expense", amount: 3000, concept: "Gimnasio", category: "salud", frequencyUnit: "week", frequencyEvery: 2, startDate: "2026-11-28" });
  assertEquals([gym.frequency, gym.day, gym.nextDate], [{ unit: "week", every: 2 }, 28, "2026-11-28"]);
  const editado = await call(u, "recurring.update", { id: gym.id, kind: "expense", amount: 3000, concept: "Gimnasio", category: "salud", frequencyUnit: "day", frequencyEvery: 10, startDate: "2026-11-30" });
  assertEquals([editado.frequency.unit, editado.nextDate], ["day", "2026-11-30"]);
  await assertRejects(() => call(u, "recurring.create", { kind: "expense", amount: 1, concept: "x", category: "otros", day: 1, frequencyUnit: "month", frequencyEvery: 601 }), ApiError);
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
  // Tampoco puede leer un movimiento suelto de otro por su id.
  const mercadona = (await call(ana, "transactions.list", { month: "2026-11" })).items.find((t: { concept: string }) => t.concept === "Mercadona");
  assertEquals((await call(ana, "transactions.get", { id: mercadona.id })).concept, "Mercadona");
  await assertRejects(() => call(luis, "transactions.get", { id: mercadona.id }), ApiError, "No existe");
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

Deno.test("perfil: cambiar nombre y usuario, y no repetir usuario", async () => {
  const a: Ctx = { userId: "perfil-a", today: "2026-11-23", store, master };
  const b: Ctx = { userId: "perfil-b", today: "2026-11-23", store, master };
  store.profiles.set("perfil-a", { name: "A", username: "aaa" });
  store.profiles.set("perfil-b", { name: "B", username: "bbb" });
  await call(a, "profile.update", { name: "  Ana ", username: "Ana.G" });
  assertEquals(store.profiles.get("perfil-a"), { name: "Ana", username: "ana.g" });
  await assertRejects(() => call(b, "profile.update", { name: "B", username: "ana.g" }), ApiError, "ya está en uso");
  await assertRejects(() => call(b, "profile.update", { name: "B", username: "x" }), ApiError);
  await assertRejects(() => call(b, "profile.update", { name: "", username: "bbb" }), ApiError);
});

Deno.test("eliminar cuenta: exige el nombre de usuario y borra todos los datos", async () => {
  const u: Ctx = { userId: "borrar", today: "2026-11-23", store, master };
  const keep: Ctx = { userId: "se-queda", today: "2026-11-23", store, master };
  store.profiles.set("borrar", { name: "Borrar", username: "borrar.me" });
  await call(u, "accounts.create", { name: "BBVA", type: "banco", openingBalance: 1000 });
  await call(u, "shortcut.create");
  await call(keep, "accounts.create", { name: "Otra", type: "banco", openingBalance: 5 });

  await assertRejects(() => call(u, "account.delete", { username: "otro" }), ApiError, "no coincide");
  await assertRejects(() => call(u, "account.delete", {}), ApiError);
  assertEquals((await call(u, "accounts.list")).accounts.length, 1, "un intento fallido no borra nada");

  await call(u, "account.delete", { username: " Borrar.Me " });
  assertEquals(store.profiles.has("borrar"), false);
  assertEquals(store.keys.has("borrar"), false);
  assertEquals(store.shortcuts.has("borrar"), false);
  assertEquals((await store.list("accounts", "borrar")).length, 0);
  assertEquals((await call(keep, "accounts.list")).accounts.length, 1, "los datos de otros no se tocan");
});
