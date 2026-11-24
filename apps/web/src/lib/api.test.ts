import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
vi.mock("./supabase", () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));

import { api, ApiError, authFn } from "./api";

beforeEach(() => invoke.mockReset());

describe("api", () => {
  it("devuelve el campo data de la respuesta", async () => {
    invoke.mockResolvedValue({ data: { data: { total: 100 } }, error: null });
    await expect(api("home")).resolves.toEqual({ total: 100 });
    expect(invoke).toHaveBeenCalledWith("api", { body: { action: "home", params: {} } });
  });

  it("convierte un error HTTP en ApiError con el mensaje del servidor", async () => {
    const res = new Response(JSON.stringify({ error: "La cuenta no existe" }), { status: 400 });
    invoke.mockResolvedValue({ data: null, error: new FunctionsHttpError(res) });
    await expect(api("transactions.create")).rejects.toMatchObject({
      message: "La cuenta no existe",
      status: 400,
    });
  });

  it("conserva código y datos extra (p. ej. correo sin confirmar)", async () => {
    const body = { error: "Confirma tu correo para entrar.", code: "email_not_confirmed", email: "a@b.com" };
    invoke.mockResolvedValue({
      data: null,
      error: new FunctionsHttpError(new Response(JSON.stringify(body), { status: 403 })),
    });
    const err = await authFn("login").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 403, code: "email_not_confirmed", extra: { email: "a@b.com" } });
  });

  it("explica la falta de conexión", async () => {
    invoke.mockResolvedValue({ data: null, error: new FunctionsFetchError(new Error("fail")) });
    await expect(api("home")).rejects.toMatchObject({ code: "network", status: 0 });
  });

  it("no se rompe si el servidor no devuelve JSON", async () => {
    invoke.mockResolvedValue({
      data: null,
      error: new FunctionsHttpError(new Response("boom", { status: 500 })),
    });
    await expect(api("home")).rejects.toMatchObject({
      status: 500,
      message: "Algo ha fallado. Inténtalo de nuevo.",
    });
  });
});
