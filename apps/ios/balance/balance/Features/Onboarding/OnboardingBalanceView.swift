import SwiftUI

private let quickName = "Mi dinero"

struct OnboardingBalanceView: View {
    @Environment(AppModel.self) private var app
    @State private var text = ""
    @State private var error: String?
    @State private var data = OnboardingStore.read()
    @Environment(AuthNavigator.self) private var nav

    private var manual: [OnboardingAccount] { data.accounts.filter { $0.name != quickName } }

    var body: some View {
        OnboardingFrame(
            step: 1, title: "¿Cuánto tienes?",
            lead: "Suma lo que tienes ahora en todas tus cuentas. Luego podrás separarlo."
        ) {
            if manual.isEmpty {
                BTile(padding: 22, spacing: 14, alignment: .center) {
                    BAmountField(label: "Saldo total", text: $text, size: 48, error: error)
                        .onChange(of: text) { _, _ in error = nil }
                    Button("Prefiero añadirlas una a una") { app.sheet = .account(id: nil, local: true) }
                        .buttonStyle(.b(.primary, small: true, block: false))
                        .tint(.accentText)
                }
            } else {
                VStack(spacing: 12) {
                    BList {
                        ForEach(Array(manual.enumerated()), id: \.offset) { i, a in
                            if i > 0 { BRowDivider() }
                            HStack(spacing: 12) {
                                BAvatar(symbol: "building.columns", style: .accent)
                                VStack(alignment: .leading) { Text(a.name).bTitle(); Text(a.type.label).bSub() }
                                Spacer()
                                Text(Money.format(a.openingBalance)).bMoney()
                            }
                            .padding(.horizontal, Space.s4).padding(.vertical, Space.s3).frame(minHeight: 64)
                        }
                    }
                    Button { app.sheet = .account(id: nil, local: true) } label: { Label("Añadir otra cuenta", systemImage: "plus") }
                        .buttonStyle(.bSecondary)
                }
            }
            BTile(style: .income, padding: 14, spacing: 12) {
                HStack(spacing: 12) {
                    Image(systemName: "lock").foregroundStyle(Color.income)
                    Text("Tus datos están en todo momento encriptados y seguros").bSubhead(.income, weight: .semibold)
                }
            }
        } footer: {
            Button("Continuar", action: next).buttonStyle(.bPrimary)
        }
        .onAppear {
            data = OnboardingStore.read()
            if let q = data.accounts.first(where: { $0.name == quickName }), text.isEmpty { text = String(q.openingBalance / 100).replacingOccurrences(of: ".", with: ",") }
        }
        .onChange(of: app.version) { _, _ in data = OnboardingStore.read() }
    }

    private func next() {
        let cents = text.trimmingCharacters(in: .whitespaces).isEmpty ? 0 : Money.parse(text)
        guard let cents else { error = "Escribe un importe válido, por ejemplo 1.250,00"; return }
        var d = OnboardingStore.read()
        var accounts = d.accounts.filter { $0.name != quickName }
        if cents > 0 && accounts.isEmpty { accounts.append(OnboardingAccount(name: quickName, type: .banco, openingBalance: cents)) }
        d.accounts = accounts
        OnboardingStore.write(d)
        nav.push(.loans)
    }
}
