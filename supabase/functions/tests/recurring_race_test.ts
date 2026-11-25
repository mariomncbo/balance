import { assertEquals } from "jsr:@std/assert@1.0.13";
import { importMasterKey } from "../_shared/crypto.ts";
import { type Ctx, handle } from "../api/handler.ts";
import { MemoryStore } from "./memory_store.ts";

const master = await importMasterKey(btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))));

// La app pide varias cosas a la vez (Principal, Movimientos, cuentas...). El primer día que vence un pago fijo,
// todas esas peticiones intentan apuntarlo. Tiene que quedar apuntado UNA sola vez.
Deno.test("varias peticiones simultáneas no duplican los pagos fijos que vencen", async () => {
  const store = new MemoryStore();
  // deno-lint-ignore no-explicit-any
  const at = (today: string) => (action: string, params: Record<string, unknown> = {}) => handle({ action, params }, { userId: "ana", today, store, master } as Ctx) as Promise<any>;
  const created = at("2026-10-01");
  const bbva = await created("accounts.create", { name: "BBVA", type: "banco", openingBalance: 100000 });
  await created("recurring.create", { kind: "expense", amount: 1299, concept: "Netflix", category: "suscripciones", accountId: bbva.id, day: 24 });
  await created("recurring.create", { kind: "loan", amount: 64000, concept: "Hipoteca", category: "hogar", accountId: bbva.id, day: 5, pending: 9840000 });

  const now = at("2026-11-24");
  await Promise.all([now("home"), now("transactions.list", { period: "month" }), now("recurring.list"), now("accounts.list"), now("goals.list"), now("report.month")]);

  const all = (await now("transactions.list", { period: "month", month: "2026-10" })).items.concat((await now("transactions.list", { period: "month" })).items);
  const byConcept = (c: string) => all.filter((t: { concept: string }) => t.concept === c).length;
  assertEquals(byConcept("Netflix"), 2, "Netflix: 24 oct y 24 nov, una vez cada uno");
  assertEquals(byConcept("Hipoteca"), 2, "Hipoteca: 5 nov y 5 oct, una vez cada una");
  const loan = (await now("recurring.list")).find((r: { kind: string }) => r.kind === "loan");
  assertEquals(loan.loan.pending, 9840000 - 2 * 64000, "lo pendiente baja una vez por cuota, no por petición");
  assertEquals((await now("accounts.list")).accounts[0].balance, 100000 - 2 * 1299 - 2 * 64000);
});

Deno.test("las peticiones repetidas después tampoco apuntan nada más", async () => {
  const store = new MemoryStore();
  // deno-lint-ignore no-explicit-any
  const at = (today: string) => (action: string, params: Record<string, unknown> = {}) => handle({ action, params }, { userId: "ana", today, store, master } as Ctx) as Promise<any>;
  const bbva = await at("2026-10-01")("accounts.create", { name: "BBVA", type: "banco", openingBalance: 0 });
  await at("2026-10-01")("recurring.create", { kind: "expense", amount: 500, concept: "Gimnasio", category: "salud", accountId: bbva.id, day: 10 });
  const now = at("2026-11-24");
  for (let i = 0; i < 3; i++) await Promise.all([now("home"), now("recurring.list")]);
  const n = (await now("transactions.list", { period: "month", month: "2026-10" })).items.length + (await now("transactions.list", { period: "month" })).items.length;
  assertEquals(n, 2);
});
