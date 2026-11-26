import { assert, assertEquals, assertRejects } from "jsr:@std/assert@1.0.13";
import { AI_UNAVAILABLE, AiError, type AiProvider, type AiRequest, DEFAULT_GEMINI_MODELS, gemini, geminiModels, withRetry } from "../_shared/ai.ts";
import { importMasterKey } from "../_shared/crypto.ts";
import { ApiError, type Ctx, handle, parseScan } from "../api/handler.ts";
import { MemoryStore } from "./memory_store.ts";

// ── Reintento: una sola vez, tras 5 s ──

Deno.test("reintento: un fallo y luego éxito → espera 5 s y devuelve la respuesta", async () => {
  const waits: number[] = [];
  let calls = 0;
  const out = await withRetry(() => {
    calls++;
    return calls === 1 ? Promise.reject(new AiError(503, true, "caído")) : Promise.resolve("ok");
  }, { sleep: (ms) => (waits.push(ms), Promise.resolve()) });
  assertEquals([out, calls, waits], ["ok", 2, [5000]]);
});

Deno.test("reintento: dos fallos seguidos → lanza el error (solo 2 llamadas)", async () => {
  let calls = 0;
  await assertRejects(
    () => withRetry(() => (calls++, Promise.reject(new AiError(500, true, "caído"))), { sleep: () => Promise.resolve() }),
    AiError,
  );
  assertEquals(calls, 2);
});

Deno.test("reintento: errores que no se arreglan esperando (400/401/403) no se reintentan", async () => {
  for (const status of [400, 401, 403]) {
    let calls = 0;
    const waits: number[] = [];
    await assertRejects(() => withRetry(() => (calls++, Promise.reject(new AiError(status, false, "mal"))), { sleep: (ms) => (waits.push(ms), Promise.resolve()) }), AiError);
    assertEquals([calls, waits.length], [1, 0], `status ${status}`);
  }
});

// ── Adaptador de Gemini (con fetch simulado) ──

const REQ: AiRequest = { parts: [{ image: "AAAA", mime: "image/jpeg" }, { text: "lee" }], schema: { type: "OBJECT" } };
const reply = (status: number, body: unknown = {}) => Promise.resolve(new Response(JSON.stringify(body), { status }));
const okBody = (json: unknown) => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(json) }] } }] });

Deno.test("gemini: manda la imagen y la clave por cabecera y devuelve el JSON", async () => {
  let seen: { url: string; key: string | null; body: { contents: { parts: Record<string, unknown>[] }[] } } | null = null;
  const ai = gemini({
    apiKey: "k-secreta",
    models: ["m1"],
    fetch: ((url: string, init: RequestInit) => {
      seen = { url, key: new Headers(init.headers).get("x-goog-api-key"), body: JSON.parse(init.body as string) };
      return reply(200, okBody({ total: 12.5 }));
    }) as unknown as typeof fetch,
  });
  assertEquals(await ai.generate(REQ), { total: 12.5 });
  assert(seen!.url.includes("/models/m1:generateContent") && !seen!.url.includes("k-secreta"), "la clave no va en la URL");
  assertEquals(seen!.key, "k-secreta");
  assertEquals(seen!.body.contents[0].parts[0], { inline_data: { mime_type: "image/jpeg", data: "AAAA" } });
});

Deno.test("gemini: 5xx y 429 se marcan como reintentables; 400/401/403 no", async () => {
  for (const [status, retryable] of [[500, true], [503, true], [429, true], [400, false], [401, false], [403, false]] as const) {
    const ai = gemini({ apiKey: "k", models: ["m1"], fetch: (() => reply(status)) as unknown as typeof fetch });
    const e = await ai.generate(REQ).then(() => null, (x) => x as AiError);
    assert(e instanceof AiError, `${status}`);
    assertEquals([e.status, e.retryable], [status, retryable]);
  }
});

Deno.test("gemini: fallo de red o respuesta vacía/no válida → reintentable", async () => {
  const net = gemini({ apiKey: "k", models: ["m1"], fetch: (() => Promise.reject(new TypeError("red"))) as unknown as typeof fetch });
  assertEquals((await net.generate(REQ).catch((e) => e) as AiError).retryable, true);
  const empty = gemini({ apiKey: "k", models: ["m1"], fetch: (() => reply(200, { candidates: [] })) as unknown as typeof fetch });
  assertEquals((await empty.generate(REQ).catch((e) => e) as AiError).retryable, true);
  const bad = gemini({ apiKey: "k", models: ["m1"], fetch: (() => reply(200, { candidates: [{ content: { parts: [{ text: "no es json" }] } }] })) as unknown as typeof fetch });
  assertEquals((await bad.generate(REQ).catch((e) => e) as AiError).retryable, true);
});

Deno.test("gemini: si un modelo no existe (404) prueba el siguiente", async () => {
  const tried: string[] = [];
  const ai = gemini({
    apiKey: "k",
    models: ["viejo", "nuevo"],
    fetch: ((url: string) => {
      tried.push(url.match(/models\/([^:]+):/)![1]);
      return url.includes("viejo") ? reply(404) : reply(200, okBody({ ok: true }));
    }) as unknown as typeof fetch,
  });
  assertEquals(await ai.generate(REQ), { ok: true });
  assertEquals(tried, ["viejo", "nuevo"]);
  const none = gemini({ apiKey: "k", models: ["a", "b"], fetch: (() => reply(404)) as unknown as typeof fetch });
  assertEquals((await none.generate(REQ).catch((e) => e) as AiError).status, 404);
});

Deno.test("gemini: modelos por defecto o por secreto", () => {
  assertEquals(geminiModels(undefined), DEFAULT_GEMINI_MODELS);
  assertEquals(geminiModels(" gemini-x , gemini-y "), ["gemini-x", "gemini-y"]);
  assertEquals(geminiModels("mal modelo!"), DEFAULT_GEMINI_MODELS);
});

// ── parseScan: no se fía de lo que dice el modelo ──

Deno.test("parseScan: valida importe, fecha y categoría", () => {
  const today = "2026-11-26";
  const good = { is_receipt: true, merchant: "  Mercadona   Madrid ", total: 23.45, date: "2026-11-24", category: "comida" };
  assertEquals(parseScan(good, "a1", today), { accountId: "a1", amount: -2345, concept: "Mercadona Madrid", category: "comida", date: "2026-11-24" });
  assertEquals(parseScan({ ...good, date: "2027-01-01" }, "a1", today)!.date, today, "fecha futura → hoy");
  assertEquals(parseScan({ ...good, date: "2020-01-01" }, "a1", today)!.date, today, "fecha muy antigua → hoy");
  assertEquals(parseScan({ ...good, date: "" }, "a1", today)!.date, today);
  assertEquals(parseScan({ ...good, category: "ingresos" }, "a1", today)!.category, "otros", "un ticket nunca es un ingreso");
  assertEquals(parseScan({ ...good, category: "inventada" }, "a1", today)!.category, "otros");
  assertEquals(parseScan({ ...good, merchant: "" }, "a1", today)!.concept, "Ticket");
  assertEquals(parseScan({ ...good, total: "7,5" }, "a1", today), null, "importe como texto con coma: no se acepta");
  for (const bad of [{ ...good, is_receipt: false }, { ...good, total: 0 }, { ...good, total: -5 }, { ...good, total: 9e9 }, { ...good, total: NaN }, null, "texto", 5]) {
    assertEquals(parseScan(bad, "a1", today), null);
  }
});

// ── Acción scan.receipt ──

const master = await importMasterKey(btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))));
const IMG = "A".repeat(200);

function setup(ai: AiProvider | undefined, user = "scan-u") {
  const store = new MemoryStore();
  const waits: number[] = [];
  const ctx: Ctx = { userId: user, today: "2026-11-26", store, master, ai, aiRetryWaitMs: 1 };
  // deno-lint-ignore no-explicit-any
  const call = (params: Record<string, unknown>) => handle({ action: "scan.receipt", params }, ctx) as Promise<any>;
  // deno-lint-ignore no-explicit-any
  const api = (action: string, params: Record<string, unknown> = {}) => handle({ action, params }, ctx) as Promise<any>;
  return { store, ctx, call, api, waits };
}

const receipt = { is_receipt: true, merchant: "Repsol", total: 40, date: "2026-11-25", category: "transporte" };

Deno.test("scan.receipt: propone el gasto y no guarda nada", async () => {
  const { call, api, store } = setup({ generate: () => Promise.resolve(receipt) });
  const acc = await api("accounts.create", { name: "BBVA", type: "banco", openingBalance: 0 });
  const r = await call({ image: IMG });
  assertEquals(r.proposal, { accountId: acc.id, amount: -4000, concept: "Repsol", category: "transporte", date: "2026-11-25" });
  assertEquals(r.remaining, 19);
  assertEquals((await store.list("transactions", "scan-u")).length, 0, "una propuesta no guarda nada");
});

Deno.test("scan.receipt: un fallo del proveedor se reintenta una vez y funciona", async () => {
  let calls = 0;
  const { call, api } = setup({ generate: () => (calls++ === 0 ? Promise.reject(new AiError(503, true, "caído")) : Promise.resolve(receipt)) });
  await api("accounts.create", { name: "BBVA", type: "banco", openingBalance: 0 });
  assertEquals((await call({ image: IMG })).proposal.concept, "Repsol");
  assertEquals(calls, 2);
});

Deno.test("scan.receipt: dos fallos → «Error, inténtalo más tarde» y no gasta cupo", async () => {
  let calls = 0;
  const { call, api, store } = setup({ generate: () => (calls++, Promise.reject(new AiError(500, true, "caído"))) });
  await api("accounts.create", { name: "BBVA", type: "banco", openingBalance: 0 });
  const e = await call({ image: IMG }).catch((x) => x) as ApiError;
  assertEquals([e.status, e.message, calls], [503, AI_UNAVAILABLE, 2]);
  assertEquals(store.aiUses.get("scan-u:scan:2026-11-26"), 0, "el cupo se devuelve");
});

Deno.test("scan.receipt: un error de clave (401/403) no se reintenta", async () => {
  let calls = 0;
  const { call, api } = setup({ generate: () => (calls++, Promise.reject(new AiError(403, false, "clave"))) });
  await api("accounts.create", { name: "BBVA", type: "banco", openingBalance: 0 });
  const e = await call({ image: IMG }).catch((x) => x) as ApiError;
  assertEquals([e.status, e.message, calls], [503, AI_UNAVAILABLE, 1]);
});

Deno.test("scan.receipt: imagen que no es un ticket → 422 y no gasta cupo", async () => {
  const { call, api, store } = setup({ generate: () => Promise.resolve({ ...receipt, is_receipt: false }) });
  await api("accounts.create", { name: "BBVA", type: "banco", openingBalance: 0 });
  const e = await call({ image: IMG }).catch((x) => x) as ApiError;
  assertEquals(e.status, 422);
  assertEquals(store.aiUses.get("scan-u:scan:2026-11-26"), 0);
});

Deno.test("scan.receipt: límite diario de 20", async () => {
  const { call, api } = setup({ generate: () => Promise.resolve(receipt) });
  await api("accounts.create", { name: "BBVA", type: "banco", openingBalance: 0 });
  for (let i = 0; i < 20; i++) await call({ image: IMG });
  const e = await call({ image: IMG }).catch((x) => x) as ApiError;
  assertEquals(e.status, 429);
});

Deno.test("scan.receipt: valida la imagen, exige una cuenta y que haya IA", async () => {
  const { call, api } = setup({ generate: () => Promise.resolve(receipt) });
  assertEquals((await call({ image: IMG }).catch((x) => x) as ApiError).status, 409, "sin cuentas");
  await api("accounts.create", { name: "BBVA", type: "banco", openingBalance: 0 });
  for (const bad of [{}, { image: "corto" }, { image: "!".repeat(200) }, { image: "A".repeat(8_000_001) }, { image: IMG, mime: "application/pdf" }]) {
    await assertRejects(() => call(bad), ApiError);
  }
  const noAi = setup(undefined, "sin-ia");
  await noAi.api("accounts.create", { name: "BBVA", type: "banco", openingBalance: 0 });
  assertEquals((await noAi.call({ image: IMG }).catch((x) => x) as ApiError).status, 503);
});
