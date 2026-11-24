import Auth
import Supabase
import SwiftUI

/// "Revisa tu correo": el correo de Supabase trae un enlace. Al tocarlo en este iPhone se abre Balance,
/// se confirma la cuenta y la raíz pasa sola a la pantalla de crear el código de acceso.
struct VerifyView: View {
    let email: String
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var error: String?
    @State private var wait = 60
    @State private var resent = false

    var body: some View {
        BFormScreen(spacing: 24) {
            HStack { BRoundButton(symbol: "chevron.left", label: "Atrás") { dismiss() }; Spacer() }
            BTile(style: .soft, padding: 20, spacing: 14) {
                BAvatar(symbol: "envelope", style: .solidAccent, size: 52)
                Text("Revisa tu correo").font(.system(size: 26, weight: .heavy)).tracking(-0.5).accessibilityAddTraits(.isHeader)
                Text("Te hemos enviado un enlace a **\(email)**. Tócalo desde este iPhone para confirmar tu cuenta.").bSubhead(.accentText)
            }
            BTile(spacing: 10) {
                HStack(spacing: 12) {
                    BAvatar(symbol: "tray", style: .accent)
                    Text("Si no lo ves, mira en la carpeta de spam. El enlace funciona una sola vez.").bSubhead(.textSecondary)
                }
            }
            if let message = error ?? app.linkError { BPill(text: message, style: .expense).accessibilityAddTraits(.isStaticText) }
            if resent && error == nil { Text("Correo enviado de nuevo.").bFootnote() }
            HStack(spacing: 8) {
                Button(wait > 0 ? "Reenviar en 0:\(String(format: "%02d", wait))" : "Reenviar correo") { Task { await resend() } }
                    .buttonStyle(.plain).font(.system(size: 15, weight: .semibold))
                    .padding(.horizontal, 14).frame(minHeight: 40).background(Color.surface, in: Capsule())
                    .disabled(wait > 0).opacity(wait > 0 ? 0.55 : 1)
                Button("Cambiar el correo") { dismiss() }
                    .buttonStyle(.plain).font(.system(size: 15, weight: .semibold))
                    .padding(.horizontal, 14).frame(minHeight: 40).background(Color.surface, in: Capsule())
            }
            .frame(maxWidth: .infinity)
        } footer: {
            Button("Abrir la app de Correo") {
                if let url = URL(string: "message://") { UIApplication.shared.open(url) }
            }.buttonStyle(.bPrimary)
        }
        .navigationBarBackButtonHidden().toolbar(.hidden, for: .navigationBar)
        .task(id: wait) {
            guard wait > 0 else { return }
            try? await Task.sleep(for: .seconds(1))
            if !Task.isCancelled { wait -= 1 }
        }
    }

    private func resend() async {
        guard wait == 0 else { return }
        error = nil
        app.linkError = nil
        do {
            try await supabase.auth.resend(email: email, type: .signup, emailRedirectTo: DeepLink.confirm)
            resent = true
            wait = 60
        } catch {
            self.error = "No se ha podido reenviar el correo. Espera un momento e inténtalo de nuevo."
        }
    }
}
