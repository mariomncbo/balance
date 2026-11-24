import SwiftUI
import Supabase
import UIKit

/// Guía del Atajo de iPhone: crea la clave personal y explica los pasos para que cada pago con Wallet se apunte solo.
struct ShortcutGuideView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var status = Resource<ShortcutStatus>()
    @State private var accounts = Resource<Balances>()
    @State private var token: String? = ShortcutKeyStore.read()
    @State private var busy = false
    @State private var error: String?
    @State private var copied: String?
    @State private var confirmRegenerate = false
    @State private var confirmRevoke = false
    @State private var showSteps = false

    private var active: ShortcutStatus? { status.data?.active == true ? status.data : nil }
    /// La clave guardada en este iPhone solo sirve si coincide con la activa.
    private var usableToken: String? { token.flatMap { t in active?.hint.map { t.hasSuffix($0) } == true ? t : nil } }

    var body: some View {
        BScreen(spacing: 14) {
            DetailHeader()
            VStack(alignment: .leading, spacing: 6) {
                Text("Pagos apuntados solos").bH1().accessibilityAddTraits(.isHeader)
                Text("Cada pago con una tarjeta de Wallet aparecerá en Balance. Son 4 pasos.").bLead()
            }
            if status.loading && status.data == nil { BLoadingTiles(rows: 3) }
            else if let e = status.error, status.data == nil { BErrorState(error: e) { app.invalidate() } }
            else {
                step(1, "Copia tu clave personal") { keyStep }
                step(2, "Crea el Atajo «Balance»") { shortcutStep }
                step(3, "Crea la automatización") {
                    Text("En Atajos: Automatización → Nueva → Transacción. Elige tus tarjetas y marca «Ejecutar inmediatamente».").bSubhead(.textSecondary)
                }
                step(4, "Elige el Atajo «Balance»") {
                    Text("Como acción. Tu próximo pago aparecerá en Movimientos con el origen «Atajo».").bSubhead(.textSecondary)
                }
                if active != nil { optionsTile }
                if let error { BPill(text: error, style: .expense) }
                Button("Hecho") { dismiss() }.buttonStyle(.bSecondary).padding(.top, 6)
            }
        }
        .toolbar(.hidden, for: .navigationBar)
        .task(id: app.version) {
            async let a: () = status.load("shortcut.status")
            async let b: () = accounts.load("accounts.list")
            _ = await (a, b)
        }
        .confirmationDialog("¿Generar una clave nueva?", isPresented: $confirmRegenerate, titleVisibility: .visible) {
            Button("Generar nueva", role: .destructive) { Task { await create() } }
        } message: { Text("La clave actual dejará de funcionar y tendrás que pegar la nueva en el Atajo.") }
        .confirmationDialog("¿Desactivar el Atajo?", isPresented: $confirmRevoke, titleVisibility: .visible) {
            Button("Desactivar", role: .destructive) { Task { await revoke() } }
        } message: { Text("Los pagos dejarán de apuntarse solos hasta que crees una clave nueva.") }
    }

    // MARK: Pasos

    private func step<Content: View>(_ n: Int, _ title: String, @ViewBuilder _ makeContent: () -> Content) -> some View {
        let content = makeContent()
        return BTile(spacing: 0) {
            HStack(alignment: .top, spacing: 12) {
                Text("\(n)").font(.system(size: 15, weight: .heavy)).foregroundStyle(Color.onAccent)
                    .frame(width: 30, height: 30).background(Color.accent, in: Circle()).accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 8) {
                    Text(title).bTitle()
                    content
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Paso \(n): \(title)")
    }

    @ViewBuilder private var keyStep: some View {
        if let s = active {
            HStack(spacing: 8) {
                Text(verbatim: "bal_••••••\(s.hint ?? "")").font(.system(size: 15, design: .monospaced)).foregroundStyle(Color.text)
                    .frame(maxWidth: .infinity, alignment: .leading)
                if let t = usableToken {
                    Button(copied == "key" ? "Copiada" : "Copiar") { copy(t, as: "key") }.buttonStyle(.b(.primary, small: true, block: false)).fixedSize()
                } else {
                    Button("Nueva clave") { confirmRegenerate = true }.buttonStyle(.b(.primary, small: true, block: false)).fixedSize().disabled(busy)
                }
            }
            .padding(.leading, 12).padding(.vertical, 5).padding(.trailing, 5)
            .background(Color.bg, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            if usableToken == nil {
                Text("La clave no está guardada en este iPhone. Crea una nueva para poder copiarla.").bFootnote()
            }
            Text("No la compartas: sirve para añadir pagos a tu cuenta.").bFootnote()
        } else {
            Text("Crea una clave para que el Atajo pueda apuntar tus pagos. Solo tú la tendrás.").bSubhead(.textSecondary)
            Button(busy ? "Creando…" : "Crear clave") { Task { await create() } }.buttonStyle(.b(.primary, small: true, block: false)).disabled(busy)
        }
    }

    @ViewBuilder private var shortcutStep: some View {
        Text("En la app Atajos, crea un atajo nuevo llamado «Balance» con una sola acción: «Obtener contenido de URL».").bSubhead(.textSecondary)
        HStack(spacing: 8) {
            Button(copied == "url" ? "Dirección copiada" : "Copiar dirección") { copy(ShortcutKeyStore.endpoint, as: "url") }
                .buttonStyle(.b(.soft, small: true, block: false))
            Button("Abrir Atajos") { if let u = URL(string: "shortcuts://") { UIApplication.shared.open(u) } }
                .buttonStyle(.b(.soft, small: true, block: false))
        }
        Button { withAnimation { showSteps.toggle() } } label: {
            HStack(spacing: 4) { Text(showSteps ? "Ocultar cómo configurarla" : "Ver cómo configurarla"); Image(systemName: showSteps ? "chevron.up" : "chevron.down") }
                .font(.system(size: 14, weight: .semibold)).foregroundStyle(Color.accentText)
        }
        .buttonStyle(.plain)
        if showSteps {
            VStack(alignment: .leading, spacing: 6) {
                bullet("URL: pega la dirección que has copiado.")
                bullet("Método: POST.")
                bullet("Cabeceras: añade una llamada X-Balance-Key y pega tu clave como valor.")
                bullet("Cuerpo de la solicitud: JSON, con tres campos de texto:")
                bullet("amount → Entrada del atajo › Importe", indent: true)
                bullet("merchant → Entrada del atajo › Comercio", indent: true)
                bullet("card → Entrada del atajo › Tarjeta o pase", indent: true)
                bullet("Opcional: añade «Mostrar notificación» con el resultado para ver «Apuntado: …» tras cada pago.")
            }
            .padding(12)
            .background(Color.bg, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
    }

    private func bullet(_ text: String, indent: Bool = false) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Text(indent ? "–" : "•").foregroundStyle(Color.textSecondary)
            Text(text).bFootnote(.text)
        }
        .padding(.leading, indent ? 14 : 0)
    }

    private var optionsTile: some View {
        let list = accounts.data?.accounts ?? []
        return BTile(spacing: 10) {
            Text("Opciones").bEyebrow()
            if !list.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Cuenta de los pagos").bSubhead(weight: .semibold)
                    Picker("Cuenta de los pagos", selection: Binding(
                        get: { active?.accountId ?? "" },
                        set: { id in Task { await setAccount(id.isEmpty ? nil : id) } }
                    )) {
                        Text("Automática (según la tarjeta)").tag("")
                        ForEach(list) { Text($0.name).tag($0.id) }
                    }
                    .pickerStyle(.menu).tint(Color.accentText)
                    Text("Si el nombre de la tarjeta coincide con una cuenta (p. ej. «BBVA»), se usa esa.").bFootnote()
                }
            }
            if let used = active?.lastUsedAt {
                Text("Último pago recibido: \(Self.when(used))").bFootnote()
            } else {
                Text("Todavía no ha llegado ningún pago.").bFootnote()
            }
            Button("Desactivar el Atajo") { confirmRevoke = true }.buttonStyle(.bDangerLink).disabled(busy)
        }
    }

    private static func when(_ iso: String) -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let d = f.date(from: iso) ?? ISO8601DateFormatter().date(from: iso) else { return iso }
        return d.formatted(.dateTime.day().month(.wide).hour().minute().locale(Locale(identifier: "es_ES")))
    }

    // MARK: Acciones

    private func copy(_ text: String, as what: String) {
        UIPasteboard.general.string = text
        copied = what
        Task { try? await Task.sleep(for: .seconds(2)); if copied == what { copied = nil } }
    }

    private func create() async {
        busy = true; error = nil
        defer { busy = false }
        do {
            let created: ShortcutCreated = try await API.call("shortcut.create")
            ShortcutKeyStore.save(created.token)
            token = created.token
            app.invalidate()
        } catch { self.error = API.map(error).message }
    }

    private func revoke() async {
        busy = true; error = nil
        defer { busy = false }
        do {
            try await API.send("shortcut.revoke")
            ShortcutKeyStore.clear()
            token = nil
            app.invalidate()
        } catch { self.error = API.map(error).message }
    }

    private func setAccount(_ id: String?) async {
        do {
            try await API.send("shortcut.account", ["accountId": id.map { .string($0) } ?? .null])
            app.invalidate()
        } catch { self.error = API.map(error).message }
    }
}
