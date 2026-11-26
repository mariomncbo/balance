import Observation
import SwiftUI

enum Route: Hashable {
    case movement(String)
    case account(String)
    case report
    case settings
    case chat
    case shortcut
}

/// Pestañas de la barra inferior nativa.
enum MainTab: Hashable {
    case home, movements, goals
}

@MainActor @Observable
final class Router {
    var tab: MainTab = .home
    /// Cada pestaña tiene su propia pila de navegación (como en las apps de Apple).
    var paths: [MainTab: [Route]] = [:]
    func push(_ r: Route) { paths[tab, default: []].append(r) }

    #if DEBUG
    /// Argumentos de depuración (solo con -fixtures): -fx.tab movements|goals, -fx.route report|settings|movement|account|chat.
    init() {
        guard Fixtures.enabled else { return }
        let d = UserDefaults.standard
        switch d.string(forKey: "fx.tab") { case "movements": tab = .movements; case "goals": tab = .goals; default: break }
        switch d.string(forKey: "fx.route") {
        case "report": paths[tab] = [.report]
        case "settings": paths[tab] = [.settings]
        case "movement": paths[tab] = [.movement("t1")]
        case "account": paths[tab] = [.account("a1")]
        case "chat": paths[tab] = [.chat]
        case "shortcut": paths[tab] = [.shortcut]
        default: break
        }
    }
    #else
    init() {}
    #endif
}

/// La app con sesión: barra de pestañas nativa (Liquid Glass del sistema) y, arriba, la cápsula nativa con
/// el menú «+» (añadir movimiento), Asistente y Ajustes.
struct MainView: View {
    @Environment(AppModel.self) private var app
    @State private var router = Router()

    var body: some View {
        @Bindable var router = router
        TabView(selection: $router.tab) {
            Tab("Principal", systemImage: "house", value: MainTab.home) { stack(.home) { HomeView() } }
            Tab("Movimientos", systemImage: "arrow.up.arrow.down", value: MainTab.movements) { stack(.movements) { MovementsView() } }
            Tab("Metas", systemImage: "target", value: MainTab.goals) { stack(.goals) { GoalsView() } }
        }
        .tabBarMinimizeBehavior(.never)
        .tint(Color.accent)
        .environment(router)
        .task { await ResponseCache.warmUp() }
        #if DEBUG
        .task {
            guard Fixtures.enabled else { return }
            switch UserDefaults.standard.string(forKey: "fx.sheet") {
            case "movement": app.sheet = .movement(id: nil)
            case "movement-edit": app.sheet = .movement(id: "t1")
            case "account": app.sheet = .account(id: nil, local: false)
            case "recurring": app.sheet = .recurring(id: nil)
            case "recurring-edit": app.sheet = .recurring(id: "r3")
            case "goal": app.sheet = .goal(id: nil)
            case "goal-edit": app.sheet = .goal(id: "g2")
            case "goal-detail": app.sheet = .goalDetail(id: "g1")
            default: break
            }
        }
        #endif
    }

    /// Pila de navegación de una pestaña: título grande nativo (lo pone cada pantalla), botones de arriba y destinos.
    private func stack<Content: View>(_ tab: MainTab, @ViewBuilder content: () -> Content) -> some View {
        NavigationStack(path: Binding(get: { router.paths[tab] ?? [] }, set: { router.paths[tab] = $0 })) {
            content()
                .navigationBarTitleDisplayMode(.large)
                .toolbar {
                    // Menú nativo del «+», solo a la izquierda. IA y Escaneo llegan en fases posteriores.
                    ToolbarItem(placement: .topBarLeading) {
                        Menu("Añadir movimiento", systemImage: "plus") {
                            Button("A mano", systemImage: "pencil") { app.sheet = .movement(id: nil) }
                            Button("IA · Pronto", systemImage: "sparkles") {}.disabled(true)
                            Button("Escaneo · Pronto", systemImage: "camera") {}.disabled(true)
                        }
                    }
                    ToolbarItemGroup(placement: .topBarTrailing) {
                        Button("Asistente de IA", systemImage: "sparkles") { router.push(.chat) }
                        Button("Ajustes", systemImage: "slider.horizontal.3") { router.push(.settings) }
                    }
                }
                .navigationDestination(for: Route.self) { route in
                    switch route {
                    case let .movement(id): MovementDetailView(id: id)
                    case let .account(id): AccountDetailView(id: id)
                    case .report: ReportView()
                    case .settings: SettingsView()
                    case .chat: ChatView()
                    case .shortcut: ShortcutGuideView()
                    }
                }
        }
    }
}

/// Cabecera de pantalla secundaria: atrás a la izquierda, título centrado, acción opcional a la derecha.
struct DetailHeader<Trailing: View>: View {
    var title: String?
    @ViewBuilder var trailing: () -> Trailing
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        HStack {
            BRoundButton(symbol: "chevron.left", label: "Atrás") { dismiss() }
            Spacer()
            if let title { Text(title).font(.system(size: 17, weight: .bold)).foregroundStyle(Color.text).accessibilityAddTraits(.isHeader) }
            Spacer()
            trailing().frame(width: 44, height: 44)
        }
        .frame(minHeight: 44)
    }
}

extension DetailHeader where Trailing == EmptyView {
    init(title: String? = nil) { self.init(title: title) { EmptyView() } }
}
