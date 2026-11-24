import SwiftUI

/// Marco común de los cinco pasos del onboarding: atrás, progreso, título, contenido y acciones.
struct OnboardingFrame<Content: View, Footer: View>: View {
    let step: Int
    let title: String
    var lead: String?
    @ViewBuilder var content: () -> Content
    @ViewBuilder var footer: () -> Footer
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        BFormScreen {
            HStack(spacing: 12) {
                BRoundButton(symbol: "chevron.left", label: "Atrás") { dismiss() }
                HStack(spacing: 6) {
                    ForEach(1...5, id: \.self) { i in
                        Capsule().fill(i <= step ? Color.accent : Color.surfaceSelected).frame(height: 6)
                    }
                }
                .accessibilityElement()
                .accessibilityLabel("Paso \(step) de 5")
            }
            VStack(alignment: .leading, spacing: 8) {
                Text(title).bH1().accessibilityAddTraits(.isHeader)
                if let lead { Text(lead).bLead() }
            }
            content()
        } footer: { footer() }
        .navigationBarBackButtonHidden()
        .toolbar(.hidden, for: .navigationBar)
    }
}
