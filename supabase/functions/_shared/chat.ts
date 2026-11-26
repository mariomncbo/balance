// Chatbot de Balance SIN IA: reconoce preguntas frecuentes por palabras clave y las responde con los datos del usuario.
// Pura (sin red ni base de datos). Si no reconoce la frase, devuelve { kind: "ai" } y será la IA quien conteste.
// Nada de lo que se pregunta o se responde se guarda ni se registra en ningún sitio.
import {
  type Account,
  addDays,
  addMonths,
  balances,
  CATEGORIES,
  type Category,
  DURATION_MAX,
  type DurationUnit,
  type Goal,
  goalPlan,
  monthOf,
  monthSummary,
  nextPayment,
  occurrences,
  parseDate,
  planNewGoal,
  type Recurring,
  spending,
  type Transaction,
} from "./domain.ts";
import { guessCategory, normalize, parseAmount, pickAccount } from "./shortcut.ts";

export interface ChatData {
  today: string;
  accounts: Account[];
  txs: Transaction[];
  recurring: Recurring[];
  goals: Goal[];
}

/** Pantalla a la que la app puede llevar al usuario desde una respuesta. */
export type ChatRoute = "shortcut" | "settings" | "goals" | "movements";

export type MovementProposal = { accountId: string; amount: number; concept: string; category: Category; date: string };
export type GoalProposal = { name: string; target: number; durationAmount: number; durationUnit: DurationUnit };

export type ChatReply =
  | { kind: "answer"; text: string; route?: ChatRoute }
  /** Propuesta que la app muestra con Confirmar / Descartar. Nada se guarda sin confirmar. */
  | { kind: "action"; text: string; action: "movement"; proposal: MovementProposal }
  | { kind: "action"; text: string; action: "goal"; proposal: GoalProposal }
  /** No se ha reconocido: la responderá la IA. */
  | { kind: "ai" };

/** Preguntas sugeridas (chips). Se resuelven siempre sin IA. */
export const CHIPS = ["help", "spent_month", "top_categories", "goals_status", "pending_payments"] as const;
export type Chip = (typeof CHIPS)[number];

// ───────────────────────── Formato ─────────────────────────

const euroFmt = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: "always" } as Intl.NumberFormatOptions);
export function eur(cents: number): string {
  const v = Math.abs(cents) / 100;
  const body = Number.isInteger(v) ? new Intl.NumberFormat("es-ES", { useGrouping: "always" } as Intl.NumberFormatOptions).format(v) : euroFmt.format(v);
  return `${cents < 0 ? "−" : ""}${body} €`;
}

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function dayLabel(date: string, today: string): string {
  if (date === today) return "hoy";
  if (date === addDays(today, -1)) return "ayer";
  const { m, day } = parseDate(date);
  return `${day} ${MONTHS_SHORT[m - 1]}`;
}

function monthName(month: string): string {
  return MONTHS[Number(month.slice(5, 7)) - 1];
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

// ───────────────────────── Periodos ─────────────────────────

type Period =
  | { kind: "day"; from: string; to: string; label: string }
  | { kind: "week"; from: string; to: string; label: string }
  | { kind: "month"; month: string; from: string; to: string; label: string };

function monthPeriod(month: string, label: string): Period {
  return { kind: "month", month, from: `${month}-01`, to: `${month}-31`, label };
}

/** Periodo al que se refiere la frase (por defecto, el mes en curso). `t` es el texto normalizado. */
export function detectPeriod(t: string, today: string): Period {
  if (/\bhoy\b/.test(t)) return { kind: "day", from: today, to: today, label: "Hoy" };
  if (/\bayer\b/.test(t)) {
    const d = addDays(today, -1);
    return { kind: "day", from: d, to: d, label: "Ayer" };
  }
  if (/\b(semana|ultimos 7 dias|siete dias)\b/.test(t)) return { kind: "week", from: addDays(today, -6), to: today, label: "En los últimos 7 días" };
  const current = monthOf(today);
  if (/\bmes (pasado|anterior)\b/.test(t) || /\bel pasado mes\b/.test(t)) {
    const m = addMonths(current, -1);
    return monthPeriod(m, `En ${monthName(m)}`);
  }
  for (let i = 0; i < 12; i++) {
    if (new RegExp(`\\b${MONTHS[i]}\\b`).test(t)) {
      const year = Number(current.slice(0, 4));
      const m = `${i + 1 > Number(current.slice(5, 7)) ? year - 1 : year}-${String(i + 1).padStart(2, "0")}`;
      return monthPeriod(m, m === current ? "Este mes" : `En ${MONTHS[i]}`);
    }
  }
  return monthPeriod(current, "Este mes");
}

const inPeriod = (t: Transaction, p: Period) => t.date >= p.from && t.date <= p.to;

// ───────────────────────── Respuestas ─────────────────────────

const answer = (text: string, route?: ChatRoute): ChatReply => ({ kind: "answer", text, ...(route ? { route } : {}) });

function expenses(d: ChatData) {
  return spending(d.txs).filter((t) => t.amount < 0);
}

function spent(d: ChatData, p: Period, income = false): ChatReply {
  const list = spending(d.txs).filter((t) => inPeriod(t, p) && (income ? t.amount > 0 : t.amount < 0));
  const total = Math.abs(list.reduce((s, t) => s + t.amount, 0));
  const verb = income ? "has ingresado" : "has gastado";
  if (list.length === 0) return answer(`${p.label} no ${income ? "has ingresado" : "has gastado"} nada.`);
  let text = `${p.label} ${verb} ${eur(total)} (${list.length} ${plural(list.length, "movimiento", "movimientos")}).`;
  if (p.kind === "month") {
    const prev = addMonths(p.month, -1);
    const prevTotal = Math.abs(
      spending(d.txs).filter((t) => monthOf(t.date) === prev && (income ? t.amount > 0 : t.amount < 0)).reduce((s, t) => s + t.amount, 0),
    );
    if (prevTotal > 0) {
      const diff = total - prevTotal;
      if (diff === 0) text += ` Igual que en ${monthName(prev)}.`;
      else text += ` Es ${eur(Math.abs(diff))} ${diff > 0 ? "más" : "menos"} que en ${monthName(prev)}.`;
    }
  }
  return answer(text);
}

function topCategories(d: ChatData, p: Period): ChatReply {
  const s = monthSummary(d.txs, d.recurring, p.kind === "month" ? p.month : monthOf(d.today), d.today);
  if (s.byCategory.length === 0) return answer("Todavía no has gastado nada este mes.");
  const lines = s.byCategory.slice(0, 3).map((c) => `• ${c.label}: ${eur(c.amount)} (${c.share} %)`);
  return answer(`Lo que más gastas ${p.kind === "month" && p.label !== "Este mes" ? p.label.toLowerCase() : "este mes"}:\n${lines.join("\n")}`);
}

const CATEGORY_WORDS: Record<Category, RegExp> = {
  comida: /\b(comida|comer|super|supermercado|restaurantes?|bares?|cenas?)\b/,
  hogar: /\b(hogar|casa|luz|agua|alquiler|internet)\b/,
  transporte: /\b(transporte|gasolina|coche|metro|bus|taxi|uber)\b/,
  ocio: /\b(ocio|cine|salir|diversion)\b/,
  salud: /\b(salud|farmacia|medico|gimnasio|gym)\b/,
  compras: /\b(compras|ropa|tiendas?)\b/,
  suscripciones: /\b(suscripciones?|netflix|spotify)\b/,
  ingresos: /\b(nomina)\b/,
  otros: /\b(otros)\b/,
};

function detectCategory(t: string): Category | null {
  for (const key of Object.keys(CATEGORY_WORDS) as Category[]) if (key !== "ingresos" && key !== "otros" && CATEGORY_WORDS[key].test(t)) return key;
  return null;
}

function categorySpend(d: ChatData, category: Category, p: Period): ChatReply {
  const list = spending(d.txs).filter((t) => t.amount < 0 && t.category === category && inPeriod(t, p));
  const total = Math.abs(list.reduce((s, t) => s + t.amount, 0));
  const label = CATEGORIES[category].toLowerCase();
  if (list.length === 0) return answer(`${p.label} no has gastado nada en ${label}.`);
  return answer(`${p.label} has gastado ${eur(total)} en ${label} (${list.length} ${plural(list.length, "movimiento", "movimientos")}).`);
}

/** Gasto en un comercio que ya aparece en los movimientos ("¿cuánto gasté en Mercadona?"). */
function merchantSpend(d: ChatData, t: string, p: Period): ChatReply | null {
  const found = expenses(d).find((x) => {
    const n = normalize(x.concept);
    return n.length >= 3 && new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(t);
  });
  if (!found) return null;
  const key = normalize(found.concept);
  const list = expenses(d).filter((x) => normalize(x.concept) === key && inPeriod(x, p));
  const total = -list.reduce((s, x) => s + x.amount, 0);
  if (list.length === 0) return answer(`${p.label} no has gastado nada en ${found.concept}.`);
  return answer(`${p.label} has gastado ${eur(total)} en ${found.concept} (${list.length} ${plural(list.length, "vez", "veces")}).`);
}

function topMerchants(d: ChatData, p: Period): ChatReply {
  const byMerchant = new Map<string, { label: string; total: number }>();
  for (const t of expenses(d).filter((x) => inPeriod(x, p))) {
    const key = normalize(t.concept) || t.concept;
    const e = byMerchant.get(key) ?? { label: t.concept, total: 0 };
    e.total += -t.amount;
    byMerchant.set(key, e);
  }
  const top = [...byMerchant.values()].sort((a, b) => b.total - a.total).slice(0, 3);
  if (top.length === 0) return answer(`${p.label} no has gastado nada.`);
  return answer(`Dónde más has gastado ${p.label.toLowerCase()}:\n${top.map((m) => `• ${m.label}: ${eur(m.total)}`).join("\n")}`);
}

function compareMonths(d: ChatData): ChatReply {
  const cur = monthOf(d.today);
  const prev = addMonths(cur, -1);
  const now = monthSummary(d.txs, d.recurring, cur, d.today);
  const before = monthSummary(d.txs, d.recurring, prev, d.today);
  if (before.expense === 0 && before.income === 0) return answer(`No tengo movimientos de ${monthName(prev)} para comparar.`);
  const diff = now.expense - before.expense;
  const spentLine = diff === 0
    ? `Gastas lo mismo que en ${monthName(prev)} (${eur(now.expense)}).`
    : `Este mes llevas ${eur(now.expense)} gastados: ${eur(Math.abs(diff))} ${diff > 0 ? "más" : "menos"} que en ${monthName(prev)} (${eur(before.expense)}).`;
  return answer(`${spentLine}\nIngresos: ${eur(now.income)} este mes y ${eur(before.income)} en ${monthName(prev)}.`);
}

function balanceTotal(d: ChatData): ChatReply {
  if (d.accounts.length === 0) return answer("Todavía no tienes ninguna cuenta. Añade una desde Principal para ver tu saldo.");
  const b = balances(d.accounts, d.txs);
  if (b.accounts.length === 1) return answer(`Tienes ${eur(b.total)} en ${b.accounts[0].name}.`);
  return answer(`En total tienes ${eur(b.total)}:\n${b.accounts.map((a) => `• ${a.name}: ${eur(a.balance)}`).join("\n")}`);
}

function balanceOf(d: ChatData, name: string): ChatReply {
  const b = balances(d.accounts, d.txs).accounts.find((a) => a.name === name)!;
  return answer(`En ${b.name} tienes ${eur(b.balance)}.`);
}

function goalsStatus(d: ChatData, only?: string): ChatReply {
  const plans = d.goals.map((g) => goalPlan(g, d.today)).filter((g) => !only || g.id === only);
  if (plans.length === 0) return answer("Todavía no tienes metas. Crea una desde Metas y te diré cuánto apartar al mes.", "goals");
  const lines = plans.map((g) => {
    if (g.done) return `• ${g.name}: ¡conseguida! (${eur(g.target)})`;
    const flag = g.behind ? " · vas con retraso" : "";
    const plan = g.short ? `aparta ${eur(g.monthly)} en total` : `aparta ${eur(g.monthly)} al mes`;
    return `• ${g.name}: ${g.progress} % (${eur(g.saved)} de ${eur(g.target)}) · ${plan}${flag}`;
  });
  const behind = plans.filter((g) => g.behind && !g.done).length;
  const head = plans.length === 1 ? "" : behind === 0 ? "Vas bien con tus metas.\n" : `Tienes ${behind} ${plural(behind, "meta", "metas")} con retraso.\n`;
  return answer(head + lines.join("\n"), "goals");
}

function pendingPayments(d: ChatData): ChatReply {
  const monthEnd = `${monthOf(d.today)}-31`;
  const items: { date: string; concept: string; amount: number }[] = [];
  for (const r of d.recurring) {
    if (r.kind === "income" || (r.loan && r.loan.pending <= 0)) continue;
    for (const date of occurrences(r, d.today, monthEnd)) items.push({ date, concept: r.concept, amount: r.amount });
  }
  items.sort((a, b) => a.date.localeCompare(b.date));
  if (items.length === 0) return answer("No te quedan pagos fijos este mes.");
  const total = items.reduce((s, i) => s + i.amount, 0);
  const lines = items.slice(0, 6).map((i) => `• ${dayLabel(i.date, d.today)}: ${i.concept} ${eur(i.amount)}`);
  const more = items.length > 6 ? `\n… y ${items.length - 6} más.` : "";
  return answer(`${plural(items.length, "Te queda", "Te quedan")} ${items.length} ${plural(items.length, "pago", "pagos")} este mes, ${eur(total)} en total:\n${lines.join("\n")}${more}`);
}

function nextPaymentAnswer(d: ChatData): ChatReply {
  const n = nextPayment(d.recurring, d.today);
  if (!n) return answer("No tienes pagos fijos a la vista.");
  return answer(`Tu próximo pago es ${n.recurring.concept}: ${eur(n.recurring.amount)}, ${dayLabel(n.date, d.today) === "hoy" ? "hoy" : `el ${dayLabel(n.date, d.today)}`}.`);
}

function nextOf(d: ChatData, r: Recurring): ChatReply {
  const n = nextPayment([{ ...r, kind: r.kind === "income" ? "expense" : r.kind }], d.today);
  if (!n) return answer(`${r.concept} no tiene más cobros a la vista.`);
  const when = dayLabel(n.date, d.today);
  return answer(`${r.kind === "income" ? "El próximo ingreso de" : "El próximo cargo de"} ${r.concept} es ${when === "hoy" || when === "ayer" ? when : `el ${when}`}: ${eur(r.amount)} (${freqLabel(r)}).`);
}

function loans(d: ChatData): ChatReply {
  const list = d.recurring.filter((r) => r.kind === "loan" && r.loan && r.loan.pending > 0);
  if (list.length === 0) return answer("No tienes préstamos apuntados.");
  return answer(list.map((r) => {
    const end = r.loan!.endMonth ? `, hasta ${monthName(r.loan!.endMonth)} de ${r.loan!.endMonth.slice(0, 4)}` : "";
    return `• ${r.concept}: te quedan ${eur(r.loan!.pending)} por pagar (${eur(r.amount)} cada cobro${end})`;
  }).join("\n"));
}

function lastMovements(d: ChatData): ChatReply {
  const list = [...d.txs].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).slice(0, 5);
  if (list.length === 0) return answer("Todavía no hay movimientos. Pulsa + para añadir el primero.");
  return answer(`Tus últimos movimientos:\n${list.map((t) => `• ${dayLabel(t.date, d.today)}: ${t.concept} ${eur(t.amount)}`).join("\n")}`, "movements");
}

const HELP = `Puedo contestarte sobre tu dinero:
• Cuánto has gastado o ingresado (hoy, ayer, esta semana, este mes, el mes pasado o un mes concreto)
• En qué gastas más, en qué comercios, tu mayor gasto y tu media diaria
• Cuánto gastas en algo concreto («cuánto gasto en comida», «en Mercadona»)
• Tu saldo, el de cada cuenta y cómo acabarás el mes
• Cuánto puedes gastar al día hasta fin de mes
• Tus gastos fijos, suscripciones, préstamos y lo que te queda por pagar
• Cómo van tus metas y cuánto ahorras este mes
• Apuntar un gasto («12 € en Mercadona») o crear una meta («crea meta PS5 de 550 € en 6 meses»)`;

// ───────────────────────── Acciones (propuestas) ─────────────────────────

const UNITS: [RegExp, DurationUnit][] = [[/^d[ií]as?$/i, "day"], [/^semanas?$/i, "week"], [/^mes(es)?$/i, "month"], [/^a[nñ]os?$/i, "year"]];

function goalProposal(text: string, today: string): ChatReply | null {
  const m = text.match(/\b(?:crea(?:r|me)?|a[nñ]ade|nueva|quiero(?: crear)?|apunta)\s+(?:una\s+)?meta\s+(?:de\s+|para\s+)?(.+?)\s+(?:de|por)\s+([\d.,]+\s*(?:€|euros?)?)\s+(?:en|a|para)\s+(\d{1,4})\s+(d[ií]as?|semanas?|mes(?:es)?|a[nñ]os?)\b/i);
  if (!m) return null;
  const name = m[1].replace(/\s+/g, " ").trim().slice(0, 60);
  const target = parseAmount(m[2]);
  const amount = Number(m[3]);
  const unit = UNITS.find(([re]) => re.test(m[4]))?.[1];
  if (!name || !target || !unit || amount < 1 || amount > DURATION_MAX[unit]) return null;
  const plan = planNewGoal(target, 0, amount, unit, today);
  const label = { day: plural(amount, "día", "días"), week: plural(amount, "semana", "semanas"), month: plural(amount, "mes", "meses"), year: plural(amount, "año", "años") }[unit];
  const how = plan.short ? `aparta ${eur(plan.monthly)} en total` : `unos ${eur(plan.monthly)} al mes`;
  return {
    kind: "action",
    action: "goal",
    text: `¿Creo la meta «${name}» de ${eur(target)} en ${amount} ${label}? Tendrías que apartar ${how}.`,
    proposal: { name, target, durationAmount: amount, durationUnit: unit },
  };
}

/** Sobre el texto normalizado (sin acentos): en JavaScript `\\b` no trata "é" como letra. */
const INCOME_VERB = /\b(ingrese|ingreso|ingresado|cobre|cobro|cobrado|me (?:han )?(?:pagado|ingresado|transferido)|recibi|he recibido|nomina)\b/;

function movementProposal(text: string, d: ChatData): ChatReply | null {
  const m = text.match(/([\d][\d.,]*)\s*(?:€|euros?|eur)?\s+(?:en|de|a|para|por)\s+(?:el |la |los |las |un |una )?(.{2,80}?)\s*[.!?]*$/i);
  if (!m) return null;
  // "cuánto/qué/cuál…" es una pregunta, no un apunte.
  const q = normalize(text);
  if (/^(cual|que|donde|como|por que)\b/.test(q) || /\b(cuanto|cuanta|cuantos|cuantas)\b/.test(q)) return null;
  const cents = parseAmount(m[1]);
  if (!cents) return null;
  const merchantRaw = m[2].replace(/\b(con (la )?tarjeta|con efectivo|ayer|hoy)\b.*$/i, "").replace(/\s+/g, " ").trim();
  if (!merchantRaw) return null;
  const merchant = merchantRaw.charAt(0).toUpperCase() + merchantRaw.slice(1, 80);
  const income = INCOME_VERB.test(normalize(text));
  const date = /\bayer\b/i.test(text) ? addDays(d.today, -1) : d.today;
  const accountId = pickAccount("", null, d.accounts);
  if (!accountId) return answer("Para apuntar movimientos primero necesitas una cuenta. Añádela desde Principal.");
  const accountName = d.accounts.find((a) => a.id === accountId)!.name;
  const category = income ? "ingresos" : guessCategory(merchant, d.txs.map((t) => ({ concept: t.concept, category: t.category, date: t.date, amount: t.amount })));
  const amount = income ? cents : -cents;
  return {
    kind: "action",
    action: "movement",
    text: `¿Apunto ${income ? "un ingreso" : "un gasto"} de ${eur(cents)} en «${merchant}» (${CATEGORIES[category].toLowerCase()}, ${dayLabel(date, d.today)}) en ${accountName}?`,
    proposal: { accountId, amount, concept: merchant, category, date },
  };
}

// ───────────────────────── Más respuestas ─────────────────────────

const FREQ: Record<DurationUnit, [string, string]> = { day: ["al día", "días"], week: ["a la semana", "semanas"], month: ["al mes", "meses"], year: ["al año", "años"] };
function freqLabel(r: Recurring): string {
  const { unit, every } = r.frequency;
  return every === 1 ? FREQ[unit][0] : `cada ${every} ${FREQ[unit][1]}`;
}

/** Equivalente mensual aproximado de un fijo. */
function monthlyOf(r: Recurring): number {
  const { unit, every } = r.frequency;
  const perMonth = unit === "day" ? 30.44 / every : unit === "week" ? 4.35 / every : unit === "month" ? 1 / every : 1 / (12 * every);
  return Math.round(r.amount * perMonth);
}

function recurringList(d: ChatData, only?: "income" | "expense" | "subs"): ChatReply {
  let list = d.recurring.filter((r) => !(r.loan && r.loan.pending <= 0));
  if (only === "income") list = list.filter((r) => r.kind === "income");
  if (only === "expense") list = list.filter((r) => r.kind !== "income");
  if (only === "subs") list = list.filter((r) => r.kind !== "income" && r.category === "suscripciones");
  if (list.length === 0) {
    return answer(only === "income" ? "No tienes ingresos fijos apuntados." : only === "subs" ? "No tienes suscripciones apuntadas como gasto fijo." : "No tienes gastos fijos apuntados. Puedes añadirlos desde Movimientos.", "movements");
  }
  const out = list.filter((r) => r.kind !== "income");
  const inc = list.filter((r) => r.kind === "income");
  const lines: string[] = [];
  if (inc.length) lines.push(...inc.map((r) => `• ${r.concept}: +${eur(r.amount)} ${freqLabel(r)}`));
  if (out.length) lines.push(...out.map((r) => `• ${r.concept}: ${eur(r.amount)} ${freqLabel(r)}`));
  const totalOut = out.reduce((s, r) => s + monthlyOf(r), 0);
  const head = only === "income" ? "Tus ingresos fijos:" : only === "subs" ? "Tus suscripciones:" : "Tus fijos:";
  const foot = out.length ? `\nEn gastos fijos se te van unos ${eur(totalOut)} al mes.` : "";
  return answer(`${head}\n${lines.join("\n")}${foot}`, "movements");
}

function biggestExpense(d: ChatData, p: Period): ChatReply {
  const top = expenses(d).filter((t) => inPeriod(t, p)).sort((a, b) => a.amount - b.amount)[0];
  if (!top) return answer(`${p.label} no has gastado nada.`);
  return answer(`Tu mayor gasto ${p.label.toLowerCase()} fue ${top.concept}: ${eur(-top.amount)} (${dayLabel(top.date, d.today)}).`);
}

function smallestExpense(d: ChatData, p: Period): ChatReply {
  const low = expenses(d).filter((t) => inPeriod(t, p)).sort((a, b) => b.amount - a.amount)[0];
  if (!low) return answer(`${p.label} no has gastado nada.`);
  return answer(`Tu gasto más pequeño ${p.label.toLowerCase()} fue ${low.concept}: ${eur(-low.amount)} (${dayLabel(low.date, d.today)}).`);
}

function dailyAverage(d: ChatData, p: Period): ChatReply {
  const total = -expenses(d).filter((t) => inPeriod(t, p)).reduce((s, t) => s + t.amount, 0);
  const end = p.to > d.today ? d.today : p.to;
  const days = Math.max(1, Math.round((Date.parse(end) - Date.parse(p.from)) / 86_400_000) + 1);
  if (total === 0) return answer(`${p.label} no has gastado nada.`);
  return answer(`${p.label} gastas de media ${eur(Math.round(total / days))} al día (${eur(total)} en ${days} ${plural(days, "día", "días")}).`);
}

function monthSaved(d: ChatData, p: Period): ChatReply {
  const s = monthSummary(d.txs, d.recurring, p.kind === "month" ? p.month : monthOf(d.today), d.today);
  const label = p.kind === "month" ? p.label : "Este mes";
  if (s.income === 0 && s.expense === 0) return answer(`${label} todavía no hay ingresos ni gastos.`);
  if (s.saved >= 0) return answer(`${label} has ingresado ${eur(s.income)} y gastado ${eur(s.expense)}: te sobran ${eur(s.saved)}${s.income > 0 ? ` (${s.savedShare} % de lo que entra)` : ""}.`);
  return answer(`${label} has gastado ${eur(-s.saved)} más de lo que has ingresado (${eur(s.expense)} de gasto frente a ${eur(s.income)} de ingresos).`);
}

/** Lo que entra y sale por fijos desde mañana hasta fin de mes. */
function restOfMonth(d: ChatData) {
  const monthEnd = `${monthOf(d.today)}-31`;
  let out = 0, inc = 0;
  for (const r of d.recurring) {
    if (r.loan && r.loan.pending <= 0) continue;
    const n = occurrences(r, d.today, monthEnd).length;
    if (r.kind === "income") inc += n * r.amount;
    else out += n * r.amount;
  }
  return { out, inc };
}

function endOfMonth(d: ChatData): ChatReply {
  if (d.accounts.length === 0) return answer("Todavía no tienes ninguna cuenta. Añade una desde Principal para ver tu saldo.");
  const total = balances(d.accounts, d.txs).total;
  const { out, inc } = restOfMonth(d);
  const end = total - out + inc;
  const parts = [out ? `te quedan ${eur(out)} en pagos fijos` : "", inc ? `te entran ${eur(inc)} de ingresos fijos` : ""].filter(Boolean).join(" y ");
  return answer(`Ahora tienes ${eur(total)}.${parts ? ` Hasta fin de mes ${parts}.` : ""} Si no gastas nada más, acabarías el mes con unos ${eur(end)}.`);
}

function canSpend(d: ChatData): ChatReply {
  if (d.accounts.length === 0) return answer("Todavía no tienes ninguna cuenta. Añade una desde Principal para ver tu saldo.");
  const total = balances(d.accounts, d.txs).total;
  const { out, inc } = restOfMonth(d);
  const free = total - out + inc;
  const { y, m, day } = parseDate(d.today);
  const daysLeft = new Date(Date.UTC(y, m, 0)).getUTCDate() - day + 1;
  const saving = d.goals.map((g) => goalPlan(g, d.today)).filter((g) => !g.done && !g.short).reduce((s, g) => s + g.monthly, 0);
  if (free <= 0) return answer(`Con lo que tienes (${eur(total)}) y los pagos fijos que quedan (${eur(out)}), este mes no te sobra nada para gastar.`);
  const perDay = Math.floor(free / daysLeft);
  const goalsLine = saving > 0 ? `\nSi además quieres apartar lo de tus metas (${eur(saving)} al mes), serían ${eur(Math.max(0, Math.floor((free - saving) / daysLeft)))} al día.` : "";
  return answer(`Después de los pagos fijos que quedan te quedarían ${eur(free)}: unos ${eur(perDay)} al día hasta fin de mes (${daysLeft} ${plural(daysLeft, "día", "días")}).${goalsLine}`);
}

function countMovements(d: ChatData, p: Period): ChatReply {
  const list = d.txs.filter((t) => inPeriod(t, p) && !t.transfer);
  const out = list.filter((t) => t.amount < 0).length;
  return answer(`${p.label} tienes ${list.length} ${plural(list.length, "movimiento", "movimientos")} (${out} ${plural(out, "gasto", "gastos")} y ${list.length - out} ${plural(list.length - out, "ingreso", "ingresos")}).`, "movements");
}

function accountsList(d: ChatData): ChatReply {
  if (d.accounts.length === 0) return answer("Todavía no tienes ninguna cuenta. Añade una desde Principal.");
  const b = balances(d.accounts, d.txs);
  return answer(`Tienes ${b.accounts.length} ${plural(b.accounts.length, "cuenta", "cuentas")}:\n${b.accounts.map((a) => `• ${a.name}: ${eur(a.balance)}`).join("\n")}\nTotal: ${eur(b.total)}.`);
}

function categorySummary(d: ChatData, p: Period): ChatReply {
  const s = monthSummary(d.txs, d.recurring, p.kind === "month" ? p.month : monthOf(d.today), d.today);
  if (s.byCategory.length === 0) return answer("Todavía no has gastado nada este mes.");
  return answer(`Tus gastos por categoría ${p.kind === "month" && p.label !== "Este mes" ? p.label.toLowerCase() : "este mes"}:\n${s.byCategory.map((c) => `• ${c.label}: ${eur(c.amount)} (${c.share} %)`).join("\n")}`);
}

function incomeList(d: ChatData, p: Period): ChatReply {
  const list = spending(d.txs).filter((t) => t.amount > 0 && inPeriod(t, p)).sort((a, b) => b.date.localeCompare(a.date));
  if (list.length === 0) return answer(`${p.label} no has ingresado nada.`);
  const total = list.reduce((s, t) => s + t.amount, 0);
  return answer(`${p.label} has ingresado ${eur(total)}:\n${list.slice(0, 6).map((t) => `• ${dayLabel(t.date, d.today)}: ${t.concept} +${eur(t.amount)}`).join("\n")}`);
}

// ───────────────────────── Clasificador ─────────────────────────

const wordCount = (t: string) => t.split(" ").filter(Boolean).length;

/** Vocabulario para corregir erratas de una letra ("gastao" → "gastado"). */
const VOCAB = [
  "gastado", "gastos", "gaste", "gasto", "gastar", "ingresado", "ingresos", "ingreso", "cobrado", "dinero", "cuanto", "cuantos", "cuentas",
  "saldo", "metas", "objetivo", "pagos", "pendientes", "quedan", "hipoteca", "prestamo", "prestamos", "suscripciones", "suscripcion",
  "comida", "transporte", "gasolina", "compras", "categorias", "categoria", "movimientos", "proximo", "semana", "ayudar", "ayudarme",
  "ahorrado", "fijos", "recibos", "nomina", "sueldo", "mayor", "media", "promedio", "final", "previsto",
  // Palabras correctas parecidas a las de arriba: se dejan tal cual ("cuando" no es "cuanto").
  "cuando", "donde", "gastando", "gastas", "gastan", "cuenta", "cuantas", "cuanta", "ingresa", "ingresar", "pagar", "pagado",
  "ahorrar", "ahorro", "metro", "compra", "compre", "nomina", "media", "medio", "mayores", "semanas", "fijo", "fija",
  "pasado", "pasada", "pasados", "cuantos", "quedan", "queda", "llevo", "tengo", "vamos", "cobran", "cobro", "debes", "compara", "comparar", "comparado", "comparame", "compras", "comprado", "gastar", "pagos", "pague",
];

function levenshtein1(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (a.length < b.length) j++;
    else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/** Corrige erratas de una letra en palabras de 5 o más letras. */
function fixTypos(t: string): string {
  return t.split(" ").map((w) => (w.length < 5 || VOCAB.includes(w) ? w : VOCAB.find((v) => levenshtein1(w, v)) ?? w)).join(" ");
}

const has = (t: string, re: RegExp) => re.test(t);

/** Preguntas que piden razonar u opinar: siempre para la IA, aunque mencionen palabras como "gasto". */
const NEEDS_AI = /\b(por que|porque|consejos?|aconsej\w*|recomiend\w*|recomendacion\w*|recort\w*|deberia\w*|podria\w*|como (puedo|hago|ahorro|llego|consigo|reduzco|mejoro|controlo)|ahorrar|gastar menos|reducir|mejorar|que opinas|que harias|que me (sugieres|propones)|merece la pena|me conviene|es mucho|es normal|estoy gastando mucho|analiza\w*|explica\w*|plan de ahorro|presupuesto)\b/;

const SPEND = /\b(gast\w*|pag(ue|ado|ados|ada|adas)|compr(e|ado|ados|as)|desembols\w*|fundid\w*|soltado|derroch\w*|se me (ha )?ido|se me va|se me fue|me he dejado|salido)\b/;
const INCOME = /\b(ingres\w*|cobr(e|ado|ados|o)|gane|ganado|nomina|sueldo|salario|me (ha )?entrado|entrad[oa]s?|me han pagado|recibido)\b/;
const QUANTITY = /\b(cuanto|cuanta|cuantos|cuantas|total|llevo|he|han|suma|importe|cifra)\b/;
const PERIOD = new RegExp(`\\b(hoy|ayer|semana|mes|dias|${MONTHS.join("|")})\\b`);

/** Responde sin IA si reconoce la frase; si no, `{ kind: "ai" }`. */
export function ask(text: string, d: ChatData): ChatReply {
  const raw = text.trim();
  const plain = normalize(raw);
  const t = fixTypos(plain);
  if (!t) return { kind: "ai" };

  // Acciones con frase sencilla (antes que las preguntas: llevan importe).
  const goal = goalProposal(raw, d.today);
  if (goal) return goal;
  const movement = movementProposal(raw, d);
  if (movement) return movement;

  // Navegación.
  if (has(t, /\b(atajo|atajos|wallet|pagos automaticos|registro automatico|apuntar solo|automatic\w*)\b/)) {
    return answer("Para que cada pago con Wallet se apunte solo, sigue la guía del Atajo de iPhone. Te la abro.", "shortcut");
  }
  if (has(t, /\b(ajustes|configuracion|apariencia|modo oscuro|modo claro|tema|face id|codigo de acceso|pin|contrasena|perfil|cerrar sesion|eliminar (mi )?cuenta|borrar (mi )?cuenta)\b/)) {
    return answer("Eso se cambia en Ajustes. Te llevo.", "settings");
  }

  // "¿Cuánto tengo que ahorrar al mes?" es una cuenta de las metas, no un consejo.
  if (has(t, /\b(tengo que ahorrar|debo ahorrar|hay que ahorrar|ahorrar al mes|apartar al mes|tengo que apartar)\b/)) return goalsStatus(d);
  if (NEEDS_AI.test(plain) || NEEDS_AI.test(t)) return { kind: "ai" };

  // Saludos, agradecimientos y ayuda.
  // Resumen del mes: "¿qué tal voy?", "¿cómo voy este mes?".
  if (has(t, /\b(que tal|como) (voy|vamos|llevo|ando|estoy)\b/) || has(t, /\b(resumen|como va el mes|situacion)\b/)) return monthSaved(d, detectPeriod(t, d.today));
  if (wordCount(t) <= 5 && has(t, /^(hola|buenas|buenos dias|buenas tardes|buenas noches|hey|ey|que tal|saludos|holi)\b/)) {
    return answer("¡Hola! Pregúntame por tus gastos, tu saldo, tus metas o tus pagos fijos. Si no sabes por dónde empezar, pulsa «¿En qué me puedes ayudar?».");
  }
  if (wordCount(t) <= 5 && has(t, /^(gracias|muchas gracias|vale|ok|okey|genial|perfecto|guay|estupendo|entendido|de acuerdo)\b/)) return answer("¡De nada! Aquí estoy para lo que necesites.");
  if (wordCount(t) <= 4 && has(t, /^(adios|hasta luego|chao|nos vemos|bye)\b/)) return answer("¡Hasta luego!");
  if (has(t, /\b(ayud\w*|que (puedes|sabes|se puede) hacer|que haces|para que (sirves|vale|sirve)|como funciona\w*|que (te )?puedo preguntar\w*|que preguntas|opciones|instrucciones|quien eres|que eres)\b/) || t === "ayuda") return answer(HELP);

  const period = detectPeriod(t, d.today);
  const hasPeriod = PERIOD.test(t);
  const spend = has(t, SPEND);
  const income = has(t, INCOME);

  // Fijos y suscripciones.
  if (has(t, /\b(suscripcion\w*)\b/) && !spend) return recurringList(d, "subs");
  if (has(t, /\b(ingresos? fijos?|cobros? fijos?)\b/)) return recurringList(d, "income");
  if (has(t, /\b(gastos? fijos?|pagos? fijos?|fijos|recurrentes?|recibos|domiciliad\w*|cuotas?|facturas)\b/) && !has(t, /\b(quedan|pendientes?|faltan|proxim\w*|siguiente)\b/)) return recurringList(d, "expense");

  // Pagos que quedan, próximo pago, préstamos.
  // "¿Cuándo me cobran Netflix?": el próximo cobro de un fijo concreto.
  const fixed = d.recurring.find((r) => {
    const n = normalize(r.concept);
    return n.length >= 3 && new RegExp(`\\b${n}\\b`).test(t);
  });
  if (fixed && has(t, /\b(cuando|proxim\w*|siguiente|que dia|dia)\b/)) return nextOf(d, fixed);
  if (has(t, /\b(pagos?|recibos?|cargos?|gastos?|facturas?|cuotas?)\b.*\b(quedan|queda|pendientes?|faltan|vienen|restan|tengo que pagar)\b/) || has(t, /\b(por pagar|me queda por pagar|que tengo que pagar|tengo que pagar|me toca pagar|toca pagar|que pagos|que debo pagar)\b/)) return pendingPayments(d);
  if (has(t, /\b(proxim\w*|siguiente) (pago|recibo|cargo|factura|cuota|gasto)\b/) || has(t, /\bcuando (es|toca|pago|me cobran|me pasan)\b/)) return nextPaymentAnswer(d);
  if (has(t, /\b(prestamos?|hipoteca|deudas?|credito|financiacion|debo)\b/)) return loans(d);

  // Metas.
  if (has(t, /\b(metas?|objetivos?|hucha|ps5|apartar|apartado)\b/) || d.goals.some((g) => normalize(g.name).length >= 3 && t.includes(normalize(g.name)))) {
    const named = d.goals.find((g) => {
      const n = normalize(g.name);
      return n.length >= 2 && t.includes(n);
    });
    if (named || has(t, /\b(metas?|objetivos?|hucha|apartar|apartado)\b/)) return goalsStatus(d, named?.id);
  }

  // Ahorro del mes, previsión y margen.
  if (has(t, /\b(cuanto puedo gastar|puedo gastar|me puedo gastar|margen|disponible para gastar|cuanto me queda para gastar)\b/)) return canSpend(d);
  if (has(t, /\b(final de mes|fin de mes|acabar el mes|terminar el mes|acabare|terminare|me quedara|tendre)\b/)) return endOfMonth(d);
  if (has(t, /\b(ahorrado|ahorro este mes|he ahorrado|me sobra|sobrado|balance del mes|resultado del mes|en positivo|en negativo|numeros rojos)\b/)) return monthSaved(d, period);

  // Gasto en un comercio concreto (con o sin la palabra "gasto"; también el nombre suelto).
  const m = merchantSpend(d, t, period);
  if (m && (spend || hasPeriod || has(t, QUANTITY) || wordCount(t) <= 2)) return m;

  // Gasto en una categoría concreta.
  const category = detectCategory(t);
  if (category && (spend || hasPeriod || has(t, QUANTITY))) return categorySpend(d, category, period);

  if (has(t, /\b(mayor|mas grande|mas caro|mas alto|maximo)\b/) && (spend || has(t, /\b(compra|pago|movimiento)\b/))) return biggestExpense(d, period);
  if (has(t, /\b(menor|mas pequeno|mas barato|minimo)\b/) && (spend || has(t, /\b(compra|pago|movimiento)\b/))) return smallestExpense(d, period);
  if (has(t, /\b(media|promedio|al dia|diario|por dia)\b/) && (spend || has(t, /\b(gasto|cuanto)\b/))) return dailyAverage(d, period);

  if (has(t, /\b(comercios?|tiendas?|sitios|establecimientos?|lugares)\b/) || has(t, /\bdonde (mas )?(gasto|gaste|gastas|se me va|se va|me gasto)\b/) || has(t, /\ba donde (va|se va)\b/)) return topMerchants(d, period);
  if (has(t, /\bcategorias?\b/) && has(t, /\b(todas|por|cada|lista|desglose)\b/)) return categorySummary(d, period);
  if (has(t, /en que (gasto|gaste|gastas|me gasto|se me va|se va|se fue)/) || has(t, /\b(lo que mas (gasto|gaste|me gasto)|en que mas gasto|mas gasto)\b/) || has(t, /\b(mayores? gastos?|principales gastos?|categorias?|desglose)\b/)) return topCategories(d, period);

  if (has(t, /\b(compar\w*|respecto|frente|versus|vs|diferencia)\b/) || (has(t, /\b(que|como) (el|en) (mes )?(pasado|anterior)\b/) && (spend || income || has(t, /\b(mas|menos|mejor|peor)\b/)))) return compareMonths(d);

  if (has(t, /\b(movimientos?|operaciones|transacciones)\b/) && has(t, /\b(cuantos|cuantas|numero)\b/)) return countMovements(d, period);
  if (has(t, /\b(ultim\w*|reciente\w*)\b/) && has(t, /\b(movimientos?|gastos?|pagos?|compras|operaciones|transacciones|ingresos?)\b/)) return lastMovements(d);

  if (income && has(t, /\b(de donde|cuales|que ingresos|lista|detalle)\b/)) return incomeList(d, period);
  if (income && (has(t, QUANTITY) || hasPeriod || wordCount(t) <= 3)) return spent(d, period, true);
  if (spend && (hasPeriod || has(t, QUANTITY) || wordCount(t) <= 3)) return spent(d, period);
  if (has(t, /\bllevo\b/) && hasPeriod) return spent(d, period);

  // Saldo: de una cuenta concreta o de todas.
  const named = d.accounts.find((a) => {
    const n = normalize(a.name);
    return n.length >= 3 && t.includes(n);
  });
  if (named && (has(t, /\b(tengo|saldo|hay|queda|dinero|cuanto)\b/) || wordCount(t) <= 2)) return balanceOf(d, named.name);
  if (has(t, /\b(cuentas|cuantas cuentas|mis cuentas|que cuentas)\b/)) return accountsList(d);
  if (has(t, /\b(saldo|dinero|patrimonio|tengo|me queda|disponible|fondos|pasta|banco|bancos|cuenta)\b/) && !has(t, /\b(por pagar|pagar)\b/)) return balanceTotal(d);

  // Una palabra suelta que encaja con algo.
  if (spend) return spent(d, period);
  if (income) return spent(d, period, true);
  if (category) return categorySpend(d, category, period);

  return { kind: "ai" };
}

/** Respuesta a una pregunta sugerida (chip). Siempre sin IA. */
export function askChip(chip: Chip, d: ChatData): ChatReply {
  switch (chip) {
    case "help": return answer(HELP);
    case "spent_month": return spent(d, monthPeriod(monthOf(d.today), "Este mes"));
    case "top_categories": return topCategories(d, monthPeriod(monthOf(d.today), "Este mes"));
    case "goals_status": return goalsStatus(d);
    case "pending_payments": return pendingPayments(d);
  }
}
