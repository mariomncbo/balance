import SwiftUI

struct ComingSoonView: View {
    let title: String
    let symbol: String
    let text: String

    var body: some View {
        BScreen {
            DetailHeader(title: title)
            BEmptyState(symbol: symbol, title: "Disponible pronto", text: text)
        }
        .toolbar(.hidden, for: .navigationBar)
    }
}
