import Foundation

// Tipos de las respuestas de la Edge Function `api` (ver supabase/functions/api/handler.ts).

enum Category: String, Codable, CaseIterable, Identifiable {
    case comida, hogar, transporte, ocio, salud, compras, suscripciones, ingresos, otros
    var id: String { rawValue }

    var label: String {
        switch self {
        case .comida: "Comida"
        case .hogar: "Hogar"
        case .transporte: "Transporte"
        case .ocio: "Ocio"
        case .salud: "Salud"
        case .compras: "Compras"
        case .suscripciones: "Suscripciones"
        case .ingresos: "Nómina e ingresos"
        case .otros: "Otros"
        }
    }

    /// Nombre de SF Symbol equivalente al icono de la web.
    var symbol: String {
        switch self {
        case .comida: "cart"
        case .hogar: "house"
        case .transporte: "car"
        case .ocio: "ticket"
        case .salud: "heart"
        case .compras: "bag"
        case .suscripciones: "repeat"
        case .ingresos: "arrow.down.left"
        case .otros: "ellipsis"
        }
    }

    static let expense: [Category] = [.comida, .hogar, .transporte, .ocio, .salud, .compras, .suscripciones, .otros]
    static let income: [Category] = [.ingresos, .otros]
}

enum AccountType: String, Codable, CaseIterable, Identifiable {
    case banco, ahorro, efectivo, tarjeta, emergencia, empresa, otro
    var id: String { rawValue }
    var label: String {
        switch self {
        case .banco: "Banco"
        case .ahorro: "Ahorro"
        case .efectivo: "Efectivo"
        case .tarjeta: "Tarjeta"
        case .emergencia: "Emergencia"
        case .empresa: "Empresa"
        case .otro: "Otro"
        }
    }
}

enum Source: String, Codable {
    case manual, ia, ticket, atajo, fijo
    var label: String? {
        switch self {
        case .manual: nil
        case .ia: "IA"
        case .ticket: "Ticket"
        case .atajo: "Atajo"
        case .fijo: "Fijo"
        }
    }
}

struct AccountBalance: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let type: AccountType
    let balance: Int
    let openingBalance: Int
    let share: Int
}

struct Balances: Codable, Hashable {
    let total: Int
    let accounts: [AccountBalance]
}

struct Transaction: Codable, Identifiable, Hashable {
    let id: String
    let accountId: String?
    let amount: Int
    let concept: String
    let category: Category
    let date: String
    let source: Source
    let note: String?
    let recurringId: String?

    var isIncome: Bool { amount > 0 }
}

struct CategoryShare: Codable, Identifiable, Hashable {
    let category: Category
    let label: String
    let amount: Int
    let share: Int
    var id: Category { category }
}

struct MonthSummary: Codable, Hashable {
    let month: String
    let income: Int
    let expense: Int
    let saved: Int
    let savedShare: Int
    let pending: Int
    let byCategory: [CategoryShare]
    let previousExpense: Int
    let vsPrevious: Int?
}

struct GoalPlan: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let target: Int
    let saved: Int
    let remaining: Int
    let months: Int
    let monthly: Int
    let deadline: String
    let progress: Int
    let behind: Bool
    let done: Bool
}

struct Goals: Codable, Hashable {
    let goals: [GoalPlan]
    let monthlyTotal: Int
    let saved: Int
    let target: Int
}

struct Frequency: Codable, Hashable {
    let unit: String
    let every: Int
}

struct LoanInfo: Codable, Hashable {
    let pending: Int
    let endMonth: String?
    let principal: Int?
}

enum RecurringKind: String, Codable, CaseIterable {
    case income, expense, loan
}

struct Recurring: Codable, Identifiable, Hashable {
    let id: String
    let kind: RecurringKind
    let amount: Int
    let concept: String
    let category: Category
    let accountId: String?
    let day: Int
    let frequency: Frequency
    let startDate: String
    let loan: LoanInfo?
    let nextDate: String?
    let progress: Int?
}

struct DayExpense: Codable, Hashable {
    let date: String
    let expense: Int
}

struct LastDays: Codable, Hashable {
    let days: [DayExpense]
    let total: Int
}

struct NextPayment: Codable, Hashable {
    let id: String
    let concept: String
    let amount: Int
    let date: String
}

struct Home: Codable, Hashable {
    let today: String
    let balances: Balances
    let month: MonthSummary
    let lastDays: LastDays
    let nextPayment: NextPayment?
    let topGoal: GoalPlan?
    let latest: [Transaction]
}

struct TransactionList: Codable, Hashable {
    let items: [Transaction]
    let summary: MonthSummary
}

struct Report: Codable, Hashable {
    let summary: MonthSummary
    let goals: Goals
}

/// Resultado de `goals.preview`: fecha objetivo y cuota mensual para un plazo en meses.
struct GoalPreview: Codable, Hashable {
    let deadline: String
    let monthly: Int
}
