import Supabase
import SwiftUI

/// Llegada desde el enlace del correo de "recuperar contraseña": ya hay una sesión de recuperación.
struct NewPasswordView: View {
    @Environment(AppModel.self) private var app
    @State private var p1 = ""
    @State private var p2 = ""
    @State private var error: String?
    @State private var busy = false

    var body: some View {
        BFormScreen {
            Color.clear.frame(height: 24)
            VStack(alignment: .leading, spacing: 8) {
                Text("Elige tu nueva contraseña").bH1().accessibilityAddTraits(.isHeader)
                Text("Usarás esta contraseña para entrar en Balance.").bLead()
            }
            BTile(spacing: 12) {
                BField(label: "Contraseña nueva", text: $p1, secure: true, content: .newPassword)
                BField(label: "Repite la contraseña", text: $p2, error: error, secure: true, content: .newPassword)
            }
        } footer: {
            Button(busy ? "Guardando…" : "Guardar contraseña") { Task { await save() } }.buttonStyle(.bPrimary).disabled(busy)
        }
        .onChange(of: p1) { _, _ in error = nil }
        .onChange(of: p2) { _, _ in error = nil }
    }

    private func save() async {
        guard p1.count >= Validation.minPassword else { error = "Mínimo \(Validation.minPassword) caracteres"; return }
        guard p1 == p2 else { error = "Las contraseñas no coinciden. Vuelve a escribirla."; return }
        busy = true
        defer { busy = false }
        do {
            try await supabase.auth.update(user: UserAttributes(password: p1))
            app.recovering = false
        } catch {
            self.error = "No se ha podido cambiar la contraseña. Pide un enlace nuevo."
        }
    }
}
