import Foundation

/// Resumen de los fijos del mes en curso para la pantalla Movimientos.
/// «Pagado» sale de los movimientos reales del mes que generó cada fijo (llevan su `recurringId`), no de suposiciones.
struct FixedMonth: Equatable {
    struct Paid: Equatable { let fixed: Recurring; let amount: Int; let date: String }
    struct Pending: Equatable { let fixed: Recurring; let date: String; let daysLeft: Int }
    struct Income: Equatable { let fixed: Recurring; let received: String?; let next: String? }

    let month: String
    let paid: [Paid]
    let pending: [Pending]
    let incomes: [Income]
    /// El próximo pago fijo si este mes ya está todo pagado.
    let nextAfterMonth: Pending?
    /// Los demás gastos fijos (ya pagados este mes o que empiezan más adelante), con su próxima fecha. Van en gris debajo de los pendientes.
    let later: [Recurring]

    var paidTotal: Int { paid.reduce(0) { $0 + $1.amount } }
    var pendingTotal: Int { pending.reduce(0) { $0 + $1.fixed.amount } }
    var monthTotal: Int { paidTotal + pendingTotal }
    var expenseCount: Int { paid.count + pending.count }
    /// Ingresos fijos mensuales (los anuales no cuentan para el mes).
    var monthlyIncome: Int { incomes.filter { $0.fixed.frequency.unit == "month" }.reduce(0) { $0 + $1.fixed.amount } }
    /// Lo que queda de los ingresos fijos tras pagar los gastos fijos del mes. nil si no hay ingresos fijos.
    var freeAfterFixed: Int? { monthlyIncome > 0 ? monthlyIncome - monthTotal : nil }
    var progress: Int { monthTotal > 0 ? min(100, Int((Double(paidTotal) / Double(monthTotal) * 100).rounded())) : 0 }
    var isEmpty: Bool { paid.isEmpty && pending.isEmpty && incomes.isEmpty && nextAfterMonth == nil }

    init(recurring: [Recurring], transactions: [Transaction], today: String) {
        let month = Dates.monthOf(today)
        self.month = month
        let thisMonth = transactions.filter { Dates.monthOf($0.date) == month && $0.recurringId != nil }
        var paid: [Paid] = [], pending: [Pending] = [], incomes: [Income] = [], upcoming: [Pending] = []
        for r in recurring {
            let posted = thisMonth.filter { $0.recurringId == r.id }
            let lastPosted = posted.map(\.date).max()
            if r.kind == .income {
                incomes.append(Income(fixed: r, received: lastPosted, next: r.nextDate))
                continue
            }
            if !posted.isEmpty {
                paid.append(Paid(fixed: r, amount: posted.reduce(0) { $0 + abs($1.amount) }, date: lastPosted ?? today))
            }
            guard let next = r.nextDate, next >= today else { continue }
            if let loan = r.loan, loan.pending <= 0 { continue }
            if next == lastPosted { continue } // el de hoy ya se apuntó (su próxima fecha la da el servidor)
            let item = Pending(fixed: r, date: next, daysLeft: Dates.daysBetween(today, next))
            if Dates.monthOf(next) == month { pending.append(item) } else { upcoming.append(item) }
        }
        self.paid = paid.sorted { $0.date < $1.date }
        self.pending = pending.sorted { $0.date < $1.date }
        self.incomes = incomes.sorted { ($0.next ?? "9") < ($1.next ?? "9") }
        self.nextAfterMonth = pending.isEmpty ? upcoming.min { $0.date < $1.date } : nil
        let pendingIds = Set(pending.map(\.fixed.id))
        self.later = recurring.filter { $0.kind != .income && !pendingIds.contains($0.id) }
            .sorted { ($0.nextDate ?? "9") < ($1.nextDate ?? "9") }
    }

    /// Texto en gris de un fijo que no toca este mes: "5 dic", o "Terminado" si es un préstamo ya pagado.
    static func laterLabel(_ r: Recurring) -> String {
        if let l = r.loan, l.pending <= 0 { return "Terminado" }
        return r.nextDate.map(shortDate) ?? "Día \(r.day)"
    }

    /// "Día 1 · cobrada el 1 nov · próxima el 1 dic".
    static func incomeLabel(_ i: Income) -> String {
        ["Día \(i.fixed.day)", i.received.map { "cobrada el \(shortDate($0))" }, i.next.map { "próxima el \(shortDate($0))" }].compactMap { $0 }.joined(separator: " · ")
    }

    static func shortDate(_ s: String) -> String { "\(Dates.parse(s).d) \(Dates.monthShort(Dates.monthOf(s)))" }

    /// «Hoy», «Mañana» o «En 6 días», con el día del mes: «En 6 días · día 24».
    static func whenLabel(_ p: Pending) -> String {
        let day = Dates.parse(p.date).d
        switch p.daysLeft {
        case 0: return "Hoy · día \(day)"
        case 1: return "Mañana · día \(day)"
        default: return "En \(p.daysLeft) días · día \(day)"
        }
    }
}
