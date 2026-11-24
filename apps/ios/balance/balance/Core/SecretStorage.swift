import Foundation
import Security

/// Almacén de secretos pequeños. En la app es el Keychain; en los tests, un diccionario.
protocol SecretStorage: AnyObject {
    func read(_ key: String) -> Data?
    func write(_ key: String, _ data: Data)
    func remove(_ key: String)
}

final class KeychainStorage: SecretStorage {
    private let service = "com.mariomncbo.balance"

    private func query(_ key: String) -> [String: Any] {
        [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: key]
    }

    func read(_ key: String) -> Data? {
        var q = query(key)
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var out: AnyObject?
        return SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess ? out as? Data : nil
    }

    func write(_ key: String, _ data: Data) {
        remove(key)
        var q = query(key)
        q[kSecValueData as String] = data
        // Solo con el dispositivo desbloqueado y sin copiarse a otros dispositivos.
        q[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        SecItemAdd(q as CFDictionary, nil)
    }

    func remove(_ key: String) {
        SecItemDelete(query(key) as CFDictionary)
    }
}

final class MemoryStorage: SecretStorage {
    private var items: [String: Data] = [:]
    func read(_ key: String) -> Data? { items[key] }
    func write(_ key: String, _ data: Data) { items[key] = data }
    func remove(_ key: String) { items[key] = nil }
}
