"""Íconos de tienda a sangre, sin transparencia en el fondo.

    py -3 scripts/tienda/iconos-tienda.py [--verificar]

- `assets/marca/icono-512.png`: Google Play (PNG de 32 bits, 512 × 512, alfa opaco en todo el lienzo).
- `assets/marca/icono-1024.png`: App Store (PNG RGB de 1024 × 1024, sin canal alfa: ITMS-90717).

El glifo (globo y barras) sale del PNG de 1024 que ya está en `assets/marca`; el fondo es el degradado del SVG
maestro (`#14A37F` → `#0A6B57`, diagonal), así que si el PNG ya es a sangre el script no cambia nada. Para
rehacer el glifo desde `icono.svg`, renderízalo a 1024 con rsvg-convert o un navegador y vuelve a correr esto.
`--verificar` solo comprueba (sale con 1 si algo no cumple): lo usa el pipeline de capturas.
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from marca import MARCA, icono_cuadrado  # noqa: E402


def verificar() -> list[str]:
    fallas: list[str] = []
    play = Image.open(MARCA / "icono-512.png")
    if play.size != (512, 512):
        fallas.append(f"icono-512.png mide {play.size}, no 512×512")
    if play.mode != "RGBA":
        fallas.append(f"icono-512.png es {play.mode}; Play pide PNG de 32 bits (RGBA)")
    elif play.getchannel("A").getextrema() != (255, 255):
        fallas.append("icono-512.png tiene píxeles transparentes; Play lo quiere a sangre")
    if (MARCA / "icono-512.png").stat().st_size > 1024 * 1024:
        fallas.append("icono-512.png pesa más de 1 MB")
    ios = Image.open(MARCA / "icono-1024.png")
    if ios.size != (1024, 1024):
        fallas.append(f"icono-1024.png mide {ios.size}, no 1024×1024")
    if ios.mode != "RGB":
        fallas.append(f"icono-1024.png es {ios.mode}; App Store exige PNG sin canal alfa (ITMS-90717)")
    return fallas


def main() -> None:
    if "--verificar" not in sys.argv:
        base = icono_cuadrado(1024)
        base.save(MARCA / "icono-1024.png", optimize=True)
        play = base.resize((512, 512), Image.Resampling.LANCZOS).convert("RGBA")
        play.save(MARCA / "icono-512.png", optimize=True)
        print("escritos assets/marca/icono-1024.png (RGB) y icono-512.png (RGBA opaco)")
    fallas = verificar()
    for f in fallas:
        print(f"FALLA: {f}")
    if fallas:
        sys.exit(1)
    print("íconos de tienda: ok (512 RGBA opaco, 1024 RGB sin alfa)")


if __name__ == "__main__":
    main()
