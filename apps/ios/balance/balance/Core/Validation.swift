import Foundation

enum Validation {
    static let usernameRegex = #"^[a-z0-9._]{3,30}$"#
    static let emailRegex = #"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$"#
    static let minPassword = 8

    static func isUsername(_ s: String) -> Bool { s.range(of: usernameRegex, options: .regularExpression) != nil }
    static func isEmail(_ s: String) -> Bool { s.range(of: emailRegex, options: .regularExpression) != nil }

    struct Signup { var name = "", username = "", email = "", password = "", password2 = "" }

    static func signup(_ f: Signup) -> [String: String] {
        var e: [String: String] = [:]
        let name = f.name.trimmingCharacters(in: .whitespaces)
        if name.isEmpty { e["name"] = "Escribe tu nombre" } else if name.count > 80 { e["name"] = "Demasiado largo" }
        if !isUsername(f.username) { e["username"] = "De 3 a 30 caracteres: letras minúsculas, números, punto o guion bajo" }
        if !isEmail(f.email.trimmingCharacters(in: .whitespaces)) { e["email"] = "Escribe un correo válido" }
        if f.password.count < minPassword { e["password"] = "Mínimo \(minPassword) caracteres" }
        if f.password2 != f.password { e["password2"] = "Las contraseñas no coinciden. Vuelve a escribirla." }
        return e
    }
}
