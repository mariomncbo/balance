import Foundation

/// Unidad de un plazo o de una frecuencia libre: "10 semanas", "cada 3 meses".
/// Los valores coinciden con los del servidor (`durationUnit`, `frequencyUnit`).
enum TimeUnit: String, CaseIterable, Codable {
    case day, week, month, year

    /// Máximo que se puede escribir (el mismo que acepta el servidor).
    var max: Int { switch self { case .day: 3650; case .week: 520; case .month: 600; case .year: 50 } }

    /// Nombre corto para el selector.
    var label: String { switch self { case .day: "Días"; case .week: "Semanas"; case .month: "Meses"; case .year: "Años" } }

    private var singular: String { switch self { case .day: "día"; case .week: "semana"; case .month: "mes"; case .year: "año" } }
    private var plural: String { switch self { case .day: "días"; case .week: "semanas"; case .month: "meses"; case .year: "años" } }

    /// "1 mes", "10 semanas".
    func format(_ n: Int) -> String { "\(n) \(n == 1 ? singular : plural)" }

    /// "Cada mes", "Cada 2 semanas".
    func every(_ n: Int) -> String { n == 1 ? "Cada \(singular)" : "Cada \(format(n))" }

    /// Valida lo escrito en el campo numérico. Devuelve el número o el mensaje de error.
    func parse(_ text: String) -> Result<Int, ParseError> {
        guard let n = Int(text.trimmingCharacters(in: .whitespaces)), n >= 1 else { return .failure(ParseError(message: "Escribe un número, por ejemplo 6")) }
        guard n <= max else { return .failure(ParseError(message: "Como mucho \(format(max))")) }
        return .success(n)
    }

    struct ParseError: Error, Equatable { let message: String }
}
