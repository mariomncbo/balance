import Auth
import Supabase
import SwiftUI

/// Crear (o cambiar) el código de 4 cifras y, en iPhone con Face ID, ofrecer activarlo.
struct CreatePinView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var pin = ""
    @State private var confirm = ""
    @State private var faceIdStep = false
    @State private var failed = false

    private var mismatch: Bool { confirm.count == 4 && pin != confirm }

    var body: some View {
        if faceIdStep { FaceIdOfferView(onDone: finish) } else { pinForm }
    }

    private var pinForm: some View {
        BFormScreen {
            VStack(alignment: .leading, spacing: 12) {
                BAvatar(symbol: "lock", style: .solidAccent, size: 56)
                Text("Crea un código para acceder a tu cuenta").bH1().accessibilityAddTraits(.isHeader)
                if let email = app.session?.user.email { BPill(text: email, style: .accent) }
            }
            .padding(.top, 24)
            BTile(spacing: 10) {
                Text("Código de 4 cifras").bEyebrow()
                BPinBoxes(label: "Código de 4 cifras", value: $pin, canReveal: true)
            }
            BTile(spacing: 10) {
                Text("Repite el código").bEyebrow()
                BPinBoxes(label: "Repite el código", value: $confirm, error: mismatch)
                if mismatch { BPill(text: "Los códigos no coinciden. Vuelve a escribirlo.", style: .expense) }
                if failed { BPill(text: "No se ha podido guardar el código.", style: .expense) }
            }
            Text("El código se guarda solo en este dispositivo. Si lo olvidas, podrás crear otro con tu contraseña.").bFootnote()
        } footer: {
            Button("Crear código de acceso", action: save).buttonStyle(.bPrimary).disabled(!PinStore.isValid(pin) || pin != confirm)
            if app.needsPinSetup { Button("En otro momento") { finish() }.buttonStyle(.bLink) }
        }
    }

    private func save() {
        do { try app.pin.set(pin) } catch { failed = true; return }
        app.unlock()
        if Biometrics.available { faceIdStep = true } else { finish() }
    }

    private func finish() {
        if app.needsPinSetup { app.needsPinSetup = false } else { dismiss() }
    }
}

struct FaceIdOfferView: View {
    @Environment(AppModel.self) private var app
    let onDone: () -> Void

    var body: some View {
        BFormScreen {
            VStack(alignment: .leading, spacing: 12) {
                BAvatar(symbol: "faceid", style: .solidAccent, size: 72).padding(.top, 24)
                Text("Entra con Face ID").bH1().accessibilityAddTraits(.isHeader)
                Text("Desbloquea Balance con tu cara en lugar de escribir el código. El código sigue funcionando si Face ID falla.").bLead()
            }
        } footer: {
            Button("Activar Face ID") {
                Task {
                    if await Biometrics.authenticate(reason: "Activa Face ID en Balance") { app.pin.faceIdEnabled = true }
                    onDone()
                }
            }.buttonStyle(.bPrimary)
            Button("Ahora no", action: onDone).buttonStyle(.bLink)
        }
    }
}
