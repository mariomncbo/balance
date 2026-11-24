import SwiftUI

@main
struct BalanceApp: App {
    @State private var app = AppModel()
    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(app)
                .preferredColorScheme(app.theme.scheme)
                .tint(Color.accent)
                .task { await app.start() }
                .onChange(of: scenePhase) { _, phase in app.scenePhaseChanged(phase) }
        }
    }
}
