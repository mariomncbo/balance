import SwiftUI

enum MainTab: Int, CaseIterable, Identifiable {
    case home, movements, goals
    var id: Int { rawValue }
    var title: String { switch self { case .home: "Principal"; case .movements: "Movimientos"; case .goals: "Metas" } }
    var symbol: String { switch self { case .home: "house"; case .movements: "arrow.up.arrow.down"; case .goals: "target" } }
}

/// Barra inferior Liquid Glass: tres pestañas y, aparte, el botón + (nativo con `glassEffect`).
struct GlassBar: View {
    @Binding var selection: MainTab
    @Binding var menuOpen: Bool
    @Namespace private var ns

    var body: some View {
        GlassEffectContainer(spacing: 12) {
            HStack(spacing: 12) {
                HStack(spacing: 0) {
                    ForEach(MainTab.allCases) { tab in
                        Button { selection = tab } label: {
                            VStack(spacing: 2) {
                                Image(systemName: tab.symbol).font(.system(size: 20, weight: .medium))
                                Text(tab.title).font(.system(size: 11, weight: .semibold))
                            }
                            .foregroundStyle(selection == tab ? Color.accentText : Color.textSecondary)
                            .frame(maxWidth: .infinity, minHeight: 54)
                            .background {
                                if selection == tab { Capsule().fill(Color.accentSubtle).matchedGeometryEffect(id: "sel", in: ns) }
                            }
                            .contentShape(Capsule())
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(tab.title)
                        .accessibilityAddTraits(selection == tab ? .isSelected : [])
                    }
                }
                .padding(4)
                .glassEffect(.regular.interactive(), in: Capsule())
                .animation(.snappy, value: selection)

                Button { menuOpen = true } label: {
                    Image(systemName: "plus").font(.system(size: 22, weight: .semibold)).foregroundStyle(Color.text).frame(width: 62, height: 62)
                }
                .buttonStyle(.plain)
                .glassEffect(.regular.interactive(), in: Circle())
                .accessibilityLabel("Añadir movimiento")
            }
        }
        .padding(.horizontal, Space.s4)
        .padding(.bottom, Space.s2)
    }
}

/// Botones de cristal de arriba a la derecha: asistente de IA y ajustes.
struct GlassTopButtons: View {
    let onChat: () -> Void
    let onSettings: () -> Void

    var body: some View {
        GlassEffectContainer(spacing: 8) {
            HStack(spacing: 8) {
                button("sparkles", "Asistente de IA", onChat)
                button("slider.horizontal.3", "Ajustes", onSettings)
            }
        }
    }

    private func button(_ symbol: String, _ label: String, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol).font(.system(size: 17, weight: .semibold)).foregroundStyle(Color.text).frame(width: 44, height: 44)
        }
        .buttonStyle(.plain)
        .glassEffect(.regular.interactive(), in: Circle())
        .accessibilityLabel(label)
    }
}

/// Menú del +: tres opciones de cristal sobre el fondo oscurecido. IA y Escaneo llegan en fases posteriores.
struct AddMenu: View {
    let onManual: () -> Void
    let onClose: () -> Void

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            Color.scrim.ignoresSafeArea().onTapGesture(perform: onClose).accessibilityHidden(true)
            VStack(alignment: .trailing, spacing: 12) {
                GlassEffectContainer(spacing: 10) {
                    VStack(alignment: .trailing, spacing: 10) {
                        item("sparkles", "IA", soon: true, action: {})
                        item("pencil", "A mano", soon: false, action: onManual)
                        item("camera", "Escaneo", soon: true, action: {})
                    }
                }
                Button(action: onClose) {
                    Image(systemName: "xmark").font(.system(size: 22, weight: .semibold)).foregroundStyle(Color.text).frame(width: 62, height: 62)
                }
                .buttonStyle(.plain)
                .glassEffect(.regular.interactive(), in: Circle())
                .accessibilityLabel("Cerrar menú")
            }
            .padding(.trailing, Space.s4)
            .padding(.bottom, Space.s2)
        }
        .transition(.opacity)
    }

    private func item(_ symbol: String, _ title: String, soon: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 10) {
                Image(systemName: symbol).font(.system(size: 18, weight: .medium))
                Text(title).font(.system(size: 17, weight: .semibold))
                if soon { BPill(text: "Pronto", style: .accent) }
            }
            .foregroundStyle(Color.text)
            .padding(.horizontal, 20).frame(minHeight: 54)
        }
        .buttonStyle(.plain)
        .glassEffect(.regular.interactive(), in: Capsule())
        .disabled(soon)
        .opacity(soon ? 0.7 : 1)
    }
}
