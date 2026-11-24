import Auth
import Supabase
import SwiftUI

struct SignupView: View {
    @Environment(AuthNavigator.self) private var nav
    @Environment(\.dismiss) private var dismiss
    @State private var f = Validation.Signup()
    @State private var errors: [String: String] = [:]
    @State private var busy = false

    var body: some View {
        BFormScreen {
            HStack(spacing: 12) {
                BRoundButton(symbol: "chevron.left", label: "Atrás") { dismiss() }
                Spacer()
            }
            HStack(spacing: 12) {
                Image("LogoSimbolo").resizable().scaledToFit().frame(width: 34, height: 34)
                    .frame(width: 52, height: 52).background(Color.surface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 0) {
                    Text("Crea tu cuenta").font(.system(size: 24, weight: .heavy)).tracking(-0.4).accessibilityAddTraits(.isHeader)
                    Text("Para guardar lo que has añadido").bSub()
                }
            }
            BTile(spacing: 12) {
                Grid(horizontalSpacing: 10, verticalSpacing: 10) {
                    GridRow {
                        BField(label: "Nombre", text: $f.name, error: errors["name"], content: .name)
                        BField(label: "Usuario", text: $f.username, error: errors["username"], content: .username, capitalization: .never, noAutocorrect: true)
                    }
                }
                BField(label: "Correo", text: $f.email, error: errors["email"], keyboard: .emailAddress, content: .emailAddress, capitalization: .never, noAutocorrect: true)
                BField(label: "Contraseña", text: $f.password, error: errors["password"], secure: true, content: .newPassword)
                BField(label: "Repite la contraseña", text: $f.password2, error: errors["password2"], secure: true, content: .newPassword)
                if let m = errors["form"] { Text(m).bFootnote(.expense) }
                Button(busy ? "Creando…" : "Crear cuenta") { Task { await submit() } }
                    .buttonStyle(.bPrimary).disabled(busy)
            }
        } footer: {
            Button("¿Ya tienes cuenta? Iniciar sesión") { nav.push(.login) }.buttonStyle(.bLink)
        }
        .navigationBarBackButtonHidden().toolbar(.hidden, for: .navigationBar)
        .onChange(of: f.username) { _, v in if v != v.lowercased() { f.username = v.lowercased() } }
    }

    private func submit() async {
        let e = Validation.signup(f)
        errors = e
        guard e.isEmpty else { return }
        busy = true
        defer { busy = false }
        do {
            struct Check: Decodable { let available: Bool }
            let check: Check = try await API.auth("username.check", ["username": .string(f.username)])
            guard check.available else { errors = ["username": "Ese nombre de usuario ya está cogido"]; return }
            let email = f.email.trimmingCharacters(in: .whitespaces).lowercased()
            do {
                let res = try await supabase.auth.signUp(
                    email: email, password: f.password,
                    data: ["name": .string(f.name.trimmingCharacters(in: .whitespaces)), "username": .string(f.username)],
                    redirectTo: DeepLink.confirm
                )
                // Con confirmación de correo activa, un correo ya registrado no da error: llega sin identidades.
                if res.user.identities?.isEmpty == true {
                    errors = ["email": "Ya hay una cuenta con este correo. ¿Quieres iniciar sesión?"]
                    return
                }
            } catch {
                let exists = error.localizedDescription.range(of: "already|registered", options: [.regularExpression, .caseInsensitive]) != nil
                errors = exists ? ["email": "Ya hay una cuenta con este correo. ¿Quieres iniciar sesión?"]
                    : ["form": "No se ha podido crear la cuenta. Revisa los datos y vuelve a intentarlo."]
                return
            }
            nav.push(.verify(email: email))
        } catch {
            errors = ["form": API.map(error).message]
        }
    }
}
