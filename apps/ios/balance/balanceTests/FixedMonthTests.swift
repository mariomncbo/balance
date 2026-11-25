import Foundation
import Testing
@testable import balance

struct FixedMonthTests {
    private func fixed(_ id: String, _ kind: RecurringKind, _ amount: Int, day: Int, next: String?, unit: String = "month", every: Int = 1, loanPending: Int? = nil) -> Recurring {
        Recurring(id: id, kind: kind, amount: amount, concept: id.capitalized, category: kind == .income ? .ingresos : .hogar, accountId: nil, day: day,
                  frequency: Frequency(unit: unit, every: every), startDate: "2026-01-01",
                  loan: loanPending.map { LoanInfo(pending: $0, endMonth: nil, principal: nil) }, nextDate: next, progress: nil)
    }
    private func tx(_ recurringId: String?, _ amount: Int, _ date: String) -> Transaction {
        Transaction(id: UUID().uuidString, accountId: nil, amount: amount, concept: "x", category: .hogar, date: date, source: .fijo, note: nil, recurringId: recurringId, transfer: nil)
    }

    private let today = "2026-11-18"

    @Test func paidComesFromRealMovementsAndPendingFromNextDate() {
        let fm = FixedMonth(
            recurring: [fixed("hipoteca", .loan, 64000, day: 5, next: "2026-12-05", loanPending: 98_000_00),
                        fixed("gimnasio", .expense, 3990, day: 3, next: "2026-12-03"),
                        fixed("luz", .expense, 5800, day: 20, next: "2026-11-20"),
                        fixed("netflix", .expense, 1299, day: 24, next: "2026-11-24"),
                        fixed("nomina", .income, 185000, day: 1, next: "2026-12-01")],
            transactions: [tx("hipoteca", -64000, "2026-11-05"), tx("gimnasio", -3990, "2026-11-03"), tx("nomina", 185000, "2026-11-01"),
                           tx(nil, -4890, "2026-11-18"), tx("hipoteca", -64000, "2026-10-05")],
            today: today)
        #expect(fm.paid.map(\.fixed.id) == ["gimnasio", "hipoteca"])
        #expect(fm.paidTotal == 67990, "solo lo de este mes; octubre no cuenta")
        #expect(fm.pending.map(\.fixed.id) == ["luz", "netflix"])
        #expect(fm.pending.map(\.daysLeft) == [2, 6])
        #expect(fm.monthTotal == 67990 + 7099)
        #expect(fm.expenseCount == 4)
        #expect(fm.incomes.first?.received == "2026-11-01" && fm.incomes.first?.next == "2026-12-01")
        #expect(fm.freeAfterFixed == 185000 - (67990 + 7099))
        #expect(fm.progress == 91)
        #expect(fm.nextAfterMonth == nil)
    }

    @Test func todayAlreadyPostedIsNotAlsoPending() {
        let fm = FixedMonth(recurring: [fixed("luz", .expense, 5800, day: 18, next: "2026-11-18")],
                            transactions: [tx("luz", -5800, "2026-11-18")], today: today)
        #expect(fm.paid.count == 1 && fm.pending.isEmpty)
    }

    @Test func allPaidShowsTheNextOneOfNextMonth() {
        let fm = FixedMonth(recurring: [fixed("gimnasio", .expense, 3990, day: 3, next: "2026-12-03"), fixed("hipoteca", .loan, 64000, day: 5, next: "2026-12-05", loanPending: 100)],
                            transactions: [tx("gimnasio", -3990, "2026-11-03")], today: today)
        #expect(fm.pending.isEmpty)
        #expect(fm.nextAfterMonth?.fixed.id == "gimnasio" && fm.nextAfterMonth?.daysLeft == 15)
    }

    @Test func finishedLoansAndYearlyIncomeDoNotCount() {
        let fm = FixedMonth(recurring: [fixed("coche", .loan, 15000, day: 25, next: "2026-11-25", loanPending: 0),
                                        fixed("paga", .income, 90000, day: 20, next: "2026-12-20", unit: "year")],
                            transactions: [], today: today)
        #expect(fm.pending.isEmpty, "un préstamo terminado no está pendiente")
        #expect(fm.monthlyIncome == 0 && fm.freeAfterFixed == nil, "la paga anual no cuenta como ingreso del mes")
    }

    @Test func expensesNotDueThisMonthGoBelowInGrey() {
        let rec = [fixed("gimnasio", .expense, 3990, day: 5, next: "2026-12-05"),          // creado hoy con día ya pasado: empieza en diciembre
                   fixed("hipoteca", .loan, 64000, day: 3, next: "2026-12-03", loanPending: 100), // pagado este mes
                   fixed("coche", .loan, 15000, day: 9, next: nil, loanPending: 0),
                   fixed("luz", .expense, 5800, day: 20, next: "2026-11-20"),
                   fixed("nomina", .income, 185000, day: 1, next: "2026-12-01")]
        let fm = FixedMonth(recurring: rec, transactions: [tx("hipoteca", -64000, "2026-11-03")], today: today)
        #expect(fm.pending.map(\.fixed.id) == ["luz"])
        #expect(fm.later.map(\.id) == ["hipoteca", "gimnasio", "coche"], "todos los gastos fijos se ven; la nómina no")
        #expect(fm.later.map(FixedMonth.laterLabel) == ["3 dic", "5 dic", "Terminado"])
    }

    @Test func weeklyFixedCountsEveryPaymentLeftThisMonth() {
        // Pádel cada semana: pagado el 4 y el 11; quedan el 18 (hoy) y el 25
        let fm = FixedMonth(recurring: [fixed("padel", .expense, 1500, day: 4, next: "2026-11-18", unit: "week")],
                            transactions: [tx("padel", -1500, "2026-11-04"), tx("padel", -1500, "2026-11-11")], today: today)
        #expect(fm.pending.first?.count == 2)
        #expect(fm.paidTotal == 3000 && fm.pendingTotal == 3000 && fm.monthTotal == 6000)
        #expect(fm.expenseCount == 1 && fm.paidCount == 0, "un fijo semanal cuenta una vez y no está pagado hasta el último del mes")
        #expect(FixedMonth.timesLeftInMonth(fixed("p", .expense, 1, day: 1, next: nil, unit: "day", every: 10), from: "2026-11-05") == 3)
    }

    @Test func monthlyEquivalentOfIncome() {
        #expect(FixedMonth.monthlyEquivalent(fixed("a", .income, 120000, day: 1, next: nil)) == 120000)
        #expect(FixedMonth.monthlyEquivalent(fixed("b", .income, 30000, day: 1, next: nil, every: 3)) == 10000)
        #expect(FixedMonth.monthlyEquivalent(fixed("c", .income, 12000, day: 1, next: nil, unit: "week")) == 52000)
        #expect(FixedMonth.monthlyEquivalent(fixed("d", .income, 90000, day: 1, next: nil, unit: "year")) == 0)
    }

    @Test func timeUnitTexts() {
        #expect(TimeUnit.month.format(1) == "1 mes" && TimeUnit.month.format(3) == "3 meses")
        #expect(TimeUnit.week.every(1) == "Cada semana" && TimeUnit.week.every(2) == "Cada 2 semanas")
        #expect(TimeUnit.year.format(2) == "2 años" && TimeUnit.day.format(1) == "1 día")
        #expect(TimeUnit.week.parse("10") == .success(10))
        #expect(TimeUnit.year.parse("51") == .failure(.init(message: "Como mucho 50 años")))
        #expect(TimeUnit.day.parse("0") == .failure(.init(message: "Escribe un número, por ejemplo 6")))
    }

    @Test func incomeLabel() {
        let fm = FixedMonth(recurring: [fixed("nomina", .income, 185000, day: 1, next: "2026-12-01")],
                            transactions: [tx("nomina", 185000, "2026-11-01")], today: today)
        #expect(FixedMonth.incomeLabel(fm.incomes[0]) == "Día 1 · cobrada el 1 nov · próxima el 1 dic")
    }

    @Test func labels() {
        let r = fixed("x", .expense, 100, day: 24, next: "2026-11-24")
        #expect(FixedMonth.whenLabel(.init(fixed: r, date: "2026-11-18", daysLeft: 0)) == "Hoy · día 18")
        #expect(FixedMonth.whenLabel(.init(fixed: r, date: "2026-11-19", daysLeft: 1)) == "Mañana · día 19")
        #expect(FixedMonth.whenLabel(.init(fixed: r, date: "2026-11-24", daysLeft: 6)) == "En 6 días · día 24")
    }
}
