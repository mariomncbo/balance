import SwiftUI
import Supabase

/// Movimiento ya relleno (por ejemplo, el que se ha leído de un ticket). `amount` va en céntimos y positivo.
struct MovementDraft: Hashable {
    let accountId: String
    let amount: Int
    let concept: String
    let category: Category
    let date: String
    var source: Source = .ticket
}

struct MovementSheet: View {
    let id: String?
    var draft: MovementDraft?
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var accounts = Resource<Balances>()
    @State private var tx = Resource<Transaction>()
    @State private var income = false
    @State private var amount = ""
    @State private var concept = ""
    @State private var category: Category = .comida
    @State private var accountId = ""
    @State private var date = Date()
    @State private var note = ""
    @State private var source: Source = .manual
    @State private var errors: [String: String] = [:]
    @State private var busy = false
    @State private var filled = false

    private var list: [AccountBalance] { accounts.data?.accounts ?? [] }
    private var loading: Bool { (accounts.loading && accounts.data == nil) || (id != nil && tx.loading && tx.data == nil) }

    var body: some View {
        BSheet(title: draft != nil ? "Confirma el gasto" : id == nil ? "Nuevo movimiento" : "Editar movimiento") {
            if draft != nil, !loading {
                Text("Esto es lo que he leído del ticket. Revísalo y corrige lo que haga falta antes de guardar.").bSub()
            }
            if loading {
                Text("Cargando…").bSub()
            } else if list.isEmpty {
                BEmptyState(symbol: "building.columns", title: "Primero añade una cuenta", text: "Los movimientos se apuntan en una cuenta.") {
                    Button("Ir a Principal") { dismiss() }.buttonStyle(.b(.primary, block: false))
                }
            } else {
                BTile(padding: 18, spacing: 10, alignment: .center) {
                    BSegmented(options: [(false, "Gasto"), (true, "Ingreso")], selection: $income).frame(width: 220)
                        .onChange(of: income) { _, v in category = v ? .ingresos : .comida }
                    BAmountField(label: income ? "Importe que entra" : "Importe que sale", text: $amount, income: income, error: errors["amount"])
                }
                BField(label: "Concepto", text: $concept, placeholder: "Mercadona", error: errors["concept"])
                VStack(alignment: .leading, spacing: 8) {
                    Text("Categoría").bEyebrow().padding(.leading, 4)
                    FlowLayout(spacing: 8) {
                        ForEach(income ? Category.income : Category.expense) { c in BChip(text: c.label, selected: category == c) { category = c } }
                    }
                }
                Grid(horizontalSpacing: 10, verticalSpacing: 10) {
                    GridRow(alignment: .top) {
                        AccountPicker(label: "Cuenta", selection: $accountId, accounts: list)
                        VStack(alignment: .leading, spacing: 6) {
                            Text("Fecha").bEyebrow().padding(.leading, 4)
                            DatePicker("Fecha", selection: $date, displayedComponents: .date).labelsHidden()
                                .frame(maxWidth: .infinity, minHeight: 54, alignment: .leading).padding(.horizontal, Space.s3)
                                .background(Color.surface, in: RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
                                .environment(\.locale, Locale(identifier: "es_ES")).environment(\.timeZone, TimeZone(identifier: "Europe/Madrid")!)
                        }
                    }
                }
                BField(label: "Nota (opcional)", text: $note)
                if let m = errors["form"] { Text(m).bFootnote(.expense) }
                Button(busy ? "Guardando…" : "Guardar") { Task { await save() } }.buttonStyle(.bPrimary).disabled(busy)
            }
        }
        .task {
            async let a: () = accounts.load("accounts.list", allowStale: false)
            async let b: () = { if let id { await tx.load("transactions.get", ["id": .string(id)], allowStale: false) } }()
            _ = await (a, b)
            fillOnce()
        }
    }

    private func fillOnce() {
        guard !filled else { return }
        filled = true
        if let t = tx.data {
            income = t.amount > 0
            amount = String(format: "%.2f", Double(abs(t.amount)) / 100).replacingOccurrences(of: ".", with: ",")
            concept = t.concept; category = t.category; accountId = t.accountId ?? list.first?.id ?? ""
            note = t.note ?? ""; source = t.source
            date = Self.formatter.date(from: t.date) ?? Date()
        } else if let d = draft {
            income = false
            amount = String(format: "%.2f", Double(d.amount) / 100).replacingOccurrences(of: ".", with: ",")
            concept = d.concept; category = d.category
            accountId = list.contains { $0.id == d.accountId } ? d.accountId : list.first?.id ?? ""
            date = Self.formatter.date(from: d.date) ?? Date()
            source = d.source
        } else {
            accountId = list.first?.id ?? ""
        }
    }

    private static let formatter: DateFormatter = {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.timeZone = TimeZone(identifier: "Europe/Madrid")
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    private func save() async {
        let cents = Money.parse(amount)
        var e: [String: String] = [:]
        if (cents ?? 0) <= 0 { e["amount"] = "Escribe un importe válido, por ejemplo 12,50" }
        if concept.trimmingCharacters(in: .whitespaces).isEmpty { e["concept"] = "Escribe qué ha sido, por ejemplo Mercadona" }
        errors = e
        guard e.isEmpty, let cents else { return }
        busy = true
        defer { busy = false }
        var params: [String: AnyJSON] = [
            "accountId": .string(accountId), "amount": .integer(income ? cents : -cents), "concept": .string(concept.trimmingCharacters(in: .whitespaces)),
            "category": .string(category.rawValue), "date": .string(Self.formatter.string(from: date)),
        ]
        if source != .fijo { params["source"] = .string(source.rawValue) }
        if !note.trimmingCharacters(in: .whitespaces).isEmpty { params["note"] = .string(note.trimmingCharacters(in: .whitespaces)) }
        do {
            if let id { params["id"] = .string(id); try await API.send("transactions.update", params) } else { try await API.send("transactions.create", params) }
            app.invalidate(); dismiss()
        } catch { errors = ["form": API.map(error).message] }
    }
}
