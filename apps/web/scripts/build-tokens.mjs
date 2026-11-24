// Genera src/styles/tokens.css y src/styles/components.css a partir del sistema de diseño
// (design/tokens/tokens.json y design/components/bundle.css). No editar los generados a mano.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const out = resolve(root, "apps/web/src/styles");
mkdirSync(out, { recursive: true });

const tokens = JSON.parse(readFileSync(resolve(root, "design/tokens/tokens.json"), "utf8"));

const ref = (v) => v.replace(/^\{(.+)\}$/, "var(--$1)");
const light = [];
const dark = [];
for (const t of [...tokens.color.tokens, ...(tokens.shadow?.tokens ?? [])]) {
  if (typeof t.value === "string") {
    light.push(`--${t.name}:${ref(t.value)};`);
    continue;
  }
  light.push(`--${t.name}:${ref(t.value.light)};`);
  dark.push(`--${t.name}:${ref(t.value.dark ?? t.value.light)};`);
}
const fixed = [...tokens.spacing.tokens, ...tokens.radius.tokens].map((t) => `--${t.name}:${t.value};`);
fixed.push(`--font-sans:${tokens.type.families.sans};`);

let css = "/* GENERADO por scripts/build-tokens.mjs desde design/tokens/tokens.json. No editar. */\n";
css += `:root{color-scheme:light;${light.join("")}}\n`;
css += `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){color-scheme:dark;${dark.join("")}}}\n`;
css += `:root[data-theme="dark"]{color-scheme:dark;${dark.join("")}}\n`;
css += `:root{${fixed.join("")}}\n`;
for (const group of tokens.type.groups) {
  for (const s of group.styles) {
    let p = `font-family:var(--font-sans);font-size:${s.fontSize};line-height:${s.lineHeight};font-weight:${s.fontWeight};`;
    if (s.letterSpacing) p += `letter-spacing:${s.letterSpacing};`;
    if (group.name === "Importes") p += "font-variant-numeric:tabular-nums;";
    css += `.${s.name}{${p}}\n`;
  }
}
writeFileSync(resolve(out, "tokens.css"), css);
copyFileSync(resolve(root, "design/components/bundle.css"), resolve(out, "components.css"));
console.log(`tokens.css: ${tokens.color.tokens.length} colores · components.css copiado`);
