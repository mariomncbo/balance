import Auth
import Supabase
import SwiftUI

/// Raíz: elige entre entrada (sin sesión), crear código, desbloqueo y la app.
struct RootView: View {
    @Environment(AppModel.self) private var appModel

    var body: some View {
        @Bindable var app = appModel
        Group {
            if let preview = debugScreen {
                preview
            } else if isFixtures {
                MainView()
            } else if !app.ready {
                Color.bg.ignoresSafeArea().overlay(ProgressView())
            } else if app.session == nil {
                SignedOutFlow()
            } else if app.recovering {
                NewPasswordView()
            } else if app.needsPinSetup {
                CreatePinView()
            } else if app.locked {
                UnlockView()
            } else {
                MainView()
            }
        }
        .animation(.default, value: app.locked)
        .background(Color.bg.ignoresSafeArea())
        .sheet(item: $app.sheet) { SheetHost(kind: $0) }
        .onOpenURL { url in Task { await appModel.handle(url: url) } }
    }

    private var isFixtures: Bool {
        #if DEBUG
        Fixtures.enabled
        #else
        false
        #endif
    }

    /// Solo Debug: -fx.screen balance|loans|salary|shortcut|scan|signup|login|recover|verify|createpin|unlock|newpassword
    private var debugScreen: AnyView? {
        #if DEBUG
        guard let name = UserDefaults.standard.string(forKey: "fx.screen") else { return nil }
        let nav = AuthNavigator()
        func flow<V: View>(_ v: V) -> AnyView { AnyView(NavigationStack { v }.environment(nav)) }
        switch name {
        case "balance": return flow(OnboardingBalanceView())
        case "loans": return flow(OnboardingLoansView())
        case "salary": return flow(OnboardingSalaryView())
        case "shortcut": return flow(OnboardingShortcutView())
        case "scan": return flow(OnboardingScanView())
        case "signup": return flow(SignupView())
        case "login": return flow(LoginView())
        case "recover": return flow(RecoverView())
        case "verify": return flow(VerifyView(email: "mario@correo.com"))
        case "createpin": return AnyView(CreatePinView())
        case "unlock": return AnyView(UnlockView())
        case "newpassword": return AnyView(NewPasswordView())
        default: return nil
        }
        #else
        return nil
        #endif
    }
}
