import Observation
import SwiftUI

enum AuthRoute: Hashable {
    case balance, loans, salary, shortcut, scan
    case signup, login, recover
    case verify(email: String)
}

@MainActor @Observable
final class AuthNavigator {
    var path: [AuthRoute] = []
    func push(_ r: AuthRoute) { path.append(r) }
    func pop() { if !path.isEmpty { path.removeLast() } }
    func popToRoot() { path.removeAll() }
}

/// Todo lo que se ve sin sesión: bienvenida, onboarding, registro, verificación, login y recuperar.
struct SignedOutFlow: View {
    @State private var nav = AuthNavigator()

    var body: some View {
        NavigationStack(path: $nav.path) {
            WelcomeView()
                .navigationDestination(for: AuthRoute.self) { route in
                    switch route {
                    case .balance: OnboardingBalanceView()
                    case .loans: OnboardingLoansView()
                    case .salary: OnboardingSalaryView()
                    case .shortcut: OnboardingShortcutView()
                    case .scan: OnboardingScanView()
                    case .signup: SignupView()
                    case .login: LoginView()
                    case .recover: RecoverView()
                    case let .verify(email): VerifyView(email: email)
                    }
                }
        }
        .environment(nav)
        .background(Color.bg)
    }
}
