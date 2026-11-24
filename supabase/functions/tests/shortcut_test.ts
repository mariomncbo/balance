import { assert, assertEquals, assertMatch, assertNotEquals } from "jsr:@std/assert@1.0.13";
import { categoryFromKeywords, conceptFrom, formatExpense, generateToken, guessCategory, parseAmount, pickAccount, TOKEN_PATTERN } from "../_shared/shortcut.ts";

Deno.test("atajo: lee los importes como los envía Wallet", () => {
  const cases: [unknown, number | null][] = [
    ["12,40 €", 1240], ["€12.40", 1240], ["12,4", 1240], ["1.234,56 €", 123456], ["1,234.56", 123456],
    ["1.234", 123400], ["-12,40 €", 1240], ["12 €", 1200], [12.4, 1240], [0.5, 50], ["EUR 3,99", 399],
    ["", null], ["gratis", null], ["0,00 €", null], [0, null], [-0, null], ["12,345", 1234500], ["1,2,3", null], [",50", 50], ["123.456,7", 12345670], ["1.234.567,8", null],
    ["99999999,99", null], [Number.NaN, null], [null, null], [{ amount: 1 }, null], ["12,", null],
  ];
  for (const [input, expected] of cases) assertEquals(parseAmount(input), expected, `«${String(input)}»`);
});

Deno.test("atajo: la clave tiene 256 bits y el formato esperado", () => {
  const a = generateToken(), b = generateToken();
  assertMatch(a, TOKEN_PATTERN);
  assertNotEquals(a, b);
  assert(!TOKEN_PATTERN.test("bal_corta") && !TOKEN_PATTERN.test(a + "x") && !TOKEN_PATTERN.test("xyz_" + a.slice(4)));
});

Deno.test("atajo: categoría por palabras clave", () => {
  assertEquals(categoryFromKeywords("MERCADONA S.A."), "comida");
  assertEquals(categoryFromKeywords("Repsol Estación 123"), "transporte");
  assertEquals(categoryFromKeywords("NETFLIX.COM"), "suscripciones");
  assertEquals(categoryFromKeywords("Farmacia Ldo. García"), "salud");
  assertEquals(categoryFromKeywords("El Corte Inglés"), "compras");
  assertEquals(categoryFromKeywords("Diagonal Mar Tienda"), "otros", "«dia» no debe coincidir dentro de «Diagonal»");
  assertEquals(categoryFromKeywords("Comercio desconocido"), "otros");
});

Deno.test("atajo: aprende la categoría que el usuario ya usó con ese comercio", () => {
  const history = [
    { concept: "Mercadona", category: "hogar" as const, date: "2026-10-01", amount: -1000 },
    { concept: "mercadona", category: "comida" as const, date: "2026-11-01", amount: -1000 },
    { concept: "Tienda Pepe", category: "ocio" as const, date: "2026-11-02", amount: -500 },
  ];
  assertEquals(guessCategory("MERCADONA", history), "comida", "gana la más reciente");
  assertEquals(guessCategory("Tienda Pepe", history), "ocio");
  assertEquals(guessCategory("Repsol", history), "transporte");
});

Deno.test("atajo: elige la cuenta por el nombre de la tarjeta", () => {
  const accounts = [{ id: "a1", name: "Cuenta naranja" }, { id: "a2", name: "BBVA" }, { id: "a3", name: "Ef" }];
  assertEquals(pickAccount("BBVA Aqua Débito", null, accounts), "a2");
  assertEquals(pickAccount("Tarjeta desconocida", "a1", accounts), "a1");
  assertEquals(pickAccount("Tarjeta desconocida", "borrada", accounts), "a1", "la preferida ya no existe: primera");
  assertEquals(pickAccount("Efectivo", null, accounts), "a1", "nombres de menos de 3 letras no cuentan");
  assertEquals(pickAccount("", null, []), null);
});

Deno.test("atajo: concepto y mensaje", () => {
  assertEquals(conceptFrom("  Mercadona   Madrid ", ""), "Mercadona Madrid");
  assertEquals(conceptFrom("", "BBVA Aqua"), "Pago con BBVA Aqua");
  assertEquals(conceptFrom("", ""), "Pago con tarjeta");
  assertEquals(conceptFrom("x".repeat(200), "").length, 80);
  assertEquals(formatExpense(123456), "−1.234,56 €");
});
