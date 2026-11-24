import SwiftUI

struct WelcomeView: View {
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        BFormScreen {
            Image("LogoHorizontal").resizable().scaledToFit().frame(width: 150).accessibilityLabel("Balance")
            VStack(spacing: 10) {
                BTile(spacing: 6) {
                    Text("Saldo total").bEyebrow()
                    HStack {
                        Text("12.480,35\u{00A0}€").bBig()
                        Spacer()
                        BPill(text: "+609\u{00A0}€", style: .income)
                    }
                }
                BTilePair {
                    BTile(style: .accent, spacing: 4) {
                        ZStack {
                            Circle().stroke(Color.accentHover, lineWidth: 7)
                            Circle().trim(from: 0, to: 0.58).stroke(Color.onAccent, style: StrokeStyle(lineWidth: 7, lineCap: .round)).rotationEffect(.degrees(-90))
                        }
                        .frame(width: 52, height: 52)
                        Text("PS5").bTitle(.onAccent).padding(.top, 6)
                        Text("77 € al mes").font(.system(size: 13, weight: .semibold))
                    }
                    BTile(style: .warning, spacing: 4) {
                        BAvatar(symbol: "bolt", style: .onTile, size: 36)
                        Text("Mercadona").bTitle().padding(.top, 6)
                        Text("Apuntado solo").bFootnote(.warning, weight: .bold)
                    }
                }
            }
            .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 10) {
                Text("Tu dinero, claro y a tu favor.")
                    .font(.system(size: 34, weight: .heavy)).tracking(-1).lineSpacing(0)
                    .accessibilityAddTraits(.isHeader)
                Text("Mira cuánto tienes, en qué se va y cuánto apartar cada mes para conseguir lo que quieres.").bLead()
            }
        } footer: {
            NavigationLink(value: AuthRoute.balance) { Text("Empezar") }.buttonStyle(.bPrimary)
            NavigationLink(value: AuthRoute.login) { Text("¿Ya tienes cuenta? Iniciar sesión") }.buttonStyle(.bLink)
        }
        .toolbar(.hidden, for: .navigationBar)
    }
}
