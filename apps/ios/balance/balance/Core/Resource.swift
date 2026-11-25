import Foundation
import Observation
import Supabase

/// Caché de respuestas de la API, compartida por toda la app y viva mientras la app está abierta.
///
/// Estrategia «enseña lo guardado y refresca detrás»:
/// - Lo ya cargado sale al instante al volver a una pestaña o abrir una hoja (sin esqueleto gris).
/// - Si los datos son recientes (menos de `freshFor` segundos y sin cambios desde entonces), no se vuelve a pedir nada.
/// - Si no, se enseñan igualmente y se refrescan en segundo plano.
/// - Cualquier cambio (`invalidate`) o volver a la app tras un rato marca todo como desactualizado.
/// - Al cerrar sesión se borra todo: nunca se enseñan datos de otro usuario.
@MainActor
enum ResponseCache {
    struct Entry { let value: Any; let at: Date; let generation: Int }

    private(set) static var store: [String: Entry] = [:]
    private static var inflight: [String: Task<Any, Error>] = [:]
    /// Sube con cada cambio de datos. Una entrada de una generación anterior se considera desactualizada.
    private(set) static var generation = 0
    static var freshFor: TimeInterval = 30
    /// Solo para tests: sustituye la llamada de red. Devuelve el JSON del campo `data`.
    static var transport: ((String, [String: AnyJSON]) async throws -> Data)?

    static func key(_ action: String, _ params: [String: AnyJSON]) -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = .sortedKeys
        let json = (try? encoder.encode(params)).map { String(decoding: $0, as: UTF8.self) } ?? ""
        return "\(action)|\(json)"
    }

    static func entry(_ key: String) -> Entry? { store[key] }

    static func isFresh(_ e: Entry) -> Bool { e.generation == generation && Date().timeIntervalSince(e.at) < freshFor }

    /// Algo ha cambiado (o puede haber cambiado): lo guardado se enseña, pero se vuelve a pedir.
    static func markStale() { generation += 1 }

    static func clear() {
        store.removeAll()
        inflight.values.forEach { $0.cancel() }
        inflight.removeAll()
        generation += 1
    }

    /// Pide a la API; si ya hay la misma petición en curso, espera a esa en vez de repetirla.
    static func fetch<T: Decodable>(_ action: String, _ params: [String: AnyJSON], as _: T.Type = T.self) async throws -> T {
        let key = key(action, params)
        if let running = inflight[key] {
            guard let v = try await running.value as? T else { throw APIError.generic }
            return v
        }
        let started = generation
        let task = Task<Any, Error> {
            if let transport = ResponseCache.transport {
                return try JSONDecoder().decode(T.self, from: try await transport(action, params))
            }
            return try await API.call(action, params, as: T.self)
        }
        inflight[key] = task
        defer { if inflight[key] == task { inflight[key] = nil } }
        let value = try await task.value
        // Si mientras tanto hubo un cambio, esta respuesta puede ser anterior a él: se guarda como desactualizada.
        store[key] = Entry(value: value, at: Date(), generation: started)
        guard let typed = value as? T else { throw APIError.generic }
        return typed
    }

    /// Carga en segundo plano lo que las pantallas principales van a pedir. Los errores se ignoran: cada pantalla reintenta.
    static func warmUp() async {
        // Primero Principal: es la que apunta los pagos fijos que hayan vencido. El resto se pide ya con eso hecho.
        _ = try? await fetch("home", [:], as: Home.self)
        async let a = try? fetch("accounts.list", [:], as: Balances.self)
        async let b = try? fetch("recurring.list", [:], as: [Recurring].self)
        async let c = try? fetch("goals.list", [:], as: Goals.self)
        async let d = try? fetch("transactions.list", ["period": .string("month")], as: TransactionList.self)
        _ = await (a, b, c, d)
    }
}

/// Datos de una acción de la API con estados de carga y error. Se usa con `.task(id: app.version)`.
@MainActor @Observable
final class Resource<T: Decodable> {
    private(set) var data: T?
    private(set) var error: Error?
    private(set) var loading = true

    /// - force: ignora lo guardado y pide siempre (tirar para recargar).
    /// - allowStale: si es false, solo se enseña lo guardado cuando es reciente. Para las hojas que rellenan campos con los
    ///   datos: así nunca se rellenan con valores viejos.
    func load(_ action: String, _ params: [String: AnyJSON] = [:], force: Bool = false, allowStale: Bool = true) async {
        let key = ResponseCache.key(action, params)
        if !force, let hit = ResponseCache.entry(key), let cached = hit.value as? T, allowStale || ResponseCache.isFresh(hit) {
            data = cached
            error = nil
            loading = false
            if ResponseCache.isFresh(hit) { return }
        }
        do {
            data = try await ResponseCache.fetch(action, params, as: T.self)
            error = nil
        } catch is CancellationError {
            return
        } catch {
            if (error as? URLError)?.code == .cancelled { return }
            // Si ya hay datos que enseñar, se conservan; el error solo se muestra cuando no hay nada.
            if data == nil { self.error = error }
        }
        loading = false
    }
}
