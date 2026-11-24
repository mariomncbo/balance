import CommonCrypto
import Foundation

/// PIN de 4 cifras solo en este dispositivo. Es un candado de la interfaz, no cifrado de datos.
/// Se guarda un hash PBKDF2 con sal en el Keychain; tras 5 fallos se bloquea 5 minutos.
final class PinStore {
    static let maxFails = 5
    static let lockSeconds: TimeInterval = 5 * 60
    static let iterations = 210_000

    enum Result: Equatable {
        case ok
        case wrong(remaining: Int)
        case locked(until: Date)
    }

    private struct Stored: Codable { var salt: Data; var hash: Data; var iterations: Int }
    private struct Fails: Codable { var count: Int; var lockedUntil: Date? }

    private let storage: SecretStorage
    private let pinKey = "pin"
    private let failsKey = "pin.fails"
    private let faceIdKey = "pin.faceid"

    init(storage: SecretStorage = KeychainStorage()) { self.storage = storage }

    static func isValid(_ pin: String) -> Bool {
        pin.count == 4 && pin.allSatisfy { $0.isASCII && $0.isNumber }
    }

    var hasPin: Bool { storage.read(pinKey) != nil }

    var faceIdEnabled: Bool {
        get { storage.read(faceIdKey) != nil }
        set { newValue ? storage.write(faceIdKey, Data([1])) : storage.remove(faceIdKey) }
    }

    func set(_ pin: String, iterations: Int = PinStore.iterations) throws {
        guard Self.isValid(pin) else { throw APIError(message: "El código debe tener 4 cifras", status: 0) }
        var salt = Data(count: 16)
        let status = salt.withUnsafeMutableBytes { SecRandomCopyBytes(kSecRandomDefault, 16, $0.baseAddress!) }
        guard status == errSecSuccess else { throw APIError.generic }
        let stored = Stored(salt: salt, hash: Self.derive(pin, salt: salt, iterations: iterations), iterations: iterations)
        storage.write(pinKey, try JSONEncoder().encode(stored))
        storage.remove(failsKey)
    }

    func clear() {
        storage.remove(pinKey)
        storage.remove(failsKey)
        storage.remove(faceIdKey)
    }

    func verify(_ pin: String, now: Date = Date()) -> Result {
        var fails = (storage.read(failsKey).flatMap { try? JSONDecoder().decode(Fails.self, from: $0) }) ?? Fails(count: 0, lockedUntil: nil)
        if let until = fails.lockedUntil, until > now { return .locked(until: until) }
        guard let stored = storage.read(pinKey).flatMap({ try? JSONDecoder().decode(Stored.self, from: $0) }) else { return .ok }
        if Self.constantTimeEqual(Self.derive(pin, salt: stored.salt, iterations: stored.iterations), stored.hash) {
            storage.remove(failsKey)
            return .ok
        }
        // Si el bloqueo ya caducó, se empieza a contar de nuevo.
        let count = (fails.lockedUntil != nil) ? 1 : fails.count + 1
        if count >= Self.maxFails {
            let until = now.addingTimeInterval(Self.lockSeconds)
            fails = Fails(count: 0, lockedUntil: until)
            storage.write(failsKey, (try? JSONEncoder().encode(fails)) ?? Data())
            return .locked(until: until)
        }
        fails = Fails(count: count, lockedUntil: nil)
        storage.write(failsKey, (try? JSONEncoder().encode(fails)) ?? Data())
        return .wrong(remaining: Self.maxFails - count)
    }

    private static func derive(_ pin: String, salt: Data, iterations: Int) -> Data {
        var out = Data(count: 32)
        let pw = Array(pin.utf8)
        out.withUnsafeMutableBytes { outPtr in
            salt.withUnsafeBytes { saltPtr in
                _ = CCKeyDerivationPBKDF(
                    CCPBKDFAlgorithm(kCCPBKDF2), pw.map { Int8(bitPattern: $0) }, pw.count,
                    saltPtr.bindMemory(to: UInt8.self).baseAddress!, salt.count,
                    CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA256), UInt32(iterations),
                    outPtr.bindMemory(to: UInt8.self).baseAddress!, 32
                )
            }
        }
        return out
    }

    private static func constantTimeEqual(_ a: Data, _ b: Data) -> Bool {
        guard a.count == b.count else { return false }
        return zip(a, b).reduce(0) { $0 | ($1.0 ^ $1.1) } == 0
    }
}
