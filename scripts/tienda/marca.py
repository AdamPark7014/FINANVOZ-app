"""Lo común de los gráficos de tienda de Finanvoz: colores, degradado, ícono y letra.

Lo usan `iconos-tienda.py`, `grafico-funciones.py` y `enmarcar.py`. Solo Pillow (`py -3 -m pip install pillow`).
La letra es Inter (OFL) y se baja una vez de google/fonts a una caché fuera del repositorio (876 KB, no entra en
git); si no hay red se usa la del sistema.
"""

from __future__ import annotations

import hashlib
import os
import shutil
import subprocess
import tempfile
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

RAIZ = Path(__file__).resolve().parents[2]
MARCA = RAIZ / "assets" / "marca"

# Colores de `assets/marca/README.md`.
CLARO = (0x14, 0xA3, 0x7F)
ACENTO = (0x0E, 0x8A, 0x6E)
OSCURO = (0x0A, 0x6B, 0x57)
BLANCO = (0xFF, 0xFF, 0xFF)

# Inter variable (opsz, wght), fijada a un commit de google/fonts y a su SHA-256.
FUENTE_URL = (
    "https://github.com/google/fonts/raw/45e3d5269e4a17d823f6d84470bc084dc5ae46f6/ofl/inter/"
    "Inter%5Bopsz%2Cwght%5D.ttf"
)
FUENTE_SHA256 = "29160a80ff49ddcab2c97711247e08b1fab27a484a329ce8b813d820dc559031"
FUENTE_ARCHIVO = "Inter-variable.ttf"

# Respaldo sin red: letras del sistema (Windows, macOS, Linux).
FUENTES_SISTEMA = [
    "C:/Windows/Fonts/segoeuib.ttf",
    "C:/Windows/Fonts/arialbd.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/Library/Fonts/Arial Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
]


def cache_fuentes() -> Path:
    carpeta = os.environ.get("FINANVOZ_FUENTES")
    ruta = Path(carpeta) if carpeta else Path(tempfile.gettempdir()) / "finanvoz-fuentes"
    ruta.mkdir(parents=True, exist_ok=True)
    return ruta


def _sha256(ruta: Path) -> str:
    h = hashlib.sha256()
    with ruta.open("rb") as fh:
        for trozo in iter(lambda: fh.read(1 << 20), b""):
            h.update(trozo)
    return h.hexdigest()


def _descargar(url: str, destino: Path) -> None:
    """urllib (con los certificados de certifi si está instalado) y, si falla el TLS de Python, curl."""
    try:
        contexto = None
        try:
            import certifi  # type: ignore
            import ssl

            contexto = ssl.create_default_context(cafile=certifi.where())
        except ImportError:
            pass
        with urllib.request.urlopen(url, timeout=60, context=contexto) as resp, destino.open("wb") as fh:
            shutil.copyfileobj(resp, fh)
        return
    except (OSError, ValueError) as exc:
        if shutil.which("curl") is None:
            raise OSError(f"{exc}; y no hay curl") from exc
    subprocess.run(["curl", "-fsSL", "--retry", "3", "-o", str(destino), url], check=True)


def ruta_fuente() -> Path | None:
    """Inter en la caché (la baja si falta o si el SHA no coincide); `None` si no hay red."""
    destino = cache_fuentes() / FUENTE_ARCHIVO
    if destino.exists() and _sha256(destino) == FUENTE_SHA256:
        return destino
    temporal = destino.with_suffix(".parcial")
    try:
        _descargar(FUENTE_URL, temporal)
        if _sha256(temporal) != FUENTE_SHA256:
            temporal.unlink(missing_ok=True)
            print("AVISO: el SHA-256 de Inter no coincide; uso la letra del sistema")
            return None
        temporal.replace(destino)
        return destino
    except (OSError, subprocess.CalledProcessError) as exc:
        temporal.unlink(missing_ok=True)
        print(f"AVISO: no pude bajar Inter ({exc}); uso la letra del sistema")
        return None


def fuente(tamano: int, peso: str = "Bold") -> ImageFont.FreeTypeFont:
    """Inter al peso pedido (Regular, Medium, SemiBold, Bold, ExtraBold); si no, una negrita del sistema."""
    ruta = ruta_fuente()
    if ruta is not None:
        f = ImageFont.truetype(str(ruta), tamano)
        try:
            nombres = f.get_variation_names()
            objetivo = peso.encode() if nombres and isinstance(nombres[0], bytes) else peso
            f.set_variation_by_name(objetivo)
            return f
        except Exception:  # noqa: BLE001 - FreeType sin variaciones: se queda en Regular
            return f
    for candidata in FUENTES_SISTEMA:
        if Path(candidata).exists():
            return ImageFont.truetype(candidata, tamano)
    return ImageFont.load_default(size=tamano)


def degradado(ancho: int, alto: int, de=CLARO, a=OSCURO, diagonal: bool = True) -> Image.Image:
    """Degradado de marca: diagonal (como el ícono) o vertical. Lineal: se calcula chico y se escala."""
    base = 256
    pequeno = Image.new("RGB", (base, base))
    px = pequeno.load()
    for y in range(base):
        for x in range(base):
            t = (x + y) / (2 * (base - 1)) if diagonal else y / (base - 1)
            px[x, y] = tuple(round(de[i] + (a[i] - de[i]) * t) for i in range(3))
    return pequeno.resize((ancho, alto), Image.Resampling.BICUBIC)


def icono_cuadrado(tamano: int) -> Image.Image:
    """El ícono a sangre (sin esquinas transparentes): el PNG de 1024 compuesto sobre su propio degradado."""
    origen = Image.open(MARCA / "icono-1024.png").convert("RGBA")
    fondo = degradado(origen.width, origen.height).convert("RGBA")
    fondo.alpha_composite(origen)
    return fondo.convert("RGB").resize((tamano, tamano), Image.Resampling.LANCZOS)


def mascara_redondeada(ancho: int, alto: int, radio: int) -> Image.Image:
    escala = 4
    m = Image.new("L", (ancho * escala, alto * escala), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, ancho * escala - 1, alto * escala - 1), radio * escala, fill=255)
    return m.resize((ancho, alto), Image.Resampling.LANCZOS)


def icono_redondeado(tamano: int) -> Image.Image:
    """El ícono con las esquinas del SVG maestro (radio 224 de 1024), con alfa, para ponerlo sobre un fondo."""
    cuadrado = icono_cuadrado(tamano).convert("RGBA")
    cuadrado.putalpha(mascara_redondeada(tamano, tamano, round(tamano * 224 / 1024)))
    return cuadrado


def partir_lineas(texto: str, letra: ImageFont.FreeTypeFont, ancho_max: int) -> list[str]:
    """Reparte el texto en líneas que caben en `ancho_max` (sin partir palabras). Si caben en dos, las
    equilibra para que no quede una palabra sola al final."""
    palabras = texto.split()
    if letra.getlength(texto) <= ancho_max:
        return [texto]
    mejor: list[str] | None = None
    for corte in range(1, len(palabras)):
        a, b = " ".join(palabras[:corte]), " ".join(palabras[corte:])
        if letra.getlength(a) <= ancho_max and letra.getlength(b) <= ancho_max:
            diferencia = abs(letra.getlength(a) - letra.getlength(b))
            if mejor is None or diferencia < mejor[0]:
                mejor = [diferencia, a, b]  # type: ignore[list-item]
    if mejor is not None:
        return [mejor[1], mejor[2]]
    lineas: list[str] = []
    actual = ""
    for palabra in palabras:
        prueba = f"{actual} {palabra}".strip()
        if letra.getlength(prueba) <= ancho_max or not actual:
            actual = prueba
        else:
            lineas.append(actual)
            actual = palabra
    if actual:
        lineas.append(actual)
    return lineas
