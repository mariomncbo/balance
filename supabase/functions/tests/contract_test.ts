// Test de contrato entre la Edge Function `api` y las apps.
//
// Guarda las respuestas REALES del handler en tests/contract/*.json. Las apps (iOS: balanceTests/ContractTests.swift)
// decodifican esos mismos ficheros con sus modelos. Si cambia la forma de una respuesta (se quita o renombra un campo,
// cambia un tipo...) este test falla hasta que se regeneren los ficheros, y entonces el test de la app dice si sigue
// entendiéndolos. Así un campo que falte se detecta aquí y no en el móvil.
//
// Ejecutar:            deno test --allow-read=tests/contract --allow-write=tests/contract --allow-env=UPDATE_CONTRACT tests/contract_test.ts
// Regenerar ficheros:  UPDATE_CONTRACT=1 deno test --allow-read=tests/contract --allow-write=tests/contract --allow-env=UPDATE_CONTRACT tests/contract_test.ts
import { assert, assertEquals } from "jsr:@std/assert@1.0.13";
import { importMasterKey } from "../_shared/crypto.ts";
import { type Ctx, handle } from "../api/handler.ts";
import { MemoryStore } from "./memory_store.ts";

const dir = new URL("./contract/", import.meta.url);
const UPDATE = Deno.env.get("UPDATE_CONTRACT") === "1";

/** Forma de un JSON: claves y tipos, sin valores. Los arrays unen la forma de todos sus elementos. */
export function shape(v: unknown): unknown {
  if (v === null) return "null";
  if (Array.isArray(v)) return { "[]": v.map(shape).reduce<unknown>((a, b) => merge(a, b), undefined) ?? "empty" };
  if (typeof v === "object") return Object.fromEntries(Object.entries(v as object).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, shape(x)]));
  return typeof v;
}

function merge(a: unknown, b: unknown): unknown {
  if (a === undefined) return b;
  if (JSON.stringify(a) === JSON.stringify(b)) return a;
  if (typeof a === "object" && typeof b === "object" && a && b && !("[]" in a) && !("[]" in b)) {
    const out: Record<string, unknown> = { ...(a as object) };
    for (const [k, x] of Object.entries(b)) out[k] = k in out ? merge(out[k], x) : x;
    return out;
  }
  const parts = new Set([...String(typeof a === "string" ? a : JSON.stringify(a)).split("|"), ...String(typeof b === "string" ? b : JSON.stringify(b)).split("|")]);
  return [...parts].sort().join("|");
}

async function check(name: string, data: unknown) {
  const file = new URL(`${name}.json`, dir);
  const body = JSON.stringify({ data }, null, 2) + "\n";
  let existing: string | null = null;
  try {
    existing = await Deno.readTextFile(file);
  } catch (e) {
    if (!(e instanceof Deno.errors.NotFound)) throw e;
  }
  if (UPDATE || existing === null) {
    await Deno.mkdir(dir, { recursive: true });
    await Deno.writeTextFile(file, body);
    return;
  }
  assertEquals(
    shape(JSON.parse(body)),
    shape(JSON.parse(existing)),
    `La respuesta de «${name}» ha cambiado de forma. Si es a propósito, regenera los ficheros (ver la cabecera de este test) y ` +
      `pasa los tests de las apps: ellas dirán si siguen entendiéndola.`,
  );
}

// ── Datos realistas ──────────────────────────────────────────────────────────

const master = await importMasterKey(btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))));
const store = new MemoryStore();
const at = (userId: string, today: string): Ctx => ({ userId, today, store, master });
// deno-lint-ignore no-explicit-any
const call = (ctx: Ctx, action: string, params: Record<string, unknown> = {}) => handle({ action, params }, ctx) as Promise<any>;

const NOW = "2026-11-24";
const creation = at("ana", "2026-10-01"); // los fijos y metas se crean antes, para que se apunten solos y haya retrasos
const now = at("ana", NOW);

async function seed() {
  const bbva = await call(creation, "accounts.create", { name: "BBVA", type: "banco", openingBalance: 7500000 });
  await call(creation, "accounts.create", { name: "Efectivo", type: "efectivo", openingBalance: 12000 });
  await call(now, "transactions.create", { accountId: bbva.id, amount: -4890, concept: "Mercadona", category: "comida", date: NOW, source: "atajo", note: "Compra semanal" });
  await call(now, "transactions.create", { accountId: bbva.id, amount: -5500, concept: "Gasolina", category: "transporte", date: "2026-11-20" });
  await call(now, "transactions.create", { accountId: bbva.id, amount: -9716, concept: "Cine", category: "ocio", date: "2026-10-15" });
  await call(now, "transactions.create", { accountId: null, amount: 3000, concept: "Bizum", category: "otros", date: "2026-11-10", source: "manual" });
  await call(creation, "recurring.create", { kind: "income", amount: 185000, concept: "Nómina", category: "ingresos", accountId: bbva.id, day: 1 });
  await call(creation, "recurring.create", { kind: "expense", amount: 1299, concept: "Netflix", category: "suscripciones", accountId: bbva.id, day: 25 });
  await call(creation, "recurring.create", { kind: "expense", amount: 9900, concept: "Seguro", category: "hogar", day: 10, frequencyUnit: "year" });
  await call(creation, "recurring.create", { kind: "loan", amount: 64000, concept: "Hipoteca", category: "hogar", accountId: bbva.id, day: 5, pending: 9840000, endMonth: "2041-06", principal: 15870968 });
  await call(creation, "recurring.create", { kind: "loan", amount: 15000, concept: "Coche", category: "transporte", day: 15, pending: 300000 });
  await call(at("ana", "2026-06-24"), "goals.create", { name: "Viaje a Japón", target: 300000, saved: 90000, months: 6 }); // con retraso
  await call(now, "goals.create", { name: "PS5", target: 55000, saved: 32000, months: 3 });
  await call(now, "goals.create", { name: "Móvil", target: 30000, saved: 30000, months: 2 }); // conseguida
}

await seed();

// ── Respuestas que usan las apps ─────────────────────────────────────────────

Deno.test("contrato: respuestas de la API con datos", async () => {
  await check("home", await call(now, "home"));
  await check("accounts.list", await call(now, "accounts.list"));
  const list = await call(now, "transactions.list", { period: "month" });
  await check("transactions.list", list);
  await check("transactions.get", await call(now, "transactions.get", { id: list.items.find((t: { note?: string }) => t.note)!.id }));
  await check("recurring.list", await call(now, "recurring.list"));
  await check("goals.list", await call(now, "goals.list"));
  await check("goals.preview", await call(now, "goals.preview", { target: 55000, saved: 0, months: 6 }));
  await check("report.month", await call(now, "report.month", { month: "2026-11" }));
  // La clave de prueba se enmascara: el fichero va al repositorio y no debe parecer una clave real.
  const created = await call(now, "shortcut.create");
  await check("shortcut.create", { ...created, token: `bal_${"x".repeat(43)}`, hint: "xxxx" });
  await check("shortcut.status", await call(now, "shortcut.status"));
});

Deno.test("contrato: respuestas de la API para una cuenta nueva (sin datos)", async () => {
  const empty = at("nuevo", NOW);
  await check("home.empty", await call(empty, "home"));
  await check("accounts.list.empty", await call(empty, "accounts.list"));
  await check("transactions.list.empty", await call(empty, "transactions.list", { period: "month" }));
  await check("recurring.list.empty", await call(empty, "recurring.list"));
  await check("goals.list.empty", await call(empty, "goals.list"));
  await check("shortcut.status.empty", await call(empty, "shortcut.status"));
});

Deno.test("los datos de prueba cubren los casos que cambian la forma", async () => {
  const home = await call(now, "home");
  assert(home.topGoal && home.nextPayment, "debe haber meta y próximo pago");
  const tx = (await call(now, "transactions.list", { period: "month" })).items;
  assert(tx.some((t: { note?: string }) => t.note) && tx.some((t: { note?: string }) => !t.note), "movimientos con y sin nota");
  assert(tx.some((t: { source: string }) => t.source === "fijo") && tx.some((t: { source: string }) => t.source === "atajo"), "origen fijo y atajo");
  assert(tx.some((t: { accountId: string | null }) => t.accountId === null), "movimiento sin cuenta");
  const fixed = await call(now, "recurring.list");
  assert(fixed.some((r: { loan?: { principal?: number } }) => r.loan?.principal) && fixed.some((r: { loan?: { principal?: number } }) => r.loan && !r.loan.principal), "préstamos con y sin importe inicial");
  assert(fixed.some((r: { loan?: { endMonth?: string } }) => r.loan?.endMonth) && fixed.some((r: { loan?: { endMonth?: string } }) => r.loan && !r.loan.endMonth), "préstamos con y sin fecha de fin");
  const goals = (await call(now, "goals.list")).goals;
  assert(goals.some((g: { behind: boolean }) => g.behind) && goals.some((g: { done: boolean }) => g.done), "meta con retraso y meta conseguida");
});

Deno.test("shape() detecta campos que faltan, sobran o cambian de tipo", () => {
  const base = { a: 1, b: { c: "x" }, l: [{ k: 1 }, { k: 2, z: null }] };
  assertEquals(shape(base), shape({ a: 9, b: { c: "y" }, l: [{ k: 5, z: null }, { k: 6 }] }));
  const differs = (other: unknown) => JSON.stringify(shape(base)) !== JSON.stringify(shape(other));
  assert(differs({ b: base.b, l: base.l }), "falta a");
  assert(differs({ ...base, extra: 1 }), "sobra extra");
  assert(differs({ ...base, a: "1" }), "a cambia de tipo");
  assert(differs({ ...base, b: { c: 1 } }), "b.c cambia de tipo");
});
