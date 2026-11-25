import Foundation
import Supabase

/// Error de la API con el mensaje que se enseña al usuario.
struct APIError: LocalizedError {
    let message: String
    let status: Int
    var code: String? = nil
    var extra: [String: Any] = [:]
    var errorDescription: String? { message }

    static let network = APIError(message: "Sin conexión. Comprueba internet y vuelve a intentarlo.", status: 0, code: "network")
    static let generic = APIError(message: "Algo ha fallado. Inténtalo de nuevo.", status: 500)
}

/// Direcciones a las que vuelve el enlace de los correos de Supabase (esquema `balance://`, ver Info-extra.plist).
/// Deben estar en Authentication → URL Configuration → Redirect URLs.
enum DeepLink {
    static let confirm = URL(string: "balance://confirmar")!
    static let recovery = URL(string: "balance://nueva-contrasena")!
}

let supabase = SupabaseClient(
    supabaseURL: Config.supabaseURL,
    supabaseKey: Config.supabaseKey,
    options: SupabaseClientOptions(auth: .init(emitLocalSessionAsInitialSession: true))
)

private struct Envelope<T: Decodable>: Decodable { let data: T }
private struct Empty: Decodable {}
private struct Body: Encodable {
    let action: String
    let params: [String: AnyJSON]
}

enum API {
    /// Llama a una acción de la Edge Function `api` (requiere sesión).
    static func call<T: Decodable>(_ action: String, _ params: [String: AnyJSON] = [:], as _: T.Type = T.self) async throws -> T {
        let env: Envelope<T> = try await invoke("api", action, params)
        return env.data
    }

    /// Acción de `api` cuyo resultado no interesa.
    static func send(_ action: String, _ params: [String: AnyJSON] = [:]) async throws {
        let _: Empty = try await invokeIgnoringBody("api", action, params)
    }

    /// Llama a la Edge Function `auth` (sin sesión): comprobar usuario y entrar con usuario.
    static func auth<T: Decodable>(_ action: String, _ params: [String: AnyJSON] = [:], as _: T.Type = T.self) async throws -> T {
        try await invoke("auth", action, params)
    }

    private static func invoke<T: Decodable>(_ fn: String, _ action: String, _ params: [String: AnyJSON]) async throws -> T {
        #if DEBUG
        if Fixtures.enabled, fn == "api" {
            let raw = (try? JSONSerialization.jsonObject(with: JSONEncoder().encode(params))) as? [String: Any] ?? [:]
            return try JSONDecoder().decode(T.self, from: Fixtures.data(for: action, params: raw))
        }
        #endif
        do {
            return try await supabase.functions.invoke(
                fn,
                options: FunctionInvokeOptions(body: Body(action: action, params: params))
            ) { data, _ in try JSONDecoder().decode(T.self, from: data) }
        } catch { throw map(error) }
    }

    private static func invokeIgnoringBody<T: Decodable>(_ fn: String, _ action: String, _ params: [String: AnyJSON]) async throws -> T {
        #if DEBUG
        if Fixtures.enabled, let empty = Empty() as? T {
            Fixtures.apply(action, params: (try? JSONSerialization.jsonObject(with: JSONEncoder().encode(params))) as? [String: Any] ?? [:])
            return empty
        }
        #endif
        do {
            return try await supabase.functions.invoke(
                fn,
                options: FunctionInvokeOptions(body: Body(action: action, params: params))
            ) { data, _ in
                // Algunas acciones devuelven {data: ...} y otras nada útil: se acepta cualquier JSON válido.
                if let empty = Empty() as? T { return empty }
                return try JSONDecoder().decode(T.self, from: data)
            }
        } catch { throw map(error) }
    }

    static func map(_ error: Error) -> APIError {
        if let e = error as? APIError { return e }
        if let f = error as? FunctionsError, case let .httpError(code, data) = f {
            let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
            var extra = obj
            let message = extra.removeValue(forKey: "error") as? String
            let c = extra.removeValue(forKey: "code") as? String
            return APIError(message: message ?? APIError.generic.message, status: code, code: c, extra: extra)
        }
        if error is URLError { return .network }
        return .generic
    }
}
