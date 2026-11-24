import SwiftUI

struct OnboardingLoansView: View {
    @State private var loans = OnboardingStore.read().loans
    @State private var concept = ""
    @State private var amount = ""
    @State private var day = ""
    @State private var pending = ""
    @State private var end = ""
    @State private var errors: [String: String] = [:]
    @Environment(AuthNavigator.self) private var nav

    var body: some View {
        OnboardingFrame(
            step: 2, title: "¿Tienes hipoteca o préstamos?",
            lead: "Los contaremos como gastos fijos y verás cuánto te queda por pagar."
        ) {
            if !loans.isEmpty {
                VStack(alignment: .leading, spacing: 10) {
                    ForEach(Array(loans.enumerated()), id: \.offset) { i, l in
                        BTile(spacing: 0) {
                            HStack(spacing: 12) {
                                BAvatar(symbol: "house", style: .accent)
                                VStack(alignment: .leading) {
                                    Text(l.concept).bTitle()
                                    Text("Día \(l.day) · te quedan \(Money.format(l.pending, round: true))").bFootnote()
                                }
                                Spacer(minLength: 4)
                                Text("−" + Money.format(l.amount, round: true)).bMoney()
                                BRoundButton(symbol: "xmark", label: "Quitar \(l.concept)", filled: false) { remove(i) }
                            }
                        }
                    }
                    Text("Total al mes: \(Money.format(loans.reduce(0) { $0 + $1.amount }))").bFootnote()
                }
            }
            BTile(style: .sunken, spacing: 12) {
                Text(loans.isEmpty ? "Añadir un préstamo" : "Añadir otro préstamo").bTitle()
                BField(label: "Nombre", text: $concept, placeholder: "Hipoteca, coche, estudios…", error: errors["concept"])
                Grid(horizontalSpacing: 10, verticalSpacing: 10) {
                    GridRow {
                        BField(label: "Cuota al mes", text: $amount, placeholder: "640,00", error: errors["amount"], keyboard: .decimalPad)
                        BField(label: "Día de cobro", text: $day, placeholder: "5", error: errors["day"], keyboard: .numberPad)
                    }
                    GridRow {
                        BField(label: "Te queda", text: $pending, placeholder: "98.400", error: errors["pending"], keyboard: .decimalPad)
                        BField(label: "Termina en", text: $end, placeholder: "mm/aaaa", error: errors["end"], keyboard: .numbersAndPunctuation)
                    }
                }
                Button("Añadir préstamo", action: add).buttonStyle(.b(.secondary, small: true))
            }
        } footer: {
            Button("Continuar") { nav.push(.salary) }.buttonStyle(.bPrimary)
            if loans.isEmpty && [concept, amount, day, pending, end].allSatisfy({ $0.trimmingCharacters(in: .whitespaces).isEmpty }) {
                Button("No tengo") { nav.push(.salary) }.buttonStyle(.bLink)
            }
        }
    }

    private func save(_ next: [OnboardingLoan]) {
        loans = next
        var d = OnboardingStore.read(); d.loans = next; OnboardingStore.write(d)
    }

    private func remove(_ i: Int) { var n = loans; n.remove(at: i); save(n) }

    /// "06/2041" → "2041-06". Vacío es válido (sin fecha de fin).
    private func parseEnd(_ t: String) -> (ok: Bool, value: String?) {
        let s = t.trimmingCharacters(in: .whitespaces)
        if s.isEmpty { return (true, nil) }
        let parts = s.split(separator: "/")
        guard parts.count == 2, let m = Int(parts[0]), (1...12).contains(m), parts[1].count == 4, let y = Int(parts[1]) else { return (false, nil) }
        return (true, String(format: "%04d-%02d", y, m))
    }

    private func add() {
        let amountC = Money.parse(amount), pendingC = Money.parse(pending), d = Int(day) ?? 0, endP = parseEnd(end)
        var e: [String: String] = [:]
        if concept.trimmingCharacters(in: .whitespaces).isEmpty { e["concept"] = "Ponle un nombre, por ejemplo Hipoteca" }
        if (amountC ?? 0) <= 0 { e["amount"] = "Escribe la cuota mensual" }
        if !(1...31).contains(d) { e["day"] = "Un día entre 1 y 31" }
        if (pendingC ?? 0) <= 0 { e["pending"] = "Escribe lo que te queda por pagar" }
        if !endP.ok { e["end"] = "Usa el formato mm/aaaa" }
        errors = e
        guard e.isEmpty, let amountC, let pendingC else { return }
        save(loans + [OnboardingLoan(concept: concept.trimmingCharacters(in: .whitespaces), amount: amountC, day: d, pending: pendingC, endMonth: endP.value)])
        concept = ""; amount = ""; day = ""; pending = ""; end = ""
    }
}
