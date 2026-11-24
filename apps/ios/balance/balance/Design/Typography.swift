import SwiftUI

/// Estilos de texto sueltos que usa el CSS de componentes (títulos, subtítulos, importes...).
/// Los estilos nombrados del sistema de diseño están en Tokens.swift (BTextStyle).
extension View {
    func bText(_ style: BTextStyle) -> some View {
        font(.system(size: style.size, weight: style.weight))
            .tracking(style.tracking)
            .lineSpacing(max(0, style.lineHeight - style.size * 1.2))
            .monospacedDigit()
    }

    private func bFont(_ size: CGFloat, _ weight: Font.Weight, tracking: CGFloat = 0, color: Color? = nil, line: CGFloat? = nil) -> some View {
        font(.system(size: size, weight: weight))
            .tracking(tracking)
            .lineSpacing(max(0, (line ?? size * 1.2) - size * 1.2))
            .foregroundStyle(color ?? Color.text)
    }

    func bH1(_ color: Color = .text) -> some View { bFont(28, .heavy, tracking: -0.6, color: color, line: 34) }
    func bLead() -> some View { bFont(17, .regular, color: .textSecondary, line: 23) }
    func bTitle(_ color: Color = .text) -> some View { bFont(17, .semibold, color: color, line: 22) }
    func bSub() -> some View { bFont(15, .regular, color: .textSecondary, line: 20) }
    func bEyebrow(_ color: Color = .textSecondary) -> some View { bFont(13, .medium, color: color, line: 18) }
    func bFootnote(_ color: Color = .textSecondary, weight: Font.Weight = .regular) -> some View { bFont(13, weight, color: color, line: 18) }
    func bSubhead(_ color: Color = .text, weight: Font.Weight = .regular) -> some View { bFont(15, weight, color: color, line: 20) }
    func bBig(_ size: CGFloat = 30, color: Color = .text) -> some View { bFont(size, .heavy, tracking: -0.8, color: color, line: size + 4).monospacedDigit().lineLimit(1).minimumScaleFactor(0.6) }
    func bMoney(_ color: Color = .text, size: CGFloat = 17) -> some View { bFont(size, .bold, color: color, line: size + 5).monospacedDigit() }
}
