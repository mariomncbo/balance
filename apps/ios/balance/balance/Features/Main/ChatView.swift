import SwiftUI
import Supabase

// MARK: - Modelo

/// Respuesta de `chat.ask` (servidor). `kind`: "answer", "action" (propuesta con Confirmar/Descartar) o "ai" (no reconocida).
struct ChatReply: Decodable, Hashable {
    let kind: String
    let text: String?
    let route: String?
    let action: String?
    let proposal: ChatProposal?
    /// La ha contestado la IA (Gemini).
    let ai: Bool?
    /// No tenía que ver con Balance (respuesta genérica, sin IA).
    let offTopic: Bool?
}

/// Propuesta de movimiento (`accountId`, `amount`, `concept`, `category`, `date`) o de meta (`name`, `target`, `durationAmount`, `durationUnit`).
struct ChatProposal: Decodable, Hashable {
    let accountId: String?
    let amount: Int?
    let concept: String?
    let category: String?
    let date: String?
    let name: String?
    let target: Int?
    let durationAmount: Int?
    let durationUnit: String?
}

struct ChatMessage: Identifiable, Hashable {
    enum Role: Hashable { case user, bot }
    enum CardState: Hashable { case pending, saving, done, discarded }

    let id = UUID()
    let role: Role
    var text: String
    var route: String?
    var action: String?
    var proposal: ChatProposal?
    var card: CardState = .pending
    var isError = false
    /// La contestó la IA: sus seguimientos («¿y el mes pasado?») también los contesta la IA.
    var ai = false
}

/// Preguntas sugeridas: se resuelven siempre sin IA en el servidor.
enum ChatChip: String, CaseIterable, Identifiable {
    case help, spent_month, top_categories, goals_status, pending_payments
    var id: String { rawValue }
    var label: String {
        switch self {
        case .help: "¿En qué me puedes ayudar?"
        case .spent_month: "¿Cuánto gasté este mes?"
        case .top_categories: "¿En qué gasto más?"
        case .goals_status: "¿Voy bien con mis metas?"
        case .pending_payments: "¿Qué pagos me quedan este mes?"
        }
    }
}

// MARK: - Pantalla

/// Asistente. La conversación vive en `AppModel.chat` (solo en memoria): dura mientras la app está abierta.
struct ChatView: View {
    @Environment(AppModel.self) private var app
    @Environment(Router.self) private var router
    @State private var input = ""
    @State private var busy = false
    @FocusState private var focused: Bool

    var body: some View {
        VStack(spacing: 0) {
            DetailHeader(title: "Asistente") {
                if !app.chat.isEmpty {
                    Button { app.chat.removeAll() } label: { Image(systemName: "square.and.pencil").font(.system(size: 17, weight: .semibold)) }
                        .foregroundStyle(Color.accentText).accessibilityLabel("Nueva conversación")
                }
            }
            .padding(.horizontal, Space.s4).padding(.top, Space.s2)

            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {
                        if app.chat.isEmpty { emptyState }
                        ForEach(app.chat) { m in bubble(m).id(m.id) }
                        if busy { typing.id("typing") }
                    }
                    .padding(.horizontal, Space.s4).padding(.vertical, Space.s4)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .scrollDismissesKeyboard(.interactively)
                .onChange(of: app.chat.count) { _, _ in scrollToEnd(proxy) }
                .onChange(of: busy) { _, _ in scrollToEnd(proxy) }
                .onAppear { scrollToEnd(proxy, animated: false) }
            }

            inputBar
        }
        .background(Color.bg.ignoresSafeArea())
        .toolbar(.hidden, for: .navigationBar)
    }

    // MARK: Partes

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: 14) {
            BAvatar(symbol: "sparkles", style: .solidAccent, size: 48)
            Text("¿Qué quieres saber de tu dinero?").bH1()
            Text("Pregúntame por tus gastos, tu saldo o tus metas. También puedes apuntar un gasto: «12 € en Mercadona».").bSub()
            VStack(alignment: .leading, spacing: 8) {
                ForEach(ChatChip.allCases) { c in
                    Button(c.label) { Task { await send(chip: c) } }
                        .buttonStyle(.b(.soft, small: true, block: false)).disabled(busy)
                }
            }
            .padding(.top, 4)
        }
        .padding(.top, 8)
    }

    @ViewBuilder private func bubble(_ m: ChatMessage) -> some View {
        switch m.role {
        case .user:
            HStack {
                Spacer(minLength: 48)
                Text(m.text).font(.system(size: 16)).foregroundStyle(Color.onAccent)
                    .padding(.horizontal, 14).padding(.vertical, 10)
                    .background(Color.accent, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            }
            .accessibilityElement(children: .combine).accessibilityLabel("Tú: \(m.text)")
        case .bot:
            VStack(alignment: .leading, spacing: 10) {
                Text(m.text).font(.system(size: 16)).foregroundStyle(m.isError ? Color.expense : Color.text)
                    .fixedSize(horizontal: false, vertical: true)
                if m.proposal != nil { card(m) }
                if let route = m.route, let label = routeLabel(route) {
                    Button(label) { open(route) }.buttonStyle(.b(.soft, small: true, block: false))
                }
            }
            .padding(.horizontal, 14).padding(.vertical, 12)
            .background(Color.surface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.trailing, 32)
            .accessibilityElement(children: .contain)
        }
    }

    @ViewBuilder private func card(_ m: ChatMessage) -> some View {
        switch m.card {
        case .pending, .saving:
            HStack(spacing: 8) {
                Button(m.card == .saving ? "Guardando…" : "Confirmar") { Task { await confirm(m) } }
                    .buttonStyle(.b(.primary, small: true, block: false)).disabled(m.card == .saving)
                Button("Descartar") { update(m.id) { $0.card = .discarded } }
                    .buttonStyle(.b(.secondary, small: true, block: false)).disabled(m.card == .saving)
            }
        case .done:
            Label(m.action == "goal" ? "Meta creada" : "Apuntado", systemImage: "checkmark.circle.fill").bFootnote(.income, weight: .bold)
        case .discarded:
            Text("Descartado").bFootnote()
        }
    }

    private var typing: some View {
        HStack(spacing: 8) {
            ProgressView().controlSize(.small)
            Text("Escribiendo…").bSub()
        }
        .padding(.horizontal, 14).padding(.vertical, 12)
        .background(Color.surface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .accessibilityLabel("El asistente está escribiendo")
    }

    private var inputBar: some View {
        VStack(spacing: 8) {
            if !app.chat.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(ChatChip.allCases) { c in
                            Button(c.label) { Task { await send(chip: c) } }
                                .buttonStyle(.b(.soft, small: true, block: false)).disabled(busy)
                        }
                    }
                    .padding(.horizontal, Space.s4)
                }
            }
            HStack(spacing: 8) {
                TextField("Escribe tu pregunta", text: $input, axis: .vertical)
                    .lineLimit(1...4)
                    .focused($focused)
                    .submitLabel(.send)
                    .onSubmit { Task { await send(text: input) } }
                    .font(.system(size: 16)).foregroundStyle(Color.text)
                    .padding(.horizontal, 16).padding(.vertical, 12)
                    .background(Color.surface, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).strokeBorder(Color.borderControl, lineWidth: 1))
                Button { Task { await send(text: input) } } label: {
                    Image(systemName: "arrow.up").font(.system(size: 17, weight: .bold)).foregroundStyle(Color.onAccent)
                        .frame(width: 44, height: 44).background(canSend ? Color.accent : Color.textSecondary.opacity(0.4), in: Circle())
                }
                .disabled(!canSend).accessibilityLabel("Enviar")
            }
            .padding(.horizontal, Space.s4)
        }
        .padding(.top, 8).padding(.bottom, 8)
        .background(Color.bg)
    }

    private var canSend: Bool { !busy && !input.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }

    // MARK: Acciones

    private func send(text raw: String) async {
        let text = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !busy else { return }
        input = ""
        // Contexto para seguimientos («¿y el mes pasado?»): los 4 últimos mensajes. Solo viajan con la pregunta; no se guardan.
        let history: [AnyJSON] = app.chat.filter { !$0.isError }.suffix(4).map {
            .object(["role": .string($0.role == .user ? "user" : "bot"), "text": .string(String($0.text.prefix(600))), "ai": .bool($0.ai)])
        }
        app.chat.append(ChatMessage(role: .user, text: text))
        await ask(["text": .string(String(text.prefix(500))), "history": .array(history)])
    }

    private func send(chip: ChatChip) async {
        guard !busy else { return }
        app.chat.append(ChatMessage(role: .user, text: chip.label))
        await ask(["chip": .string(chip.rawValue)])
    }

    private func ask(_ params: [String: AnyJSON]) async {
        busy = true
        defer { busy = false }
        do {
            let r: ChatReply = try await API.call("chat.ask", params)
            app.chat.append(ChatMessage(role: .bot, text: r.text ?? "Error, inténtalo más tarde.", route: r.route, action: r.action, proposal: r.proposal, ai: r.ai == true))
        } catch {
            // El servidor ya da el mensaje adecuado («Error, inténtalo más tarde.» o el del límite diario).
            let e = API.map(error)
            app.chat.append(ChatMessage(role: .bot, text: e.status == 429 || e.status == 503 ? e.message : "Error, inténtalo más tarde.", isError: true))
        }
    }

    private func confirm(_ m: ChatMessage) async {
        guard let p = m.proposal else { return }
        update(m.id) { $0.card = .saving }
        do {
            if m.action == "goal" {
                try await API.send("goals.create", [
                    "name": .string(p.name ?? ""), "target": .integer(p.target ?? 0),
                    "durationAmount": .integer(p.durationAmount ?? 1), "durationUnit": .string(p.durationUnit ?? "month"),
                ])
            } else {
                try await API.send("transactions.create", [
                    "accountId": .string(p.accountId ?? ""), "amount": .integer(p.amount ?? 0), "concept": .string(p.concept ?? ""),
                    "category": .string(p.category ?? "otros"), "date": .string(p.date ?? Dates.todayMadrid()), "source": .string("manual"),
                ])
            }
            update(m.id) { $0.card = .done }
            app.invalidate()
        } catch {
            update(m.id) { $0.card = .pending }
            app.chat.append(ChatMessage(role: .bot, text: "No se pudo guardar: \(API.map(error).message)", isError: true))
        }
    }

    private func update(_ id: UUID, _ change: (inout ChatMessage) -> Void) {
        guard let i = app.chat.firstIndex(where: { $0.id == id }) else { return }
        change(&app.chat[i])
    }

    private func routeLabel(_ route: String) -> String? {
        switch route {
        case "shortcut": "Abrir la guía del Atajo"
        case "settings": "Ir a Ajustes"
        case "goals": "Ver mis metas"
        case "movements": "Ver movimientos"
        default: nil
        }
    }

    private func open(_ route: String) {
        switch route {
        case "shortcut": router.push(.shortcut)
        case "settings": router.push(.settings)
        case "goals": router.paths[router.tab] = []; router.tab = .goals
        case "movements": router.paths[router.tab] = []; router.tab = .movements
        default: break
        }
    }

    private func scrollToEnd(_ proxy: ScrollViewProxy, animated: Bool = true) {
        let target: AnyHashable? = busy ? AnyHashable("typing") : app.chat.last.map { AnyHashable($0.id) }
        guard let target else { return }
        if animated { withAnimation(.easeOut(duration: 0.2)) { proxy.scrollTo(target, anchor: .bottom) } } else { proxy.scrollTo(target, anchor: .bottom) }
    }
}
