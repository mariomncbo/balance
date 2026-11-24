import Supabase
import SwiftUI

struct LoginView: View {
    @Environment(AppModel.self) private var app
    @Environment(AuthNavigator.self) private var nav
    @State private var username = ""
    @State private var password = ""
    @State private var error: String?
    @State private var busy = false

    var body: some View {
        BFormScreen {
            Color.clear.frame(height: 24)
            BTile(style: .accent, padding: 22, spacing: 16) {
                Image("LogoHorizontalBlanco").resizable().scaledToFit().frame(width: 130).accessibilityLabel("Balance")
                Text("Hola de nuevo").bH1(.onAccent).accessibilityAddTraits(.isHeader)
            }
            .overlay(alignment: .topTrailing) {
                Image("LogoSimboloBlanco").resizable().scaledToFit().frame(width: 150).opacity(0.22).offset(x: 26, y: -18).accessibilityHidden(true)
            }
            .clipShape(RoundedRectangle(cornerRadius: Radius.lg, style: .continuous))
            BTile(spacing: 12) {
                BField(label: "Nombre de usuario", text: $username, content: .username, capitalization: .never, noAutocorrect: true)
                BField(label: "Contraseña", text: $password, error: error, secure: true, content: .password)
                Button("¿Olvidaste tu contraseña?") { nav.push(.recover) }.buttonStyle(.bLink).frame(maxWidth: .infinity, alignment: .trailing)
                Button(busy ? "Entrando…" : "Iniciar sesión") { Task { await submit() } }.buttonStyle(.bPrimary).disabled(busy)
            }
        } footer: {
            Button("¿No tienes cuenta? Crear cuenta") { nav.push(.signup) }.buttonStyle(.bLink)
        }
        .navigationBarBackButtonHidden().toolbar(.hidden, for: .navigationBar)
        .onChange(of: username) { _, _ in error = nil }
        .onChange(of: password) { _, _ in error = nil }
    }

    private func submit() async {
        guard !username.trimmingCharacters(in: .whitespaces).isEmpty, !password.isEmpty else { error = "Escribe tu usuario y tu contraseña"; return }
        busy = true
        error = nil
        defer { busy = false }
        do {
            struct Tokens: Decodable { let access_token: String; let refresh_token: String }
            struct Result: Decodable { let session: Tokens }
            let res: Result = try await API.auth("login", ["username": .string(username.trimmingCharacters(in: .whitespaces).lowercased()), "password": .string(password)])
            try await app.setSession(access: res.session.access_token, refresh: res.session.refresh_token)
            app.unlock() // acaba de escribir la contraseña: no hace falta pedirle además el código
        } catch let e as APIError where e.code == "email_not_confirmed" {
            if let email = e.extra["email"] as? String {
                try? await supabase.auth.resend(email: email, type: .signup, emailRedirectTo: DeepLink.confirm)
                nav.push(.verify(email: email))
            } else { error = e.message }
        } catch {
            self.error = API.map(error).message
        }
    }
}
