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

@MainActor @Observable
final class Router {
    var path: [Route] = []
    var tab: MainTab = .home
    func push(_ r: Route) { path.append(r) }

    #if DEBUG
    /// Argumentos de depuración (solo con -fixtures): -fx.tab movements|goals, -fx.route report|settings|movement|account|chat.
    init() {
        guard Fixtures.enabled else { return }
        let d = UserDefaults.standard
        switch d.string(forKey: "fx.tab") { case "movements": tab = .movements; case "goals": tab = .goals; default: break }
        switch d.string(forKey: "fx.route") {
        case "report": path = [.report]
        case "settings": path = [.settings]
        case "movement": path = [.movement("t1")]
        case "account": path = [.account("a1")]
        case "chat": path = [.chat]
        case "shortcut": path = [.shortcut]
        default: break
        }
    }
    #else
    init() {}
    #endif
}

/// La app con sesión: tres pestañas con barra Liquid Glass, botones de cristal arriba y el menú del +.
struct MainView: View {
    @Environment(AppModel.self) private var app
    @State private var router = Router()
    @State private var menuOpen = false

    var body: some View {
        @Bindable var router = router
        NavigationStack(path: $router.path) {
            ZStack {
                switch router.tab {
                case .home: HomeView()
                case .movements: MovementsView()
                case .goals: GoalsView()
                }
            }
            .background(Color.bg.ignoresSafeArea())
            .overlay(alignment: .topTrailing) {
                GlassTopButtons(onChat: { router.push(.chat) }, onSettings: { router.push(.settings) })
                    .padding(.trailing, Space.s4).padding(.top, Space.s2)
            }
            .safeAreaInset(edge: .bottom) { GlassBar(selection: $router.tab, menuOpen: $menuOpen) }
            .overlay { if menuOpen { AddMenu(onManual: { menuOpen = false; app.sheet = .movement(id: nil) }, onClose: { menuOpen = false }) } }
            .animation(.easeOut(duration: 0.2), value: menuOpen)
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: Route.self) { route in
                switch route {
                case let .movement(id): MovementDetailView(id: id)
                case let .account(id): AccountDetailView(id: id)
                case .report: ReportView()
                case .settings: SettingsView()
                case .chat: ComingSoonView(title: "Asistente", symbol: "sparkles", text: "Pronto podrás preguntarle por tus gastos y tus metas.")
                case .shortcut: ShortcutGuideView()
                }
            }
        }
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
            if UserDefaults.standard.bool(forKey: "fx.menu") { menuOpen = true }
        }
        #endif
    }
}

/// Cabecera de las pestañas: deja hueco a los botones de cristal de la derecha.
struct TabHeader: View {
    var eyebrow: String?
    let title: String

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let eyebrow { Text(eyebrow).bEyebrow() }
            Text(title).font(.system(size: 24, weight: .heavy)).tracking(-0.4).foregroundStyle(Color.text).accessibilityAddTraits(.isHeader)
        }
        .frame(minHeight: 44, alignment: .leading)
        .padding(.trailing, 104)
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
