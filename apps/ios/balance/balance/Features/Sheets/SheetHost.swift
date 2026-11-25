import SwiftUI

/// Marco de una hoja modal: Cancelar a la izquierda, título centrado y el contenido desplazable.
struct BSheet<Content: View>: View {
    let title: String
    var closeLabel = "Cancelar"
    @ViewBuilder var content: () -> Content
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 0) {
            ZStack {
                Text(title).font(.system(size: 17, weight: .bold)).foregroundStyle(Color.text).accessibilityAddTraits(.isHeader)
                HStack { Button(closeLabel) { dismiss() }.buttonStyle(.bLink); Spacer() }
            }
            .padding(.horizontal, Space.s4).padding(.top, Space.s4)
            ScrollView {
                VStack(alignment: .leading, spacing: 16, content: content)
                    .padding(.horizontal, Space.s4).padding(.vertical, Space.s4)
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .background(Color.bg.ignoresSafeArea())
        .presentationDragIndicator(.visible)
        .presentationCornerRadius(Radius.xl)
    }
}

struct SheetHost: View {
    let kind: SheetKind

    var body: some View {
        switch kind {
        case let .account(id, local): AccountSheet(id: id, local: local)
        case let .movement(id): MovementSheet(id: id)
        case let .recurring(id): RecurringSheet(id: id)
        case let .goal(id): GoalSheet(id: id)
        case let .goalDetail(id): GoalDetailSheet(id: id)
        }
    }
}

/// Fila "Borrar" con confirmación en la propia hoja.
struct DeleteBlock: View {
    let label: String
    let question: String
    let detail: String
    let busy: Bool
    let onDelete: () -> Void
    @State private var confirming = false

    var body: some View {
        if confirming {
            BTile(spacing: 12) {
                Text(question).bTitle()
                Text(detail).bSub()
                HStack(spacing: 8) {
                    Button("Cancelar") { confirming = false }.buttonStyle(.b(.secondary, small: true))
                    Button(label, action: onDelete).buttonStyle(.b(.destructive, small: true)).disabled(busy)
                }
            }
            .accessibilityElement(children: .contain)
        } else {
            Button(label) { confirming = true }.buttonStyle(.bDangerLink).frame(maxWidth: .infinity)
        }
    }
}

/// Selector de cuenta con el aspecto de un campo.
struct AccountPicker: View {
    let label: String
    @Binding var selection: String
    let accounts: [AccountBalance]
    var allowNone = false

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).bEyebrow().padding(.leading, 4)
            Picker(label, selection: $selection) {
                if allowNone { Text("Sin cuenta").tag("") }
                ForEach(accounts) { Text($0.name).tag($0.id) }
            }
            .pickerStyle(.menu).labelsHidden().tint(Color.text)
            .frame(maxWidth: .infinity, minHeight: 54, alignment: .leading).padding(.horizontal, Space.s4 - 8)
            .background(Color.surface, in: RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Radius.md, style: .continuous).strokeBorder(Color.borderControl, lineWidth: 1))
        }
    }
}
