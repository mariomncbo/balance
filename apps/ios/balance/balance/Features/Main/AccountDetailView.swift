import SwiftUI
import Supabase

struct AccountDetailView: View {
    let id: String
    @Environment(AppModel.self) private var app
    @State private var accounts = Resource<Balances>()
    @State private var list = Resource<TransactionList>()

    var body: some View {
        let account = accounts.data?.accounts.first { $0.id == id }
        let items = list.data?.items ?? []
        BScreen(spacing: 14) {
            DetailHeader(title: account?.name ?? "Cuenta") {
                if account != nil { BRoundButton(symbol: "pencil", label: "Editar cuenta") { app.sheet = .account(id: id, local: false) } }
            }
            if let e = accounts.error, account == nil { BErrorState(error: e) { app.invalidate() } }
            if accounts.loading && account == nil { BLoadingTiles(rows: 3) }
            if accounts.data != nil && account == nil { BEmptyState(symbol: "building.columns", title: "Esta cuenta ya no existe", text: "Puede que la hayas borrado.") }
            if let a = account {
                VStack(spacing: 10) {
                    BTile(style: .accent, padding: 20, spacing: 4) {
                        HStack {
                            Text("\(a.type.label) · saldo actual").bEyebrow(.onAccent).opacity(0.85)
                            Spacer()
                            BAvatar(symbol: "building.columns", style: .solidAccent, size: 36).opacity(0.85)
                        }
                        Text(Money.format(a.balance)).bBig(36, color: .onAccent)
                        Text("\(a.share) % de todo tu dinero").font(.system(size: 13, weight: .semibold))
                    }
                    BTilePair {
                        BTile(style: .income, spacing: 2) {
                            Text("Entradas del mes").bFootnote(.income, weight: .bold)
                            Text(Money.format(items.filter { $0.amount > 0 }.reduce(0) { $0 + $1.amount }, signed: true)).bMoney(.income, size: 19)
                        }
                        BTile(style: .expense, spacing: 2) {
                            Text("Salidas del mes").bFootnote(.expense, weight: .bold)
                            Text(Money.format(items.filter { $0.amount < 0 }.reduce(0) { $0 + $1.amount })).bMoney(size: 19)
                        }
                    }
                }
                if list.data != nil && items.isEmpty { BEmptyState(symbol: "arrow.up.arrow.down", title: "Sin movimientos este mes", text: "Los movimientos de esta cuenta aparecerán aquí.") }
                TransactionGroups(items: items, today: Dates.todayMadrid())
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .task(id: app.version) {
            async let a: () = accounts.load("accounts.list")
            async let b: () = list.load("transactions.list", ["accountId": .string(id), "period": .string("month")])
            _ = await (a, b)
        }
    }
}
