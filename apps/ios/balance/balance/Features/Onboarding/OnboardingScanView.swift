import SwiftUI

struct OnboardingScanView: View {
    @Environment(AuthNavigator.self) private var nav

    var body: some View {
        OnboardingFrame(
            step: 5, title: "Haz una foto y listo",
            lead: "Fotografía un ticket, una factura o una captura de un pago. Leemos el importe, el comercio y la fecha; tú solo confirmas."
        ) {
            BTilePair {
                BTile(spacing: 6) {
                    Text("MERCADONA").font(.system(size: 13, weight: .heavy)).tracking(0.5).frame(maxWidth: .infinity)
                    ForEach([("Leche", "3,96"), ("Pan", "1,20"), ("Fruta", "7,24")], id: \.0) { n, v in
                        HStack { Text(n); Spacer(); Text(v).monospacedDigit() }.bFootnote()
                    }
                    HStack { Text("TOTAL"); Spacer(); Text("12,40").monospacedDigit() }.bFootnote(.text, weight: .bold)
                }
                .rotationEffect(.degrees(-2))
                BTile(style: .soft, spacing: 8, alignment: .center) {
                    BAvatar(symbol: "camera", style: .solidAccent, size: 48)
                    Text("Leído").bFootnote(.accentText, weight: .bold).padding(.top, 4)
                    Text("−12,40\u{00A0}€").bMoney()
                    Text("Mercadona · hoy").bFootnote(.accentText)
                }
            }
            .accessibilityHidden(true)
            BPill(text: "Siempre en el botón + → Escaneo", style: .accent, symbol: "plus")
        } footer: {
            Button("Continuar") { nav.push(.signup) }.buttonStyle(.bPrimary)
        }
    }
}
