import SwiftUI

struct TransactionRow: View {
    let t: Transaction
    let today: String
    var showDate = true

    var body: some View {
        NavigationLink(value: Route.movement(t.id)) {
            HStack(spacing: 12) {
                BAvatar(symbol: t.category.symbol, style: t.isIncome ? .income : .neutral)
                VStack(alignment: .leading, spacing: 0) {
                    Text(t.concept).bTitle().lineLimit(1)
                    Text(subtitle).bSub().lineLimit(1)
                }
                Spacer(minLength: 8)
                Text(Money.format(t.amount, signed: true)).bMoney(t.isIncome ? .income : .text)
            }
            .padding(.horizontal, Space.s4).padding(.vertical, Space.s3).frame(minHeight: 64)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
    }

    private var subtitle: String {
        [t.category.label, showDate ? Dates.dayLabel(t.date, today: today) : nil, t.source.label].compactMap { $0 }.joined(separator: " · ")
    }
}

/// Lista de movimientos agrupada por día.
struct TransactionGroups: View {
    let items: [Transaction]
    let today: String

    var body: some View {
        ForEach(Dates.groupByDay(items, date: \.date), id: \.date) { group in
            VStack(alignment: .leading, spacing: 8) {
                Text(Dates.dayLabel(group.date, today: today)).bEyebrow().padding(.leading, 4)
                BList {
                    ForEach(Array(group.items.enumerated()), id: \.element.id) { i, t in
                        if i > 0 { BRowDivider() }
                        TransactionRow(t: t, today: today, showDate: false)
                    }
                }
            }
        }
    }
}
