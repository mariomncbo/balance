import SwiftUI
import Supabase

private enum Period: String, CaseIterable { case day, week, month }

struct MovementsView: View {
    @Environment(AppModel.self) private var app
    @State private var period: Period = .month
    @State private var query = ""
    @State private var debounced = ""
    @State private var category: Category?
    @State private var list = Resource<TransactionList>()
    @State private var fixed = Resource<[Recurring]>()
    /// El mes entero sin filtros: de aquí sale qué fijos ya se han pagado.
    @State private var month = Resource<TransactionList>()

    private var params: [String: AnyJSON] {
        var p: [String: AnyJSON] = ["period": .string(period.rawValue)]
        if !debounced.isEmpty { p["query"] = .string(debounced) }
        if let category { p["category"] = .string(category.rawValue) }
        return p
    }

    var body: some View {
        BScreen(spacing: 12, tabs: true) {
            TabHeader(title: "Movimientos")
            fixedSection
            HStack(spacing: 8) {
                HStack(spacing: 8) {
                    Image(systemName: "magnifyingglass").foregroundStyle(Color.textSecondary)
                    TextField("Buscar", text: $query).submitLabel(.search)
                }
                .padding(.horizontal, 14).frame(minHeight: 46).background(Color.surface, in: Capsule())
                .accessibilityElement(children: .contain)
                BSegmented(options: [(Period.day, "Día"), (.week, "Sem."), (.month, "Mes")], selection: $period).frame(width: 168)
            }
            .padding(.top, 4)
            if list.loading && list.data == nil { BLoadingTiles() }
            if let e = list.error, list.data == nil { BErrorState(error: e) { app.invalidate() } }
            if let s = list.data?.summary { summary(s) }
            if let d = list.data {
                if d.items.isEmpty {
                    if !debounced.isEmpty || category != nil {
                        BEmptyState(symbol: "magnifyingglass", title: "Sin resultados", text: "No hay movimientos con ese filtro.") {
                            Button("Quitar filtros") { query = ""; category = nil }.buttonStyle(.b(.secondary, block: false))
                        }
                    } else {
                        BEmptyState(symbol: "arrow.up.arrow.down", title: "Todavía no hay movimientos", text: "Añade el primero con el botón + de abajo.")
                    }
                } else {
                    TransactionGroups(items: d.items, today: Dates.todayMadrid())
                }
            }
        }
        .refreshable { await reload(force: true) }
        .task(id: "\(app.version)-\(period.rawValue)-\(debounced)-\(category?.rawValue ?? "")") { await reload() }
        .task(id: query) {
            try? await Task.sleep(for: .milliseconds(300))
            if !Task.isCancelled { debounced = query.trimmingCharacters(in: .whitespaces) }
        }
    }

    private func reload(force: Bool = false) async {
        async let a: () = list.load("transactions.list", params, force: force)
        async let b: () = fixed.load("recurring.list", force: force)
        async let c: () = month.load("transactions.list", ["period": .string("month")], force: force)
        _ = await (a, b, c)
    }

    /// Fila de fichas pequeñas: lo gastado y las categorías principales (pulsar una filtra la lista).
    private func summary(_ s: MonthSummary) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Gastado en \(Dates.monthName(s.month).lowercased())").bFootnote()
                    Text(Money.format(-s.expense)).bMoney(size: 15)
                }
                .miniTile()
                .accessibilityElement(children: .combine)
                ForEach(s.byCategory) { c in
                    Button { category = category == c.category ? nil : c.category } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("\(c.label) · \(c.share) %").bFootnote()
                            Text(Money.format(-c.amount)).bMoney(size: 15)
                        }
                        .miniTile(selected: category == c.category)
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Filtrar por \(c.label): \(Money.format(-c.amount)), \(c.share) %")
                    .accessibilityAddTraits(category == c.category ? .isSelected : [])
                }
            }
        }
        .scrollClipDisabled()
    }

    private var fixedMonth: FixedMonth? {
        guard let r = fixed.data else { return nil }
        return FixedMonth(recurring: r, transactions: month.data?.items ?? [], today: Dates.todayMadrid())
    }

    @ViewBuilder private var fixedSection: some View {
        if let fm = fixedMonth, let all = fixed.data {
            if fm.isEmpty {
                BTile(style: .soft, padding: 18, spacing: 10) {
                    Text("Gastos fijos").bEyebrow(.accentText)
                    Text("Tu sueldo, el alquiler, las suscripciones… Añádelos y se apuntarán solos cada mes.").bSubhead()
                    Button("Añadir fijo") { app.sheet = .recurring(id: nil) }.buttonStyle(.b(.primary, block: false))
                }
            } else {
                if fm.expenseCount > 0 || fm.nextAfterMonth != nil { fixedHero(fm) }
                let rows = fm.expenseRows(all)
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text(fm.pending.isEmpty ? "Gastos fijos" : "Próximos pagos").bEyebrow().padding(.leading, 4).accessibilityAddTraits(.isHeader)
                        Spacer()
                        Button("+ Añadir fijo") { app.sheet = .recurring(id: nil) }.bFootnote(.accentText, weight: .bold)
                    }
                    if !rows.isEmpty {
                        BList {
                            ForEach(Array(rows.enumerated()), id: \.element.fixed.id) { i, row in
                                if i > 0 { BRowDivider() }
                                FixedRow(r: row.fixed, subtitle: row.label, highlight: row.pending) { app.sheet = .recurring(id: row.fixed.id) }
                            }
                        }
                    }
                }
                if !fm.incomes.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("Ingresos fijos").bEyebrow().padding(.leading, 4).accessibilityAddTraits(.isHeader)
                            Spacer()
                            if fm.monthlyIncome > 0 {
                                Text("\(Money.format(fm.monthlyIncome, signed: true, round: fm.monthlyIncome % 100 == 0))/mes").bFootnote(.income, weight: .bold).monospacedDigit()
                            }
                        }
                        BList {
                            ForEach(Array(fm.incomes.enumerated()), id: \.element.fixed.id) { i, inc in
                                if i > 0 { BRowDivider() }
                                FixedRow(r: inc.fixed, subtitle: FixedMonth.incomeLabel(inc), highlight: false) { app.sheet = .recurring(id: inc.fixed.id) }
                            }
                        }
                    }
                }
            }
        } else if fixed.loading {
            BLoadingTiles()
        }
    }

    /// Ficha azul: cuánto llevas pagado de los gastos fijos del mes.
    private func fixedHero(_ fm: FixedMonth) -> some View {
        BTile(style: .accent, padding: 18, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Text("Gastos fijos de \(Dates.monthName(fm.month).lowercased())").bEyebrow(.onAccent)
                Spacer()
                if fm.expenseCount > 0 { Text("\(fm.paid.count) de \(fm.expenseCount) pagados").bFootnote(.onAccent, weight: .bold) }
            }
            if fm.expenseCount > 0 {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text(Money.format(fm.paidTotal)).bBig(30, color: .onAccent)
                    Text("de \(Money.format(fm.monthTotal)) al mes").bSubhead(.onAccent, weight: .semibold).opacity(0.85)
                }
                .lineLimit(1).minimumScaleFactor(0.7)
                GeometryReader { g in
                    ZStack(alignment: .leading) {
                        Capsule().fill(Color.accentHover)
                        Capsule().fill(Color.onAccent).frame(width: g.size.width * CGFloat(fm.progress) / 100)
                    }
                }
                .frame(height: 8)
                .accessibilityHidden(true)
            }
            HStack {
                if !fm.pending.isEmpty {
                    Text("Quedan \(Money.format(fm.pendingTotal)) por pagar")
                } else if let n = fm.nextAfterMonth {
                    Text("Todo pagado. Próximo: \(n.fixed.concept), el \(FixedMonth.shortDate(n.date))")
                }
                Spacer(minLength: 8)
                if let free = fm.freeAfterFixed { Text("Libre tras fijos: \(Money.format(free, round: true))") }
            }
            .bFootnote(.onAccent, weight: .semibold).monospacedDigit()
        }
        .accessibilityElement(children: .combine)
    }
}

/// Fila de un fijo (gasto, préstamo o ingreso). Al pulsarla se edita.
struct FixedRow: View {
    let r: Recurring
    let subtitle: String
    var highlight = false
    let onOpen: () -> Void

    var body: some View {
        let income = r.kind == .income
        let amount = Money.format(income ? r.amount : -r.amount, signed: true, round: r.amount % 100 == 0)
        Button(action: onOpen) {
            HStack(spacing: 12) {
                BAvatar(symbol: income ? "arrow.down" : (r.kind == .loan ? "building.columns" : r.category.symbol),
                        style: income ? .income : (highlight ? .warning : .neutral))
                VStack(alignment: .leading, spacing: 0) {
                    Text(r.concept).bTitle().lineLimit(1)
                    Text(subtitle).bFootnote(highlight ? .warning : .textSecondary, weight: highlight ? .bold : .regular).lineLimit(2)
                    if r.kind == .loan, let p = r.progress, let l = r.loan, l.pending > 0 {
                        HStack(spacing: 8) {
                            BProgress(value: p, loan: true, height: 6)
                            Text("quedan \(Money.format(l.pending, round: true))").bFootnote().fixedSize()
                        }
                        .padding(.top, 4)
                    }
                }
                Spacer(minLength: 8)
                Text(amount).bMoney(income ? .income : .text)
            }
            .padding(.horizontal, Space.s4).padding(.vertical, Space.s3).frame(minHeight: 64)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(r.concept), \(amount), \(subtitle)")
        .accessibilityHint("Editar")
    }
}

private extension View {
    func miniTile(selected: Bool = false) -> some View {
        padding(.horizontal, 12).padding(.vertical, 10)
            .background(Color.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Color.accentBorder, lineWidth: selected ? 2 : 0))
    }
}
