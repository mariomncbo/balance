import SwiftUI
import Supabase

struct MovementDetailView: View {
    let id: String
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var tx = Resource<Transaction>()
    @State private var accounts = Resource<Balances>()
    @State private var confirming = false
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        BScreen(spacing: 14) {
            DetailHeader {
                if tx.data != nil { BRoundButton(symbol: "pencil", label: "Editar movimiento") { app.sheet = .movement(id: id) } }
            }
            if tx.loading && tx.data == nil { BLoadingTiles(rows: 3) }
            if let e = tx.error, tx.data == nil { BErrorState(error: e) { app.invalidate() } }
            if let t = tx.data { content(t) }
        }
        .toolbar(.hidden, for: .navigationBar)
        .task(id: app.version) {
            async let a: () = tx.load("transactions.get", ["id": .string(id)])
            async let b: () = accounts.load("accounts.list")
            _ = await (a, b)
        }
    }

    @ViewBuilder private func content(_ t: Transaction) -> some View {
        let account = accounts.data?.accounts.first { $0.id == t.accountId }
        VStack(spacing: 10) {
            BTile(padding: 24, spacing: 8, alignment: .center) {
                BAvatar(symbol: t.category.symbol, style: t.isIncome ? .income : .neutral, size: 56)
                Text(t.concept).font(.system(size: 19, weight: .heavy)).foregroundStyle(Color.text)
                Text(Money.format(t.amount, signed: true)).bBig(40, color: t.isIncome ? .income : .text)
                Text(Dates.longDate(t.date)).bSub()
            }
            BTilePair {
                BTile(spacing: 2) { Text("Categoría").bEyebrow(); Text(t.category.label).bTitle() }
                BTile(spacing: 2) { Text("Cuenta").bEyebrow(); Text(account?.name ?? "Sin cuenta").bTitle() }
            }
            BTilePair {
                BTile(style: t.isIncome ? .income : .expense, spacing: 2) {
                    Text("Tipo").bFootnote(t.isIncome ? .income : .expense, weight: .bold)
                    Text(t.isIncome ? "Ingreso" : "Gasto").bTitle()
                }
                BTile(style: .soft, spacing: 2) {
                    Text("Origen").bFootnote(.accentText, weight: .bold)
                    Text(t.source.label ?? "A mano").bTitle()
                }
            }
            if let note = t.note, !note.isEmpty {
                BTile(spacing: 2) { Text("Nota").bEyebrow(); Text(note).font(.system(size: 17)).foregroundStyle(Color.text) }
            }
        }
        if let error { Text(error).bFootnote(.expense).frame(maxWidth: .infinity) }
        if confirming {
            BTile(spacing: 12) {
                Text("¿Borrar este movimiento?").bTitle()
                Text("No se puede deshacer. El saldo de la cuenta se recalculará.").bSub()
                HStack(spacing: 8) {
                    Button("Cancelar") { confirming = false }.buttonStyle(.b(.secondary, small: true))
                    Button("Borrar") { Task { await remove() } }.buttonStyle(.b(.destructive, small: true)).disabled(busy)
                }
            }
            .accessibilityElement(children: .contain)
        } else {
            Button("Borrar movimiento") { confirming = true }.buttonStyle(.bDangerLink).frame(maxWidth: .infinity)
        }
    }

    private func remove() async {
        busy = true
        defer { busy = false }
        do {
            try await API.send("transactions.delete", ["id": .string(id)])
            app.invalidate()
            dismiss()
        } catch { self.error = API.map(error).message }
    }
}
