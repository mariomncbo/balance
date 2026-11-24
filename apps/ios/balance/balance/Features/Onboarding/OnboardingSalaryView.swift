import SwiftUI

struct OnboardingSalaryView: View {
    private static let presets: [(String, Int)] = [("Día 1", 1), ("Día 25", 25), ("Último día", 31)]
    @State private var amount: String
    @State private var day: Int
    @State private var other: Bool
    @State private var error: String?
    @Environment(AuthNavigator.self) private var nav

    init() {
        let s = OnboardingStore.read().salary
        _amount = State(initialValue: s.map { String($0.amount / 100) } ?? "")
        _day = State(initialValue: s?.day ?? 1)
        _other = State(initialValue: s != nil && !Self.presets.contains { $0.1 == s!.day })
    }

    var body: some View {
        let cents = Money.parse(amount)
        OnboardingFrame(step: 3, title: "Tu sueldo", lead: "¿Qué te entra al mes? Lo guardaremos como ingreso fijo.") {
            BTile(style: .income, padding: 22, spacing: 18, alignment: .center) {
                BAmountField(label: "Sueldo mensual", text: $amount, income: true, size: 48, error: error)
                    .onChange(of: amount) { _, _ in error = nil }
            }
            VStack(alignment: .leading, spacing: 10) {
                Text("¿Qué día cobras?").bEyebrow().padding(.leading, 4)
                FlowLayout(spacing: 8) {
                    ForEach(Self.presets, id: \.1) { label, d in
                        BChip(text: label, selected: !other && day == d) { day = d; other = false }
                    }
                    BChip(text: "Otro…", selected: other) { other = true }
                }
                if other {
                    BField(label: "Día del mes", text: Binding(get: { day == 0 ? "" : String(day) }, set: { day = Int($0.filter(\.isNumber).prefix(2)) ?? 0 }), keyboard: .numberPad)
                }
            }
            if let cents, cents > 0 {
                BTile(spacing: 0) {
                    Text("Cada **día \(day)** lo verás entrar como **Nómina \(Money.format(cents, signed: true, round: true))**.").bSubhead()
                }
            }
        } footer: {
            Button("Continuar", action: next).buttonStyle(.bPrimary)
            if amount.trimmingCharacters(in: .whitespaces).isEmpty { Button("Prefiero no ponerlo", action: next).buttonStyle(.bLink) }
        }
    }

    private func next() {
        var d = OnboardingStore.read()
        if amount.trimmingCharacters(in: .whitespaces).isEmpty { d.salary = nil; OnboardingStore.write(d); nav.push(.shortcut); return }
        guard let cents = Money.parse(amount), cents > 0 else { error = "Escribe un importe válido, por ejemplo 1.850,00"; return }
        guard (1...31).contains(day) else { error = "El día tiene que estar entre 1 y 31"; return }
        d.salary = OnboardingSalary(amount: cents, day: day)
        OnboardingStore.write(d)
        nav.push(.shortcut)
    }
}

/// Distribución en filas que se rompen solas, para chips.
struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        arrange(proposal.width ?? .infinity, subviews).size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = arrange(bounds.width, subviews)
        for (i, p) in result.points.enumerated() { subviews[i].place(at: CGPoint(x: bounds.minX + p.x, y: bounds.minY + p.y), proposal: .unspecified) }
    }

    private func arrange(_ width: CGFloat, _ subviews: Subviews) -> (size: CGSize, points: [CGPoint]) {
        var x: CGFloat = 0, y: CGFloat = 0, rowH: CGFloat = 0, maxW: CGFloat = 0
        var points: [CGPoint] = []
        for s in subviews {
            let size = s.sizeThatFits(.unspecified)
            if x > 0 && x + size.width > width { x = 0; y += rowH + spacing; rowH = 0 }
            points.append(CGPoint(x: x, y: y))
            x += size.width + spacing; rowH = max(rowH, size.height); maxW = max(maxW, x - spacing)
        }
        return (CGSize(width: maxW, height: y + rowH), points)
    }
}
