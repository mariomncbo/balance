import { describe, expect, it } from "vitest";
import { addDays, dayLabel, longDate, monthTitle, shiftMonth, weekdayInitial } from "./dates";

describe("fechas", () => {
  it("etiquetas de día", () => {
    expect(dayLabel("2026-11-23", "2026-11-23")).toBe("Hoy");
    expect(dayLabel("2026-11-22", "2026-11-23")).toBe("Ayer");
    expect(dayLabel("2026-11-01", "2026-11-23")).toBe("1 nov");
    expect(dayLabel("2025-12-31", "2026-11-23")).toBe("31 dic 2025");
  });
  it("suma días cruzando mes y año", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("meses", () => {
    expect(monthTitle("2026-11")).toBe("Noviembre 2026");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-11", 3)).toBe("2027-02");
  });
  it("día de la semana", () => {
    expect(longDate("2026-11-23")).toBe("lunes 23 de noviembre");
    expect(weekdayInitial("2026-11-23")).toBe("L");
    expect(weekdayInitial("2026-11-25")).toBe("X");
  });
});

import { groupByDay, todayMadrid } from "./dates";
describe("agrupar y hoy", () => {
  it("agrupa por día respetando el orden", () => {
    const g = groupByDay([
      { date: "2026-11-23", n: 1 },
      { date: "2026-11-23", n: 2 },
      { date: "2026-11-20", n: 3 },
    ]);
    expect(g.map((x) => [x.date, x.items.length])).toEqual([
      ["2026-11-23", 2],
      ["2026-11-20", 1],
    ]);
  });
  it("hoy tiene formato de fecha", () => expect(todayMadrid()).toMatch(/^\d{4}-\d{2}-\d{2}$/));
});
