# Generador del logo (moneda en dos mitades)

- `make_logo.py`: crea los SVG. Necesita `fonttools` y la fuente Quicksand (OFL) de Google Fonts:
  `python -I make_logo.py Quicksand[wght].ttf ../svg`
- `render.mjs`: exporta los PNG con `@resvg/resvg-js@2.6.2`:
  `node render.mjs ../svg ../png`
