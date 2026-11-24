import LocalAuthentication

/// Face ID. Solo se ofrece si hay PIN (regla del producto) y el dispositivo lo permite.
enum Biometrics {
    static var available: Bool {
        let ctx = LAContext()
        var err: NSError?
        return ctx.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &err) && ctx.biometryType == .faceID
    }

    static func authenticate(reason: String = "Desbloquea Balance") async -> Bool {
        let ctx = LAContext()
        ctx.localizedFallbackTitle = "" // sin "Introducir código del iPhone": el respaldo es el PIN de Balance
        return (try? await ctx.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: reason)) ?? false
    }
}
