import SwiftUI
import Supabase

struct GoalSheet: View {
    let id: String?
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var goals = Resource<Goals>()
    @State private var name = ""
    @State private var target = ""
    @State private var saved = ""
    @State private var months = 6
    @State private var initialMonths: Int?
    @State private var filled = false
    @State private var preview: GoalPreview?
    @State private var errors: [String: String] = [:]
    @State private var busy = false

    private static let options = [3, 6, 12, 24]
    private var editing: GoalPlan? { id.flatMap { id in goals.data?.goals.first { $0.id == id } } }
    private var chips: [Int] { (initialMonths.map { Self.options.contains($0) ? Self.options : [$0] + Self.options }) ?? Self.options }
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
                VStack(alignment: .leading, spacing: 8) {
                    Text("¿En cuántos meses?").bEyebrow().padding(.leading, 4)
                    FlowLayout(spacing: 8) { ForEach(chips, id: \.self) { n in BChip(text: "\(n) meses", selected: months == n) { months = n } } }
                }
                planTile
                if let m = errors["form"] { Text(m).bFootnote(.expense) }
                Button(busy ? "Guardando…" : "Guardar") { Task { await save() } }.buttonStyle(.bPrimary).disabled(busy)
                if id != nil {
                    DeleteBlock(label: "Borrar meta", question: "¿Borrar esta meta?", detail: "Se borrará la meta y su progreso. No se puede deshacer.", busy: busy) { Task { await remove() } }
                }
            }
        }
        .task { if id != nil { await goals.load("goals.list"); fill() } }
        .task(id: "\(targetCents ?? -1)-\(savedCents)-\(months)") { await refreshPreview() }
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
            } else if let p = preview {
                Text("Te faltan \(Money.format(missing, round: missing % 100 == 0)). Aparta").bEyebrow(.onAccent).opacity(0.85)
                Text("\(Money.format(p.monthly, round: true)) al mes").bBig(36, color: .onAccent)
                Text(verbatim: "y la tendrás en \(Dates.monthName(p.deadline).lowercased()) de \(String(Dates.parse("\(p.deadline)-01").y))").font(.system(size: 14, weight: .semibold))
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
        months = g.months
        initialMonths = g.months
    }

    private func refreshPreview() async {
        guard let t = targetCents, t > 0 else { preview = nil; return }
        try? await Task.sleep(for: .milliseconds(250))
        if Task.isCancelled { return }
        preview = try? await API.call("goals.preview", ["target": .integer(t), "saved": .integer(savedCents), "months": .integer(months)], as: GoalPreview.self)
    }

    private func save() async {
        var e: [String: String] = [:]
        if name.trimmingCharacters(in: .whitespaces).isEmpty { e["name"] = "Ponle un nombre a la meta" }
        if (targetCents ?? 0) <= 0 { e["target"] = "Escribe cuánto cuesta" }
        if !saved.trimmingCharacters(in: .whitespaces).isEmpty && Money.parse(saved) == nil { e["saved"] = "Importe no válido" }
        errors = e
        guard e.isEmpty, let t = targetCents else { return }
        busy = true
        defer { busy = false }
        var params: [String: AnyJSON] = ["name": .string(name.trimmingCharacters(in: .whitespaces)), "target": .integer(t), "saved": .integer(savedCents)]
        do {
            if let id {
                params["id"] = .string(id)
                // El plazo solo se cambia si se ha tocado: así no se pierde el aviso de "vas con retraso" al editar otra cosa.
                if months != initialMonths { params["months"] = .integer(months) }
                try await API.send("goals.update", params)
            } else {
                params["months"] = .integer(months)
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
