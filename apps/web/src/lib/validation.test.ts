import { describe, expect, it } from "vitest";
import { EMAIL, USERNAME, validateSignup } from "./validation";

const ok = {
  name: "Mario",
  username: "mario.ahorra",
  email: "mario@correo.com",
  password: "contraseña1",
  password2: "contraseña1",
};

describe("validación del registro", () => {
  it("acepta datos correctos", () => expect(validateSignup(ok)).toEqual({}));
  it("avisa de contraseñas distintas con el texto del diseño", () => {
    expect(validateSignup({ ...ok, password2: "otra" }).password2).toBe(
      "Las contraseñas no coinciden. Vuelve a escribirla.",
    );
  });
  it("rechaza usuarios no válidos", () => {
    for (const u of ["ab", "Mario", "con espacio", "ñandú", "a".repeat(31)])
      expect(USERNAME.test(u)).toBe(false);
    for (const u of ["abc", "mario.ahorra", "m_1.2"]) expect(USERNAME.test(u)).toBe(true);
  });
  it("rechaza correos y contraseñas cortas", () => {
    expect(EMAIL.test("sin-arroba")).toBe(false);
    expect(validateSignup({ ...ok, email: "x@y" }).email).toBeTruthy();
    expect(validateSignup({ ...ok, password: "corta", password2: "corta" }).password).toBeTruthy();
  });
});
