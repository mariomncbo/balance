import SwiftUI
import Supabase

struct GoalSheet: View {
    let id: String?
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var goals = Resource<Goals>()
    @State private var accounts = Resource<Balances>()
    @State private var accountId = ""
    @State private var name = ""
    @State private var target = ""
    @State private var saved = ""
    @State private var durationText = "6"
    @State private var unit: TimeUnit = .month
    /// Plazo con el que se abrió al editar: solo se envía si cambia.
    @State private var initialDuration: (String, TimeUnit)?
    @State private var filled = false
    @State private var preview: GoalPreview?
    @State private var errors: [String: String] = [:]
    @State private var busy = false

    private var editing: GoalPlan? { id.flatMap { id in goals.data?.goals.first { $0.id == id } } }
    private var duration: Int? { try? unit.parse(durationText).get() }
    private var durationChanged: Bool { initialDuration.map { $0.0 != durationText || $0.1 != unit } ?? true }
    private var targetCents: Int? { Money.parse(target) }
    private var savedCents: Int { saved.trimmingCharacters(in: .whitespaces).isEmpty ? 0 : (Money.parse(saved) ?? 0) }

    var body: some View {
        BSheet(title: id == nil ? "Nueva meta" : "Editar meta") {
            if id != nil && editing == nil && goals.error == nil {
                Text("Cargando…").bSub()
            } else {
                BField(label: "¿Qué quieres conseguir?", text: $name, placeholder: "PS5, viaje a Japón…", error: errors["name"])
                BTilePair {
                    BTileMoneyField(label: "Cuesta", text: $target, error: errors["target"])
                    BTileMoneyField(label: "Ya tienes", text: $saved, error: errors["saved"])
                }
                BDurationField(label: "¿En cuánto tiempo?", amount: $durationText, unit: $unit, error: errors["duration"])
                planTile
                if let list = accounts.data?.accounts, !list.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        AccountPicker(label: "Cuenta donde guardas este dinero (opcional)", selection: $accountId, accounts: list, allowNone: true)
                        Text("Es la cuenta de destino por defecto cuando aportas a esta meta.").bFootnote().padding(.leading, 4)
                    }
                }
                if let m = errors["form"] { Text(m).bFootnote(.expense) }
                Button(busy ? "Guardando…" : "Guardar") { Task { await save() } }.buttonStyle(.bPrimary).disabled(busy)
                if id != nil {
                    DeleteBlock(label: "Borrar meta", question: "¿Borrar esta meta?", detail: "Se borrará la meta y su progreso. No se puede deshacer.", busy: busy) { Task { await remove() } }
                }
            }
        }
        .task { async let a: () = accounts.load("accounts.list", allowStale: false); if id != nil { await goals.load("goals.list", allowStale: false); fill() }; _ = await a }
        .task(id: "\(targetCents ?? -1)-\(savedCents)-\(durationText)-\(unit.rawValue)") { await refreshPreview() }
    }

    private var planTile: some View {
        let t = targetCents ?? 0
        let missing = max(0, t - savedCents)
        return BTile(style: .accent, padding: 18, spacing: 4) {
            if t <= 0 {
                Text("Escribe cuánto cuesta y te diremos cuánto apartar al mes.").font(.system(size: 15, weight: .semibold))
            } else if missing == 0 {
                Text("¡Ya la tienes!").bBig(28, color: .onAccent)
                Text("Con lo que llevas ahorrado, ya cubres esta meta.").font(.system(size: 14, weight: .semibold))
            } else if duration == nil {
                Text("Escribe en cuánto tiempo la quieres y te diremos cuánto apartar.").font(.system(size: 15, weight: .semibold))
            } else if let p = preview {
                Text("Te faltan \(Money.format(missing, round: missing % 100 == 0)). Aparta").bEyebrow(.onAccent).opacity(0.85)
                if p.short == true {
                    // Menos de un mes: el total, no una cuota mensual
                    Text(Money.format(p.monthly, round: true)).bBig(36, color: .onAccent)
                    Text(verbatim: "antes del \(Dates.shortDate(p.deadline)) de \(String(Dates.parse(p.deadline).y))").font(.system(size: 14, weight: .semibold))
                } else {
                    Text("\(Money.format(p.monthly, round: true)) al mes").bBig(36, color: .onAccent)
                    Text(verbatim: "y la tendrás en \(Dates.monthName(Dates.monthOf(p.deadline)).lowercased()) de \(String(Dates.parse(p.deadline).y))").font(.system(size: 14, weight: .semibold))
                }
            } else {
                Text("Calculando…").font(.system(size: 15, weight: .semibold))
            }
        }
        .accessibilityElement(children: .combine)
    }

    private func fill() {
        guard !filled, let g = editing else { return }
        filled = true
        name = g.name
        target = String(format: "%.2f", Double(g.target) / 100).replacingOccurrences(of: ".", with: ",")
        saved = String(format: "%.2f", Double(g.saved) / 100).replacingOccurrences(of: ".", with: ",")
        // Se rellena con el tiempo que le queda: en meses, o en días si es menos de un mes.
        if g.isShort, let d = g.daysLeft { durationText = String(max(1, d)); unit = .day } else { durationText = String(max(1, g.months)); unit = .month }
        initialDuration = (durationText, unit)
        accountId = g.accountId ?? ""
    }

    private func refreshPreview() async {
        guard let t = targetCents, t > 0, let n = duration else { preview = nil; return }
        try? await Task.sleep(for: .milliseconds(250))
        if Task.isCancelled { return }
        preview = try? await API.call("goals.preview", ["target": .integer(t), "saved": .integer(savedCents), "durationAmount": .integer(n), "durationUnit": .string(unit.rawValue)], as: GoalPreview.self)
    }

    private func save() async {
        var e: [String: String] = [:]
        if name.trimmingCharacters(in: .whitespaces).isEmpty { e["name"] = "Ponle un nombre a la meta" }
        if (targetCents ?? 0) <= 0 { e["target"] = "Escribe cuánto cuesta" }
        if !saved.trimmingCharacters(in: .whitespaces).isEmpty && Money.parse(saved) == nil { e["saved"] = "Importe no válido" }
        if case .failure(let err) = unit.parse(durationText) { e["duration"] = err.message }
        errors = e
        guard e.isEmpty, let t = targetCents, let n = duration else { return }
        busy = true
        defer { busy = false }
        var params: [String: AnyJSON] = ["name": .string(name.trimmingCharacters(in: .whitespaces)), "target": .integer(t), "saved": .integer(savedCents), "accountId": accountId.isEmpty ? .null : .string(accountId)]
        do {
            if let id {
                params["id"] = .string(id)
                // El plazo solo se cambia si se ha tocado: así no se pierde el aviso de "vas con retraso" al editar otra cosa.
                if durationChanged { params["durationAmount"] = .integer(n); params["durationUnit"] = .string(unit.rawValue) }
                try await API.send("goals.update", params)
            } else {
                params["durationAmount"] = .integer(n); params["durationUnit"] = .string(unit.rawValue)
                try await API.send("goals.create", params)
            }
            app.invalidate(); dismiss()
        } catch { errors = ["form": API.map(error).message] }
    }

    private func remove() async {
        guard let id else { return }
        busy = true
        defer { busy = false }
        do { try await API.send("goals.delete", ["id": .string(id)]); app.invalidate(); dismiss() }
        catch { errors = ["form": API.map(error).message] }
    }
}
