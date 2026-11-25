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
    /// Mitad de una transferencia entre cuentas (aportación a una meta). No es gasto ni ingreso.
    let transfer: TransferInfo?

    var isIncome: Bool { amount > 0 }
    var isTransfer: Bool { transfer != nil }
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

struct TransferInfo: Codable, Hashable {
    let id: String
    let goalId: String?
    let contributionId: String?
}

struct Contribution: Codable, Identifiable, Hashable {
    let id: String
    let date: String
    let amount: Int
    let transferId: String?
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
    /// Cuenta donde se guarda el dinero de la meta (destino por defecto de las aportaciones).
    let accountId: String?
    /// De la más reciente a la más antigua.
    let contributions: [Contribution]?
    /// Queda menos de un mes: `monthly` es el total que falta, no una cuota al mes.
    let short: Bool?
    let daysLeft: Int?

    var isShort: Bool { short == true }
    /// "120 € antes del 5 dic" o "77 €/mes".
    var amountText: String { isShort ? "\(Money.format(monthly, round: true)) antes del \(Dates.shortDate(deadline))" : "\(Money.format(monthly, round: true))/mes" }
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
    /// Menos de un mes: `monthly` es el total que falta.
    let short: Bool?
}

/// Estado de la clave del Atajo (`shortcut.status`). La clave nunca viene aquí: solo sus 4 últimos caracteres.
struct ShortcutStatus: Codable, Hashable {
    let active: Bool
    let hint: String?
    let createdAt: String?
    let lastUsedAt: String?
    let accountId: String?
}

/// Clave recién creada (`shortcut.create`). Es la única vez que el servidor la devuelve.
struct ShortcutCreated: Codable, Hashable {
    let token: String
    let hint: String
}
