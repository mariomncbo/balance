import Foundation
import Testing
@testable import balance

struct MoneyTests {
    @Test func formatsSpanishStyle() {
        #expect(Money.format(1_248_035) == "12.480,35\u{00A0}€")
        #expect(Money.format(185_000) == "1.850,00\u{00A0}€")
        #expect(Money.format(0) == "0,00\u{00A0}€")
        #expect(Money.format(123_400) == "1.234,00\u{00A0}€")
    }

    @Test func signs() {
        #expect(Money.format(-4_890) == "\u{2212}48,90\u{00A0}€")
        #expect(Money.format(185_000, signed: true) == "+1.850,00\u{00A0}€")
        #expect(Money.format(185_000) == "1.850,00\u{00A0}€")
        #expect(Money.format(-124_060, round: true) == "\u{2212}1.241\u{00A0}€")
    }

    @Test func parsesCommonFormats() {
        #expect(Money.parse("48,90") == 4_890)
        #expect(Money.parse("12") == 1_200)
        #expect(Money.parse("1.250,5") == 125_050)
        #expect(Money.parse("1.250") == 125_000)
        #expect(Money.parse("12.5") == 1_250)
        #expect(Money.parse("12.480,35 €") == 1_248_035)
    }

    @Test func parseIgnoresSign() {
        #expect(Money.parse("\u{2212}48,90") == 4_890)
        #expect(Money.parse("+1.850") == 185_000)
    }

    @Test func parseRejectsGarbage() {
        for bad in ["", "abc", "1,234", "12,3,4"] { #expect(Money.parse(bad) == nil, "«\(bad)»") }
    }
}

struct DatesTests {
    @Test func dayLabels() {
        #expect(Dates.dayLabel("2026-11-23", today: "2026-11-23") == "Hoy")
        #expect(Dates.dayLabel("2026-11-22", today: "2026-11-23") == "Ayer")
        #expect(Dates.dayLabel("2026-11-01", today: "2026-11-23") == "1 nov")
        #expect(Dates.dayLabel("2025-12-31", today: "2026-11-23") == "31 dic 2025")
    }

    @Test func addDaysAcrossBoundaries() {
        #expect(Dates.addDays("2026-12-31", 1) == "2027-01-01")
        #expect(Dates.addDays("2026-03-01", -1) == "2026-02-28")
    }

    @Test func months() {
        #expect(Dates.monthTitle("2026-11") == "Noviembre 2026")
        #expect(Dates.shiftMonth("2026-01", -1) == "2025-12")
        #expect(Dates.shiftMonth("2026-11", 3) == "2027-02")
    }

    @Test func weekdays() {
        #expect(Dates.longDate("2026-11-23") == "lunes 23 de noviembre")
        #expect(Dates.weekdayInitial("2026-11-23") == "L")
        #expect(Dates.weekdayInitial("2026-11-25") == "X")
    }

    @Test func groupsByDay() {
        let g = Dates.groupByDay([("2026-11-23", 1), ("2026-11-23", 2), ("2026-11-20", 3)], date: { $0.0 })
        #expect(g.map { "\($0.date):\($0.items.count)" } == ["2026-11-23:2", "2026-11-20:1"])
    }

    @Test func todayHasDateFormat() {
        #expect(Dates.todayMadrid().range(of: #"^\d{4}-\d{2}-\d{2}$"#, options: .regularExpression) != nil)
    }
}

struct PinTests {
    private func store() -> (PinStore, MemoryStorage) { let m = MemoryStorage(); return (PinStore(storage: m), m) }

    @Test func validatesFormat() {
        #expect(PinStore.isValid("1234"))
        for bad in ["123", "12345", "12a4", "", "١٢٣٤"] { #expect(!PinStore.isValid(bad), "«\(bad)»") }
    }

    @Test func storesHashNotThePin() throws {
        let (pin, mem) = store()
        try pin.set("4821", iterations: 1000)
        #expect(pin.hasPin)
        #expect(mem.read("pin").map { String(decoding: $0, as: UTF8.self).contains("4821") } == false)
    }

    @Test func countsAttemptsAndResetsOnSuccess() throws {
        let (pin, _) = store()
        try pin.set("4821", iterations: 1000)
        #expect(pin.verify("4821") == .ok)
        #expect(pin.verify("0000") == .wrong(remaining: 4))
        #expect(pin.verify("1111") == .wrong(remaining: 3))
        #expect(pin.verify("4821") == .ok)
        #expect(pin.verify("0000") == .wrong(remaining: 4))
    }

    @Test func locksFiveMinutesAfterFiveFailures() throws {
        let (pin, _) = store()
        try pin.set("4821", iterations: 1000)
        let t = Date(timeIntervalSince1970: 1_000_000)
        var r = pin.verify("0000", now: t)
        for _ in 0..<4 { r = pin.verify("0000", now: t) }
        #expect(r == .locked(until: t.addingTimeInterval(300)))
        if case .locked = pin.verify("4821", now: t.addingTimeInterval(1)) {} else { Issue.record("debería seguir bloqueado") }
        #expect(pin.verify("4821", now: t.addingTimeInterval(301)) == .ok)
    }

    @Test func clearRemovesEverything() throws {
        let (pin, _) = store()
        try pin.set("4821", iterations: 1000)
        pin.faceIdEnabled = true
        pin.clear()
        #expect(!pin.hasPin && !pin.faceIdEnabled)
    }

    @Test func rejectsInvalidPin() {
        let (pin, _) = store()
        #expect(throws: APIError.self) { try pin.set("12") }
    }
}

struct OnboardingTests {
    @Test func buildsImportParams() throws {
        let d = OnboardingData(
            accounts: [OnboardingAccount(name: "Mi dinero", type: .banco, openingBalance: 1_248_035)],
            loans: [OnboardingLoan(concept: "Hipoteca", amount: 64_000, day: 5, pending: 9_840_000, endMonth: "2041-06")],
            salary: OnboardingSalary(amount: 185_000, day: 1)
        )
        let json = try JSONSerialization.jsonObject(with: JSONEncoder().encode(d.importParams)) as! [String: Any]
        let recurring = json["recurring"] as! [[String: Any]]
        #expect(recurring.count == 2)
        #expect(recurring[0]["kind"] as? String == "income" && recurring[0]["concept"] as? String == "Nómina")
        #expect(recurring[1]["kind"] as? String == "loan" && recurring[1]["endMonth"] as? String == "2041-06")
        #expect((json["accounts"] as! [[String: Any]]).count == 1)
    }

    @Test func storeRoundTripAndCorruption() {
        let suite = UserDefaults(suiteName: "test.onboarding")!
        suite.removePersistentDomain(forName: "test.onboarding")
        OnboardingStore.defaults = suite
        #expect(OnboardingStore.read().isEmpty)
        OnboardingStore.write(OnboardingData(salary: OnboardingSalary(amount: 185_000, day: 1)))
        #expect(OnboardingStore.read().salary == OnboardingSalary(amount: 185_000, day: 1))
        suite.set(Data("{no es json".utf8), forKey: "balance.onboarding")
        #expect(OnboardingStore.read().isEmpty)
        OnboardingStore.clear()
        #expect(OnboardingStore.read().isEmpty)
    }
}
