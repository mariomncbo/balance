import SwiftUI

private let dotColors: [Color] = [.accent, .incomeSolid, .textSecondary, .warningSolid, .expenseSolid]

struct HomeView: View {
    @Environment(AppModel.self) private var app
    @Environment(Router.self) private var router
    @State private var res = Resource<Home>()

    var body: some View {
        BScreen(spacing: 14, tabs: true) {
            TabHeader(eyebrow: res.data.map { Dates.longDate($0.today) }, title: app.profile.map { "Hola, \($0.name)" } ?? "Hola")
            if res.loading && res.data == nil { BLoadingTiles() }
            if let error = res.error, res.data == nil { BErrorState(error: error) { app.invalidate() } }
            if let d = res.data { content(d) }
        }
        .refreshable { await res.load("home") }
        .task(id: app.version) { await res.load("home") }
    }

    @ViewBuilder private func content(_ d: Home) -> some View {
        if d.balances.accounts.isEmpty {
            BTile { Text("Saldo total").bEyebrow(); Text(Money.format(0)).bBig(color: .textSecondary) }
            BEmptyState(symbol: "building.columns", title: "Añade tu primera cuenta", text: "Tu banco, tu cuenta de ahorro o el efectivo. Aquí verás el saldo de todas juntas.") {
                Button("Añadir cuenta") { app.sheet = .account(id: nil, local: false) }.buttonStyle(.b(.primary, block: false))
            }
        } else {
            tiles(d)
            latest(d)
        }
    }

    private func tiles(_ d: Home) -> some View {
        VStack(spacing: 10) {
            NavigationLink(value: Route.report) {
                BTile(spacing: 8) {
                    Text("Saldo total").bEyebrow()
                    HStack {
                        Text(Money.format(d.balances.total)).bBig()
                        Spacer()
                        BPill(text: "\(Money.format(d.month.saved, signed: true)) este mes", style: d.month.saved >= 0 ? .income : .expense)
                    }
                }
            }.buttonStyle(.plain)

            BTilePair {
                Button { router.tab = .movements } label: { weekTile(d) }.buttonStyle(.plain)
                Button { router.tab = .goals } label: { goalTile(d) }.buttonStyle(.plain)
            }
            BTilePair {
                nextTile(d)
                monthTile(d)
            }
            accountsTile(d)
        }
    }

    private func weekTile(_ d: Home) -> some View {
        BTile(spacing: 10) {
            Text("Últimos 7 días").bEyebrow()
            Text(Money.format(-d.lastDays.total)).bMoney()
            WeekBars(days: d.lastDays.days)
        }
    }

    @ViewBuilder private func goalTile(_ d: Home) -> some View {
        if let g = d.topGoal {
            BTile(spacing: 6, alignment: .center) {
                Text("Meta más cerca").bEyebrow().frame(maxWidth: .infinity, alignment: .leading)
                ZStack {
                    Circle().stroke(Color.surfaceSelected, lineWidth: 9)
                    Circle().trim(from: 0, to: CGFloat(g.progress) / 100).stroke(Color.goal, style: StrokeStyle(lineWidth: 9, lineCap: .round)).rotationEffect(.degrees(-90))
                    Text("\(g.progress) %").font(.system(size: 15, weight: .heavy)).monospacedDigit()
                }
                .frame(width: 76, height: 76)
                .accessibilityElement().accessibilityLabel("\(g.name): \(g.progress) %")
                Text(g.name).bTitle()
                Text("\(Money.format(g.monthly, round: true))/mes").bFootnote(.accentText, weight: .bold)
            }
        } else {
            BTile(style: .soft, spacing: 6) {
                BAvatar(symbol: "target", style: .solidAccent)
                Text("Crea tu primera meta").bTitle().padding(.top, 4)
                Text("Te diremos cuánto apartar al mes").bFootnote(.accentText)
            }
        }
    }

    @ViewBuilder private func nextTile(_ d: Home) -> some View {
        if let n = d.nextPayment {
            BTile(style: .warning, spacing: 4) {
                BAvatar(symbol: "clock", style: .warning, size: 32).background(Circle().fill(Color.surface))
                Text(n.date == d.today ? "Hoy" : "El \(Dates.parse(n.date).d)").bFootnote(.warning, weight: .bold).padding(.top, 4)
                Text(n.concept).bTitle()
                Text(Money.format(-n.amount)).bMoney()
            }
        } else {
            BTile(spacing: 4) { Text("Próximo pago").bEyebrow(); Text("Sin pagos fijos a la vista").bSub() }
        }
    }

    private func monthTile(_ d: Home) -> some View {
        NavigationLink(value: Route.report) {
            BTile(spacing: 8) {
                Text("Este mes").bEyebrow()
                kv("Entra", Money.format(d.month.income, signed: true, round: true), .income)
                kv("Sale", Money.format(-d.month.expense, round: true), .text)
                kv("Por pagar", Money.format(-d.month.pending, round: true), .text)
            }
        }.buttonStyle(.plain)
    }

    private func kv(_ k: String, _ v: String, _ c: Color) -> some View {
        HStack { Text(k).bSubhead(.textSecondary); Spacer(); Text(v).bSubhead(c, weight: .bold).monospacedDigit() }
    }

    private func accountsTile(_ d: Home) -> some View {
        BTile(spacing: 12) {
            HStack {
                Text("Dónde está tu dinero").bEyebrow()
                Spacer()
                Button("Añadir cuenta") { app.sheet = .account(id: nil, local: false) }.bFootnote(.accentText, weight: .bold)
            }
            GeometryReader { g in
                HStack(spacing: 3) {
                    ForEach(Array(d.balances.accounts.enumerated()), id: \.element.id) { i, a in
                        Capsule().fill(dotColors[i % dotColors.count]).frame(width: max(8, g.size.width * CGFloat(max(a.share, 1)) / 100))
                    }
                }
            }
            .frame(height: 12).clipShape(Capsule())
            .accessibilityElement().accessibilityLabel(d.balances.accounts.map { "\($0.name) \($0.share) %" }.joined(separator: ", "))
            VStack(spacing: 8) {
                ForEach(Array(d.balances.accounts.enumerated()), id: \.element.id) { i, a in
                    NavigationLink(value: Route.account(a.id)) {
                        HStack(spacing: 8) {
                            Circle().fill(dotColors[i % dotColors.count]).frame(width: 10, height: 10)
                            Text(a.name).bSubhead()
                            Spacer()
                            Text(Money.format(a.balance)).bSubhead(weight: .semibold).monospacedDigit()
                        }
                        .frame(minHeight: 32)
                    }.buttonStyle(.plain)
                }
            }
        }
    }

    private func latest(_ d: Home) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Últimos movimientos").bTitle().accessibilityAddTraits(.isHeader)
                Spacer()
                Button("Ver todos") { router.tab = .movements }.bFootnote(.accentText, weight: .bold)
            }
            if d.latest.isEmpty {
                Text("Todavía no hay movimientos. Pulsa + para añadir el primero.").bSub()
            } else {
                BList {
                    ForEach(Array(d.latest.enumerated()), id: \.element.id) { i, t in
                        if i > 0 { BRowDivider() }
                        TransactionRow(t: t, today: d.today)
                    }
                }
            }
        }
    }
}

struct WeekBars: View {
    let days: [DayExpense]

    var body: some View {
        let maxV = max(1, days.map(\.expense).max() ?? 1)
        VStack(spacing: 4) {
            HStack(alignment: .bottom, spacing: 4) {
                ForEach(Array(days.enumerated()), id: \.element.date) { i, d in
                    RoundedRectangle(cornerRadius: 5).fill(i == days.count - 1 ? Color.accent : Color.surfaceSelected)
                        .frame(height: max(4, 60 * CGFloat(d.expense) / CGFloat(maxV)))
                }
            }
            .frame(height: 60, alignment: .bottom)
            HStack(spacing: 4) {
                ForEach(Array(days.enumerated()), id: \.element.date) { i, d in
                    Text(Dates.weekdayInitial(d.date)).font(.system(size: 11, weight: i == days.count - 1 ? .heavy : .regular))
                        .foregroundStyle(i == days.count - 1 ? Color.accentText : Color.textSecondary).frame(maxWidth: .infinity)
                }
            }
        }
        .accessibilityElement()
        .accessibilityLabel("Gasto de los últimos 7 días: " + days.map { "\(Dates.weekdayInitial($0.date)) \(Money.format($0.expense))" }.joined(separator: ", "))
    }
}
