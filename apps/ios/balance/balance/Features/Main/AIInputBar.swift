import SwiftUI
import Supabase

/// Opción «IA» del «+»: solo un campo de texto sobre el teclado. Al enviar, el servidor entiende la frase
/// (reglas primero, Gemini si hace falta) y se abre el formulario de nuevo movimiento relleno.
struct AIInputBar: View {
    @Environment(AppModel.self) private var app
    @State private var text = ""
    @State private var busy = false
    @State private var error: String?
    @FocusState private var focused: Bool

    private var canSend: Bool { !busy && !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }

    var body: some View {
        ZStack(alignment: .bottom) {
            Color.black.opacity(0.25).ignoresSafeArea()
                .onTapGesture { close() }
                .accessibilityLabel("Cerrar")
                .accessibilityAddTraits(.isButton)

            VStack(alignment: .leading, spacing: 6) {
                if let error { Text(error).bFootnote(.expense).padding(.horizontal, 6) }
                HStack(spacing: 8) {
                    // Una sola línea: así la tecla «enviar» del teclado envía (en varias líneas mete un salto de línea).
                    TextField("", text: $text)
                        .focused($focused)
                        .submitLabel(.send)
                        .onSubmit { Task { await send() } }
                        .disabled(busy)
                        .font(.system(size: 17)).foregroundStyle(Color.text)
                        .accessibilityLabel("Movimiento")
                        .padding(.leading, Space.s4).padding(.vertical, 14)
                    Button { Task { await send() } } label: {
                        ZStack {
                            if busy { ProgressView().tint(Color.onAccent) }
                            else { Image(systemName: "arrow.up").font(.system(size: 17, weight: .bold)) }
                        }
                        .foregroundStyle(Color.onAccent)
                        .frame(width: 40, height: 40)
                        .background(canSend || busy ? Color.accent : Color.textSecondary.opacity(0.4), in: Circle())
                    }
                    .disabled(!canSend)
                    .padding(.trailing, 6)
                    .accessibilityLabel("Enviar")
                }
                .background(Color.surface, in: RoundedRectangle(cornerRadius: 26, style: .continuous))
            }
            .padding(.horizontal, Space.s3).padding(.bottom, Space.s2)
        }
        .task {
            // El menú del «+» tarda un instante en cerrarse: después se enfoca el campo y sale el teclado.
            try? await Task.sleep(for: .milliseconds(250))
            focused = true
        }
        .onChange(of: focused) { _, f in if !f && !busy && error == nil { close() } }
    }

    private func close() {
        focused = false
        app.aiInput = false
    }

    private func send() async {
        let clean = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { close(); return }
        guard !busy else { return }
        error = nil
        busy = true
        defer { busy = false }
        do {
            let r: ParseReply = try await API.call("parse.movement", ["text": .string(String(clean.prefix(300)))])
            app.aiInput = false
            app.sheet = .scanned(MovementDraft(proposal: r.proposal, source: r.via == "ai" ? .ia : .manual))
        } catch {
            self.error = API.map(error).message
            focused = true
        }
    }
}

struct ParseReply: Decodable {
    let proposal: MovementProposalDTO
    let via: String
    let remaining: Int?
}
