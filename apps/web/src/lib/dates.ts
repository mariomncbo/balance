// Fechas como texto "AAAA-MM-DD" y meses "AAAA-MM", igual que la API. Sin zonas horarias: son fechas de calendario.
const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const parse = (d: string) => {
  const [y = 0, m = 1, day = 1] = d.split("-").map(Number);
  return { y, m, day };
};

export function addDays(d: string, n: number): string {
  const { y, m, day } = parse(d);
  const t = new Date(Date.UTC(y, m - 1, day + n));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}

/** "Hoy", "Ayer" o "1 nov" (con el año si no es el actual). */
export function dayLabel(date: string, today: string): string {
  if (date === today) return "Hoy";
  if (date === addDays(today, -1)) return "Ayer";
  const a = parse(date);
  const b = parse(today);
  return `${a.day} ${MONTHS_SHORT[a.m - 1]}${a.y === b.y ? "" : ` ${a.y}`}`;
}

export function monthTitle(month: string): string {
  const { y, m } = parse(`${month}-01`);
  const name = MONTHS[m - 1] ?? "";
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${y}`;
}

export function monthName(month: string): string {
  const { m } = parse(`${month}-01`);
  const name = MONTHS[m - 1] ?? "";
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function shiftMonth(month: string, n: number): string {
  const { y, m } = parse(`${month}-01`);
  const idx = y * 12 + (m - 1) + n;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}

export function longDate(d: string): string {
  const { y, m, day } = parse(d);
  const weekday = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"][
    new Date(Date.UTC(y, m - 1, day)).getUTCDay()
  ];
  return `${weekday} ${day} de ${MONTHS[m - 1]}`;
}

/** Inicial del día de la semana (L, M, X, J, V, S, D). */
export function weekdayInitial(d: string): string {
  const { y, m, day } = parse(d);
  return ["D", "L", "M", "X", "J", "V", "S"][new Date(Date.UTC(y, m - 1, day)).getUTCDay()] ?? "";
}

export const monthOf = (d: string) => d.slice(0, 7);

/** Fecha de hoy en España ("AAAA-MM-DD"), igual que la que usa la API. */
export function todayMadrid(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
}

/** Agrupa por día (la lista ya viene ordenada de más reciente a más antigua). */
export function groupByDay<T extends { date: string }>(items: T[]): { date: string; items: T[] }[] {
  const groups: { date: string; items: T[] }[] = [];
  for (const it of items) {
    const last = groups.at(-1);
    if (last && last.date === it.date) last.items.push(it);
    else groups.push({ date: it.date, items: [it] });
  }
  return groups;
}
