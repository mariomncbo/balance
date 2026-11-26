import SwiftUI
import Supabase

/// Editar el nombre y el nombre de usuario. El correo no se cambia aquí.
struct ProfileSheet: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var username = ""
    @State private var filled = false
    @State private var busy = false
    @State private var errors: [String: String] = [:]

    private var cleanName: String { name.trimmingCharacters(in: .whitespaces) }
    private var changed: Bool { cleanName != app.profile?.name || username != app.profile?.username }

    var body: some View {
        BSheet(title: "Editar perfil") {
            BField(label: "Nombre", text: $name, placeholder: "Mario", error: errors["name"], content: .givenName)
            BField(label: "Nombre de usuario", text: $username, placeholder: "mario", error: errors["username"], help: "De 3 a 30 caracteres: letras minúsculas, números, puntos o guiones bajos. Es con lo que entras.", content: .username, capitalization: .never, noAutocorrect: true)
            if let email = app.profile?.email {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Correo").bEyebrow().padding(.leading, 4)
                    Text(email).bSub().padding(.leading, 4)
                }
            }
            if let m = errors["form"] { Text(m).bFootnote(.expense) }
            Button(busy ? "Guardando…" : "Guardar") { Task { await save() } }.buttonStyle(.bPrimary).disabled(busy || !changed)
        }
        .onAppear {
            guard !filled, let p = app.profile else { return }
            filled = true; name = p.name; username = p.username
        }
        .onChange(of: username) { _, v in if v != v.lowercased() { username = v.lowercased() } }
    }

    private func save() async {
        var e: [String: String] = [:]
        if cleanName.isEmpty { e["name"] = "Escribe tu nombre" }
        if username.range(of: "^[a-z0-9._]{3,30}$", options: .regularExpression) == nil { e["username"] = "De 3 a 30 caracteres: minúsculas, números, puntos o guiones bajos" }
        errors = e
        guard e.isEmpty else { return }
        busy = true
        defer { busy = false }
        do {
            try await API.send("profile.update", ["name": .string(cleanName), "username": .string(username)])
            await app.loadProfile()
            dismiss()
        } catch let err {
            let m = API.map(err)
            if m.status == 409 { errors = ["username": m.message] } else { errors = ["form": m.message] }
        }
    }
}

/// Eliminar la cuenta y todos sus datos. Para confirmar hay que escribir el nombre de usuario.
struct DeleteAccountSheet: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var typed = ""
    @State private var busy = false
    @State private var error: String?

    private var username: String { app.profile?.username ?? "" }
    private var matches: Bool { !username.isEmpty && typed.trimmingCharacters(in: .whitespaces).lowercased() == username }

    var body: some View {
        BSheet(title: "Eliminar cuenta") {
            BTile(spacing: 8) {
                Text("Esto no se puede deshacer").bTitle()
                Text("Se borrarán para siempre tu usuario y todos tus datos: cuentas, movimientos, gastos fijos, metas y la clave del Atajo. No hay copia de seguridad para recuperarlos.").bSub()
            }
            BField(label: "Para confirmar, escribe tu nombre de usuario: \(username)", text: $typed, placeholder: username, error: nil, capitalization: .never, noAutocorrect: true)
            if let error { Text(error).bFootnote(.expense) }
            Button(busy ? "Eliminando…" : "Eliminar mi cuenta para siempre") { Task { await delete() } }
                .buttonStyle(.bDestructive).disabled(!matches || busy)
        }
    }

    private func delete() async {
        busy = true; error = nil
        defer { busy = false }
        do {
            try await app.deleteAccount(username: typed)
            dismiss()
        } catch let err { error = API.map(err).message }
    }
}
