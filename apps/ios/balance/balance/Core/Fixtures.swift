#if DEBUG
import Foundation

/// Datos de ejemplo para depurar y probar la interfaz sin red ni cuenta. Solo existe en builds de Debug y
/// se activa con el argumento de arranque `-fixtures`.
enum Fixtures {
    static var enabled: Bool { ProcessInfo.processInfo.arguments.contains("-fixtures") }
    static var empty: Bool { ProcessInfo.processInfo.arguments.contains("-fixtures-empty") }

    static let profile = Profile(name: "Mario", username: "mario", email: "mario@correo.com")

    private static let today = "2026-11-24"

    private static let tx: [String] = [
        #"{"id":"t1","accountId":"a1","amount":-4890,"concept":"Mercadona","category":"comida","date":"2026-11-24","source":"atajo"}"#,
        #"{"id":"t2","accountId":"a1","amount":-1299,"concept":"Netflix","category":"suscripciones","date":"2026-11-24","source":"fijo"}"#,
        #"{"id":"t3","accountId":"a1","amount":-5500,"concept":"Gasolina","category":"transporte","date":"2026-11-20","source":"manual"}"#,
        #"{"id":"t4","accountId":"a1","amount":185000,"concept":"Nómina","category":"ingresos","date":"2026-11-01","source":"fijo"}"#,
        #"{"id":"t5","accountId":"a2","amount":-70299,"concept":"Hipoteca","category":"hogar","date":"2026-11-05","source":"fijo","note":"Cuota de noviembre"}"#,
    ]

    private static let summary = #"{"month":"2026-11","income":185000,"expense":124060,"saved":60940,"savedShare":33,"pending":1299,"byCategory":[{"category":"hogar","label":"Hogar","amount":70299,"share":57},{"category":"comida","label":"Comida","amount":31245,"share":25},{"category":"transporte","label":"Transporte","amount":12800,"share":10},{"category":"ocio","label":"Ocio","amount":9716,"share":8}],"previousExpense":133690,"vsPrevious":9630}"#

    private static let goal = #"{"id":"g1","name":"PS5","target":55000,"saved":32000,"remaining":23000,"months":3,"monthly":7700,"deadline":"2027-02","progress":58,"behind":false,"done":false}"#

    private static let balances = #"{"total":1248035,"accounts":[{"id":"a1","name":"BBVA","type":"banco","balance":757401,"openingBalance":750000,"share":61},{"id":"a2","name":"Cuenta naranja","type":"ahorro","balance":489434,"openingBalance":489434,"share":39},{"id":"a3","name":"Efectivo","type":"efectivo","balance":12000,"openingBalance":12000,"share":0}]}"#

    static func data(for action: String, params: [String: Any]) -> Data {
        let body: String
        switch action {
        case "home":
            body = empty
                ? #"{"today":"\#(today)","balances":{"total":0,"accounts":[]},"month":\#(summary),"lastDays":{"days":[],"total":0},"nextPayment":null,"topGoal":null,"latest":[]}"#
                : #"{"today":"\#(today)","balances":\#(balances),"month":\#(summary),"lastDays":{"days":[{"date":"2026-11-18","expense":0},{"date":"2026-11-19","expense":1250},{"date":"2026-11-20","expense":5500},{"date":"2026-11-21","expense":2300},{"date":"2026-11-22","expense":0},{"date":"2026-11-23","expense":8120},{"date":"2026-11-24","expense":6189}],"total":23359},"nextPayment":{"id":"r1","concept":"Netflix","amount":1299,"date":"2026-11-25"},"topGoal":\#(goal),"latest":[\#(tx[0]),\#(tx[1]),\#(tx[2]),\#(tx[3])]}"#
        case "accounts.list": body = balances
        case "transactions.list": body = #"{"items":[\#(tx.joined(separator: ","))],"summary":\#(summary)}"#
        case "transactions.get":
            let id = params["id"] as? String
            body = tx.first { $0.contains("\"id\":\"\(id ?? "t1")\"") } ?? tx[0]
        case "recurring.list":
            body = #"[{"id":"r1","kind":"expense","amount":1299,"concept":"Netflix","category":"suscripciones","accountId":"a1","day":25,"frequency":{"unit":"month","every":1},"startDate":"2026-01-25","loan":null,"nextDate":"2026-11-25","progress":null},{"id":"r2","kind":"income","amount":185000,"concept":"Nómina","category":"ingresos","accountId":"a1","day":1,"frequency":{"unit":"month","every":1},"startDate":"2026-01-01","loan":null,"nextDate":"2026-12-01","progress":null},{"id":"r3","kind":"loan","amount":64000,"concept":"Hipoteca","category":"hogar","accountId":"a1","day":5,"frequency":{"unit":"month","every":1},"startDate":"2016-06-05","loan":{"pending":9840000,"endMonth":"2041-06","principal":15870968},"nextDate":"2026-12-05","progress":38}]"#
        case "goals.list":
            body = empty ? #"{"goals":[],"monthlyTotal":0,"saved":0,"target":0}"#
                : #"{"goals":[\#(goal),{"id":"g2","name":"Viaje a Japón","target":300000,"saved":90000,"remaining":210000,"months":4,"monthly":52500,"deadline":"2027-03","progress":30,"behind":true,"done":false},{"id":"g3","name":"Fondo de emergencia","target":600000,"saved":210000,"remaining":390000,"months":39,"monthly":10000,"deadline":"2030-03","progress":35,"behind":false,"done":false}],"monthlyTotal":70200,"saved":332000,"target":955000}"#
        case "goals.preview":
            let t = params["target"] as? Int ?? 0, s = params["saved"] as? Int ?? 0, m = max(1, params["months"] as? Int ?? 1)
            let monthly = Int((Double(max(0, t - s)) / Double(m) / 100).rounded(.up)) * 100
            body = #"{"deadline":"\#(Dates.shiftMonth("2026-11", m))","monthly":\#(monthly)}"#
        case "shortcut.status":
            body = empty ? #"{"active":false,"hint":null,"createdAt":null,"lastUsedAt":null,"accountId":null}"#
                : #"{"active":true,"hint":"3f9a","createdAt":"2026-11-20T10:00:00.000Z","lastUsedAt":"2026-11-24T09:12:00.000Z","accountId":null}"#
        case "shortcut.create": body = #"{"token":"bal_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx3f9a","hint":"3f9a"}"#
        case "report.month": body = #"{"summary":\#(summary),"goals":{"goals":[\#(goal)],"monthlyTotal":7700,"saved":32000,"target":55000}}"#
        default: body = "{}"
        }
        return Data(#"{"data":\#(body)}"#.utf8)
    }
}
#endif
