import SwiftUI
import Supabase

struct ReportView: View {
    @Environment(AppModel.self) private var app
    private let current = Dates.monthOf(Dates.todayMadrid())
    @State private var month = Dates.monthOf(Dates.todayMadrid())
    @State private var res = Resource<Report>()

    private let slice: [Color] = [.text, .textSecondary, .border, .surfaceSelected]

    var body: some View {
        BScreen(spacing: 12) {
            HStack {
                BRoundButtonDismiss()
                Spacer()
                HStack(spacing: 2) {
                    Button { month = Dates.shiftMonth(month, -1) } label: { Image(systemName: "chevron.left").frame(width: 34, height: 34) }
                        .accessibilityLabel("Mes anterior")
                    Text(Dates.monthTitle(month)).font(.system(size: 17, weight: .bold)).accessibilityAddTraits(.isHeader)
                    Button { month = Dates.shiftMonth(month, 1) } label: { Image(systemName: "chevron.right").frame(width: 34, height: 34) }
                        .disabled(month >= current).accessibilityLabel("Mes siguiente")
                }
                .foregroundStyle(Color.text)
                Spacer()
                Color.clear.frame(width: 44, height: 44)
            }
            if res.loading && res.data == nil { BLoadingTiles() }
            if let e = res.error, res.data == nil { BErrorState(error: e) { app.invalidate() } }
            if let r = res.data { content(r) }
        }
        .toolbar(.hidden, for: .navigationBar)
        .task(id: "\(app.version)-\(month)") { await res.load("report.month", ["month": .string(month)]) }
    }

    @ViewBuilder private func content(_ r: Report) -> some View {
        let s = r.summary
        VStack(spacing: 10) {
            BTile(style: s.saved >= 0 ? .income : .expense, padding: 18, spacing: 2) {
                Text(s.saved >= 0 ? "Has ahorrado" : "Has gastado de más").bFootnote(s.saved >= 0 ? .income : .expense, weight: .bold)
                HStack {
                    Text(Money.format(s.saved, signed: true)).bBig(36, color: s.saved >= 0 ? .income : .expense)
                    Spacer()
                    if s.income > 0 {
                        Text("\(s.savedShare) % de lo que entró").font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(s.saved >= 0 ? Color.income : Color.expense)
                            .padding(.horizontal, 10).padding(.vertical, 4).background(Color.surface, in: Capsule())
                    }
                }
            }
            BTilePair {
                BTile(spacing: 2) { Text("Ingresos").bEyebrow(); Text(Money.format(s.income, signed: true)).bMoney(.income, size: 18) }
                BTile(spacing: 2) { Text("Gastos").bEyebrow(); Text(Money.format(-s.expense)).bMoney(size: 18) }
            }
            if let v = s.vsPrevious, v != 0 {
                BTile(style: .soft, padding: 14, spacing: 0) {
                    HStack(spacing: 12) {
                        BAvatar(symbol: v > 0 ? "arrow.down.right" : "arrow.up.right", style: .solidAccent)
                        Text("Has gastado **\(Money.format(abs(v))) \(v > 0 ? "menos" : "más")** que el mes anterior.").bSubhead()
                    }
                }
            }
            BTile(spacing: 10) {
                Text("En qué se fue").bEyebrow()
                if s.byCategory.isEmpty { Text("No hay gastos este mes.").bSub() } else {
                    GeometryReader { g in
                        HStack(spacing: 3) {
                            ForEach(Array(s.byCategory.enumerated()), id: \.element.id) { i, c in
                                Capsule().fill(slice[min(i, slice.count - 1)]).frame(width: max(8, g.size.width * CGFloat(max(c.share, 1)) / 100))
                            }
                        }
                    }
                    .frame(height: 12).clipShape(Capsule())
                    .accessibilityElement().accessibilityLabel(s.byCategory.map { "\($0.label) \($0.share) %" }.joined(separator: ", "))
                    ForEach(Array(s.byCategory.enumerated()), id: \.element.id) { i, c in
                        HStack(spacing: 8) {
                            Circle().fill(slice[min(i, slice.count - 1)]).frame(width: 10, height: 10)
                            Text(c.label).bSubhead(); Spacer()
                            Text(Money.format(c.amount, round: true)).bSubhead(weight: .bold).monospacedDigit()
                        }
                    }
                }
            }
            if month == current && !r.goals.goals.isEmpty {
                BTile(spacing: 10) {
                    Text("Metas").bEyebrow()
                    ForEach(r.goals.goals) { g in
                        HStack(spacing: 10) {
                            Text(g.name).bSubhead().frame(maxWidth: .infinity, alignment: .leading)
                            BProgress(value: g.progress).frame(width: 90)
                            Text("\(g.progress) %").bSubhead().monospacedDigit().frame(width: 44, alignment: .trailing)
                        }
                    }
                }
            }
        }
    }
}

struct BRoundButtonDismiss: View {
    @Environment(\.dismiss) private var dismiss
    var body: some View { BRoundButton(symbol: "chevron.left", label: "Atrás") { dismiss() } }
}
