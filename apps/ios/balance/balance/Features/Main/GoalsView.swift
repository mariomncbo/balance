import SwiftUI

struct GoalsView: View {
    @Environment(AppModel.self) private var app
    @State private var res = Resource<Goals>()

    var body: some View {
        BScreen(spacing: 14, tabs: true) {
            TabHeader(title: "Metas")
            if res.loading && res.data == nil { BLoadingTiles() }
            if let e = res.error, res.data == nil { BErrorState(error: e) { app.invalidate() } }
            if let g = res.data {
                if g.goals.isEmpty {
                    BEmptyState(symbol: "target", title: "Todavía no tienes metas", text: "Un coche, una casa, un viaje, una PS5… Crea una meta y te diremos cuánto apartar cada mes.") {
                        Button("Crear meta") { app.sheet = .goal(id: nil) }.buttonStyle(.b(.primary, block: false))
                    }
                    .padding(.top, 60)
                } else {
                    content(g)
                }
            }
        }
        .refreshable { await res.load("goals.list", force: true) }
        .task(id: app.version) { await res.load("goals.list") }
    }

    private func content(_ g: Goals) -> some View {
        let rings = Array(g.goals.prefix(2))
        let rest = Array(g.goals.dropFirst(2))
        return VStack(spacing: 10) {
            BTile(style: .accent, padding: 18, spacing: 4) {
                Text("Para cumplir todas tus metas").bEyebrow(.onAccent).opacity(0.85)
                Text("\(Money.format(g.monthlyTotal, round: g.monthlyTotal % 100 == 0)) al mes").bBig(color: .onAccent)
                Text("Llevas \(Money.format(g.saved, round: g.saved % 100 == 0)) de \(Money.format(g.target, round: g.target % 100 == 0)) \(g.goals.count == 1 ? "en tu meta" : "entre las \(spelled(g.goals.count))")")
                    .font(.system(size: 13, weight: .semibold))
            }
            .accessibilityElement(children: .combine)

            BTilePair {
                ForEach(rings) { goal in Button { app.sheet = .goalDetail(id: goal.id) } label: { ringTile(goal) }.buttonStyle(.plain) }
                if rings.count == 1 { Color.clear.frame(maxWidth: .infinity) }
            }
            ForEach(rest) { goal in Button { app.sheet = .goalDetail(id: goal.id) } label: { wideTile(goal) }.buttonStyle(.plain) }

            Button { app.sheet = .goal(id: nil) } label: {
                BTile(style: .soft, spacing: 0) {
                    HStack(spacing: 8) { Image(systemName: "plus"); Text("Crear meta").font(.system(size: 17, weight: .bold)) }
                        .foregroundStyle(Color.accentText).frame(maxWidth: .infinity, minHeight: 28)
                }
            }.buttonStyle(.plain)
        }
    }

    private func spelled(_ n: Int) -> String { ["", "una", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"].indices.contains(n) ? ["", "una", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"][n] : "\(n)" }

    @ViewBuilder private func status(_ g: GoalPlan) -> some View {
        if g.done { BPill(text: "Conseguida", style: .income, symbol: "checkmark") }
        else if g.behind { BPill(text: "\(g.amountText) · con retraso", style: .warning, symbol: "exclamationmark.triangle") }
        else if g.isShort { BPill(text: g.amountText, style: .accent) }
        else { BPill(text: "\(g.amountText) · \(Dates.monthShort(g.deadline))", style: .accent) }
    }

    private func ringTile(_ g: GoalPlan) -> some View {
        BTile(spacing: 6) {
            BRing(percent: g.progress, label: "\(g.name): \(g.progress) %")
            Text(g.name).bTitle().lineLimit(1).padding(.top, 4)
            Text("\(Money.format(g.saved, round: g.saved % 100 == 0)) de \(Money.format(g.target, round: g.target % 100 == 0))").bFootnote().monospacedDigit()
            status(g)
        }
    }

    private func wideTile(_ g: GoalPlan) -> some View {
        BTile(spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Text(g.name).bTitle().lineLimit(1)
                Spacer(minLength: 8)
                (Text(Money.format(g.saved, round: g.saved % 100 == 0)).font(.system(size: 17, weight: .bold)).foregroundStyle(Color.text)
                    + Text(" de \(Money.format(g.target, round: g.target % 100 == 0))").font(.system(size: 13)).foregroundStyle(Color.textSecondary)).monospacedDigit()
            }
            BProgress(value: g.progress)
            HStack {
                if g.done { Text("Conseguida").bFootnote(.income, weight: .bold) }
                else if g.behind { Text("Aparta \(g.amountText) · con retraso").bFootnote(.warning, weight: .bold) }
                else { (Text("Aparta ") + Text(g.amountText).bold().foregroundStyle(Color.accentText)).bFootnote() }
                Spacer()
                if !g.isShort { Text(Dates.monthTitle(Dates.monthOf(g.deadline))).bFootnote() }
            }
        }
        .accessibilityElement(children: .combine)
    }
}
