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

    private var params: [String: AnyJSON] {
        var p: [String: AnyJSON] = ["period": .string(period.rawValue)]
        if !debounced.isEmpty { p["query"] = .string(debounced) }
        if let category { p["category"] = .string(category.rawValue) }
        return p
    }

    var body: some View {
        BScreen(spacing: 12, tabs: true) {
            TabHeader(title: "Movimientos")
            HStack(spacing: 8) {
                HStack(spacing: 8) {
                    Image(systemName: "magnifyingglass").foregroundStyle(Color.textSecondary)
                    TextField("Buscar", text: $query).submitLabel(.search)
                }
                .padding(.horizontal, 14).frame(minHeight: 46).background(Color.surface, in: Capsule())
                .accessibilityElement(children: .contain)
                BSegmented(options: [(Period.day, "Día"), (.week, "Sem."), (.month, "Mes")], selection: $period).frame(width: 168)
            }
            if list.loading && list.data == nil { BLoadingTiles() }
            if let e = list.error, list.data == nil { BErrorState(error: e) { app.invalidate() } }
            if let s = list.data?.summary { summary(s) }
            fixedSection
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
        .refreshable { await reload() }
        .task(id: "\(app.version)-\(period.rawValue)-\(debounced)-\(category?.rawValue ?? "")") { await reload() }
        .task(id: query) {
            try? await Task.sleep(for: .milliseconds(300))
            if !Task.isCancelled { debounced = query.trimmingCharacters(in: .whitespaces) }
        }
    }

    private func reload() async {
        async let a: () = list.load("transactions.list", params)
        async let b: () = fixed.load("recurring.list")
        _ = await (a, b)
    }

    private func summary(_ s: MonthSummary) -> some View {
        VStack(spacing: 10) {
            BTile(padding: 16, spacing: 0) {
                HStack {
                    VStack(alignment: .leading, spacing: 0) {
                        Text("Gastado en \(Dates.monthName(s.month).lowercased())").bEyebrow()
                        Text(Money.format(-s.expense)).bBig(26)
                    }
                    Spacer()
                    if let v = s.vsPrevious, v != 0 {
                        BPill(text: "\(Money.format(abs(v), round: true)) \(v > 0 ? "menos" : "más")", style: v > 0 ? .income : .expense)
                    }
                }
            }
            let cats = Array(s.byCategory.prefix(4))
            Grid(horizontalSpacing: 10, verticalSpacing: 10) {
                ForEach(Array(stride(from: 0, to: cats.count, by: 2)), id: \.self) { i in
                    GridRow {
                        categoryTile(cats[i])
                        if i + 1 < cats.count { categoryTile(cats[i + 1]) } else { Color.clear }
                    }
                }
            }
        }
    }

    private func categoryTile(_ c: CategoryShare) -> some View {
        Button { category = category == c.category ? nil : c.category } label: {
            BTile(padding: 14, spacing: 6) {
                HStack { Text(c.label).bSubhead(weight: .bold); Spacer(); Text("\(c.share) %").bFootnote() }
                Text(Money.format(-c.amount)).bMoney()
                BProgress(value: c.share, loan: true, height: 6)
            }
            .overlay(RoundedRectangle(cornerRadius: Radius.lg, style: .continuous).strokeBorder(Color.accentBorder, lineWidth: category == c.category ? 2 : 0))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Filtrar por \(c.label): \(Money.format(-c.amount)), \(c.share) %")
        .accessibilityAddTraits(category == c.category ? .isSelected : [])
    }

    @ViewBuilder private var fixedSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Fijos").bEyebrow().padding(.leading, 4).accessibilityAddTraits(.isHeader)
                Spacer()
                Button("Añadir") { app.sheet = .recurring(id: nil) }.bFootnote(.accentText, weight: .bold)
            }
            if let f = fixed.data, !f.isEmpty {
                FlowLayout(spacing: 8) { ForEach(f) { r in FixedTag(r: r) { app.sheet = .recurring(id: r.id) } } }
            } else if !fixed.loading {
                Text("Tu sueldo, el alquiler, las suscripciones… Añádelos y se apuntarán solos.").bSub()
            }
        }
    }
}

struct FixedTag: View {
    let r: Recurring
    let onOpen: () -> Void

    var body: some View {
        let amount = Money.format(r.kind == .income ? r.amount : -r.amount, signed: true, round: r.amount % 100 == 0)
        let meta = r.kind == .loan && r.loan != nil
            ? "Día \(r.day) · quedan \(Money.format(r.loan!.pending, round: true))"
            : "Día \(r.day) · \(r.frequency.unit == "year" ? "anual" : "mensual")"
        let (bg, fg): (Color, Color) = switch r.kind { case .income: (.incomeSubtle, .income); case .expense: (.expenseSubtle, .expense); case .loan: (.surface, .text) }
        Button(action: onOpen) {
            VStack(alignment: .leading, spacing: 2) {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(r.concept).font(.system(size: 15, weight: .bold))
                    Text(amount).font(.system(size: 15)).monospacedDigit()
                }
                Text(meta).font(.system(size: 13)).foregroundStyle(r.kind == .loan ? Color.textSecondary : fg)
                if r.kind == .loan, let p = r.progress { BProgress(value: p, loan: true, height: 6).padding(.top, 4) }
            }
            .foregroundStyle(fg)
            .padding(.horizontal, 14).padding(.vertical, 10)
            .background(bg, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(r.concept), \(amount). Editar")
    }
}
