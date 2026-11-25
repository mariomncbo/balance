import SwiftUI

// MARK: - Pantalla

/// Fondo gris claro con margen lateral de 16 pt. Cada pantalla la usa como contenedor desplazable.
struct BScreen<Content: View>: View {
    var spacing: CGFloat = 16
    @ViewBuilder var content: () -> Content

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: spacing, content: content)
                .padding(.horizontal, Space.s4)
                .padding(.top, Space.s4)
                .padding(.bottom, Space.s5)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .scrollBounceBehavior(.basedOnSize)
        .background(Color.bg.ignoresSafeArea())
    }
}

/// Pantalla de formulario / onboarding: contenido arriba y acciones fijas abajo.
/// El pie sube con el teclado (para que el botón principal siga a mano). Si el pie es solo un enlace secundario
/// («¿No tienes cuenta?…»), `hidesFooterWithKeyboard` lo oculta mientras se escribe para que no tape el formulario.
struct BFormScreen<Content: View, Footer: View>: View {
    var spacing: CGFloat = 20
    var hidesFooterWithKeyboard = false
    @ViewBuilder var content: () -> Content
    @ViewBuilder var footer: () -> Footer
    @State private var keyboardShown = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: spacing, content: content)
                .padding(.horizontal, Space.s4)
                .padding(.top, Space.s4)
                .padding(.bottom, Space.s5)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .scrollBounceBehavior(.basedOnSize)
        .scrollDismissesKeyboard(.interactively)
        .safeAreaInset(edge: .bottom) {
            if !(hidesFooterWithKeyboard && keyboardShown) {
                VStack(spacing: 6, content: footer)
                    .padding(.horizontal, Space.s4)
                    .padding(.top, Space.s2)
                    .padding(.bottom, Space.s2)
                    .background(Color.bg)
            }
        }
        .background(Color.bg.ignoresSafeArea())
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)) { _ in keyboardShown = true }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) { _ in keyboardShown = false }
        .animation(.easeOut(duration: 0.2), value: keyboardShown)
    }
}

// MARK: - Ficha (bento)

enum TileStyle {
    case plain, accent, soft, income, expense, warning, sunken

    var background: Color {
        switch self {
        case .plain: .surface
        case .accent: .accent
        case .soft: .accentSubtle
        case .income: .incomeSubtle
        case .expense: .expenseSubtle
        case .warning: .warningSubtle
        case .sunken: .bgSubtle
        }
    }
}

struct BTile<Content: View>: View {
    var style: TileStyle = .plain
    var padding: CGFloat = Space.s4
    var spacing: CGFloat = 8
    var alignment: HorizontalAlignment = .leading
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(alignment: alignment, spacing: spacing, content: content)
            .padding(padding)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: alignment == .center ? .top : .topLeading)
            .foregroundStyle(style == .accent ? Color.onAccent : Color.text)
            .background(style.background, in: RoundedRectangle(cornerRadius: Radius.lg, style: .continuous))
    }
}

/// Dos fichas en fila con la misma altura.
struct BTilePair<Content: View>: View {
    @ViewBuilder var content: () -> Content
    var body: some View {
        HStack(alignment: .top, spacing: 10, content: content).fixedSize(horizontal: false, vertical: true)
    }
}

/// Dos columnas con 10 pt de separación; `span2` ocupa el ancho completo.
struct BGrid<Content: View>: View {
    @ViewBuilder var content: () -> Content
    var body: some View {
        Grid(horizontalSpacing: 10, verticalSpacing: 10) { content() }
    }
}

// MARK: - Botones

enum BButtonKind { case primary, secondary, soft, destructive, link, dangerLink, dangerSecondary }

struct BButtonStyle: ButtonStyle {
    var kind: BButtonKind = .primary
    var small = false
    var block = true
    @Environment(\.isEnabled) private var enabled
    private var isLink: Bool { kind == .link || kind == .dangerLink }

    func makeBody(configuration: Configuration) -> some View {
        let fg: Color = switch kind {
        case .primary, .destructive: .onAccent
        case .secondary: .text
        case .soft, .link: .accentText
        case .dangerLink, .dangerSecondary: .expense
        }
        let bg: Color = switch kind {
        case .primary: configuration.isPressed ? .accentHover : .accent
        case .secondary: configuration.isPressed ? .surfaceHover : .surface
        case .soft: .accentSubtle
        case .destructive: .expenseSolid
        case .link, .dangerLink: .clear
        case .dangerSecondary: configuration.isPressed ? .surfaceHover : .surface
        }
        configuration.label
            .lineLimit(1)
            .font(.system(size: small ? 15 : 17, weight: isLink ? .semibold : .bold))
            .foregroundStyle(fg)
            .frame(maxWidth: block && !isLink ? .infinity : nil, minHeight: isLink ? 44 : (small ? 40 : 54))
            .padding(.horizontal, isLink ? Space.s2 : (small ? 16 : Space.s5))
            .background(bg, in: Capsule())
            .opacity(enabled ? 1 : 0.4)
            .contentShape(Capsule())
    }
}

extension ButtonStyle where Self == BButtonStyle {
    static var bPrimary: BButtonStyle { BButtonStyle(kind: .primary) }
    static var bSecondary: BButtonStyle { BButtonStyle(kind: .secondary) }
    static var bDestructive: BButtonStyle { BButtonStyle(kind: .destructive) }
    static var bLink: BButtonStyle { BButtonStyle(kind: .link) }
    static var bDangerLink: BButtonStyle { BButtonStyle(kind: .dangerLink) }
    static var bDangerSecondary: BButtonStyle { BButtonStyle(kind: .dangerSecondary) }
    static func b(_ kind: BButtonKind, small: Bool = false, block: Bool = true) -> BButtonStyle { BButtonStyle(kind: kind, small: small, block: block) }
}

/// Botón redondo de 44 pt (atrás, ojo, cerrar).
struct BRoundButton: View {
    let symbol: String
    let label: String
    var filled = true
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(filled ? Color.text : Color.textSecondary)
                .frame(width: 44, height: 44)
                .background(filled ? Color.surface : Color.clear, in: Circle())
        }
        .accessibilityLabel(label)
    }
}

// MARK: - Campos

struct BField: View {
    let label: String
    @Binding var text: String
    var placeholder = ""
    var error: String?
    var help: String?
    var secure = false
    var keyboard: UIKeyboardType = .default
    var content: UITextContentType?
    var capitalization: TextInputAutocapitalization = .sentences
    var noAutocorrect = false
    @FocusState private var focused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).bEyebrow().padding(.leading, 4)
            Group {
                if secure { SecureField(placeholder, text: $text) } else { TextField(placeholder, text: $text) }
            }
            .focused($focused)
            .keyboardType(keyboard)
            .textContentType(content)
            .textInputAutocapitalization(capitalization)
            .autocorrectionDisabled(secure || noAutocorrect)
            .font(.system(size: 17))
            .padding(.horizontal, Space.s4)
            .frame(minHeight: 54)
            .background(Color.surface, in: RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                    .strokeBorder(error != nil ? Color.expense : (focused ? Color.accentBorder : Color.borderControl), lineWidth: focused || error != nil ? 1.5 : 1)
            )
            .accessibilityLabel(label)
            if let message = error ?? help {
                Text(message).bFootnote(error != nil ? .expense : .textSecondary).padding(.leading, 4)
                    .accessibilityAddTraits(error != nil ? .isStaticText : [])
            }
        }
    }
}

/// Plazo o frecuencia libre: un número y su unidad (Días / Semanas / Meses / Años).
struct BDurationField: View {
    let label: String
    @Binding var amount: String
    @Binding var unit: TimeUnit
    var error: String?
    @FocusState private var focused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).bEyebrow().padding(.leading, 4)
            HStack(spacing: 8) {
                TextField("6", text: $amount)
                    .focused($focused)
                    .keyboardType(.numberPad)
                    .font(.system(size: 17, weight: .semibold)).monospacedDigit()
                    .multilineTextAlignment(.center)
                    .frame(width: 72).frame(minHeight: 46)
                    .background(Color.surface, in: RoundedRectangle(cornerRadius: Radius.md, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: Radius.md, style: .continuous)
                            .strokeBorder(error != nil ? Color.expense : (focused ? Color.accentBorder : Color.borderControl), lineWidth: focused || error != nil ? 1.5 : 1)
                    )
                    .accessibilityLabel("\(label): número")
                BSegmented(options: TimeUnit.allCases.map { ($0, $0.label) }, selection: $unit)
                    .accessibilityElement(children: .contain)
                    .accessibilityLabel("\(label): unidad")
            }
            if let error { Text(error).bFootnote(.expense).padding(.leading, 4) }
        }
    }
}

/// Importe grande en euros. El texto es libre ("48,90"); se convierte con Money.parse al guardar.
struct BAmountField: View {
    let label: String
    @Binding var text: String
    var income = false
    var size: CGFloat = 44
    var error: String?
    @FocusState private var focused: Bool

    var body: some View {
        VStack(spacing: 6) {
            Text(label).bEyebrow()
            HStack(alignment: .firstTextBaseline, spacing: Space.s2) {
                TextField("0,00", text: $text)
                    .focused($focused)
                    .keyboardType(.decimalPad)
                    .multilineTextAlignment(.trailing)
                    .font(.system(size: size, weight: .heavy))
                    .tracking(-1)
                    .monospacedDigit()
                    .foregroundStyle(income && !text.isEmpty ? Color.income : Color.text)
                    .fixedSize()
                    .accessibilityLabel(label)
                Text("€").font(.system(size: size * 0.64, weight: .bold)).foregroundStyle(Color.textSecondary).accessibilityHidden(true)
            }
            .frame(maxWidth: .infinity)
            .contentShape(Rectangle())
            .onTapGesture { focused = true }
            if let error { Text(error).bFootnote(.expense) }
        }
    }
}

// MARK: - Píldoras, avatares, filas

enum PillStyle { case income, expense, warning, accent }

struct BPill: View {
    let text: String
    var style: PillStyle = .accent
    var symbol: String?

    var body: some View {
        let (bg, fg): (Color, Color) = switch style {
        case .income: (.incomeSubtle, .income)
        case .expense: (.expenseSubtle, .expense)
        case .warning: (.warningSubtle, .warning)
        case .accent: (.accentSubtle, .accentText)
        }
        HStack(spacing: 6) {
            if let symbol { Image(systemName: symbol).font(.system(size: 12, weight: .semibold)) }
            Text(text).font(.system(size: 13, weight: .semibold)).monospacedDigit()
        }
        .foregroundStyle(fg)
        .padding(.horizontal, 10).padding(.vertical, 4)
        .background(bg, in: Capsule())
    }
}

enum AvatarStyle { case neutral, accent, income, expense, warning, onTile, solidAccent }

struct BAvatar: View {
    let symbol: String
    var style: AvatarStyle = .neutral
    var size: CGFloat = 40

    var body: some View {
        let (bg, fg): (Color, Color) = switch style {
        case .neutral: (.bg, .textSecondary)
        case .accent: (.accentSubtle, .accentText)
        case .income: (.incomeSubtle, .income)
        case .expense: (.expenseSubtle, .expense)
        case .warning: (.warningSubtle, .warning)
        case .onTile: (.surface, .warning)
        case .solidAccent: (.accent, .onAccent)
        }
        Image(systemName: symbol)
            .font(.system(size: size * 0.45, weight: .medium))
            .foregroundStyle(fg)
            .frame(width: size, height: size)
            .background(bg, in: Circle())
            .accessibilityHidden(true)
    }
}

/// Lista de filas dentro de una ficha redondeada, con separadores.
struct BList<Content: View>: View {
    @ViewBuilder var content: () -> Content
    var body: some View {
        VStack(spacing: 0, content: content)
            .frame(maxWidth: .infinity)
            .background(Color.surface, in: RoundedRectangle(cornerRadius: Radius.lg, style: .continuous))
            .clipShape(RoundedRectangle(cornerRadius: Radius.lg, style: .continuous))
    }
}

struct BRowDivider: View {
    var body: some View { Rectangle().fill(Color.separator).frame(height: 1).padding(.leading, 68) }
}

struct BProgress: View {
    let value: Int
    var loan = false
    var height: CGFloat = 10

    var body: some View {
        GeometryReader { g in
            ZStack(alignment: .leading) {
                Capsule().fill(Color.surfaceSelected)
                Capsule().fill(loan ? Color.textSecondary : Color.goal).frame(width: g.size.width * CGFloat(min(max(value, 0), 100)) / 100)
            }
        }
        .frame(height: height)
        .accessibilityElement()
        .accessibilityLabel("Progreso")
        .accessibilityValue("\(value) %")
    }
}

struct BChip: View {
    let text: String
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(text)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(selected ? Color.onAccent : Color.text)
                .padding(.horizontal, 14).frame(minHeight: 40)
                .background(selected ? Color.accent : Color.surface, in: Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

/// Control segmentado (Día / Sem. / Mes, Gasto / Ingreso...).
struct BSegmented<Value: Hashable>: View {
    let options: [(Value, String)]
    @Binding var selection: Value

    var body: some View {
        HStack(spacing: 0) {
            ForEach(options, id: \.0) { value, label in
                Button { selection = value } label: {
                    Text(label)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(selection == value ? Color.onAccent : Color.textSecondary)
                        .frame(maxWidth: .infinity, minHeight: 38)
                        .background(selection == value ? Color.accent : Color.clear, in: Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(selection == value ? .isSelected : [])
            }
        }
        .padding(3)
        .background(Color.surface, in: Capsule())
    }
}

// MARK: - Estados

struct BEmptyState<Action: View>: View {
    let symbol: String
    let title: String
    let text: String
    @ViewBuilder var action: () -> Action

    var body: some View {
        VStack(spacing: 10) {
            BAvatar(symbol: symbol, style: .accent, size: 56)
            Text(title).bTitle().multilineTextAlignment(.center)
            Text(text).bSub().multilineTextAlignment(.center)
            action().padding(.top, 6)
        }
        .padding(Space.s5)
        .frame(maxWidth: .infinity)
    }
}

extension BEmptyState where Action == EmptyView {
    init(symbol: String, title: String, text: String) { self.init(symbol: symbol, title: title, text: text) { EmptyView() } }
}

struct BErrorState: View {
    let error: Error
    var retry: (() -> Void)?

    var body: some View {
        VStack(spacing: 10) {
            BAvatar(symbol: "exclamationmark.triangle", style: .expense, size: 56)
            Text("No se han podido cargar los datos").bTitle().multilineTextAlignment(.center)
            Text(error.localizedDescription).bSub().multilineTextAlignment(.center)
            if let retry {
                Button("Reintentar", action: retry).buttonStyle(.b(.primary, block: false)).padding(.top, 6)
            }
        }
        .padding(Space.s5)
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
    }
}

/// Esqueleto de pantalla con fichas: se ve mientras llegan los datos.
struct BLoadingTiles: View {
    var rows = 4
    @State private var pulse = false

    var body: some View {
        VStack(spacing: 10) {
            ForEach(0..<rows, id: \.self) { i in
                RoundedRectangle(cornerRadius: Radius.lg, style: .continuous)
                    .fill(Color.surfaceSelected)
                    .frame(height: i == 0 ? 150 : 110)
                    .opacity(pulse ? 0.55 : 1)
            }
        }
        .onAppear { withAnimation(.easeInOut(duration: 1.4).repeatForever(autoreverses: true)) { pulse = true } }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Cargando")
    }
}

// MARK: - PIN

struct BPinBoxes: View {
    let label: String
    @Binding var value: String
    var length = 4
    var error = false
    var canReveal = false
    @State private var shown = false
    @FocusState private var focused: Bool

    var body: some View {
        HStack(spacing: length == 6 ? 8 : Space.s3) {
            ZStack {
                HStack(spacing: length == 6 ? 8 : Space.s3) {
                    ForEach(0..<length, id: \.self) { i in
                        let digit = i < value.count ? String(value[value.index(value.startIndex, offsetBy: i)]) : nil
                        let active = focused && i == min(value.count, length - 1)
                        ZStack {
                            if let digit {
                                if shown { Text(digit).font(.system(size: 28, weight: .bold)).monospacedDigit() }
                                else { Circle().fill(Color.text).frame(width: 12, height: 12) }
                            }
                        }
                        .frame(width: length == 6 ? 46 : 58, height: length == 6 ? 58 : 66)
                        .background(Color.surface, in: RoundedRectangle(cornerRadius: length == 6 ? 16 : 18, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: length == 6 ? 16 : 18, style: .continuous)
                                .strokeBorder(error ? Color.expense : (active ? Color.accentBorder : Color.borderControl), lineWidth: active || error ? 1.5 : 1)
                        )
                    }
                }
                .accessibilityHidden(true)
                // Un único campo real, invisible, para el teclado numérico.
                TextField("", text: $value)
                    .focused($focused)
                    .keyboardType(.numberPad)
                    .textContentType(.oneTimeCode)
                    .foregroundStyle(.clear).tint(.clear)
                    .opacity(0.02)
                    .accessibilityLabel(label)
                    .accessibilityValue("\(value.count) de \(length) cifras")
                    .onChange(of: value) { _, new in
                        let clean = String(new.filter { $0.isASCII && $0.isNumber }.prefix(length))
                        if clean != new { value = clean }
                    }
            }
            .contentShape(Rectangle())
            .onTapGesture { focused = true }
            if canReveal {
                BRoundButton(symbol: shown ? "eye.slash" : "eye", label: shown ? "Ocultar código" : "Mostrar código", filled: false) { shown.toggle() }
            }
        }
        .onAppear { focused = true }
    }
}

struct BPinPad: View {
    let onDigit: (String) -> Void
    let onDelete: () -> Void
    var onBiometric: (() -> Void)?
    var disabled = false

    var body: some View {
        let cols = Array(repeating: GridItem(.fixed(76), spacing: 28), count: 3)
        LazyVGrid(columns: cols, spacing: 14) {
            ForEach(1...9, id: \.self) { n in key(String(n)) }
            if let onBiometric {
                Button(action: onBiometric) {
                    Image(systemName: "faceid").font(.system(size: 30)).foregroundStyle(Color.accentText).frame(width: 76, height: 76)
                }.accessibilityLabel("Usar Face ID")
            } else { Color.clear.frame(width: 76, height: 76) }
            key("0")
            Button(action: onDelete) {
                Image(systemName: "delete.left").font(.system(size: 26)).foregroundStyle(Color.textSecondary).frame(width: 76, height: 76)
            }.accessibilityLabel("Borrar").disabled(disabled)
        }
        .frame(maxWidth: .infinity)
    }

    private func key(_ d: String) -> some View {
        Button { onDigit(d) } label: {
            Text(d).font(.system(size: 30, weight: .semibold)).monospacedDigit().foregroundStyle(Color.text)
                .frame(width: 76, height: 76).background(Color.surface, in: Circle())
        }
        .disabled(disabled)
        .accessibilityLabel(d)
    }
}

// MARK: - Anillo de progreso

struct BRing: View {
    let percent: Int
    var size: CGFloat = 76
    var label: String?

    var body: some View {
        ZStack {
            Circle().stroke(Color.surfaceSelected, lineWidth: size * 0.12)
            Circle().trim(from: 0, to: CGFloat(min(max(percent, 0), 100)) / 100)
                .stroke(Color.goal, style: StrokeStyle(lineWidth: size * 0.12, lineCap: .round)).rotationEffect(.degrees(-90))
            Text("\(percent) %").font(.system(size: size * 0.2, weight: .heavy)).monospacedDigit().foregroundStyle(Color.text)
        }
        .frame(width: size, height: size)
        .accessibilityElement()
        .accessibilityLabel(label ?? "Progreso")
        .accessibilityValue("\(percent) %")
    }
}

/// Ficha con un importe editable (Cuesta / Ya tienes).
struct BTileMoneyField: View {
    let label: String
    @Binding var text: String
    var error: String?
    @FocusState private var focused: Bool

    var body: some View {
        BTile(padding: 14, spacing: 2) {
            Text(label).bEyebrow()
            HStack(spacing: 4) {
                TextField("0", text: $text).focused($focused).keyboardType(.decimalPad)
                    .font(.system(size: 24, weight: .heavy)).monospacedDigit().foregroundStyle(Color.text)
                    .accessibilityLabel(label)
                Text("€").font(.system(size: 18, weight: .bold)).foregroundStyle(Color.textSecondary).accessibilityHidden(true)
            }
            if let error { Text(error).bFootnote(.expense) }
        }
        .overlay(RoundedRectangle(cornerRadius: Radius.lg, style: .continuous).strokeBorder(error != nil ? Color.expense : (focused ? Color.accentBorder : .clear), lineWidth: 1.5))
        .contentShape(Rectangle())
        .onTapGesture { focused = true }
    }
}
