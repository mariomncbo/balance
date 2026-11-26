import { assert, assertEquals, assertRejects, assertStringIncludes } from "jsr:@std/assert@1.0.13";
import { ask, askChip, type ChatData, type ChatReply, CHIPS, detectPeriod } from "../_shared/chat.ts";
import type { Goal, Recurring, Transaction } from "../_shared/domain.ts";
import { importMasterKey } from "../_shared/crypto.ts";
import { ApiError, type Ctx, handle } from "../api/handler.ts";
import { MemoryStore } from "./memory_store.ts";

const today = "2026-11-26";
const tx = (id: string, accountId: string, amount: number, concept: string, category: Transaction["category"], date: string, extra: Partial<Transaction> = {}): Transaction =>
  ({ id, accountId, amount, concept, category, date, source: "manual", ...extra });

const data: ChatData = {
  today,
  accounts: [
    { id: "a1", name: "BBVA", type: "banco", openingBalance: 100000 },
    { id: "a2", name: "Efectivo", type: "efectivo", openingBalance: 5000 },
  ],
  txs: [
    tx("t1", "a1", 185000, "Nómina", "ingresos", "2026-11-01"),
    tx("t2", "a1", -4890, "Mercadona", "comida", "2026-11-26"),
    tx("t3", "a1", -2000, "Mercadona", "comida", "2026-11-25"),
    tx("t4", "a1", -6000, "Repsol", "transporte", "2026-11-10"),
    tx("t5", "a1", -1299, "Netflix", "suscripciones", "2026-11-05"),
    tx("t6", "a1", -10000, "Mercadona", "comida", "2026-10-15"),
    tx("t7", "a1", 185000, "Nómina", "ingresos", "2026-10-01"),
    // Transferencia a una meta: no es gasto ni ingreso.
    tx("t8", "a1", -5000, "Aportación a PS5", "otros", "2026-11-20", { transfer: { id: "tr1" } }),
    tx("t9", "a2", 5000, "Aportación a PS5", "otros", "2026-11-20", { transfer: { id: "tr1" } }),
  ],
  recurring: [
    { id: "r1", kind: "expense", amount: 1299, concept: "Netflix", category: "suscripciones", accountId: "a1", day: 29, frequency: { unit: "month", every: 1 }, startDate: "2026-01-29", lastPosted: "2026-10-29" },
    { id: "r2", kind: "loan", amount: 64000, concept: "Hipoteca", category: "hogar", accountId: "a1", day: 5, frequency: { unit: "month", every: 1 }, startDate: "2016-06-05", lastPosted: "2026-11-05", loan: { pending: 9840000, endMonth: "2041-06" } },
    { id: "r3", kind: "income", amount: 185000, concept: "Nómina", category: "ingresos", accountId: "a1", day: 1, frequency: { unit: "month", every: 1 }, startDate: "2026-01-01", lastPosted: "2026-11-01" },
  ] as Recurring[],
  goals: [{ id: "g1", name: "PS5", target: 55000, saved: 32000, deadline: "2027-02-26", plannedMonthly: 7700 }] as Goal[],
};

const text = (r: ChatReply) => (r.kind === "ai" ? "" : r.text);

// Frase → lo que tiene que contener la respuesta (sin IA).
const ANSWERS: [string, string][] = [
  ["¿Cuánto gasté este mes?", "Este mes has gastado 141,89 €"],
  ["cuanto llevo gastado", "Este mes has gastado 141,89 €"],
  ["¿Cuánto gasté este mes?", "41,89 € más que en octubre"],
  ["cuánto he gastado hoy", "Hoy has gastado 48,90 €"],
  ["gastos de ayer", "Ayer has gastado 20 €"],
  ["cuanto gaste en octubre", "En octubre has gastado 100 €"],
  ["gasto del mes pasado", "En octubre has gastado 100 €"],
  ["¿En qué gasto más?", "Comida: 68,90 €"],
  ["cuáles son mis mayores gastos", "Comida"],
  ["¿Cuánto llevo gastado en comida este mes?", "has gastado 68,90 € en comida"],
  ["cuanto gasto en gasolina", "en transporte"],
  ["¿cuánto gasté en Mercadona?", "has gastado 68,90 € en Mercadona (2 veces)"],
  ["dónde gasto más", "Mercadona: 68,90 €"],
  ["cuánto dinero tengo", "En total tienes"],
  ["mi saldo", "En total tienes"],
  ["cuánto tengo en BBVA", "En BBVA tienes"],
  ["¿Voy bien con mis metas?", "PS5: 58 %"],
  ["cómo va la meta PS5", "PS5"],
  ["¿Qué pagos me quedan este mes?", "Te queda 1 pago este mes"],
  ["que me queda por pagar", "Netflix"],
  ["cuál es mi próximo pago", "Tu próximo pago es Netflix"],
  ["cuánto me queda de hipoteca", "Hipoteca: te quedan 98.400 € por pagar"],
  ["cuánto he ingresado este mes", "Este mes has ingresado 1.850 €"],
  ["compara con el mes pasado", "más que en octubre"],
  ["últimos movimientos", "Tus últimos movimientos"],
  ["hola", "¡Hola!"],
  ["gracias", "¡De nada!"],
  ["¿En qué me puedes ayudar?", "Puedo contestarte"],
  ["¿cómo puedo configurar el atajo?", "guía del Atajo"],
  ["quiero cambiar a modo oscuro", "Ajustes"],
];

Deno.test("chat: responde sin IA las preguntas frecuentes", () => {
  for (const [q, expected] of ANSWERS) {
    const r = ask(q, data);
    assertEquals(r.kind, "answer", `«${q}» debería contestarse sin IA`);
    assertStringIncludes(text(r), expected, `«${q}»`);
  }
});

// Formas distintas de preguntar lo mismo, erratas y preguntas menos habituales.
const MORE: [string, string][] = [
  ["En qué puedes ayudarme", "Puedo contestarte"],
  ["qué puedes hacer", "Puedo contestarte"],
  ["para qué sirves", "Puedo contestarte"],
  ["cuánto me he gastado", "Este mes has gastado 141,89 €"],
  ["cuánto llevo este mes", "Este mes has gastado"],
  ["gstado este mes", "Este mes has gastado"],
  ["cuanto e gastado", "Este mes has gastado"],
  ["cuánta pasta tengo", "En total tienes"],
  ["cuánto hay en el banco", "En total tienes"],
  ["saldo bbva", "En BBVA tienes"],
  ["qué tal voy este mes", "te sobran"],
  ["dame un resumen", "te sobran"],
  ["cuánto he ahorrado este mes", "te sobran"],
  ["mercadona", "en Mercadona"],
  ["cuánto en netflix", "en Netflix"],
  ["cuánto he gastado en el super", "en comida"],
  ["cuáles son mis gastos fijos", "Tus fijos:"],
  ["qué suscripciones tengo", "Tus suscripciones:"],
  ["cuándo me cobran netflix", "El próximo cargo de Netflix es el 29 nov"],
  ["cuándo cobro la nómina", "El próximo ingreso de Nómina es el 1 dic"],
  ["qué día me pasan la hipoteca", "El próximo cargo de Hipoteca es el 5 dic"],
  ["qué me toca pagar", "Te queda 1 pago"],
  ["facturas pendientes", "Te queda 1 pago"],
  ["cuánto debo", "Hipoteca"],
  ["cómo acabaré el mes", "acabarías el mes"],
  ["me llega para fin de mes", "acabarías el mes"],
  ["cuánto puedo gastar al día", "al día hasta fin de mes"],
  ["cuál ha sido mi mayor gasto", "Tu mayor gasto este mes fue Repsol: 60 €"],
  ["media de gasto diario", "de media"],
  ["cuántos movimientos tengo este mes", "movimientos"],
  ["mis últimos gastos", "Tus últimos movimientos"],
  ["qué he comprado hoy", "Hoy has gastado 48,90 €"],
  ["cuánto he cobrado", "Este mes has ingresado 1.850 €"],
  ["voy mejor o peor que el mes pasado", "que en octubre"],
  ["en qué se me va el dinero", "Lo que más gastas"],
  ["qué es lo que más gasto", "Lo que más gastas"],
  ["cuánto tengo que ahorrar al mes", "PS5"],
  ["cuánto me falta para la ps5", "PS5"],
  ["cuántas cuentas tengo", "Tienes 2 cuentas"],
];

Deno.test("chat: entiende muchas formas de preguntar", () => {
  for (const [q, expected] of MORE) {
    const r = ask(q, data);
    assertEquals(r.kind, "answer", `«${q}» debería contestarse sin IA`);
    assertStringIncludes(text(r), expected, `«${q}»`);
  }
});

Deno.test("chat: las transferencias a metas no cuentan como gasto", () => {
  // 141,89 € no incluye los 50 € de la aportación.
  assertStringIncludes(text(ask("cuánto gasté este mes", data)), "141,89 €");
});

Deno.test("chat: lleva a la pantalla que toca", () => {
  const r = ask("¿cómo configuro el atajo?", data);
  assert(r.kind === "answer" && r.route === "shortcut");
  const s = ask("abre los ajustes", data);
  assert(s.kind === "answer" && s.route === "settings");
});

Deno.test("chat: lo que necesita razonar o no es de finanzas va a la IA", () => {
  for (const q of [
    "¿por qué gasto tanto en comida?",
    "dame consejos para ahorrar",
    "¿cómo puedo ahorrar más?",
    "¿debería cancelar Netflix?",
    "¿cuál es la capital de Francia?",
    "quiero ahorrar para un viaje en verano",
    "cuéntame un chiste",
    "estoy gastando mucho",
    "analiza mis gastos",
  ]) {
    assertEquals(ask(q, data).kind, "ai", `«${q}» debería ir a la IA`);
  }
});

Deno.test("chat: propone un gasto con una frase sencilla, sin guardarlo", () => {
  const r = ask("12 € en Mercadona", data);
  assert(r.kind === "action" && r.action === "movement");
  assertEquals(r.proposal, { accountId: "a1", amount: -1200, concept: "Mercadona", category: "comida", date: today });
  assertStringIncludes(r.text, "¿Apunto un gasto de 12 €");

  const cine = ask("gasté 8,50 euros en el cine ayer", data);
  assert(cine.kind === "action" && cine.action === "movement");
  assertEquals([cine.proposal.amount, cine.proposal.concept, cine.proposal.category, cine.proposal.date], [-850, "Cine", "ocio", "2026-11-25"]);

  const cobro = ask("cobré 300 € de la empresa", data);
  assert(cobro.kind === "action" && cobro.action === "movement");
  assertEquals([cobro.proposal.amount, cobro.proposal.category], [30000, "ingresos"]);

  // Una pregunta con importe no es un apunte.
  assertEquals(ask("¿cuánto gasté en 2 días?", data).kind === "action", false);
  assertEquals(ask("¿qué pasó con los 12 € en Mercadona?", data).kind === "action", false);
});

Deno.test("chat: sin cuentas no propone gastos", () => {
  const r = ask("12 € en Mercadona", { ...data, accounts: [] });
  assertEquals(r.kind, "answer");
  assertStringIncludes(text(r), "primero necesitas una cuenta");
});

Deno.test("chat: propone una meta con una frase sencilla", () => {
  const r = ask("crea meta PS5 de 550 € en 6 meses", data);
  assert(r.kind === "action" && r.action === "goal");
  assertEquals(r.proposal, { name: "PS5", target: 55000, durationAmount: 6, durationUnit: "month" });
  assertStringIncludes(r.text, "¿Creo la meta «PS5» de 550 €");

  const roma = ask("quiero crear una meta Viaje a Roma de 1.200 euros en 1 año", data);
  assert(roma.kind === "action" && roma.action === "goal");
  assertEquals(roma.proposal, { name: "Viaje a Roma", target: 120000, durationAmount: 1, durationUnit: "year" });
});

Deno.test("chat: los chips siempre se contestan sin IA", () => {
  for (const c of CHIPS) assertEquals(askChip(c, data).kind, "answer", c);
  const empty: ChatData = { today, accounts: [], txs: [], recurring: [], goals: [] };
  for (const c of CHIPS) assertEquals(askChip(c, empty).kind, "answer", `${c} sin datos`);
  assertStringIncludes(text(askChip("spent_month", empty)), "no has gastado nada");
  assertStringIncludes(text(askChip("goals_status", empty)), "Todavía no tienes metas");
});

Deno.test("chat: periodos", () => {
  assertEquals(detectPeriod("cuanto gaste hoy", today).from, today);
  assertEquals(detectPeriod("cuanto gaste en diciembre", today).from, "2025-12-01");
  assertEquals(detectPeriod("cuanto gaste en noviembre", today).label, "Este mes");
  assertEquals(detectPeriod("esta semana", today).from, "2026-11-20");
});

// ── A través de la API ──
const master = await importMasterKey(btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))));
const store = new MemoryStore();
const u: Ctx = { userId: "chat", today, store, master };
// deno-lint-ignore no-explicit-any
const call = (action: string, params: Record<string, unknown> = {}) => handle({ action, params }, u) as Promise<any>;

Deno.test("chat.ask: usa los datos del usuario y no guarda nada", async () => {
  const bbva = await call("accounts.create", { name: "BBVA", type: "banco", openingBalance: 100000 });
  await call("transactions.create", { accountId: bbva.id, amount: -4890, concept: "Mercadona", category: "comida", date: today });
  const before = (await store.list("transactions", "chat")).length;

  assertStringIncludes((await call("chat.ask", { chip: "spent_month" })).text, "48,90 €");
  assertStringIncludes((await call("chat.ask", { text: "cuánto tengo en BBVA" })).text, "En BBVA tienes 951,10 €");
  assertEquals((await call("chat.ask", { text: "dame un consejo" })).kind, "ai");
  const proposal = await call("chat.ask", { text: "12 € en Mercadona" });
  assertEquals([proposal.kind, proposal.proposal.accountId], ["action", bbva.id]);

  assertEquals((await store.list("transactions", "chat")).length, before, "una propuesta no guarda nada");
});

Deno.test("chat.ask: valida la entrada", async () => {
  await assertRejects(() => call("chat.ask", {}), ApiError);
  await assertRejects(() => call("chat.ask", { text: "x".repeat(501) }), ApiError);
  await assertRejects(() => call("chat.ask", { chip: "no-existe" }), ApiError);
});
