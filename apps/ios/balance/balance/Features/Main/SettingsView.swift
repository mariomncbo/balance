import SwiftUI

struct SettingsView: View {
    @Environment(AppModel.self) private var appModel
    @Environment(Router.self) private var router
    @State private var pinOn = false
    @State private var faceOn = false
    @State private var changePin = false
    @State private var editProfile = false
    @State private var deleteAccount = false

    var body: some View {
        @Bindable var app = appModel
        BScreen(spacing: 14) {
            DetailHeader(title: "Ajustes")
            VStack(spacing: 10) {
                Button { editProfile = true } label: {
                BTile(spacing: 0) {
                    HStack(spacing: 14) {
                        Text(String(app.profile?.name.prefix(1) ?? "").uppercased())
                            .font(.system(size: 22, weight: .heavy)).foregroundStyle(Color.onAccent)
                            .frame(width: 52, height: 52).background(Color.accent, in: Circle()).accessibilityHidden(true)
                        VStack(alignment: .leading, spacing: 0) {
                            Text(app.profile?.name ?? " ").font(.system(size: 19, weight: .heavy)).foregroundStyle(Color.text)
                            Text(app.profile.map { "@\($0.username) · \($0.email)" } ?? " ").bSub().lineLimit(1)
                        }
                        Spacer()
                        Image(systemName: "chevron.right").foregroundStyle(Color.textSecondary)
                    }
                }
                }
                .buttonStyle(.plain)
                .accessibilityHint("Edita tu nombre y tu nombre de usuario")
                BTile(spacing: 10) {
                    Text("Apariencia").bEyebrow().accessibilityAddTraits(.isHeader)
                    HStack(spacing: 8) {
                        ForEach(ThemeChoice.allCases) { m in
                            Button { app.theme = m } label: {
                                VStack(spacing: 6) {
                                    Image(systemName: m.symbol).font(.system(size: 18))
                                    Text(m.label).font(.system(size: 14, weight: .semibold))
                                }
                                .foregroundStyle(app.theme == m ? Color.onAccent : Color.text)
                                .frame(maxWidth: .infinity).padding(.vertical, 12)
                                .background(app.theme == m ? Color.accent : Color.bg, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                            }
                            .buttonStyle(.plain)
                            .accessibilityAddTraits(app.theme == m ? .isSelected : [])
                        }
                    }
                }
                BTilePair {
                    BTile(spacing: 6) {
                        BAvatar(symbol: "lock", style: .accent)
                        Text("Código").bTitle().padding(.top, 4)
                        Text(pinOn ? "Activado" : "Desactivado").bFootnote(pinOn ? .income : .textSecondary, weight: .bold)
                        VStack(alignment: .leading, spacing: 6) {
                            Button(pinOn ? "Cambiar" : "Activar") { changePin = true }
                            if pinOn {
                                Button("Bloquear ahora") { app.lockNow() }
                                Button("Quitar") { app.pin.clear(); refresh() }.foregroundStyle(Color.expense)
                            }
                        }
                        .font(.system(size: 13, weight: .bold)).foregroundStyle(Color.accentText).padding(.top, 4)
                    }
                    BTile(spacing: 6) {
                        BAvatar(symbol: "faceid", style: .accent)
                        Text("Face ID").bTitle().padding(.top, 4)
                        if pinOn && Biometrics.available {
                            Toggle("Face ID", isOn: Binding(
                                get: { faceOn },
                                set: { v in
                                    Task {
                                        if v, !(await Biometrics.authenticate(reason: "Activa Face ID en Balance")) { return }
                                        app.pin.faceIdEnabled = v; refresh()
                                    }
                                })).labelsHidden()
                            Text(faceOn ? "Activado" : "Desactivado").bFootnote(faceOn ? .income : .textSecondary, weight: .bold)
                        } else {
                            Text(Biometrics.available ? "Primero activa el código" : "No disponible en este dispositivo").bFootnote()
                        }
                    }
                }
                Button { router.push(.shortcut) } label: {
                    BTile(style: .soft, spacing: 0) {
                        HStack(spacing: 12) {
                            BAvatar(symbol: "bolt", style: .solidAccent)
                            VStack(alignment: .leading, spacing: 0) {
                                Text("¿Cómo hacer registro automático de pagos?").font(.system(size: 16, weight: .semibold)).foregroundStyle(Color.text).multilineTextAlignment(.leading)
                                Text("Guía del Atajo de iPhone").bFootnote(.accentText, weight: .semibold)
                            }
                            Spacer(); Image(systemName: "chevron.right").foregroundStyle(Color.accentText)
                        }
                    }
                }.buttonStyle(.plain)
            }
            Button("Cerrar sesión") { Task { await app.signOut() } }.buttonStyle(.bDangerSecondary).padding(.top, 12)
            Button("Eliminar cuenta") { deleteAccount = true }.buttonStyle(.bDangerLink).frame(maxWidth: .infinity)
        }
        .toolbar(.hidden, for: .navigationBar)
        .onAppear(perform: refresh)
        .sheet(isPresented: $editProfile) { ProfileSheet().environment(app) }
        .sheet(isPresented: $deleteAccount) { DeleteAccountSheet().environment(app) }
        .sheet(isPresented: $changePin, onDismiss: refresh) { CreatePinView().environment(app) }
    }

    private func refresh() { pinOn = appModel.pin.hasPin; faceOn = appModel.pin.faceIdEnabled }
}
