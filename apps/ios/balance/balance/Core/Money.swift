import Foundation

/// Dinero siempre en céntimos (enteros). Formato español: 1.250,00 € y signo − (U+2212).
enum Money {
    private static let formatter: NumberFormatter = {
        let f = NumberFormatter()
        f.locale = Locale(identifier: "es_ES")
        f.numberStyle = .decimal
        f.minimumFractionDigits = 2
        f.maximumFractionDigits = 2
        f.usesGroupingSeparator = true
        f.groupingSize = 3
        f.minimumGroupingDigits = 1 // también agrupa los miles de 4 cifras: 1.234,00
        return f
    }()

    private static let integer: NumberFormatter = {
        let f = NumberFormatter()
        f.locale = Locale(identifier: "es_ES")
        f.numberStyle = .decimal
        f.maximumFractionDigits = 0
        f.usesGroupingSeparator = true
        f.minimumGroupingDigits = 1
        return f
    }()

    static func format(_ cents: Int, signed: Bool = false, round: Bool = false) -> String {
        let abs = Swift.abs(cents)
        let body = round
            ? integer.string(from: NSNumber(value: (Double(abs) / 100).rounded())) ?? "0"
            : formatter.string(from: NSNumber(value: Double(abs) / 100)) ?? "0,00"
        let sign = cents < 0 ? "\u{2212}" : (signed && cents > 0 ? "+" : "")
        return "\(sign)\(body)\u{00A0}€"
    }

    /// Convierte lo que escribe el usuario ("48,90", "1.250,5", "12") en céntimos. nil si no es válido.
    static func parse(_ text: String) -> Int? {
        var t = text.replacingOccurrences(of: "€", with: "")
            .filter { !$0.isWhitespace && $0 != "\u{00A0}" }
        if let first = t.first, "+-\u{2212}".contains(first) { t.removeFirst() }
        if t.isEmpty { return nil }
        if t.contains(",") {
            t = t.replacingOccurrences(of: ".", with: "").replacingOccurrences(of: ",", with: ".")
        } else if let lastDot = t.lastIndex(of: ".") {
            // "1.250" = mil doscientos cincuenta; "12.5" = doce y medio
            let decimals = t.distance(from: lastDot, to: t.endIndex) - 1
            let onlyOneDot = t.firstIndex(of: ".") == lastDot
            if decimals == 3 && onlyOneDot { t = t.replacingOccurrences(of: ".", with: "") }
        }
        let parts = t.split(separator: ".", omittingEmptySubsequences: false)
        guard parts.count <= 2,
              parts.allSatisfy({ $0.allSatisfy(\.isASCII) && $0.allSatisfy(\.isNumber) }),
              !parts[0].isEmpty,
              parts.count == 1 || (1...2).contains(parts[1].count),
              let value = Double(t), value < 90_000_000_000_000 else { return nil }
        return Int((value * 100).rounded())
    }
}
