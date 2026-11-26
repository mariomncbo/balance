import SwiftUI
import Supabase

/// Ficha de una meta: progreso, botón Aportar (mueve dinero entre cuentas), historial con Deshacer y Editar.
struct GoalDetailSheet: View {
    let id: String
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var goals = Resource<Goals>()
    @State private var accounts = Resource<Balances>()
    @State private var amount = ""
    @State private var moveMoney = true
    @State private var fromId = ""
    @State private var toId = ""
    @State private var filled = false
    @State private var busy = false
    @State private var error: String?
    @State private var undoing: Contribution?
    @State private var editing = false

    private static let quick = [1000, 2500, 5000]
    private var goal: GoalPlan? { goals.data?.goals.first { $0.id == id } }
    private var list: [AccountBalance] { accounts.data?.accounts ?? [] }
    private var canMove: Bool { list.count >= 2 }
    private var cents: Int? { Money.parse(amount) }
    private var today: String { Dates.todayMadrid() }

    var body: some View {
        BSheet(title: goal?.name ?? "Meta", closeLabel: "Cerrar") {
            if let g = goal {
                header(g)
                if !g.done { contribute(g) }
                history(g)
                Button("Editar meta") { editing = true }.buttonStyle(.bSecondary)
            } else if let e = goals.error {
                BErrorState(error: e) { app.invalidate() }
            } else if goals.loading {
                Text("Cargando…").bSub()
            } else {
                BEmptyState(symbol: "target", title: "Esta meta ya no existe", text: "Puede que la hayas borrado.")
            }
        }
        .task(id: app.version) {
            async let a: () = goals.load("goals.list")
            async let b: () = accounts.load("accounts.list")
            _ = await (a, b)
            setDefaults()
        }
        .sheet(isPresented: $editing) { GoalSheet(id: id).environment(app) }
        .confirmationDialog("¿Deshacer esta aportación?", isPresented: Binding(get: { undoing != nil }, set: { if !$0 { undoing = nil } }), titleVisibility: .visible, presenting: undoing) { c in
            Button("Deshacer aportación", role: .destructive) { Task { await undo(c) } }
        } message: { c in
            Text(c.transferId != nil ? "Se quitarán \(Money.format(c.amount)) de la meta y el dinero volverá a la cuenta de origen." : "Se quitarán \(Money.format(c.amount)) de la meta.")
        }
    }

    // MARK: Partes

    private func header(_ g: GoalPlan) -> some View {
        BTile(spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Text("\(Money.format(g.saved, round: g.saved % 100 == 0))").font(.system(size: 28, weight: .heavy)).monospacedDigit().foregroundStyle(Color.text)
                Text("de \(Money.format(g.target, round: g.target % 100 == 0))").font(.system(size: 15)).foregroundStyle(Color.textSecondary).monospacedDigit()
                Spacer()
                Text("\(g.progress) %").font(.system(size: 15, weight: .heavy)).foregroundStyle(Color.accentText).monospacedDigit()
            }
            BProgress(value: g.progress)
            if g.done { Text("¡Meta conseguida!").bFootnote(.income, weight: .bold) }
            else if g.behind { Text("Te faltan \(Money.format(g.remaining, round: g.remaining % 100 == 0)) · aparta \(g.amountText) · con retraso").bFootnote(.warning, weight: .bold) }
            else { Text("Te faltan \(Money.format(g.remaining, round: g.remaining % 100 == 0)) · aparta \(g.isShort ? g.amountText : "\(g.amountText) hasta \(Dates.monthName(Dates.monthOf(g.deadline)).lowercased())")").bFootnote() }
        }
        .accessibilityElement(children: .combine)
    }

    private func contribute(_ g: GoalPlan) -> some View {
        BTile(style: .soft, spacing: 12) {
            Text("Aportar").bTitle()
            HStack(spacing: 8) {
                ForEach(Self.quick, id: \.self) { c in
                    BChip(text: "+\(c / 100) €", selected: cents == c) { amount = String(c / 100) }
                }
            }
            BAmountField(label: "Importe de la aportación", text: $amount, size: 34)
            if canMove {
                Toggle("Mover el dinero entre cuentas", isOn: $moveMoney).font(.system(size: 15, weight: .semibold)).tint(Color.accent)
                if moveMoney {
                    AccountPicker(label: "Sale de", selection: $fromId, accounts: list)
                    AccountPicker(label: "Va a", selection: $toId, accounts: list)
                    if fromId == toId { Text("Elige dos cuentas distintas.").bFootnote(.expense) }
                }
            } else {
                Text("Con una sola cuenta, la aportación solo sube la meta. Añade otra cuenta para mover dinero entre ellas.").bFootnote()
            }
            if let error { Text(error).bFootnote(.expense) }
            Button(busy ? "Aportando…" : "Aportar") { Task { await contribute(to: g) } }
                .buttonStyle(.bPrimary).disabled(busy || (cents ?? 0) <= 0 || (canMove && moveMoney && fromId == toId))
        }
    }

    @ViewBuilder private func history(_ g: GoalPlan) -> some View {
        let items = g.contributions ?? []
        VStack(alignment: .leading, spacing: 8) {
            Text("Aportaciones").bEyebrow().padding(.leading, 4).accessibilityAddTraits(.isHeader)
            if items.isEmpty {
                Text("Todavía no has aportado nada a esta meta.").bSub().padding(.leading, 4)
            } else {
                BList {
                    ForEach(Array(items.enumerated()), id: \.element.id) { i, c in
                        if i > 0 { BRowDivider() }
                        HStack(spacing: 12) {
                            BAvatar(symbol: c.transferId != nil ? "arrow.left.arrow.right" : "plus", style: .accent)
                            VStack(alignment: .leading, spacing: 0) {
                                Text(Money.format(c.amount, signed: true)).bMoney(.income)
                                Text(Dates.dayLabel(c.date, today: today) + (c.transferId != nil ? " · entre cuentas" : "")).bSub()
                            }
                            Spacer()
                            Button("Deshacer") { undoing = c }.buttonStyle(.b(.soft, small: true, block: false)).disabled(busy)
                        }
                        .padding(.horizontal, Space.s4).padding(.vertical, Space.s3).frame(minHeight: 64)
                        .accessibilityElement(children: .combine)
                        .accessibilityAction(named: "Deshacer") { undoing = c }
                    }
                }
            }
        }
    }

    // MARK: Acciones

    /// Destino: la cuenta de la meta si existe; origen: la primera cuenta distinta del destino.
    private func setDefaults() {
        guard !filled, let g = goal, !list.isEmpty else { return }
        filled = true
        toId = list.contains { $0.id == g.accountId } ? (g.accountId ?? "") : (list.first?.id ?? "")
        fromId = list.first { $0.id != toId }?.id ?? toId
    }

    private func contribute(to g: GoalPlan) async {
        guard let c = cents, c > 0 else { error = "Escribe un importe válido, por ejemplo 25"; return }
        busy = true; error = nil
        defer { busy = false }
        var params: [String: AnyJSON] = ["id": .string(g.id), "amount": .integer(c)]
        if canMove && moveMoney {
            guard fromId != toId else { return }
            params["fromAccountId"] = .string(fromId)
            params["toAccountId"] = .string(toId)
        }
        do {
            try await API.send("goals.contribute", params)
            amount = ""
            app.invalidate()
            dismiss()
        } catch { self.error = API.map(error).message }
    }

    private func undo(_ c: Contribution) async {
        busy = true; error = nil
        defer { busy = false; undoing = nil }
        do {
            try await API.send("goals.uncontribute", ["id": .string(id), "contributionId": .string(c.id)])
            app.invalidate()
        } catch { self.error = API.map(error).message }
    }
}
