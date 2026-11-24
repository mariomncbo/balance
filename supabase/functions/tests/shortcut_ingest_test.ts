import { assert, assertEquals, assertRejects } from "jsr:@std/assert@1.0.13";
import { importMasterKey, sha256Hex } from "../_shared/crypto.ts";
import { ApiError, type Ctx, handle } from "../api/handler.ts";
import { ingest } from "../shortcut/handler.ts";
import { MemoryGate, MemoryStore } from "./memory_store.ts";

const master = await importMasterKey(btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))));
const dedupeKey = await crypto.subtle.importKey("raw", crypto.getRandomValues(new Uint8Array(32)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
const TODAY = "2026-11-24";

function setup() {
  const store = new MemoryStore();
  const gate = new MemoryGate(store);
  const ctx = (userId: string): Ctx => ({ userId, today: TODAY, store, master });
  // deno-lint-ignore no-explicit-any
  const call = (userId: string, action: string, params: Record<string, unknown> = {}) => handle({ action, params }, ctx(userId)) as Promise<any>;
  const send = (key: string | null, body: unknown, extra: Partial<{ method: string; contentLength: number }> = {}) =>
    ingest(
      { method: extra.method ?? "POST", key, contentLength: extra.contentLength ?? null, body: typeof body === "string" ? body : JSON.stringify(body) },
      { gate, store, master, dedupeKey, today: TODAY },
    );
  return { store, gate, call, send };
}

Deno.test("atajo: la clave se guarda solo como hash y se puede regenerar y revocar", async () => {
  const { store, call } = setup();
  assertEquals((await call("ana", "shortcut.status")).active, false);
  const { token, hint } = await call("ana", "shortcut.create");
  assertEquals(token.slice(-4), hint);
  const saved = store.shortcuts.get("ana")!;
  assertEquals(saved.tokenHash, await sha256Hex(token));
  assert(!JSON.stringify([...store.shortcuts.values()]).includes(token), "la clave nunca se guarda en claro");
  const status = await call("ana", "shortcut.status");
  assertEquals([status.active, status.hint, status.lastUsedAt], [true, hint, null]);
  assert(!("token" in status), "status no devuelve la clave");
  const second = await call("ana", "shortcut.create");
  assert(second.token !== token);
  assertEquals(store.shortcuts.size, 1, "regenerar sustituye, no acumula");
  await call("ana", "shortcut.revoke");
  assertEquals((await call("ana", "shortcut.status")).active, false);
});

Deno.test("atajo: apunta el pago cifrado, en la cuenta de la tarjeta y con categoría", async () => {
  const { store, call, send } = setup();
  await call("ana", "accounts.create", { name: "Cuenta naranja", type: "ahorro", openingBalance: 100000 });
  const bbva = await call("ana", "accounts.create", { name: "BBVA", type: "banco", openingBalance: 500000 });
  const { token } = await call("ana", "shortcut.create");
  const r = await send(token, { amount: "12,40 €", merchant: "MERCADONA", card: "BBVA Aqua" });
  assertEquals(r.status, 200);
  assertEquals(r.body.message, "Apuntado: −12,40 € · MERCADONA");
  const [t] = (await call("ana", "transactions.list", { period: "day" })).items;
  assertEquals([t.amount, t.concept, t.category, t.source, t.accountId, t.date], [-1240, "MERCADONA", "comida", "atajo", bbva.id, TODAY]);
  const dump = JSON.stringify([...store.tables.values()]);
  assert(!dump.includes("MERCADONA") && !dump.includes("1240"), "el pago se guarda cifrado");
  assert((await call("ana", "shortcut.status")).lastUsedAt, "se anota el último uso");
});

Deno.test("atajo: usa la cuenta elegida en la app si la tarjeta no coincide", async () => {
  const { call, send } = setup();
  await call("ana", "accounts.create", { name: "BBVA", type: "banco", openingBalance: 0 });
  const naranja = await call("ana", "accounts.create", { name: "Cuenta naranja", type: "ahorro", openingBalance: 0 });
  await assertRejects(() => call("ana", "shortcut.account", { accountId: naranja.id }), ApiError, "Primero crea la clave");
  const { token } = await call("ana", "shortcut.create");
  await call("ana", "shortcut.account", { accountId: naranja.id });
  await assertRejects(() => call("ana", "shortcut.account", { accountId: "de-otro" }), ApiError, "La cuenta no existe");
  await send(token, { amount: 5, merchant: "Kiosko", card: "Tarjeta regalo" });
  const [t] = (await call("ana", "transactions.list", { period: "day" })).items;
  assertEquals(t.accountId, naranja.id);
});

Deno.test("atajo: rechaza sin dar pistas las claves malas, revocadas o de otro formato", async () => {
  const { call, send } = setup();
  const { token } = await call("ana", "shortcut.create");
  const fake = "bal_" + "A".repeat(43);
  for (const key of [null, "", "abc", token + "x", fake, `Bearer ${token}`]) {
    const r = await send(key, { amount: "1,00" });
    assertEquals(r.status, 401, `clave «${key}»`);
    assertEquals(r.body.error, "Clave del Atajo no válida. Genera una nueva en Balance → Ajustes.");
  }
  await call("ana", "shortcut.create"); // regenerar: la anterior deja de valer
  assertEquals((await send(token, { amount: "1,00" })).status, 401);
});

Deno.test("atajo: un usuario no puede escribir en la cuenta de otro", async () => {
  const { call, send } = setup();
  await call("ana", "accounts.create", { name: "BBVA", type: "banco", openingBalance: 0 });
  const { token: luisKey } = await call("luis", "shortcut.create");
  await send(luisKey, { amount: "9,99", merchant: "Netflix", card: "BBVA" });
  assertEquals((await call("ana", "transactions.list", { period: "day" })).items.length, 0);
  const [t] = (await call("luis", "transactions.list", { period: "day" })).items;
  assertEquals([t.concept, t.accountId], ["Netflix", null], "luis no tiene cuentas: sin cuenta, nunca la de ana");
});

Deno.test("atajo: valida método, tamaño, JSON e importe antes de tocar datos", async () => {
  const { gate, call, send } = setup();
  const { token } = await call("ana", "shortcut.create");
  assertEquals((await send(token, { amount: "1" }, { method: "GET" })).status, 405);
  assertEquals((await send(token, { amount: "1", merchant: "x".repeat(5000) })).status, 413);
  assertEquals((await send(token, "", { contentLength: 999999 })).status, 413);
  assertEquals((await send(token, "no es json")).status, 400);
  assertEquals((await send(token, [1, 2])).status, 400);
  assertEquals((await send(token, { merchant: "Sin importe" })).status, 400);
  assertEquals((await send(token, { amount: "2.000.000 €" })).status, 400);
  assertEquals((await call("ana", "transactions.list", { period: "day" })).items.length, 0);
});

Deno.test("atajo: el mismo pago repetido en 2 minutos no se duplica", async () => {
  const { gate, call, send } = setup();
  const { token } = await call("ana", "shortcut.create");
  const pago = { amount: "3,20 €", merchant: "Café Pepe", card: "BBVA" };
  assertEquals((await send(token, pago)).body.duplicate, undefined);
  const again = await send(token, pago);
  assertEquals([again.status, again.body.duplicate], [200, true]);
  gate.now += 121_000;
  await send(token, pago); // pasado el plazo es otro pago (dos cafés)
  await send(token, { ...pago, amount: "3,30 €" }); // distinto importe: otro pago
  assertEquals((await call("ana", "transactions.list", { period: "day" })).items.length, 3);
});

Deno.test("atajo: máximo 30 pagos por hora", async () => {
  const { gate, call, send } = setup();
  const { token } = await call("ana", "shortcut.create");
  for (let i = 1; i <= 30; i++) assertEquals((await send(token, { amount: `${i},00`, merchant: "Tienda" })).status, 200);
  assertEquals((await send(token, { amount: "31,00", merchant: "Tienda" })).status, 429);
  gate.now += 3_600_001;
  assertEquals((await send(token, { amount: "32,00", merchant: "Tienda" })).status, 200);
});

Deno.test("atajo: aprende la categoría corregida por el usuario", async () => {
  const { call, send } = setup();
  const { token } = await call("ana", "shortcut.create");
  await send(token, { amount: "10", merchant: "Bar Manolo" });
  const [t] = (await call("ana", "transactions.list", { period: "day" })).items;
  assertEquals(t.category, "comida");
  await call("ana", "transactions.update", { ...t, id: t.id, category: "ocio" });
  await send(token, { amount: "12", merchant: "BAR MANOLO" });
  const items = (await call("ana", "transactions.list", { period: "day" })).items;
  assertEquals(items.filter((x: { category: string }) => x.category === "ocio").length, 2);
});
