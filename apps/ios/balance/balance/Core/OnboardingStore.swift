import Foundation
import Supabase

/// Lo que se escribe en el onboarding vive en el dispositivo hasta crear la cuenta; después se sube de una
/// vez (acción `onboarding.import`) y se borra de aquí.
struct OnboardingAccount: Codable, Hashable { var name: String; var type: AccountType; var openingBalance: Int }
struct OnboardingLoan: Codable, Hashable { var concept: String; var amount: Int; var day: Int; var pending: Int; var endMonth: String? }
struct OnboardingSalary: Codable, Hashable { var amount: Int; var day: Int }

struct OnboardingData: Codable, Hashable {
    var accounts: [OnboardingAccount] = []
    var loans: [OnboardingLoan] = []
    var salary: OnboardingSalary?

    var isEmpty: Bool { accounts.isEmpty && loans.isEmpty && salary == nil }
}

enum OnboardingStore {
    private static let key = "balance.onboarding"
    static var defaults = UserDefaults.standard

    static func read() -> OnboardingData {
        guard let raw = defaults.data(forKey: key), let d = try? JSONDecoder().decode(OnboardingData.self, from: raw) else { return OnboardingData() }
        return d
    }

    static func write(_ data: OnboardingData) {
        defaults.set(try? JSONEncoder().encode(data), forKey: key)
    }

    static func clear() { defaults.removeObject(forKey: key) }
}

extension OnboardingData {
    /// Parámetros de `onboarding.import`: el sueldo es un ingreso fijo y cada préstamo un fijo de tipo préstamo.
    var importParams: [String: AnyJSON] {
        var recurring: [AnyJSON] = []
        if let s = salary {
            recurring.append(.object(["kind": "income", "amount": .integer(s.amount), "concept": "Nómina", "category": "ingresos", "day": .integer(s.day)]))
        }
        for l in loans {
            var o: [String: AnyJSON] = ["kind": "loan", "amount": .integer(l.amount), "concept": .string(l.concept), "category": "hogar", "day": .integer(l.day), "pending": .integer(l.pending)]
            if let e = l.endMonth { o["endMonth"] = .string(e) }
            recurring.append(.object(o))
        }
        let accounts: [AnyJSON] = self.accounts.map {
            .object(["name": .string($0.name), "type": .string($0.type.rawValue), "openingBalance": .integer($0.openingBalance)])
        }
        return ["accounts": .array(accounts), "recurring": .array(recurring)]
    }
}
