// Genera los colores del Asset Catalog (con variante oscura) y Design/Tokens.swift
// a partir de design/tokens/tokens.json. No editar a mano los ficheros generados.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const app = resolve(root, "apps/ios/balance/balance");
const tokens = JSON.parse(readFileSync(resolve(root, "design/tokens/tokens.json"), "utf8"));

const byName = new Map(tokens.color.tokens.map((t) => [t.name, t.value]));
const PRIMITIVE = /^(neutral|accent|income|expense|warning)-\d+$/;

/** Resuelve "{neutral-2}" hasta llegar a un valor de color real. */
function resolve_(value, theme) {
  const m = /^\{(.+)\}$/.exec(value);
  if (!m) return value;
  const next = byName.get(m[1]);
  if (!next) throw new Error(`Token desconocido: ${m[1]}`);
  return resolve_(typeof next === "string" ? next : (next[theme] ?? next.light), theme);
}

function components(css) {
  const hex = /^#([0-9a-f]{6})$/i.exec(css);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  const rgba = /^rgba?\(([^)]+)\)$/.exec(css);
  if (rgba) {
    const [r, g, b, a = "1"] = rgba[1].split(",").map((s) => s.trim());
    return { r: Number(r), g: Number(g), b: Number(b), a: Number(a) };
  }
  throw new Error(`Color no reconocido: ${css}`);
}

const f = (n) => (n / 255).toFixed(3);
const entry = (c, dark) => ({
  ...(dark ? { appearances: [{ appearance: "luminosity", value: "dark" }] } : {}),
  color: { "color-space": "srgb", components: { red: f(c.r), green: f(c.g), blue: f(c.b), alpha: c.a.toFixed(3) } },
  idiom: "universal",
});

const camel = (s) => s.replace(/-(\w)/g, (_, c) => c.toUpperCase());

// Colores semánticos → Assets.xcassets/Tokens/<nombre>.colorset
const colorsDir = resolve(app, "Assets.xcassets/Tokens");
rmSync(colorsDir, { recursive: true, force: true });
mkdirSync(colorsDir, { recursive: true });
writeFileSync(resolve(colorsDir, "Contents.json"), JSON.stringify({ info: { author: "xcode", version: 1 } }, null, 2));
const semantic = tokens.color.tokens.filter((t) => !PRIMITIVE.test(t.name));
for (const t of semantic) {
  const dir = resolve(colorsDir, `${t.name}.colorset`);
  mkdirSync(dir, { recursive: true });
  const light = components(resolve_(typeof t.value === "string" ? t.value : t.value.light, "light"));
  const dark = components(resolve_(typeof t.value === "string" ? t.value : t.value.dark, "dark"));
  writeFileSync(
    resolve(dir, "Contents.json"),
    JSON.stringify({ colors: [entry(light, false), entry(dark, true)], info: { author: "xcode", version: 1 } }, null, 2),
  );
}

const px = (v) => Number(String(v).replace("px", ""));
let swift = "// GENERADO por apps/ios/scripts/build-tokens.mjs desde design/tokens/tokens.json. No editar.\n";
swift += "import SwiftUI\n\n";
// Los colores no se declaran aquí: Xcode genera Color.bg, Color.surface, Color.accentText... desde el Asset Catalog.
swift += "enum Space {\n";
for (const t of tokens.spacing.tokens) swift += `    static let ${camel(t.name).replace("space", "s")}: CGFloat = ${px(t.value)}\n`;
swift += "}\n\nenum Radius {\n";
for (const t of tokens.radius.tokens) swift += `    static let ${camel(t.name).replace("radius", "").replace(/^./, (c) => c.toLowerCase())}: CGFloat = ${px(t.value)}\n`;
swift += "}\n\n/// Estilos de texto del sistema de diseño.\nenum BTextStyle {\n";
const styles = tokens.type.groups.flatMap((g) => g.styles);
for (const s of styles) swift += `    case ${camel(s.name)}\n`;
const sw = (w) => ({ 400: ".regular", 500: ".medium", 600: ".semibold", 700: ".bold", 800: ".heavy" })[w] ?? ".regular";
swift += "\n    var size: CGFloat {\n        switch self {\n";
for (const s of styles) swift += `        case .${camel(s.name)}: ${px(s.fontSize)}\n`;
swift += "        }\n    }\n\n    var lineHeight: CGFloat {\n        switch self {\n";
for (const s of styles) swift += `        case .${camel(s.name)}: ${px(s.lineHeight)}\n`;
swift += "        }\n    }\n\n    var weight: Font.Weight {\n        switch self {\n";
for (const s of styles) swift += `        case .${camel(s.name)}: ${sw(s.fontWeight)}\n`;
swift += "        }\n    }\n\n    var tracking: CGFloat {\n        switch self {\n";
for (const s of styles) swift += `        case .${camel(s.name)}: ${s.letterSpacing ? px(s.letterSpacing) : 0}\n`;
swift += "        }\n    }\n\n    var isAmount: Bool { self == .amountHero || self == .amountLg }\n}\n";
writeFileSync(resolve(app, "Design/Tokens.swift"), swift);
console.log(`${semantic.length} colores semánticos · ${styles.length} estilos de texto`);
