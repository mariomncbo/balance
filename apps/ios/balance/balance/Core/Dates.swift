import Foundation

/// Fechas como texto "AAAA-MM-DD" y meses "AAAA-MM", igual que la API. Fechas de calendario, sin zonas horarias.
enum Dates {
    private static let monthsShort = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
    private static let months = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
    private static let weekdays = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"]

    private static var utc: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "UTC")!
        return c
    }()

    struct Parts { var y: Int; var m: Int; var d: Int }

    static func parse(_ s: String) -> Parts {
        let p = s.split(separator: "-").compactMap { Int($0) }
        return Parts(y: p.count > 0 ? p[0] : 0, m: p.count > 1 ? p[1] : 1, d: p.count > 2 ? p[2] : 1)
    }

    private static func date(_ s: String) -> Date {
        let p = parse(s)
        return utc.date(from: DateComponents(year: p.y, month: p.m, day: p.d))!
    }

    private static func string(_ d: Date) -> String {
        let c = utc.dateComponents([.year, .month, .day], from: d)
        return String(format: "%04d-%02d-%02d", c.year!, c.month!, c.day!)
    }

    static func addDays(_ s: String, _ n: Int) -> String {
        string(utc.date(byAdding: .day, value: n, to: date(s))!)
    }

    static func shiftMonth(_ month: String, _ n: Int) -> String {
        let p = parse("\(month)-01")
        let idx = p.y * 12 + (p.m - 1) + n
        return String(format: "%d-%02d", idx / 12, idx % 12 + 1)
    }

    static func monthOf(_ s: String) -> String { String(s.prefix(7)) }

    /// "Hoy", "Ayer" o "1 nov" (con el año si no es el actual).
    static func dayLabel(_ s: String, today: String) -> String {
        if s == today { return "Hoy" }
        if s == addDays(today, -1) { return "Ayer" }
        let a = parse(s), b = parse(today)
        return "\(a.d) \(monthsShort[a.m - 1])\(a.y == b.y ? "" : " \(a.y)")"
    }

    static func monthTitle(_ month: String) -> String {
        let p = parse("\(month)-01")
        return "\(months[p.m - 1].capitalizedFirst) \(p.y)"
    }

    /// "2027-02" → "feb".
    static func monthShort(_ month: String) -> String { monthsShort[parse("\(month)-01").m - 1] }

    static func monthName(_ month: String) -> String { months[parse("\(month)-01").m - 1].capitalizedFirst }

    static func longDate(_ s: String) -> String {
        let p = parse(s)
        let wd = utc.component(.weekday, from: date(s)) - 1
        return "\(weekdays[wd]) \(p.d) de \(months[p.m - 1])"
    }

    /// Inicial del día de la semana (L, M, X, J, V, S, D).
    static func weekdayInitial(_ s: String) -> String {
        ["D", "L", "M", "X", "J", "V", "S"][utc.component(.weekday, from: date(s)) - 1]
    }

    /// Fecha de hoy en España ("AAAA-MM-DD"), igual que la que usa la API.
    static func todayMadrid(now: Date = Date()) -> String {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "Europe/Madrid")!
        let p = c.dateComponents([.year, .month, .day], from: now)
        return String(format: "%04d-%02d-%02d", p.year!, p.month!, p.day!)
    }

    /// Agrupa por día (la lista ya viene ordenada de más reciente a más antigua).
    static func groupByDay<T>(_ items: [T], date: (T) -> String) -> [(date: String, items: [T])] {
        var groups: [(date: String, items: [T])] = []
        for it in items {
            if let last = groups.last, last.date == date(it) { groups[groups.count - 1].items.append(it) }
            else { groups.append((date(it), [it])) }
        }
        return groups
    }
}

extension String {
    var capitalizedFirst: String { prefix(1).uppercased() + dropFirst() }
}
