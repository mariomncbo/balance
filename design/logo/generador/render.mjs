// Exporta PNG desde los SVG del logo y genera una hoja de contacto para revisarlos.
// Uso: node render.mjs <carpeta_svg> <carpeta_png>
import { Resvg } from "@resvg/resvg-js";
import fs from "node:fs";
import path from "node:path";

const [, , SRC, OUT] = process.argv;
fs.mkdirSync(OUT, { recursive: true });
const read = (f) => fs.readFileSync(path.join(SRC, f), "utf8");
const png = (svg, width, file) => {
  const out = new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng();
  fs.writeFileSync(path.join(OUT, file), out);
};

// Iconos de app
png(read("app-icon.svg"), 1024, "app-icon-ios-1024.png");
png(read("app-icon-oscuro.svg"), 1024, "app-icon-ios-oscuro-1024.png");
png(read("app-icon-tintado.svg"), 1024, "app-icon-ios-tintado-1024.png");
png(read("app-icon.svg"), 180, "apple-touch-icon-180.png");
png(read("app-icon.svg"), 192, "pwa-192.png");
png(read("app-icon.svg"), 512, "pwa-512.png");
png(read("app-icon-maskable.svg"), 512, "pwa-maskable-512.png");
png(read("favicon.svg"), 32, "favicon-32.png");
png(read("favicon.svg"), 16, "favicon-16.png");
// Logos en PNG (para documentos y redes)
png(read("balance-logo-horizontal.svg"), 1200, "balance-logo-horizontal.png");
png(read("balance-logo-horizontal-oscuro.svg"), 1200, "balance-logo-horizontal-oscuro.png");
png(read("balance-simbolo.svg"), 512, "balance-simbolo.png");

// Hoja de contacto
const inner = (f) => read(f).replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
const vb = (f) => read(f).match(/viewBox="([^"]+)"/)[1];
const cell = (f, x, y, w, h, bg) => {
  const [vx, vy, vw, vh] = vb(f).split(" ").map(Number);
  const s = Math.min((w - 40) / vw, (h - 40) / vh);
  const dx = x + (w - vw * s) / 2 - vx * s, dy = y + (h - vh * s) / 2 - vy * s;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="24" fill="${bg}"/><g transform="translate(${dx} ${dy}) scale(${s})">${inner(f)}</g>`;
};
const L = "#f5f6f8", D = "#111317", V = "#1f3f78";
let b = "";
b += cell("balance-logo-horizontal.svg", 20, 20, 700, 220, L);
b += cell("balance-logo-horizontal-oscuro.svg", 740, 20, 700, 220, D);
b += cell("balance-simbolo.svg", 20, 260, 220, 220, "#ffffff");
b += cell("balance-simbolo-oscuro.svg", 260, 260, 220, 220, D);
b += cell("balance-simbolo-tinta.svg", 500, 260, 220, 220, L);
b += cell("balance-simbolo-blanco.svg", 740, 260, 220, 220, V);
b += cell("app-icon.svg", 980, 260, 220, 220, L);
b += cell("app-icon-oscuro.svg", 1220, 260, 220, 220, L);
b += cell("balance-logo-vertical.svg", 20, 500, 340, 300, L);
b += cell("balance-logo-vertical-oscuro.svg", 380, 500, 340, 300, D);
b += cell("balance-wordmark-tinta.svg", 740, 500, 340, 140, L);
b += cell("balance-logo-horizontal-blanco.svg", 1100, 500, 340, 140, V);
b += cell("favicon.svg", 740, 660, 140, 140, "#ffffff");
b += cell("app-icon-tintado.svg", 900, 660, 140, 140, "#3a3a3c");
const sheet = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1460 820" width="1460" height="820"><rect width="1460" height="820" fill="#e1e4e9"/>${b}</svg>`;
png(sheet, 1460, "_hoja.png");
// Favicon ampliado para ver cómo se lee a 16 px
const f16 = new Resvg(read("favicon.svg"), { fitTo: { mode: "width", value: 16 } }).render();
console.log("ok", fs.readdirSync(OUT).length, "png; favicon16", f16.width, "x", f16.height);
