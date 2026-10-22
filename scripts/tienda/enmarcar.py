"""Enmarca las capturas crudas de Maestro para las tiendas.

    py -3 scripts/tienda/enmarcar.py --plataforma ios-6.9 --entrada <carpeta con los PNG de Maestro>
    py -3 scripts/tienda/enmarcar.py --plataforma android-telefono --entrada <carpeta>

Entrada: la carpeta que deja el flujo de capturas (`maestro-capturas` o `maestro-capturas-android`), con los PNG
de `takeScreenshot` en `claro/` y `oscuro/` (o sueltos). Salida: `docs/tienda/capturas/<plataforma>/NN-nombre.png`
con el degradado de marca de fondo, un titular corto arriba y la captura con esquinas redondeadas, al tamaño exacto
de cada tienda (iOS 1320 × 2868; Android 1080 × 1920). Orden, titulares y nombres: `capturas-plan.json`.

Si falta alguna captura del plan se avisa y se sigue (la ficha admite de 2 a 8). `--salida` cambia la carpeta;
`--solo nombre` enmarca una sola.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
from marca import BLANCO, RAIZ, degradado, fuente, mascara_redondeada, partir_lineas  # noqa: E402

PLAN = Path(__file__).resolve().parent / "capturas-plan.json"
SALIDA = RAIZ / "docs" / "tienda" / "capturas"

# Geometría por plataforma: margen lateral, tamaño de letra del titular, alto de línea, margen superior.
GEOMETRIA = {
    "ios-6.9": {"margen": 100, "letra": 92, "linea": 108, "arriba": 150, "radio": 0.105},
    "android-telefono": {"margen": 84, "letra": 70, "linea": 84, "arriba": 110, "radio": 0.075},
}


def buscar(entrada: Path, nombres: list[str], tema: str) -> Path | None:
    """La primera captura que exista, por prioridad; primero en la subcarpeta del tema, luego en cualquier lado."""
    for nombre in nombres:
        candidatas = sorted(entrada.rglob(f"{nombre}.png"))
        del_tema = [c for c in candidatas if tema in c.parent.parts]
        if del_tema:
            return del_tema[0]
        if candidatas and tema == "claro":
            sin_tema = [c for c in candidatas if "oscuro" not in c.parent.parts]
            if sin_tema:
                return sin_tema[0]
    return None


def enmarcar(captura: Path, titulo: str, ancho: int, alto: int, geo: dict) -> Image.Image:
    lienzo = degradado(ancho, alto, diagonal=False).convert("RGBA")
    dibujo = ImageDraw.Draw(lienzo)
    letra = fuente(geo["letra"], "Bold")
    lineas = partir_lineas(titulo, letra, ancho - 2 * geo["margen"])
    y = geo["arriba"]
    for linea in lineas:
        w = letra.getlength(linea)
        dibujo.text(((ancho - w) / 2, y), linea, font=letra, fill=BLANCO)
        y += geo["linea"]
    y += geo["linea"] * 0.55

    pantalla = Image.open(captura).convert("RGBA")
    ancho_cap = ancho - 2 * geo["margen"]
    alto_cap = round(pantalla.height * ancho_cap / pantalla.width)
    pantalla = pantalla.resize((ancho_cap, alto_cap), Image.Resampling.LANCZOS)
    radio = round(ancho_cap * geo["radio"])
    pantalla.putalpha(mascara_redondeada(ancho_cap, alto_cap, radio))

    # Sombra suave debajo de la pantalla.
    sombra = Image.new("RGBA", (ancho, alto), (0, 0, 0, 0))
    ImageDraw.Draw(sombra).rounded_rectangle(
        (geo["margen"], y + 18, geo["margen"] + ancho_cap, y + 18 + alto_cap), radio, fill=(0, 0, 0, 110)
    )
    lienzo.alpha_composite(sombra.filter(ImageFilter.GaussianBlur(28)))
    lienzo.alpha_composite(pantalla, (geo["margen"], round(y)))
    return lienzo.convert("RGB")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--plataforma", required=True, choices=sorted(GEOMETRIA))
    p.add_argument("--entrada", required=True, type=Path)
    p.add_argument("--salida", type=Path)
    p.add_argument("--solo")
    args = p.parse_args()

    plan = json.loads(PLAN.read_text(encoding="utf-8"))[args.plataforma]
    salida = args.salida or SALIDA / args.plataforma
    salida.mkdir(parents=True, exist_ok=True)
    geo = GEOMETRIA[args.plataforma]
    hechas, faltan = [], []
    for item in plan["capturas"]:
        if args.solo and item["nombre"] != args.solo:
            continue
        origen = buscar(args.entrada, item["archivos"], item.get("tema", "claro"))
        if origen is None:
            faltan.append(f"{item['nombre']} (busqué {', '.join(item['archivos'])} en {item.get('tema', 'claro')})")
            continue
        imagen = enmarcar(origen, item["titulo"], plan["ancho"], plan["alto"], geo)
        destino = salida / f"{item['nombre']}.png"
        imagen.save(destino, optimize=True)
        hechas.append(f"{destino.relative_to(RAIZ) if destino.is_relative_to(RAIZ) else destino} ← {origen.name}")
    for h in hechas:
        print("ok ", h)
    for f in faltan:
        print("falta", f)
    if not hechas:
        sys.exit("No se enmarcó ninguna captura: revisa --entrada y los nombres de takeScreenshot")


if __name__ == "__main__":
    main()
