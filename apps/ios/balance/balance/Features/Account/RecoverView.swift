import Supabase
import SwiftUI

struct RecoverView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var email = ""
    @State private var error: String?
    @State private var sent = false
    @State private var busy = false

    var body: some View {
        BFormScreen {
            HStack { BRoundButton(symbol: "chevron.left", label: "Atrás") { dismiss() }; Spacer() }
            VStack(alignment: .leading, spacing: 8) {
                Text("Recupera tu contraseña").bH1().accessibilityAddTraits(.isHeader)
                Text("Escribe el correo de tu cuenta y te enviaremos un enlace para crear una nueva.").bLead()
            }
            BTile { BField(label: "Correo", text: $email, error: error, keyboard: .emailAddress, content: .emailAddress, capitalization: .never, noAutocorrect: true) }
            if sent {
                BTile(style: .income, spacing: 0) {
                    HStack(spacing: 12) {
                        BAvatar(symbol: "checkmark", style: .solidAccent)
                        VStack(alignment: .leading) {
                            Text("Enlace enviado").bTitle()
                            Text("Si hay una cuenta con ese correo, te llegará un enlace. Mira también en spam.").bSubhead(.income)
                        }
                    }
                }
                .accessibilityElement(children: .combine)
            }
        } footer: {
            Button(busy ? "Enviando…" : (sent ? "Enviar de nuevo" : "Enviar enlace")) { Task { await submit() } }
                .buttonStyle(.bPrimary).disabled(busy)
        }
        .navigationBarBackButtonHidden().toolbar(.hidden, for: .navigationBar)
        .onChange(of: email) { _, _ in error = nil }
    }

    private func submit() async {
        let mail = email.trimmingCharacters(in: .whitespaces).lowercased()
        guard Validation.isEmail(mail) else { error = "Escribe un correo válido"; return }
        busy = true
        defer { busy = false }
        // Siempre se enseña la misma confirmación: no se revela si el correo tiene cuenta.
        do {
            try await supabase.auth.resetPasswordForEmail(mail, redirectTo: DeepLink.recovery)
            sent = true
        } catch {
            let status = (error as? AuthError)?.errorCode
            if status != nil, "\(error)".contains("400") || "\(error)".contains("422") { sent = true; return }
            self.error = "No se ha podido enviar el enlace. Inténtalo de nuevo en un rato."
        }
    }
}
