import Foundation
import Observation
import Supabase

/// Datos de una acción de la API con estados de carga y error. Se usa con `.task(id: app.version)`.
@MainActor @Observable
final class Resource<T: Decodable> {
    private(set) var data: T?
    private(set) var error: Error?
    private(set) var loading = true

    func load(_ action: String, _ params: [String: AnyJSON] = [:]) async {
        do {
            let value: T = try await API.call(action, params)
            data = value
            error = nil
        } catch is CancellationError {
            return
        } catch {
            if (error as? URLError)?.code == .cancelled { return }
            self.error = error
        }
        loading = false
    }
}
