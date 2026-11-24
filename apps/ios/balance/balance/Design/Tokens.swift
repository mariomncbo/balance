// GENERADO por apps/ios/scripts/build-tokens.mjs desde design/tokens/tokens.json. No editar.
import SwiftUI

enum Space {
    static let s1: CGFloat = 4
    static let s2: CGFloat = 8
    static let s3: CGFloat = 12
    static let s4: CGFloat = 16
    static let s5: CGFloat = 24
    static let s6: CGFloat = 32
    static let s7: CGFloat = 48
}

enum Radius {
    static let sm: CGFloat = 8
    static let md: CGFloat = 14
    static let lg: CGFloat = 24
    static let xl: CGFloat = 28
    static let full: CGFloat = 999
}

/// Estilos de texto del sistema de diseño.
enum BTextStyle {
    case amountHero
    case amountLg
    case title1
    case title2
    case headline
    case body
    case subhead
    case footnote
    case caption

    var size: CGFloat {
        switch self {
        case .amountHero: 40
        case .amountLg: 22
        case .title1: 28
        case .title2: 22
        case .headline: 17
        case .body: 17
        case .subhead: 15
        case .footnote: 13
        case .caption: 11
        }
    }

    var lineHeight: CGFloat {
        switch self {
        case .amountHero: 44
        case .amountLg: 28
        case .title1: 34
        case .title2: 28
        case .headline: 22
        case .body: 22
        case .subhead: 20
        case .footnote: 18
        case .caption: 13
        }
    }

    var weight: Font.Weight {
        switch self {
        case .amountHero: .heavy
        case .amountLg: .bold
        case .title1: .heavy
        case .title2: .bold
        case .headline: .semibold
        case .body: .regular
        case .subhead: .regular
        case .footnote: .regular
        case .caption: .medium
        }
    }

    var tracking: CGFloat {
        switch self {
        case .amountHero: -1
        case .amountLg: 0
        case .title1: -0.6
        case .title2: -0.3
        case .headline: 0
        case .body: 0
        case .subhead: 0
        case .footnote: 0
        case .caption: 0.1
        }
    }

    var isAmount: Bool { self == .amountHero || self == .amountLg }
}
