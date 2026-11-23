import { assert, assertEquals, assertMatch, assertNotEquals, assertRejects } from "jsr:@std/assert@1.0.13";
import {
  b64urlDecode,
  b64urlEncode,
  createWrappedUserKey,
  decryptPayload,
  encryptPayload,
  importMasterKey,
  rowAad,
  sha256Hex,
  unwrapUserKey,
  uuidv7,
} from "../_shared/crypto.ts";

const masterB64 = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

Deno.test("ida y vuelta: cifra y descifra un payload", async () => {
  const master = await importMasterKey(masterB64);
  const dek = await unwrapUserKey(master, await createWrappedUserKey(master, USER), USER);
  const aad = rowAad("transactions", USER, "row-1");
  const data = { amount: -4890, concept: "Mercadona" };
  const sealed = await encryptPayload(dek, aad, data);
  assertMatch(sealed, /^v1\.[\w-]+\.[\w-]+$/);
  assert(!sealed.includes("Mercadona"), "el texto en claro no debe aparecer");
  assertEquals(await decryptPayload(dek, aad, sealed), data);
});

Deno.test("cada cifrado usa un IV distinto", async () => {
  const master = await importMasterKey(masterB64);
  const dek = await unwrapUserKey(master, await createWrappedUserKey(master, USER), USER);
  const aad = rowAad("accounts", USER, "a");
  assertNotEquals(await encryptPayload(dek, aad, { x: 1 }), await encryptPayload(dek, aad, { x: 1 }));
});

Deno.test("no se puede mover una fila a otro usuario, tabla o id", async () => {
  const master = await importMasterKey(masterB64);
  const dek = await unwrapUserKey(master, await createWrappedUserKey(master, USER), USER);
  const sealed = await encryptPayload(dek, rowAad("goals", USER, "g1"), { name: "PS5" });
  await assertRejects(() => decryptPayload(dek, rowAad("goals", OTHER, "g1"), sealed));
  await assertRejects(() => decryptPayload(dek, rowAad("accounts", USER, "g1"), sealed));
  await assertRejects(() => decryptPayload(dek, rowAad("goals", USER, "g2"), sealed));
});

Deno.test("la clave de un usuario no abre los datos de otro", async () => {
  const master = await importMasterKey(masterB64);
  const wrapped = await createWrappedUserKey(master, USER);
  await assertRejects(() => unwrapUserKey(master, wrapped, OTHER));
  const otherDek = await unwrapUserKey(master, await createWrappedUserKey(master, OTHER), OTHER);
  const dek = await unwrapUserKey(master, wrapped, USER);
  const aad = rowAad("accounts", USER, "a");
  const sealed = await encryptPayload(dek, aad, { n: 1 });
  await assertRejects(() => decryptPayload(otherDek, aad, sealed));
});

Deno.test("una clave maestra distinta no abre las claves de usuario", async () => {
  const master = await importMasterKey(masterB64);
  const wrong = await importMasterKey(b64urlEncode(crypto.getRandomValues(new Uint8Array(32))));
  const wrapped = await createWrappedUserKey(master, USER);
  await assertRejects(() => unwrapUserKey(wrong, wrapped, USER));
});

Deno.test("un payload manipulado se rechaza", async () => {
  const master = await importMasterKey(masterB64);
  const dek = await unwrapUserKey(master, await createWrappedUserKey(master, USER), USER);
  const aad = rowAad("accounts", USER, "a");
  const sealed = await encryptPayload(dek, aad, { balance: 100 });
  const [v, iv, ct] = sealed.split(".");
  const bytes = b64urlDecode(ct);
  bytes[0] ^= 0x01; // altera un byte real del texto cifrado
  await assertRejects(() => decryptPayload(dek, aad, `${v}.${iv}.${b64urlEncode(bytes)}`));
});

Deno.test("la clave maestra debe tener 32 bytes", async () => {
  await assertRejects(() => importMasterKey(btoa("corta")));
});

Deno.test("sha256 y uuidv7", async () => {
  assertEquals(await sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  const a = uuidv7(1_700_000_000_000);
  const b = uuidv7(1_700_000_000_001);
  assertMatch(a, /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert(a < b, "los UUIDv7 se ordenan por tiempo");
});
