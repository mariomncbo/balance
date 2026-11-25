import Foundation
import Testing
@testable import balance

/// Contrato con el servidor: decodifica con los modelos REALES de la app las respuestas reales de la Edge Function `api`.
/// Los ficheros los genera `supabase/functions/tests/contract_test.ts` (ver su cabecera para regenerarlos).
/// Si el servidor deja de enviar un campo que la app exige, o cambia su tipo, estos tests fallan.
struct ContractTests {
    private struct Envelope<T: Decodable>: Decodable { let data: T }

    /// Raíz del repositorio, subiendo desde este fichero hasta encontrar `supabase/functions/tests/contract`.
    private static let dir: URL = {
        var url = URL(fileURLWithPath: #filePath).deletingLastPathComponent()
        for _ in 0..<8 {
            let candidate = url.appendingPathComponent("supabase/functions/tests/contract")
            if FileManager.default.fileExists(atPath: candidate.path) { return candidate }
            url.deleteLastPathComponent()
        }
        return URL(fileURLWithPath: "/nonexistent")
    }()

    private func data(_ name: String) throws -> Data {
        try Data(contentsOf: Self.dir.appendingPathComponent("\(name).json"))
    }

    private func decode<T: Decodable>(_ name: String, as _: T.Type = T.self) throws -> T {
        do { return try JSONDecoder().decode(Envelope<T>.self, from: data(name)).data }
        catch { Issue.record("«\(name)» no se puede leer con los modelos de la app: \(error)"); throw error }
    }

    @Test func contractFilesExist() {
        #expect(FileManager.default.fileExists(atPath: Self.dir.path), "No se encuentran los ficheros de contrato en \(Self.dir.path)")
    }

    @Test func home() throws {
        let h: Home = try decode("home")
        #expect(h.balances.accounts.count == 2)
        #expect(h.balances.accounts.allSatisfy { $0.openingBalance != 0 }, "openingBalance es el campo que faltó en producción")
        #expect(h.topGoal != nil && h.nextPayment != nil)
        #expect(h.lastDays.days.count == 7)
        #expect(h.latest.count <= 5)
    }

    @Test func homeForNewAccount() throws {
        let h: Home = try decode("home.empty")
        #expect(h.balances.accounts.isEmpty && h.balances.total == 0)
        #expect(h.topGoal == nil && h.nextPayment == nil && h.latest.isEmpty)
    }

    @Test func accounts() throws {
        let b: Balances = try decode("accounts.list")
        #expect(b.accounts.map(\.type).contains(.banco))
        #expect(b.total == b.accounts.reduce(0) { $0 + $1.balance })
        #expect((try decode("accounts.list.empty", as: Balances.self)).accounts.isEmpty)
    }

    @Test func transactions() throws {
        let l: TransactionList = try decode("transactions.list")
        #expect(l.items.contains { $0.source == .fijo } && l.items.contains { $0.source == .atajo })
        #expect(l.items.contains { $0.note != nil } && l.items.contains { $0.note == nil })
        #expect(l.items.contains { $0.accountId == nil })
        let legs = l.items.filter(\.isTransfer)
        #expect(legs.count == 2 && Set(legs.compactMap { $0.transfer?.id }).count == 1, "una transferencia son dos movimientos con el mismo id")
        #expect(legs.reduce(0) { $0 + $1.amount } == 0, "las dos mitades suman cero")
        #expect(legs.allSatisfy { $0.transfer?.goalId != nil })
        #expect(l.summary.byCategory.isEmpty == false)
        let one: Transaction = try decode("transactions.get")
        #expect(one.note != nil)
        #expect((try decode("transactions.list.empty", as: TransactionList.self)).items.isEmpty)
    }

    @Test func recurring() throws {
        let r: [Recurring] = try decode("recurring.list")
        #expect(Set(r.map(\.kind)) == [.income, .expense, .loan])
        #expect(r.contains { $0.loan?.principal != nil } && r.contains { $0.loan != nil && $0.loan?.principal == nil })
        #expect(r.contains { $0.loan?.endMonth != nil } && r.contains { $0.loan != nil && $0.loan?.endMonth == nil })
        #expect(r.contains { $0.frequency.unit == "year" })
        #expect((try decode("recurring.list.empty", as: [Recurring].self)).isEmpty)
    }

    @Test func goals() throws {
        let g: Goals = try decode("goals.list")
        #expect(g.goals.contains { $0.behind } && g.goals.contains { $0.done })
        #expect(g.monthlyTotal == g.goals.reduce(0) { $0 + $1.monthly })
        #expect((try decode("goals.list.empty", as: Goals.self)).goals.isEmpty)
        let withContribs = try #require(g.goals.first { !($0.contributions ?? []).isEmpty })
        #expect(withContribs.contributions?.contains { $0.transferId != nil } == true && withContribs.contributions?.contains { $0.transferId == nil } == true)
        #expect(withContribs.accountId != nil)
        #expect(g.goals.contains { $0.accountId == nil })
        let contributed: GoalPlan = try decode("goals.contribute")
        #expect(contributed.done, "la meta de prueba queda conseguida con la última aportación")
        let p: GoalPreview = try decode("goals.preview")
        #expect(p.monthly > 0 && p.deadline.count == 10 && p.short == false, "fecha límite completa AAAA-MM-DD")
        #expect(g.goals.allSatisfy { $0.short != nil && $0.daysLeft != nil })
    }

    @Test func report() throws {
        let r: Report = try decode("report.month")
        #expect(r.summary.month == "2026-11")
        #expect(!r.goals.goals.isEmpty)
    }

    @Test func shortcut() throws {
        let s: ShortcutStatus = try decode("shortcut.status")
        #expect(s.active && s.hint != nil)
        let off: ShortcutStatus = try decode("shortcut.status.empty")
        #expect(!off.active && off.hint == nil)
        let c: ShortcutCreated = try decode("shortcut.create")
        #expect(c.token.hasPrefix("bal_") && c.token.hasSuffix(c.hint))
    }

    /// Comprueba que este test SÍ detecta el problema: quitando `openingBalance` de la respuesta, la app no la lee.
    @Test func detectsAMissingRequiredField() throws {
        var json = try #require(try JSONSerialization.jsonObject(with: data("accounts.list")) as? [String: Any])
        var d = try #require(json["data"] as? [String: Any])
        var accounts = try #require(d["accounts"] as? [[String: Any]])
        accounts[0].removeValue(forKey: "openingBalance")
        d["accounts"] = accounts
        json["data"] = d
        let broken = try JSONSerialization.data(withJSONObject: json)
        #expect(throws: DecodingError.self) { try JSONDecoder().decode(Envelope<Balances>.self, from: broken) }
    }
}
