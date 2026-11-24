import Auth
import Supabase
import SwiftUI

struct UnlockView: View {
    @Environment(AppModel.self) private var app
    @State private var pin = ""
    @State private var message: String?
    @State private var lockedUntil: Date?
    @State private var forgot = false
    @State private var triedFaceId = false

    var body: some View {
        VStack(spacing: 24) {
            VStack(spacing: 10) {
                Image("LogoSimbolo").resizable().scaledToFit().frame(width: 42, height: 42)
                    .frame(width: 64, height: 64).background(Color.surface, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
                    .accessibilityHidden(true)
                Text(app.profile.map { "Hola, \($0.name)" } ?? "Hola").font(.system(size: 24, weight: .heavy)).tracking(-0.4).accessibilityAddTraits(.isHeader)
                Text("Introduce tu código").bSub()
            }
            .padding(.top, 20)
            VStack(spacing: 12) {
                HStack(spacing: Space.s3) {
                    ForEach(0..<4, id: \.self) { i in
                        ZStack { if i < pin.count { Circle().fill(Color.text).frame(width: 12, height: 12) } }
                            .frame(width: 58, height: 66)
                            .background(Color.surface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                            .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous)
                                .strokeBorder(message != nil ? Color.expense : (i == pin.count ? Color.accentBorder : Color.borderControl), lineWidth: i == pin.count || message != nil ? 1.5 : 1))
                    }
                }
                .accessibilityElement().accessibilityLabel("Código").accessibilityValue("\(pin.count) de 4 cifras")
                if let message { BPill(text: message, style: .expense).accessibilityAddTraits(.isStaticText) }
            }
            .frame(minHeight: 100)
            BPinPad(
                onDigit: { d in message = nil; if pin.count < 4 { pin += d } },
                onDelete: { if !pin.isEmpty { pin.removeLast() } },
                onBiometric: app.pin.faceIdEnabled && Biometrics.available ? { Task { await faceId() } } : nil,
                disabled: lockedUntil != nil
            )
            Spacer(minLength: 0)
            Button("¿Olvidaste el código?") { forgot = true }.buttonStyle(.bLink)
        }
        .padding(.horizontal, Space.s4).padding(.bottom, Space.s2)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.bg.ignoresSafeArea())
        .onChange(of: pin) { _, p in if p.count == 4 { check(p) } }
        .task(id: lockedUntil) {
            guard let until = lockedUntil else { return }
            try? await Task.sleep(for: .seconds(max(0, until.timeIntervalSinceNow)))
            if !Task.isCancelled { lockedUntil = nil; message = nil }
        }
        .task {
            // Face ID se ofrece solo al abrir, si está activado.
            if !triedFaceId, app.pin.faceIdEnabled, Biometrics.available { triedFaceId = true; await faceId() }
        }
        .sheet(isPresented: $forgot) { ForgotPinView() }
    }

    private func check(_ p: String) {
        switch app.pin.verify(p) {
        case .ok: app.unlock()
        case let .wrong(remaining):
            pin = ""
            message = "Código incorrecto. Te quedan \(remaining) \(remaining == 1 ? "intento" : "intentos")."
        case let .locked(until):
            pin = ""
            lockedUntil = until
            message = "Demasiados intentos. Prueba de nuevo en \(max(1, Int((until.timeIntervalSinceNow / 60).rounded(.up)))) min."
        }
    }

    private func faceId() async {
        if await Biometrics.authenticate() { app.unlock() }
    }
}

struct ForgotPinView: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var password = ""
    @State private var error: String?
    @State private var busy = false

    var body: some View {
        BFormScreen {
            VStack(alignment: .leading, spacing: 8) {
                Text("¿Olvidaste el código?").bH1().accessibilityAddTraits(.isHeader)
                Text("Escribe la contraseña de tu cuenta y podrás crear un código nuevo.").bLead()
            }
            .padding(.top, 12)
            BTile { BField(label: "Contraseña", text: $password, error: error, secure: true, content: .password) }
        } footer: {
            Button(busy ? "Comprobando…" : "Continuar") { Task { await submit() } }.buttonStyle(.bPrimary).disabled(busy)
            Button("Cancelar") { dismiss() }.buttonStyle(.bLink)
        }
        .onChange(of: password) { _, _ in error = nil }
        .presentationDragIndicator(.visible)
    }

    private func submit() async {
        guard let email = app.session?.user.email, !password.isEmpty else { error = "Escribe tu contraseña"; return }
        busy = true
        defer { busy = false }
        do {
            try await supabase.auth.signIn(email: email, password: password)
            app.pin.clear()
            app.needsPinSetup = true
            app.unlock()
            dismiss()
        } catch {
            self.error = "Contraseña incorrecta"
        }
    }
}
