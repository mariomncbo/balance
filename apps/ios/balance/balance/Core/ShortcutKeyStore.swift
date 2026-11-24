import Foundation

/// Guarda en el Keychain de este iPhone la clave del Atajo, para poder copiarla otra vez.
/// El servidor solo tiene su hash: si se pierde aquí, se genera una nueva.
enum ShortcutKeyStore {
    private static let key = "shortcut.token"
    static var storage: SecretStorage = KeychainStorage()

    static func read() -> String? { storage.read(key).map { String(decoding: $0, as: UTF8.self) } }
    static func save(_ token: String) { storage.write(key, Data(token.utf8)) }
    static func clear() { storage.remove(key) }

    /// Dirección a la que el Atajo envía cada pago.
    static var endpoint: String { Config.supabaseURL.appendingPathComponent("functions/v1/shortcut").absoluteString }
}
