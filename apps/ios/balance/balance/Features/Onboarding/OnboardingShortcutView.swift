import SwiftUI

struct OnboardingShortcutView: View {
    @Environment(AuthNavigator.self) private var nav

    var body: some View {
        OnboardingFrame(
            step: 4, title: "Tus pagos, apuntados solos",
            lead: "Con un Atajo del iPhone, cada pago con tarjeta en Wallet aparece en Balance sin que hagas nada."
        ) {
            BTilePair {
                BTile(spacing: 6) {
                    BAvatar(symbol: "building.columns")
                    Text("Pagas con Wallet").bEyebrow().padding(.top, 6)
                    Text("Mercadona").bTitle()
                    Text("−12,40\u{00A0}€").bMoney()
                }
                BTile(style: .accent, spacing: 6) {
                    BAvatar(symbol: "bolt", style: .solidAccent).opacity(0.9)
                    Text("Al instante").bEyebrow(.onAccent).opacity(0.85).padding(.top, 6)
                    Text("Apuntado").bTitle(.onAccent)
                    Text("Comida · Atajo").font(.system(size: 13, weight: .semibold))
                }
            }
            .accessibilityHidden(true)
            BTile(spacing: 0) {
                HStack(spacing: 12) {
                    BAvatar(symbol: "gearshape", style: .accent)
                    Text("Lo configuras cuando tengas tu cuenta, desde Ajustes. Se tarda 2 minutos.").bSubhead(.textSecondary)
                }
            }
        } footer: {
            Button("Continuar") { nav.push(.scan) }.buttonStyle(.bPrimary)
        }
    }
}
