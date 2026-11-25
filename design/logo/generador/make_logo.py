"""Logo de Balance — "Dos mitades": una moneda partida en dos mitades desplazadas
(lo que entra y lo que sale, en balance). Genera todas las variantes en SVG.
Uso: python -I make_logo.py <Quicksand[wght].ttf> <carpeta_salida>
"""
import math, os, sys
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

FONT, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)

# Paleta azul minimalista (v2): azul marino arriba y verde apagado abajo. Mismos colores que los tokens.
C = {
    "blue": "#1f3f78", "green": "#2f7a59", "green_on_blue": "#a3cdb6",
    "ink": "#15181d", "white": "#ffffff", "dark": "#111317",
    "blue_dark": "#8aa3d1", "green_dark": "#6fb08f", "grey": "#bdbdbd",
}

# ── Símbolo (rejilla 100×100): círculo r=40, mitades separadas 7 y desplazadas ±5 ──
R, GAP, SHIFT, ROUND = 40.0, 7.0, 5.0, 3.0

def half(cx, cy, top):
    """Media moneda con las esquinas del corte redondeadas (radio ROUND)."""
    r = R - ROUND                       # se dibuja más pequeña y un trazo redondo la engorda
    d = GAP / 2 + ROUND                 # distancia del centro al borde plano (ya contraído)
    dx = math.sqrt(r * r - d * d)
    y = cy - d if top else cy + d
    sweep = 1 if top else 0
    return (f'M{cx-dx:.3f},{y:.3f}A{r},{r} 0 0,{sweep} {cx+dx:.3f},{y:.3f}Z')

def symbol(top_color, bottom_color, dx=0.0, dy=0.0, s=1.0):
    cx, cy = 50.0, 50.0
    t = half(cx - SHIFT, cy, True)
    b = half(cx + SHIFT, cy, False)
    sw = 2 * ROUND
    return (f'<g transform="translate({dx:.2f} {dy:.2f}) scale({s:.4f})" stroke-linejoin="round">'
            f'<path d="{t}" fill="{top_color}" stroke="{top_color}" stroke-width="{sw}"/>'
            f'<path d="{b}" fill="{bottom_color}" stroke="{bottom_color}" stroke-width="{sw}"/></g>')

SYM_BOX = (50 - R - SHIFT, 50 - R, 50 + R + SHIFT, 50 + R)   # 5,10 → 95,90

# ── Nombre: "balance" en Quicksand 700, a trazos ──
font = instantiateVariableFont(TTFont(FONT), {"wght": 700}, inplace=False)
gs, cmap = font.getGlyphSet(), font.getBestCmap()
upm = font["head"].unitsPerEm
def glyph_top(ch):
    bp = BoundsPen(gs); gs[cmap[ord(ch)]].draw(bp); return bp.bounds[3]
XH, ASC = glyph_top("x"), glyph_top("b")

def word(text, x0, baseline, xheight, color, track=-0.005):
    s = xheight / XH
    pen = SVGPathPen(gs); x = 0.0
    for ch in text:
        g = gs[cmap[ord(ch)]]
        g.draw(TransformPen(pen, (s, 0, 0, -s, x0 + x * s, baseline)))
        x += g.width + track * upm
    return f'<path d="{pen.getCommands()}" fill="{color}"/>', (x - track * upm) * s, ASC * s

def svg(vx, vy, w, h, body, scale=1, bg=None):
    rect = f'<rect x="{vx}" y="{vy}" width="{w}" height="{h}" fill="{bg}"/>' if bg else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vx:.1f} {vy:.1f} {w:.1f} {h:.1f}" '
            f'width="{w*scale:.0f}" height="{h*scale:.0f}">{rect}{body}</svg>\n')

def save(name, content):
    open(os.path.join(OUT, name), "w").write(content)

PAD = 6
X0, Y0, X1, Y1 = SYM_BOX

# Símbolo suelto
for name, (a, b) in {
    "simbolo": (C["blue"], C["green"]),
    "simbolo-oscuro": (C["blue_dark"], C["green_dark"]),
    "simbolo-tinta": (C["ink"], C["ink"]),
    "simbolo-blanco": (C["white"], C["white"]),
    "simbolo-azul": (C["blue"], C["blue"]),
}.items():
    save(f"balance-{name}.svg", svg(X0 - PAD, Y0 - PAD, X1 - X0 + 2 * PAD, Y1 - Y0 + 2 * PAD, symbol(a, b), 4))

# Proporción del nombre: altura de x = 40 % del símbolo, línea base en el corte inferior óptico
XHEIGHT = 34.0
BASELINE = 50 + XHEIGHT / 2

# Nombre suelto
for name, color in {"wordmark-tinta": C["ink"], "wordmark-blanco": C["white"], "wordmark-azul": C["blue"]}.items():
    p, w, asc = word("balance", PAD, PAD + 60, XHEIGHT, color)
    save(f"balance-{name}.svg", svg(0, 0, w + 2 * PAD, 60 + 2 * PAD + 10, p, 4))

# Logo horizontal
def horizontal(top, bottom, text_color):
    gap = 18
    p, w, _ = word("balance", X1 + gap, BASELINE, XHEIGHT, text_color)
    x0, y0 = X0 - PAD, Y0 - PAD
    return svg(x0, y0, X1 + gap + w + PAD - x0, Y1 + PAD - y0, symbol(top, bottom) + p, 3)

save("balance-logo-horizontal.svg", horizontal(C["blue"], C["green"], C["ink"]))
save("balance-logo-horizontal-oscuro.svg", horizontal(C["blue_dark"], C["green_dark"], C["white"]))
save("balance-logo-horizontal-tinta.svg", horizontal(C["ink"], C["ink"], C["ink"]))
save("balance-logo-horizontal-blanco.svg", horizontal(C["white"], C["white"], C["white"]))

# Logo vertical: símbolo encima, nombre centrado debajo
def vertical(top, bottom, text_color):
    p0, w, asc = word("balance", 0, 0, XHEIGHT * 0.9, text_color)
    W = max(w, X1 - X0) + 2 * PAD + 8
    sx = (W - 100) / 2
    baseline = Y1 + 20 + asc
    p, _, _ = word("balance", (W - w) / 2, baseline, XHEIGHT * 0.9, text_color)
    return svg(0, Y0 - PAD, W, baseline + 12 + PAD - (Y0 - PAD), symbol(top, bottom, sx, 0) + p, 3)

save("balance-logo-vertical.svg", vertical(C["blue"], C["green"], C["ink"]))
save("balance-logo-vertical-oscuro.svg", vertical(C["blue_dark"], C["green_dark"], C["white"]))

# Iconos de app (a sangre: iOS, Android y navegadores aplican su máscara)
def icon(size, bg, top, bottom, scale=0.58, rx=0):
    s = size / 100 * scale
    d = size / 2 - 50 * s
    rect = f'<rect width="{size}" height="{size}" rx="{rx}" fill="{bg}"/>' if bg else ""
    return svg(0, 0, size, size, rect + symbol(top, bottom, d, d, s))

save("app-icon.svg", icon(1024, C["blue"], C["white"], C["green_on_blue"]))
save("app-icon-oscuro.svg", icon(1024, C["dark"], C["blue_dark"], C["green_dark"]))
save("app-icon-tintado.svg", icon(1024, None, C["white"], C["grey"]))
save("app-icon-maskable.svg", icon(512, C["blue"], C["white"], C["green_on_blue"], scale=0.48))
save("favicon.svg", icon(64, C["blue"], C["white"], C["green_on_blue"], scale=0.72, rx=14))
print("ok", len(os.listdir(OUT)))
