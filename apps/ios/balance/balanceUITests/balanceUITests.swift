import XCTest

final class BalanceUITests: XCTestCase {
    override func setUp() { continueAfterFailure = false }

    private func launch(_ extra: [String] = []) -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["-fixtures"] + extra
        app.launch()
        return app
    }

    func testHomeShowsBalanceAndAccounts() {
        let app = launch()
        XCTAssertTrue(app.staticTexts["Hola, Mario"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["12.480,35\u{00A0}€"].exists)
        XCTAssertTrue(app.staticTexts["BBVA"].exists)
    }

    func testTabsNavigate() {
        let app = launch()
        XCTAssertTrue(app.buttons["Movimientos"].waitForExistence(timeout: 5))
        app.buttons["Movimientos"].tap()
        XCTAssertTrue(app.staticTexts["Próximos pagos"].waitForExistence(timeout: 5))
        app.buttons["Metas"].tap()
        XCTAssertTrue(app.staticTexts["Para cumplir todas tus metas"].waitForExistence(timeout: 5))
        app.buttons["Principal"].tap()
        XCTAssertTrue(app.staticTexts["Saldo total"].waitForExistence(timeout: 5))
    }

    func testPlusMenuOpensManualMovementSheet() {
        let app = launch()
        app.buttons["Añadir movimiento"].tap()
        XCTAssertTrue(app.buttons["A mano"].waitForExistence(timeout: 3))
        let ia = app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'IA'")).firstMatch
        XCTAssertTrue(ia.exists)
        XCTAssertFalse(ia.isEnabled, "IA llega en una fase posterior")
        app.buttons["A mano"].tap()
        XCTAssertTrue(app.staticTexts["Nuevo movimiento"].waitForExistence(timeout: 5))
        app.buttons["Cancelar"].tap()
        XCTAssertTrue(app.staticTexts["Hola, Mario"].waitForExistence(timeout: 3))
    }

    func testMovementDetailAndDeleteConfirmation() {
        let app = launch(["-fx.tab", "movements"])
        XCTAssertTrue(app.staticTexts["Mercadona"].waitForExistence(timeout: 5))
        app.staticTexts["Mercadona"].tap()
        XCTAssertTrue(app.buttons["Borrar movimiento"].waitForExistence(timeout: 5))
        app.buttons["Borrar movimiento"].tap()
        XCTAssertTrue(app.staticTexts["¿Borrar este movimiento?"].waitForExistence(timeout: 3))
        app.buttons["Cancelar"].tap()
        XCTAssertTrue(app.buttons["Borrar movimiento"].waitForExistence(timeout: 3))
    }

    func testSettingsThemeAndPin() {
        let app = launch(["-fx.route", "settings"])
        XCTAssertTrue(app.staticTexts["Apariencia"].waitForExistence(timeout: 5))
        app.buttons["Oscuro"].tap()
        XCTAssertTrue(app.buttons["Oscuro"].isSelected)
        app.buttons["Sistema"].tap()
        XCTAssertTrue(app.buttons["Sistema"].isSelected)
        XCTAssertTrue(app.staticTexts["Desactivado"].exists)
    }

    func testNewFixedFormValidates() {
        let app = launch(["-fx.sheet", "recurring"])
        XCTAssertTrue(app.staticTexts["Nuevo fijo"].waitForExistence(timeout: 5))
        app.buttons["Guardar"].tap()
        XCTAssertTrue(app.staticTexts["Escribe un importe válido, por ejemplo 9,99"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.staticTexts["Ponle un nombre, por ejemplo Netflix"].exists)
    }

    func testOnboardingWalksToSignup() {
        let app = XCUIApplication()
        app.launchArguments = ["-fx.reset"]
        app.launch()
        XCTAssertTrue(app.buttons["Empezar"].waitForExistence(timeout: 5))
        app.buttons["Empezar"].tap()
        XCTAssertTrue(app.staticTexts["¿Cuánto tienes?"].waitForExistence(timeout: 3))
        app.buttons["Continuar"].tap()
        XCTAssertTrue(app.staticTexts["¿Tienes hipoteca o préstamos?"].waitForExistence(timeout: 3))
        app.buttons["No tengo"].tap()
        XCTAssertTrue(app.staticTexts["Tu sueldo"].waitForExistence(timeout: 3))
        app.buttons["Prefiero no ponerlo"].tap()
        XCTAssertTrue(app.staticTexts["Tus pagos, apuntados solos"].waitForExistence(timeout: 3))
        app.buttons["Continuar"].tap()
        XCTAssertTrue(app.staticTexts["Haz una foto y listo"].waitForExistence(timeout: 3))
        app.buttons["Continuar"].tap()
        XCTAssertTrue(app.staticTexts["Crea tu cuenta"].waitForExistence(timeout: 3))
    }

    func testSignupShowsValidationErrors() {
        let app = XCUIApplication()
        app.launchArguments = ["-fx.screen", "signup"]
        app.launch()
        XCTAssertTrue(app.buttons["Crear cuenta"].waitForExistence(timeout: 5))
        app.buttons["Crear cuenta"].tap()
        XCTAssertTrue(app.staticTexts["Escribe tu nombre"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.staticTexts["Escribe un correo válido"].exists)
        XCTAssertTrue(app.staticTexts["Mínimo 8 caracteres"].exists)
    }

    func testLoginRequiresCredentials() {
        let app = XCUIApplication()
        app.launchArguments = ["-fx.screen", "login"]
        app.launch()
        XCTAssertTrue(app.buttons["Iniciar sesión"].waitForExistence(timeout: 5))
        app.buttons["Iniciar sesión"].tap()
        XCTAssertTrue(app.staticTexts["Escribe tu usuario y tu contraseña"].waitForExistence(timeout: 3))
    }

    func testGoalsListShowsProgressAndDelay() {
        let app = launch(["-fx.tab", "goals"])
        XCTAssertTrue(app.staticTexts["PS5"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Viaje a Japón"].exists)
        XCTAssertTrue(app.staticTexts["Fondo de emergencia"].exists)
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS 'con retraso'")).firstMatch.exists, "la meta atrasada se avisa")
    }

    func testGoalSheetCalculatesMonthlyLive() {
        let app = launch(["-fx.sheet", "goal"])
        XCTAssertTrue(app.staticTexts["Nueva meta"].waitForExistence(timeout: 5))
        let cost = app.textFields["Cuesta"]
        XCTAssertTrue(cost.waitForExistence(timeout: 3))
        cost.tap(); cost.typeText("600")
        // 600 € en 6 meses (plazo por defecto) = 100 €/mes
        XCTAssertTrue(app.staticTexts["100\u{00A0}€ al mes"].waitForExistence(timeout: 5))
        app.buttons["12 meses"].tap()
        XCTAssertTrue(app.staticTexts["50\u{00A0}€ al mes"].waitForExistence(timeout: 5))
    }

    func testGoalSheetValidatesNameAndCost() {
        let app = launch(["-fx.sheet", "goal"])
        XCTAssertTrue(app.buttons["Guardar"].waitForExistence(timeout: 5))
        app.buttons["Guardar"].tap()
        XCTAssertTrue(app.staticTexts["Ponle un nombre a la meta"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.staticTexts["Escribe cuánto cuesta"].exists)
    }

    func testGoalDetailContributeAndUndo() {
        let app = launch(["-fx.tab", "goals"])
        XCTAssertTrue(app.staticTexts["PS5"].waitForExistence(timeout: 5))
        app.staticTexts["PS5"].tap()
        XCTAssertTrue(app.buttons["Cerrar"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["Aportaciones"].exists)
        let before = app.buttons.matching(NSPredicate(format: "label == 'Deshacer'")).count
        XCTAssertEqual(before, 1, "la meta de ejemplo ya trae una aportación")
        // aportar 25 € con el chip rápido
        app.buttons["+25 €"].tap()
        app.buttons["Aportar"].tap()
        let more = NSPredicate(format: "count == 2")
        expectation(for: more, evaluatedWith: app.buttons.matching(NSPredicate(format: "label == 'Deshacer'")))
        waitForExpectations(timeout: 6)
        // deshacer la última (confirmando)
        app.buttons.matching(NSPredicate(format: "label == 'Deshacer'")).firstMatch.tap()
        XCTAssertTrue(app.buttons["Deshacer aportación"].waitForExistence(timeout: 3))
        app.buttons["Deshacer aportación"].tap()
        expectation(for: NSPredicate(format: "count == 1"), evaluatedWith: app.buttons.matching(NSPredicate(format: "label == 'Deshacer'")))
        waitForExpectations(timeout: 6)
    }

    func testTransferInMovementsIsReadOnly() {
        let app = launch(["-fx.tab", "movements"])
        XCTAssertTrue(app.staticTexts["Mercadona"].waitForExistence(timeout: 5))
        let leg = app.descendants(matching: .any).matching(NSPredicate(format: "label BEGINSWITH 'Aportación a PS5'")).firstMatch
        var tries = 0
        while !(leg.exists && leg.isHittable) && tries < 8 { app.swipeUp(); tries += 1 }
        XCTAssertTrue(leg.exists, "la transferencia debe aparecer en la lista de Movimientos")
        leg.tap()
        XCTAssertTrue(app.staticTexts["Se gestiona desde la meta"].waitForExistence(timeout: 5))
        XCTAssertFalse(app.buttons["Borrar movimiento"].exists, "una transferencia no se borra suelta")
        XCTAssertFalse(app.buttons["Editar movimiento"].exists)
        XCTAssertTrue(app.buttons["Ver meta"].exists)
    }
}
