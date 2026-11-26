import Foundation
import Observation
import SwiftUI
import Supabase

enum ThemeChoice: String, CaseIterable, Identifiable {
    case system, light, dark
    var id: String { rawValue }
    var label: String { switch self { case .system: "Sistema"; case .light: "Claro"; case .dark: "Oscuro" } }
    var scheme: ColorScheme? { switch self { case .system: nil; case .light: .light; case .dark: .dark } }
    var symbol: String { switch self { case .system: "gearshape"; case .light: "sun.max"; case .dark: "moon" } }
}

struct Profile: Codable, Hashable {
    let name: String
    let username: String
    let email: String
}

/// Hoja modal abierta. Cada caso lleva el id cuando es una edición.
enum SheetKind: Identifiable, Hashable {
    case account(id: String?, local: Bool)
    case movement(id: String?)
    case recurring(id: String?)
    case goal(id: String?)
    case goalDetail(id: String)

    var id: String {
        switch self {
        case let .account(id, local): "account-\(id ?? "new")-\(local)"
        case let .movement(id): "movement-\(id ?? "new")"
        case let .recurring(id): "recurring-\(id ?? "new")"
        case let .goal(id): "goal-\(id ?? "new")"
        case let .goalDetail(id): "goal-detail-\(id)"
        }
    }
}

@MainActor @Observable
final class AppModel {
    // Sesión
    private(set) var session: Session?
    private(set) var ready = false
    private(set) var profile: Profile?

    // Candado
    var locked: Bool
    /// Tras verificar el correo se ofrece crear el código de acceso.
    var needsPinSetup = false
    /// Llegó el enlace de "recuperar contraseña": se pide la nueva.
    var recovering = false
    /// Mensaje si un enlace del correo no ha funcionado.
    var linkError: String?
    let pin: PinStore

    // Tema (se guarda en el dispositivo)
    var theme: ThemeChoice {
        didSet { UserDefaults.standard.set(theme.rawValue, forKey: "balance.theme") }
    }

    // Datos: sube cada vez que algo cambia, y las pantallas vuelven a pedir lo suyo.
    private(set) var version = 0
    var sheet: SheetKind?

    private var backgroundedAt: Date?
    private static let relockAfter: TimeInterval = 30

    init(pin: PinStore = PinStore()) {
        self.pin = pin
        self.locked = pin.hasPin
        self.theme = ThemeChoice(rawValue: UserDefaults.standard.string(forKey: "balance.theme") ?? "") ?? .system
    }

    func start() async {
        #if DEBUG
        if Fixtures.enabled { profile = Fixtures.profile; ready = true; return }
        #endif
        // Sesión guardada en el dispositivo (si la hay): así la pantalla de carga nunca depende del primer evento.
        if let saved = try? await supabase.auth.session, !saved.isExpired { session = saved }
        ready = true
        if session != nil { await loadProfile() }
        for await (event, session) in supabase.auth.authStateChanges {
            self.session = session
            self.ready = true
            if event == .passwordRecovery { recovering = true }
            if session == nil {
                ResponseCache.clear()
                profile = nil
            } else {
                if profile == nil { await loadProfile() }
                await importOnboardingIfNeeded()
            }
        }
    }

    func invalidate() {
        ResponseCache.markStale()
        version += 1
    }

    /// Enlace del correo: confirma el registro (`balance://confirmar`) o abre la recuperación (`balance://nueva-contrasena`).
    func handle(url: URL) async {
        guard url.scheme == "balance" else { return }
        do {
            _ = try await supabase.auth.session(from: url)
            // Tras confirmar el correo se ofrece crear el código de acceso (si aún no hay).
            if url.host == "confirmar", !pin.hasPin { needsPinSetup = true }
        } catch {
            linkError = "El enlace ha caducado o ya se usó. Pide uno nuevo."
        }
    }

    /// Sube de una vez lo escrito en el onboarding (cuentas y fijos) y lo borra del dispositivo.
    /// Si falla, se conserva y se reintenta en el próximo inicio de sesión.
    func importOnboardingIfNeeded() async {
        let data = OnboardingStore.read()
        guard !data.isEmpty else { return }
        do {
            try await API.send("onboarding.import", data.importParams)
            OnboardingStore.clear()
            invalidate()
        } catch let e as APIError where e.status == 409 {
            OnboardingStore.clear() // la cuenta ya tenía datos: no se duplica
        } catch {
            // se reintentará
        }
    }

    func loadProfile() async {
        profile = try? await supabase.from("profiles").select("name, username, email").single().execute().value
    }

    func signOut() async {
        try? await supabase.auth.signOut()
        ResponseCache.clear()
        profile = nil
        locked = pin.hasPin
    }

    /// Elimina la cuenta en el servidor (con todos sus datos) y deja este iPhone como recién instalado.
    func deleteAccount(username: String) async throws {
        try await API.send("account.delete", ["username": .string(username)])
        try? await supabase.auth.signOut(scope: .local)
        ResponseCache.clear()
        ShortcutKeyStore.clear()
        OnboardingStore.clear()
        pin.clear()
        UserDefaults.standard.removeObject(forKey: "home.excludedAccounts")
        profile = nil
        locked = false
    }

    func setSession(access: String, refresh: String) async throws {
        try await supabase.auth.setSession(accessToken: access, refreshToken: refresh)
    }

    // Candado
    func unlock() { locked = false }
    func lockNow() { locked = pin.hasPin }

    func scenePhaseChanged(_ phase: ScenePhase) {
        switch phase {
        case .background, .inactive:
            if backgroundedAt == nil { backgroundedAt = Date() }
        case .active:
            if let t = backgroundedAt {
                let away = Date().timeIntervalSince(t)
                if pin.hasPin, away > Self.relockAfter { locked = true }
                // Al volver tras un rato pueden haber llegado pagos (Atajo, fijos): se refresca detrás, sin parpadeo.
                if away > 20 { invalidate() }
            }
            backgroundedAt = nil
        @unknown default: break
        }
    }
}
