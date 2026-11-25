import SwiftUI
import Supabase

struct AccountSheet: View {
    let id: String?
    let local: Bool
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var accounts = Resource<Balances>()
    @State private var name = ""
    @State private var type: AccountType = .banco
    @State private var amount = ""
    @State private var loadedFor: String?
    @State private var errors: [String: String] = [:]
    @State private var busy = false

    private var editing: AccountBalance? { id.flatMap { id in accounts.data?.accounts.first { $0.id == id } } }

    var body: some View {
        BSheet(title: id == nil ? "Nueva cuenta" : "Editar cuenta") {
            if id != nil && editing == nil {
                Text("Cargando…").bSub()
            } else {
                BTile(padding: 22, alignment: .center) {
                    BAmountField(label: "Saldo de la cuenta", text: $amount, error: errors["amount"])
                }
                BField(label: "Nombre", text: $name, placeholder: "Cuenta naranja", error: errors["name"])
                VStack(alignment: .leading, spacing: 8) {
                    Text("Tipo de cuenta").bEyebrow().padding(.leading, 4)
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 4), spacing: 8) {
                        ForEach(AccountType.allCases) { t in
                            Button { type = t } label: {
                                Text(t.label).font(.system(size: 13, weight: .semibold)).lineLimit(1).minimumScaleFactor(0.8)
                                    .foregroundStyle(type == t ? Color.onAccent : Color.text)
                                    .frame(maxWidth: .infinity).padding(.vertical, 12)
                                    .background(type == t ? Color.accent : Color.surface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                            }
                            .buttonStyle(.plain).accessibilityAddTraits(type == t ? .isSelected : [])
                        }
                    }
                }
                if let m = errors["form"] { Text(m).bFootnote(.expense) }
                Button(busy ? "Guardando…" : "Guardar") { Task { await save() } }.buttonStyle(.bPrimary).disabled(busy)
                if id != nil {
                    DeleteBlock(label: "Borrar cuenta", question: "¿Borrar esta cuenta?", detail: "Se borrarán también todos sus movimientos. No se puede deshacer.", busy: busy) { Task { await remove() } }
                }
            }
        }
        .task { if id != nil { await accounts.load("accounts.list", allowStale: false) } }
        .onChange(of: editing) { _, a in fill(a) }
        .onChange(of: accounts.data) { _, _ in fill(editing) }
    }

    private func fill(_ a: AccountBalance?) {
        guard let a, loadedFor != a.id else { return }
        loadedFor = a.id
        name = a.name; type = a.type; amount = String(format: "%.2f", Double(a.balance) / 100).replacingOccurrences(of: ".", with: ",")
    }

    private func save() async {
        let cents = amount.trimmingCharacters(in: .whitespaces).isEmpty ? 0 : Money.parse(amount)
        var e: [String: String] = [:]
        if name.trimmingCharacters(in: .whitespaces).isEmpty { e["name"] = "Ponle un nombre a la cuenta" }
        if cents == nil { e["amount"] = "Escribe un importe válido, por ejemplo 1.250,00" }
        errors = e
        guard e.isEmpty, let cents else { return }
        // Al editar, el campo es el saldo actual: el saldo inicial se ajusta por la diferencia, sin tocar los movimientos.
        let opening = editing.map { $0.openingBalance + (cents - $0.balance) } ?? cents
        if local {
            var o = OnboardingStore.read()
            o.accounts = o.accounts.filter { $0.name != "Mi dinero" } + [OnboardingAccount(name: name.trimmingCharacters(in: .whitespaces), type: type, openingBalance: opening)]
            OnboardingStore.write(o)
            app.invalidate(); dismiss(); return
        }
        busy = true
        defer { busy = false }
        let params: [String: AnyJSON] = ["name": .string(name.trimmingCharacters(in: .whitespaces)), "type": .string(type.rawValue), "openingBalance": .integer(opening)]
        do {
            if let id { try await API.send("accounts.update", params.merging(["id": .string(id)]) { $1 }) } else { try await API.send("accounts.create", params) }
            app.invalidate(); dismiss()
        } catch { errors = ["form": API.map(error).message] }
    }

    private func remove() async {
        guard let id else { return }
        busy = true
        defer { busy = false }
        do { try await API.send("accounts.delete", ["id": .string(id)]); app.invalidate(); dismiss() }
        catch { errors = ["form": API.map(error).message] }
    }
}
