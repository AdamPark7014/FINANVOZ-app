"""Gráfico de funciones de Google Play (1024 × 500), según `docs/tienda/capturas.md`.

    py -3 scripts/tienda/grafico-funciones.py [salida.png]

Degradado de marca, el ícono redondeado y la frase «Cuánto puedes gastar hoy» (el subtítulo de la ficha) con la
marca arriba. Sin capturas encimadas ni precios. Por omisión escribe `assets/marca/grafico-funciones-1024x500.png`.
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
from marca import BLANCO, MARCA, degradado, fuente, icono_redondeado, partir_lineas  # noqa: E402

ANCHO, ALTO = 1024, 500
FRASE = "Cuánto puedes gastar hoy"
NOMBRE = "Finanvoz"


def main() -> None:
    salida = Path(sys.argv[1]) if len(sys.argv) > 1 else MARCA / "grafico-funciones-1024x500.png"
    lienzo = degradado(ANCHO, ALTO).convert("RGBA")

    # Un aro suave a la derecha, fuera del centro (ahí Play pone el botón de reproducir si hay video).
    capa = Image.new("RGBA", (ANCHO * 2, ALTO * 2), (0, 0, 0, 0))
    ImageDraw.Draw(capa).ellipse((1560, -520, 2560, 480), outline=(255, 255, 255, 34), width=120)
    lienzo.alpha_composite(capa.resize((ANCHO, ALTO), Image.Resampling.LANCZOS))

    icono = icono_redondeado(236)
    margen = 72
    lienzo.alpha_composite(icono, (margen, (ALTO - icono.height) // 2))

    dibujo = ImageDraw.Draw(lienzo)
    x = margen + icono.width + 56
    ancho_texto = ANCHO - x - margen
    marca = fuente(34, "SemiBold")
    titulo = fuente(78, "Bold")
    lineas = partir_lineas(FRASE, titulo, ancho_texto)
    alto_linea = 88
    alto_bloque = 34 + 22 + alto_linea * len(lineas)
    y = (ALTO - alto_bloque) // 2
    dibujo.text((x, y), NOMBRE.upper(), font=marca, fill=(*BLANCO, 210))
    y += 34 + 22
    for linea in lineas:
        dibujo.text((x, y), linea, font=titulo, fill=BLANCO)
        y += alto_linea

    salida.parent.mkdir(parents=True, exist_ok=True)
    lienzo.convert("RGB").save(salida, optimize=True)
    print(f"escrito {salida} ({ANCHO}×{ALTO}, {salida.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
