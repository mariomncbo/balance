import SwiftUI
import Supabase

struct RecurringSheet: View {
    let id: String?
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var accounts = Resource<Balances>()
    @State private var list = Resource<[Recurring]>()
    @State private var kind: RecurringKind = .expense
    @State private var amount = ""
    @State private var concept = ""
    @State private var day = ""
    @State private var everyText = "1"
    @State private var unit: TimeUnit = .month
    /// Con días o semanas: fecha del primer cobro (no hay "día del mes").
    @State private var firstDate = Date()
    @State private var category: Category = .suscripciones
    @State private var accountId = ""
    @State private var pending = ""
    @State private var principal = ""
    @State private var end = ""
    @State private var errors: [String: String] = [:]
    @State private var busy = false
    @State private var filled = false

    private var every: Int? { try? unit.parse(everyText).get() }
    private var byDate: Bool { unit == .day || unit == .week }

    private static let formatter: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.timeZone = TimeZone(identifier: "Europe/Madrid")
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    private var loading: Bool { (accounts.loading && accounts.data == nil) || (id != nil && list.loading && list.data == nil) }
    private let kinds: [(RecurringKind, String, String)] = [(.income, "Ingreso", "arrow.up"), (.expense, "Gasto", "arrow.down"), (.loan, "Préstamo", "house")]

    var body: some View {
        BSheet(title: id == nil ? "Nuevo fijo" : "Editar fijo") {
            if loading { Text("Cargando…").bSub() } else { form }
        }
        .task {
            async let a: () = accounts.load("accounts.list", allowStale: false)
            async let b: () = list.load("recurring.list", allowStale: false)
            _ = await (a, b)
            fillOnce()
        }
    }

    @ViewBuilder private var form: some View {
        HStack(spacing: 8) {
            ForEach(kinds, id: \.0) { k, label, symbol in
                Button { kind = k; category = k == .income ? .ingresos : (k == .loan ? .hogar : .suscripciones) } label: {
                    VStack(spacing: 4) { Image(systemName: symbol).font(.system(size: 18)); Text(label).font(.system(size: 14, weight: .bold)) }
                        .foregroundStyle(kind == k ? Color.onAccent : Color.text)
                        .frame(maxWidth: .infinity).padding(.vertical, 10)
                        .background(kind == k ? Color.accent : Color.surface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                }
                .buttonStyle(.plain).accessibilityAddTraits(kind == k ? .isSelected : [])
            }
        }
        BTile(padding: 16, spacing: 4, alignment: .center) { BAmountField(label: unit.every(every ?? 1), text: $amount, error: errors["amount"]) }
        BField(label: "Concepto", text: $concept, placeholder: kind == .income ? "Nómina" : (kind == .loan ? "Hipoteca" : "Netflix"), error: errors["concept"])
        BDurationField(label: "¿Cada cuánto?", amount: $everyText, unit: $unit, error: errors["every"])
        if byDate {
            VStack(alignment: .leading, spacing: 6) {
                Text("Primer cobro").bEyebrow().padding(.leading, 4)
                DatePicker("Primer cobro", selection: $firstDate, displayedComponents: .date).labelsHidden()
                    .frame(maxWidth: .infinity, minHeight: 54, alignment: .leading).padding(.horizontal, Space.s3)
                    .background(Color.surface, in: RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
                    .environment(\.locale, Locale(identifier: "es_ES")).environment(\.timeZone, TimeZone(identifier: "Europe/Madrid")!)
                Text("Desde ese día se repite \(unit.every(every ?? 1).lowercased()).").bFootnote().padding(.leading, 4)
            }
        } else {
            BField(label: "Día de cobro", text: $day, placeholder: "5", error: errors["day"], keyboard: .numberPad)
        }
        if kind != .income {
            VStack(alignment: .leading, spacing: 8) {
                Text("Categoría").bEyebrow().padding(.leading, 4)
                FlowLayout(spacing: 8) { ForEach(Category.expense) { c in BChip(text: c.label, selected: category == c) { category = c } } }
            }
        }
        if !(accounts.data?.accounts.isEmpty ?? true) { AccountPicker(label: "Cuenta", selection: $accountId, accounts: accounts.data?.accounts ?? [], allowNone: true) }
        if kind == .loan {
            BTile(style: .soft, padding: 14, spacing: 12) {
                Grid(horizontalSpacing: 10, verticalSpacing: 10) {
                    GridRow(alignment: .top) {
                        BField(label: "Te queda por pagar", text: $pending, placeholder: "98.400", error: errors["pending"], keyboard: .decimalPad)
                        BField(label: "Termina en", text: $end, placeholder: "mm/aaaa", error: errors["end"], keyboard: .numbersAndPunctuation)
                    }
                }
                BField(label: "Importe inicial del préstamo (opcional)", text: $principal, error: errors["principal"], help: "Con él se dibuja cuánto llevas amortizado.", keyboard: .decimalPad)
            }
        }
        if let m = errors["form"] { Text(m).bFootnote(.expense) }
        Button(busy ? "Guardando…" : "Guardar") { Task { await save() } }.buttonStyle(.bPrimary).disabled(busy)
        if id != nil {
            DeleteBlock(label: "Borrar fijo", question: "¿Borrar este fijo?", detail: "Dejará de apuntarse solo. Los movimientos que ya se apuntaron se quedan.", busy: busy) { Task { await remove() } }
        }
    }

    private func euros(_ c: Int?) -> String { c.map { String(format: "%.2f", Double($0) / 100).replacingOccurrences(of: ".", with: ",") } ?? "" }

    private func fillOnce() {
        guard !filled else { return }
        filled = true
        if let id, let r = list.data?.first(where: { $0.id == id }) {
            kind = r.kind; amount = euros(r.amount); concept = r.concept; day = String(r.day)
            unit = TimeUnit(rawValue: r.frequency.unit) ?? .month; everyText = String(r.frequency.every)
            if byDate { firstDate = Self.formatter.date(from: r.startDate) ?? Date() }
            category = r.category; accountId = r.accountId ?? ""; pending = euros(r.loan?.pending); principal = euros(r.loan?.principal)
            if let e = r.loan?.endMonth { end = "\(e.suffix(2))/\(e.prefix(4))" }
        } else {
            accountId = accounts.data?.accounts.first?.id ?? ""
        }
    }

    private func parseEnd(_ t: String) -> (ok: Bool, value: String?) {
        let s = t.trimmingCharacters(in: .whitespaces)
        if s.isEmpty { return (true, nil) }
        let p = s.split(separator: "/")
        guard p.count == 2, let m = Int(p[0]), (1...12).contains(m), p[1].count == 4, let y = Int(p[1]) else { return (false, nil) }
        return (true, String(format: "%04d-%02d", y, m))
    }

    private func save() async {
        let cents = Money.parse(amount), d = Int(day) ?? 0, pend = Money.parse(pending), endP = parseEnd(end)
        let prin: Int? = principal.trimmingCharacters(in: .whitespaces).isEmpty ? nil : Money.parse(principal)
        var e: [String: String] = [:]
        if (cents ?? 0) <= 0 { e["amount"] = "Escribe un importe válido, por ejemplo 9,99" }
        if concept.trimmingCharacters(in: .whitespaces).isEmpty { e["concept"] = "Ponle un nombre, por ejemplo Netflix" }
        if !byDate && !(1...31).contains(d) { e["day"] = "Un día entre 1 y 31" }
        if case .failure(let err) = unit.parse(everyText) { e["every"] = err.message }
        if kind == .loan {
            if (pend ?? 0) <= 0 { e["pending"] = "Escribe lo que te queda por pagar" }
            if !principal.trimmingCharacters(in: .whitespaces).isEmpty && prin == nil { e["principal"] = "Importe no válido" }
            if !endP.ok { e["end"] = "Usa el formato mm/aaaa" }
        }
        errors = e
        guard e.isEmpty, let cents, let every else { return }
        busy = true
        defer { busy = false }
        var params: [String: AnyJSON] = [
            "kind": .string(kind.rawValue), "amount": .integer(cents), "concept": .string(concept.trimmingCharacters(in: .whitespaces)),
            "category": .string(category.rawValue), "frequencyUnit": .string(unit.rawValue), "frequencyEvery": .integer(every),
        ]
        if byDate { params["startDate"] = .string(Self.formatter.string(from: firstDate)) } else { params["day"] = .integer(d) }
        if !accountId.isEmpty { params["accountId"] = .string(accountId) }
        if kind == .loan, let pend {
            params["pending"] = .integer(pend)
            if let v = endP.value { params["endMonth"] = .string(v) }
            if let prin, prin > 0 { params["principal"] = .integer(prin) }
        }
        do {
            if let id { params["id"] = .string(id); try await API.send("recurring.update", params) } else { try await API.send("recurring.create", params) }
            app.invalidate(); dismiss()
        } catch { errors = ["form": API.map(error).message] }
    }

    private func remove() async {
        guard let id else { return }
        busy = true
        defer { busy = false }
        do { try await API.send("recurring.delete", ["id": .string(id)]); app.invalidate(); dismiss() }
        catch { errors = ["form": API.map(error).message] }
    }
}
