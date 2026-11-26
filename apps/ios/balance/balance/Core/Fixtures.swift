#if DEBUG
import Foundation

/// Datos de ejemplo para depurar y probar la interfaz sin red ni cuenta. Solo existe en builds de Debug y
/// se activa con el argumento de arranque `-fixtures`.
enum Fixtures {
    static var enabled: Bool { ProcessInfo.processInfo.arguments.contains("-fixtures") }
    static var empty: Bool { ProcessInfo.processInfo.arguments.contains("-fixtures-empty") }

    static let profile = Profile(name: "Mario", username: "mario", email: "mario@correo.com")

    private static let today = "2026-11-24"

    /// Ordenados como los devuelve el servidor: de más reciente a más antiguo.
    private static let tx: [String] = [
        #"{"id":"t2","accountId":"a1","amount":-1299,"concept":"Netflix","category":"suscripciones","date":"2026-11-24","source":"fijo"}"#,
        #"{"id":"t1","accountId":"a1","amount":-4890,"concept":"Mercadona","category":"comida","date":"2026-11-24","source":"atajo"}"#,
        #"{"id":"t7","accountId":"a2","amount":5000,"concept":"Aportación a PS5","category":"otros","date":"2026-11-20","source":"manual","transfer":{"id":"tr-c1","goalId":"g1","contributionId":"c1"}}"#,
        #"{"id":"t6","accountId":"a1","amount":-5000,"concept":"Aportación a PS5","category":"otros","date":"2026-11-20","source":"manual","transfer":{"id":"tr-c1","goalId":"g1","contributionId":"c1"}}"#,
        #"{"id":"t3","accountId":"a1","amount":-5500,"concept":"Gasolina","category":"transporte","date":"2026-11-20","source":"manual"}"#,
        #"{"id":"t5","accountId":"a2","amount":-70299,"concept":"Hipoteca","category":"hogar","date":"2026-11-05","source":"fijo","note":"Cuota de noviembre","recurringId":"r3"}"#,
        #"{"id":"t4","accountId":"a1","amount":185000,"concept":"Nómina","category":"ingresos","date":"2026-11-01","source":"fijo","recurringId":"r2"}"#,
    ]

    private static let summary = #"{"month":"2026-11","income":185000,"expense":124060,"saved":60940,"savedShare":33,"pending":1299,"byCategory":[{"category":"hogar","label":"Hogar","amount":70299,"share":57},{"category":"comida","label":"Comida","amount":31245,"share":25},{"category":"transporte","label":"Transporte","amount":12800,"share":10},{"category":"ocio","label":"Ocio","amount":9716,"share":8}],"previousExpense":133690,"vsPrevious":9630}"#

    /// Aportaciones de la meta PS5 (cambian con goals.contribute / goals.uncontribute, para probar la interfaz).
    private static var contributions: [(id: String, date: String, amount: Int)] = [("c1", "2026-11-20", 5000)]
    private static var nextContribution = 2

    private static var goal: String {
        let saved = 27000 + contributions.reduce(0) { $0 + $1.amount }
        let remaining = max(0, 55000 - saved)
        let monthly = Int((Double(remaining) / 3 / 100).rounded(.up)) * 100
        let progress = min(100, Int((Double(saved) / 55000 * 100).rounded()))
        let list = contributions.reversed().map { #"{"id":"\#($0.id)","date":"\#($0.date)","amount":\#($0.amount),"transferId":"tr-\#($0.id)"}"# }.joined(separator: ",")
        return #"{"id":"g1","name":"PS5","target":55000,"saved":\#(saved),"remaining":\#(remaining),"months":3,"monthly":\#(monthly),"deadline":"2027-02","progress":\#(progress),"behind":false,"done":\#(remaining == 0),"accountId":"a2","contributions":[\#(list)]}"#
    }

    /// Cambios de las acciones que escriben datos (solo existen las que la interfaz de pruebas necesita).
    private static var goalsSaved: Int { 27000 + contributions.reduce(0) { $0 + $1.amount } + 90000 + 210000 }

    static func apply(_ action: String, params: [String: Any]) {
        switch action {
        case "goals.contribute":
            let amount = params["amount"] as? Int ?? 0
            guard amount > 0 else { return }
            contributions.append(("c\(nextContribution)", today, amount))
            nextContribution += 1
        case "goals.uncontribute":
            contributions.removeAll { $0.id == params["contributionId"] as? String }
        default: break
        }
    }

    private static let balances = #"{"total":1248035,"accounts":[{"id":"a1","name":"BBVA","type":"banco","balance":757401,"openingBalance":750000,"share":61},{"id":"a2","name":"Cuenta naranja","type":"ahorro","balance":489434,"openingBalance":489434,"share":39},{"id":"a3","name":"Efectivo","type":"efectivo","balance":12000,"openingBalance":12000,"share":0}]}"#

    static func data(for action: String, params: [String: Any]) -> Data {
        let body: String
        switch action {
        case "home":
            body = empty
                ? #"{"today":"\#(today)","balances":{"total":0,"accounts":[]},"month":\#(summary),"lastDays":{"days":[],"total":0},"nextPayment":null,"topGoal":null,"latest":[]}"#
                : #"{"today":"\#(today)","balances":\#(balances),"month":\#(summary),"lastDays":{"days":[{"date":"2026-11-18","expense":0},{"date":"2026-11-19","expense":1250},{"date":"2026-11-20","expense":5500},{"date":"2026-11-21","expense":2300},{"date":"2026-11-22","expense":0},{"date":"2026-11-23","expense":8120},{"date":"2026-11-24","expense":6189}],"total":23359},"nextPayment":{"id":"r4","concept":"Luz","amount":5800,"date":"2026-11-28"},"topGoal":\#(goal),"latest":[\#(tx[0]),\#(tx[1]),\#(tx[2]),\#(tx.first { $0.contains("\"t4\"") } ?? tx[3])]}"#
        case "accounts.list": body = balances
        case "transactions.list": body = #"{"items":[\#(tx.joined(separator: ","))],"summary":\#(summary)}"#
        case "transactions.get":
            let id = params["id"] as? String
            body = tx.first { $0.contains("\"id\":\"\(id ?? "t1")\"") } ?? tx[0]
        case "recurring.list":
            body = #"[{"id":"r1","kind":"expense","amount":1299,"concept":"Netflix","category":"suscripciones","accountId":"a1","day":29,"frequency":{"unit":"month","every":1},"startDate":"2026-01-29","loan":null,"nextDate":"2026-11-29","progress":null},{"id":"r5","kind":"expense","amount":1500,"concept":"Pádel","category":"ocio","accountId":"a1","day":6,"frequency":{"unit":"week","every":1},"startDate":"2026-11-06","loan":null,"nextDate":"2026-11-27","progress":null},{"id":"r4","kind":"expense","amount":5800,"concept":"Luz","category":"hogar","accountId":"a1","day":28,"frequency":{"unit":"month","every":1},"startDate":"2026-01-28","loan":null,"nextDate":"2026-11-28","progress":null},{"id":"r2","kind":"income","amount":185000,"concept":"Nómina","category":"ingresos","accountId":"a1","day":1,"frequency":{"unit":"month","every":1},"startDate":"2026-01-01","loan":null,"nextDate":"2026-12-01","progress":null},{"id":"r3","kind":"loan","amount":64000,"concept":"Hipoteca","category":"hogar","accountId":"a1","day":5,"frequency":{"unit":"month","every":1},"startDate":"2016-06-05","loan":{"pending":9840000,"endMonth":"2041-06","principal":15870968},"nextDate":"2026-12-05","progress":38}]"#
        case "goals.list":
            body = empty ? #"{"goals":[],"monthlyTotal":0,"saved":0,"target":0}"#
                : #"{"goals":[\#(goal),{"id":"g2","name":"Viaje a Japón","target":300000,"saved":90000,"remaining":210000,"months":4,"monthly":52500,"deadline":"2027-03","progress":30,"behind":true,"done":false,"accountId":null,"contributions":[]},{"id":"g3","name":"Fondo de emergencia","target":600000,"saved":210000,"remaining":390000,"months":39,"monthly":10000,"deadline":"2030-03","progress":35,"behind":false,"done":false,"accountId":null,"contributions":[]}],"monthlyTotal":70200,"saved":\#(goalsSaved),"target":955000}"#
        case "goals.preview":
            // Igual que el servidor: fecha límite exacta; con menos de un mes, el total que falta.
            let t = params["target"] as? Int ?? 0, s = params["saved"] as? Int ?? 0
            let n = max(1, params["durationAmount"] as? Int ?? params["months"] as? Int ?? 1)
            let unit = TimeUnit(rawValue: params["durationUnit"] as? String ?? "month") ?? .month
            let (deadline, months): (String, Int) = switch unit {
            case .day: (Dates.addDays(today, n), n / 31)
            case .week: (Dates.addDays(today, 7 * n), 7 * n / 31)
            case .month: ("\(Dates.shiftMonth("2026-11", n))-24", n)
            case .year: ("\(Dates.shiftMonth("2026-11", 12 * n))-24", 12 * n)
            }
            let monthly = Int((Double(max(0, t - s)) / Double(max(1, months)) / 100).rounded(.up)) * 100
            body = #"{"deadline":"\#(deadline)","monthly":\#(monthly),"short":\#(months < 1)}"#
        case "shortcut.status":
            body = empty ? #"{"active":false,"hint":null,"createdAt":null,"lastUsedAt":null,"accountId":null}"#
                : #"{"active":true,"hint":"3f9a","createdAt":"2026-11-20T10:00:00.000Z","lastUsedAt":"2026-11-24T09:12:00.000Z","accountId":null}"#
        case "shortcut.create": body = #"{"token":"bal_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx3f9a","hint":"3f9a"}"#
        case "chat.ask":
            // Respuestas de ejemplo (sin servidor): el clasificador real está en supabase/functions/_shared/chat.ts.
            let text = (params["text"] as? String ?? "").lowercased()
            if params["chip"] != nil || text.contains("gast") {
                body = #"{"kind":"answer","text":"Este mes has gastado 141,89 € (4 movimientos)."}"#
            } else if text.contains("€") || text.contains("euro") {
                body = #"{"kind":"action","action":"movement","text":"¿Apunto un gasto de 12 € en «Mercadona» (comida, hoy) en BBVA?","proposal":{"accountId":"a1","amount":-1200,"concept":"Mercadona","category":"comida","date":"\#(today)"}}"#
            } else if text.contains("atajo") {
                body = #"{"kind":"answer","text":"Para que cada pago con Wallet se apunte solo, sigue la guía del Atajo de iPhone. Te la abro.","route":"shortcut"}"#
            } else {
                body = #"{"kind":"ai"}"#
            }
        case "report.month": body = #"{"summary":\#(summary),"goals":{"goals":[\#(goal)],"monthlyTotal":7700,"saved":32000,"target":55000}}"#
        default: body = "{}"
        }
        return Data(#"{"data":\#(body)}"#.utf8)
    }
}
#endif
