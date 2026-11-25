// Cifrado envolvente de Balance (Web Crypto, AES-256-GCM).
//
// - Clave maestra (KEK): 32 bytes en base64, en el secreto BALANCE_MASTER_KEY.
// - Clave de datos (DEK): 32 bytes aleatorios por usuario, guardada en
//   public.user_keys cifrada con la KEK (dato asociado = "dek:<user_id>").
// - Cada fila se cifra con la DEK del usuario. Dato asociado = "<tabla>:<user_id>:<id>",
//   así una fila cifrada no se puede mover a otro usuario, tabla o id.
//
// Formato de texto cifrado: "v1.<iv base64url>.<ciphertext+tag base64url>".

const VERSION = "v1";
const IV_BYTES = 12;
type Bytes = Uint8Array<ArrayBuffer>;
const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64urlEncode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function b64urlDecode(text: string): Bytes {
  const b64 = text.replaceAll("-", "+").replaceAll("_", "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64Decode(text: string): Bytes {
  return b64urlDecode(text.replaceAll("+", "-").replaceAll("/", "_"));
}

async function importAesKey(raw: Bytes): Promise<CryptoKey> {
  if (raw.length !== 32) throw new Error("La clave debe tener 32 bytes");
  return await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function seal(key: CryptoKey, plain: Bytes, aad: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc.encode(aad) }, key, plain),
  );
  return `${VERSION}.${b64urlEncode(iv)}.${b64urlEncode(ct)}`;
}

async function open(key: CryptoKey, sealed: string, aad: string): Promise<Bytes> {
  const [version, ivPart, ctPart] = sealed.split(".");
  if (version !== VERSION || !ivPart || !ctPart) throw new Error("Formato de cifrado no reconocido");
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64urlDecode(ivPart), additionalData: enc.encode(aad) },
    key,
    b64urlDecode(ctPart),
  );
  return new Uint8Array(plain);
}

/** Importa la clave maestra desde su texto base64 (estándar o url). */
export async function importMasterKey(base64: string): Promise<CryptoKey> {
  return await importAesKey(b64Decode(base64.trim()));
}

/** Crea una DEK nueva para un usuario y la devuelve cifrada con la KEK. */
export async function createWrappedUserKey(master: CryptoKey, userId: string): Promise<string> {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  return await seal(master, raw, `dek:${userId}`);
}

/** Descifra la DEK de un usuario y la importa como clave AES. */
export async function unwrapUserKey(master: CryptoKey, wrapped: string, userId: string): Promise<CryptoKey> {
  return await importAesKey(await open(master, wrapped, `dek:${userId}`));
}

export type TableName = "accounts" | "transactions" | "recurring" | "goals" | "monthly_reports" | "user_settings";

export function rowAad(table: TableName, userId: string, rowId: string): string {
  return `${table}:${userId}:${rowId}`;
}

/** Cifra un objeto JSON para guardarlo en `payload`. */
export async function encryptPayload(dek: CryptoKey, aad: string, data: unknown): Promise<string> {
  return await seal(dek, enc.encode(JSON.stringify(data)), aad);
}

/** Descifra un `payload`. Lanza si la clave, el dato asociado o el contenido no cuadran. */
export async function decryptPayload<T>(dek: CryptoKey, aad: string, sealed: string): Promise<T> {
  return JSON.parse(dec.decode(await open(dek, sealed, aad))) as T;
}

/** Hash SHA-256 en hex (para la clave del Atajo). */
export async function sha256Hex(text: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(text)));
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * UUID determinista a partir de un texto (los 16 primeros bytes de su SHA-256, con los bits de versión 5 y variante).
 * El mismo texto da siempre el mismo id: sirve para que un mismo cobro no se pueda apuntar dos veces.
 */
export async function seededUuid(seed: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(seed))).slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** UUIDv7: ordenado en el tiempo (mejor para los índices que UUIDv4). */
export function uuidv7(now = Date.now()): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let ts = now;
  for (let i = 5; i >= 0; i--) {
    bytes[i] = ts & 0xff;
    ts = Math.floor(ts / 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
