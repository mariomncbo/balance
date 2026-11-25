import Foundation
import Helpers
import Supabase
import Testing
@testable import balance

/// La caché es estado global compartido: estos tests se ejecutan uno detrás de otro.
@MainActor @Suite(.serialized)
struct ResponseCacheTests {
    final class Server { var calls = 0; var delay: Duration = .zero; var fail = false }

    private func setUp(_ server: Server) {
        ResponseCache.clear()
        ResponseCache.freshFor = 30
        ResponseCache.transport = { _, _ in
            server.calls += 1
            if server.delay > .zero { try await Task.sleep(for: server.delay) }
            if server.fail { throw APIError.network }
            return Data(#"{"total":100,"accounts":[]}"#.utf8)
        }
    }

    @Test func freshDataIsNotRequestedAgain() async {
        let server = Server(); setUp(server)
        let first = Resource<Balances>()
        await first.load("accounts.list")
        // Una pantalla nueva (como al volver a una pestaña) pide lo mismo: sale al instante y sin tocar la red.
        let second = Resource<Balances>()
        await second.load("accounts.list")
        #expect(server.calls == 1)
        #expect(second.data?.total == 100 && !second.loading && second.error == nil)
    }

    @Test func staleDataShowsAtOnceAndRefreshesBehind() async throws {
        let server = Server(); setUp(server)
        await Resource<Balances>().load("accounts.list")
        ResponseCache.markStale() // por ejemplo, tras apuntar un movimiento
        server.delay = .milliseconds(150)
        let screen = Resource<Balances>()
        let task = Task { await screen.load("accounts.list") }
        try await Task.sleep(for: .milliseconds(40))
        #expect(screen.data != nil && !screen.loading, "lo guardado se enseña mientras llega lo nuevo")
        await task.value
        #expect(server.calls == 2, "y se refresca detrás")
    }

    @Test func sameRequestInFlightIsSharedNotRepeated() async {
        let server = Server(); setUp(server)
        server.delay = .milliseconds(80)
        let a = Resource<Balances>(), b = Resource<Balances>()
        async let x: Void = a.load("accounts.list")
        async let y: Void = b.load("accounts.list")
        _ = await (x, y)
        #expect(server.calls == 1, "la precarga y la pantalla no duplican la petición")
        #expect(a.data != nil && b.data != nil)
    }

    @Test func sheetsNeverFillFieldsWithStaleData() async throws {
        let server = Server(); setUp(server)
        await Resource<Balances>().load("accounts.list")
        ResponseCache.markStale()
        server.delay = .milliseconds(150)
        let sheet = Resource<Balances>()
        let task = Task { await sheet.load("accounts.list", allowStale: false) }
        try await Task.sleep(for: .milliseconds(40))
        #expect(sheet.data == nil && sheet.loading, "con allowStale: false espera a los datos nuevos")
        await task.value
        #expect(sheet.data != nil && !sheet.loading)
    }

    @Test func pullToRefreshAlwaysAsks() async {
        let server = Server(); setUp(server)
        let screen = Resource<Balances>()
        await screen.load("accounts.list")
        await screen.load("accounts.list", force: true)
        #expect(server.calls == 2)
    }

    @Test func dataExpiresAfterTheFreshnessWindow() async {
        let server = Server(); setUp(server)
        ResponseCache.freshFor = 0
        await Resource<Balances>().load("accounts.list")
        let screen = Resource<Balances>()
        await screen.load("accounts.list")
        #expect(server.calls == 2 && screen.data != nil)
    }

    @Test func failureKeepsWhatWasAlreadyShown() async {
        let server = Server(); setUp(server)
        await Resource<Balances>().load("accounts.list")
        ResponseCache.markStale()
        server.fail = true
        let screen = Resource<Balances>()
        await screen.load("accounts.list")
        #expect(screen.data != nil && screen.error == nil, "sin conexión se siguen viendo los datos guardados")
    }

    @Test func failureWithNothingSavedReportsTheError() async {
        let server = Server(); setUp(server)
        server.fail = true
        let screen = Resource<Balances>()
        await screen.load("accounts.list")
        #expect(screen.data == nil && screen.error != nil && !screen.loading)
    }

    @Test func differentParametersAreDifferentEntries() async {
        let server = Server(); setUp(server)
        await Resource<Balances>().load("accounts.list", ["a": .string("1")])
        await Resource<Balances>().load("accounts.list", ["a": .string("2")])
        await Resource<Balances>().load("accounts.list", ["a": .string("1")])
        #expect(server.calls == 2)
    }

    @Test func signingOutForgetsEverything() async {
        let server = Server(); setUp(server)
        await Resource<Balances>().load("accounts.list")
        ResponseCache.clear() // lo que hace AppModel.signOut()
        let other = Resource<Balances>()
        await other.load("accounts.list")
        #expect(server.calls == 2, "el siguiente usuario nunca ve datos del anterior")
    }
}
