#!/usr/bin/env python3
"""Sube la ficha de Finanvoz a App Store Connect por API (idempotente: si existe, actualiza).

    py -3 scripts/tienda/asc-ficha.py                 # textos, categoría, edad, URLs y capturas de docs/tienda/capturas/ios-6.9
    py -3 scripts/tienda/asc-ficha.py --sin-capturas  # solo metadatos
    py -3 scripts/tienda/asc-ficha.py --prueba-subida # sube una imagen de prueba al set, espera COMPLETE y la borra
    py -3 scripts/tienda/asc-ficha.py --build 4       # además enlaza la build 1.0.0 (4) a la versión

Qué deja en la consola (app 6825850016, es-MX):
  - appStoreVersions: la versión editable queda como 1.0.0 (la consola la crea como «1.0»).
  - appStoreVersionLocalizations es-MX: description, keywords, promotionalText, supportUrl (marketingUrl vacío;
    whatsNew no: Apple no lo pide en la primera versión) con los .txt de docs/tienda/ios/.
  - appInfoLocalizations es-MX: name «Finanvoz», subtitle, privacyPolicyUrl.
  - appInfos: primaryCategory FINANCE, secondaryCategory PRODUCTIVITY.
  - ageRatingDeclarations: todo NONE / false (IOS-APP-STORE.md §5), resultado 4+.
  - appScreenshotSets APP_IPHONE_67 (Apple lo usa para 6.7" y 6.9": acepta 1320 × 2868) con los PNG de
    docs/tienda/capturas/ios-6.9 en orden alfabético: reserva, subida por partes y commit con MD5. Las capturas que
    ya están con el mismo nombre y checksum se quedan; las demás se borran.

Credenciales (nunca se imprimen): ASC_KEY_PATH + ASC_KEY_ID + ASC_ISSUER_ID, o las de GitHub Actions
(APP_STORE_CONNECT_PRIVATE_KEY con el texto del .p8, APP_STORE_CONNECT_KEY_ID, APP_STORE_CONNECT_ISSUER_ID). Sin
variables busca AuthKey_*.p8 en C:/dev/secrets/arta-ios (la llave «GitHub Actions ARTA», mismo equipo AHNW9K8745)
y usa el Issuer ID de IOS-APP-STORE.md §3. Lo que no cambia aquí: la etiqueta de privacidad (§6), la disponibilidad
por país, el precio y el envío a revisión: eso se hace en la consola.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from asc_signing import Asc, AscError, make_jwt  # noqa: E402

RAIZ = Path(__file__).resolve().parents[2]
TIENDA = RAIZ / "docs" / "tienda"
CAPTURAS = TIENDA / "capturas" / "ios-6.9"

BUNDLE_ID = "com.finanvoz.app"
LOCALE = "es-MX"
VERSION = "1.0.0"
NOMBRE = "Finanvoz"
PAGES = "https://adampark7014.github.io/FINANVOZ-app/"
AVISO_URL = PAGES + "aviso-de-privacidad.html"
SOPORTE_URL = PAGES + "soporte.html"
CATEGORIA = "FINANCE"
CATEGORIA_2 = "PRODUCTIVITY"
DISPLAY_TYPE = "APP_IPHONE_67"
# El Issuer ID no va al repositorio (es público): se lee de issuer-id.txt junto a la llave.
ISSUER_POR_OMISION = ""
SECRETOS_POR_OMISION = Path(os.environ.get("FINANVOZ_SECRETOS_IOS", "C:/dev/secrets/arta-ios"))

# Cuestionario de edad (IOS-APP-STORE.md §5): nada de esto aplica a una app de finanzas personales.
EDAD_ENUM = [
    "alcoholTobaccoOrDrugUseOrReferences",
    "contests",
    "gamblingSimulated",
    "horrorOrFearThemes",
    "matureOrSuggestiveThemes",
    "medicalOrTreatmentInformation",
    "profanityOrCrudeHumor",
    "sexualContentGraphicAndNudity",
    "sexualContentOrNudity",
    "violenceCartoonOrFantasy",
    "violenceRealistic",
    "violenceRealisticProlongedGraphicOrSadistic",
    "gunsOrOtherWeapons",
]
EDAD_BOOL = [
    "gambling",
    "lootBox",
    "unrestrictedWebAccess",
    "messagingAndChat",
    "parentalControls",
    "userGeneratedContent",
    "advertising",
    "ageAssurance",
    "healthOrWellnessTopics",
    "socialMedia",
]
ESTADOS_EDITABLES = {
    "PREPARE_FOR_SUBMISSION",
    "DEVELOPER_REJECTED",
    "REJECTED",
    "METADATA_REJECTED",
    "INVALID_BINARY",
    "WAITING_FOR_REVIEW",
}


class Sesion(Asc):
    """`Asc` con token que se renueva (el JWT dura 18 min; las capturas pueden tardar más)."""

    def __init__(self, key_path: str, key_id: str, issuer_id: str) -> None:
        self._cred = (key_path, key_id, issuer_id)
        self._desde = 0.0
        super().__init__("")
        self._renovar()

    def _renovar(self) -> None:
        self.token = make_jwt(*self._cred)
        self._desde = time.time()

    def call(self, method, path, body=None, query=None):  # type: ignore[override]
        if time.time() - self._desde > 900:
            self._renovar()
        return super().call(method, path, body, query)


def credenciales() -> tuple[str, str, str]:
    key_path = os.environ.get("ASC_KEY_PATH", "")
    key_id = os.environ.get("ASC_KEY_ID") or os.environ.get("APP_STORE_CONNECT_KEY_ID", "")
    issuer = os.environ.get("ASC_ISSUER_ID") or os.environ.get("APP_STORE_CONNECT_ISSUER_ID", "")
    contenido = os.environ.get("APP_STORE_CONNECT_PRIVATE_KEY", "")
    if not key_path and contenido:
        fh = tempfile.NamedTemporaryFile("w", suffix=".p8", delete=False, encoding="utf-8")
        fh.write(contenido)
        fh.close()
        key_path = fh.name
    if not key_path:
        llaves = sorted(SECRETOS_POR_OMISION.glob("AuthKey_*.p8"))
        if not llaves:
            raise SystemExit(f"No encuentro AuthKey_*.p8 en {SECRETOS_POR_OMISION}; pon ASC_KEY_PATH/ASC_KEY_ID/ASC_ISSUER_ID")
        key_path = str(llaves[0])
        key_id = key_id or llaves[0].stem.removeprefix("AuthKey_")
    if not key_id:
        key_id = Path(key_path).stem.removeprefix("AuthKey_")
    if not issuer:
        archivo = SECRETOS_POR_OMISION / "issuer-id.txt"
        issuer = archivo.read_text(encoding="utf-8").strip() if archivo.exists() else ISSUER_POR_OMISION
    if not issuer:
        raise SystemExit(f"Falta el Issuer ID: ASC_ISSUER_ID o {SECRETOS_POR_OMISION / 'issuer-id.txt'}")
    print(f"llave de App Store Connect …{key_id[-4:]} · issuer …{issuer[-4:]}")
    return key_path, key_id, issuer


def leer(nombre: str) -> str:
    return (TIENDA / "ios" / nombre).read_text(encoding="utf-8").rstrip("\n")


def textos() -> dict[str, str]:
    t = {
        "subtitle": leer("subtitulo.txt"),
        "promotionalText": leer("texto-promocional.txt"),
        "description": leer("descripcion.txt"),
        "keywords": leer("palabras-clave.txt"),
    }
    limites = {"subtitle": 30, "promotionalText": 170, "description": 4000, "keywords": 100}
    for campo, valor in t.items():
        if len(valor) > limites[campo]:
            raise SystemExit(f"{campo}: {len(valor)} caracteres, el límite es {limites[campo]}")
        # README de docs/tienda: en iOS no se habla de Plus, del proveedor de IA ni de otras plataformas.
        import re

        if re.search(r"\bPlus\b|inteligencia artificial|android|google play|widget", valor, re.I):
            raise SystemExit(f"{campo} menciona Plus, IA, Android o widget: no va en la ficha de iOS (README)")
    return t


def md5(ruta: Path) -> str:
    h = hashlib.md5()
    with ruta.open("rb") as fh:
        for trozo in iter(lambda: fh.read(1 << 20), b""):
            h.update(trozo)
    return h.hexdigest()


def tamano_png(ruta: Path) -> tuple[int, int]:
    import struct

    cabecera = ruta.read_bytes()[:24]
    if cabecera[:8] != b"\x89PNG\r\n\x1a\n":
        raise SystemExit(f"{ruta.name} no es PNG")
    return struct.unpack(">II", cabecera[16:24])


# ───────────────────────── metadatos ─────────────────────────


def app_id(asc: Asc) -> str:
    r = asc.call("GET", "/apps", query={"filter[bundleId]": BUNDLE_ID, "fields[apps]": "name,bundleId,primaryLocale"})
    datos = r.get("data") or []
    if not datos:
        raise SystemExit(f"No hay app con bundle {BUNDLE_ID} en este equipo")
    a = datos[0]
    print(f"app {a['attributes']['name']} ({a['id']}) · idioma principal {a['attributes']['primaryLocale']}")
    return a["id"]


def version_editable(asc: Asc, app: str) -> str:
    r = asc.call(
        "GET",
        f"/apps/{app}/appStoreVersions",
        query={"filter[platform]": "IOS", "fields[appStoreVersions]": "versionString,appStoreState", "limit": "20"},
    )
    editables = [v for v in r.get("data") or [] if v["attributes"]["appStoreState"] in ESTADOS_EDITABLES]
    if not editables:
        creada = asc.call(
            "POST",
            "/appStoreVersions",
            {
                "data": {
                    "type": "appStoreVersions",
                    "attributes": {"platform": "IOS", "versionString": VERSION},
                    "relationships": {"app": {"data": {"type": "apps", "id": app}}},
                }
            },
        )
        print(f"versión {VERSION} creada ({creada['data']['id']})")
        return creada["data"]["id"]
    v = editables[0]
    if v["attributes"]["versionString"] != VERSION and v["attributes"]["appStoreState"] == "PREPARE_FOR_SUBMISSION":
        asc.call(
            "PATCH",
            f"/appStoreVersions/{v['id']}",
            {"data": {"type": "appStoreVersions", "id": v["id"], "attributes": {"versionString": VERSION}}},
        )
        print(f"versión «{v['attributes']['versionString']}» renombrada a {VERSION} ({v['id']})")
    else:
        print(f"versión {v['attributes']['versionString']} · {v['attributes']['appStoreState']} ({v['id']})")
    return v["id"]


def localizacion(asc: Asc, coleccion: str, padre: str, tipo: str, relacion: str) -> str:
    r = asc.call("GET", f"/{coleccion}/{padre}/{tipo}")
    for item in r.get("data") or []:
        if item["attributes"].get("locale") == LOCALE:
            return item["id"]
    creada = asc.call(
        "POST",
        f"/{tipo}",
        {
            "data": {
                "type": tipo,
                "attributes": {"locale": LOCALE},
                "relationships": {relacion: {"data": {"type": coleccion, "id": padre}}},
            }
        },
    )
    print(f"  localización {LOCALE} creada en {tipo} ({creada['data']['id']})")
    return creada["data"]["id"]


def parchar(asc: Asc, tipo: str, ident: str, atributos: dict, relaciones: dict | None = None) -> None:
    """PATCH que, si la API rechaza un atributo (campos que Apple añade o retira), lo quita y reintenta."""
    pendientes = dict(atributos)
    for _ in range(len(atributos) + 1):
        cuerpo = {"data": {"type": tipo, "id": ident, "attributes": pendientes}}
        if relaciones:
            cuerpo["data"]["relationships"] = relaciones
        try:
            asc.call("PATCH", f"/{tipo}/{ident}", cuerpo)
            return
        except AscError as exc:
            culpable = next((k for k in pendientes if f"'{k}'" in str(exc) or f"/{k}" in str(exc)), None)
            if exc.code != 400 or culpable is None:
                raise
            print(f"  AVISO: la API no acepta «{culpable}» ({str(exc).splitlines()[0][:80]}…); sigo sin él")
            pendientes.pop(culpable)
    raise SystemExit(f"no pude actualizar {tipo}/{ident}")


def metadatos(asc: Asc, app: str, version: str, aviso_url: str, soporte_url: str) -> dict[str, str]:
    ids: dict[str, str] = {}
    t = textos()

    # Información de la app (appInfos) en estado editable
    infos = asc.call("GET", f"/apps/{app}/appInfos", query={"fields[appInfos]": "appStoreState,state"})
    editables = [i for i in infos.get("data") or [] if i["attributes"].get("state") in ESTADOS_EDITABLES]
    info = (editables or infos["data"])[0]["id"]
    ids["appInfo"] = info
    parchar(
        asc,
        "appInfos",
        info,
        {},
        {
            "primaryCategory": {"data": {"type": "appCategories", "id": CATEGORIA}},
            "secondaryCategory": {"data": {"type": "appCategories", "id": CATEGORIA_2}},
        },
    )
    print(f"appInfo {info}: categorías {CATEGORIA} / {CATEGORIA_2}")

    loc_info = localizacion(asc, "appInfos", info, "appInfoLocalizations", "appInfo")
    ids["appInfoLocalization"] = loc_info
    parchar(
        asc,
        "appInfoLocalizations",
        loc_info,
        {"name": NOMBRE, "subtitle": t["subtitle"], "privacyPolicyUrl": aviso_url},
    )
    print(f"appInfoLocalization {loc_info}: name, subtitle «{t['subtitle']}», privacyPolicyUrl {aviso_url}")

    edad = asc.call("GET", f"/appInfos/{info}/ageRatingDeclaration")["data"]["id"]
    ids["ageRatingDeclaration"] = edad
    atributos = {k: "NONE" for k in EDAD_ENUM} | {k: False for k in EDAD_BOOL}
    atributos["kidsAgeBand"] = None
    parchar(asc, "ageRatingDeclarations", edad, atributos)
    # La declaración no admite GET directo (solo UPDATE): se relee por la relación del appInfo.
    estado = asc.call("GET", f"/appInfos/{info}/ageRatingDeclaration")["data"]["attributes"]
    raros = {k: v for k, v in estado.items() if v not in (None, "NONE", False)}
    print(f"ageRatingDeclaration {edad}: todo NONE/false" + (f" salvo {raros}" if raros else ""))

    loc_ver = localizacion(asc, "appStoreVersions", version, "appStoreVersionLocalizations", "appStoreVersion")
    ids["appStoreVersionLocalization"] = loc_ver
    parchar(
        asc,
        "appStoreVersionLocalizations",
        loc_ver,
        {
            "description": t["description"],
            "keywords": t["keywords"],
            "promotionalText": t["promotionalText"],
            "supportUrl": soporte_url,
            "marketingUrl": None,
        },
    )
    print(f"appStoreVersionLocalization {loc_ver}: description ({len(t['description'])}), keywords, promotionalText, supportUrl {soporte_url}")
    return ids


def enlazar_build(asc: Asc, app: str, version: str, numero: str) -> None:
    r = asc.call(
        "GET",
        "/builds",
        query={"filter[app]": app, "filter[version]": numero, "fields[builds]": "version,processingState", "limit": "5"},
    )
    validas = [b for b in r.get("data") or [] if b["attributes"]["processingState"] == "VALID"]
    if not validas:
        raise SystemExit(f"no hay build {numero} válida (procesada) en App Store Connect")
    asc.call(
        "PATCH",
        f"/appStoreVersions/{version}/relationships/build",
        {"data": {"type": "builds", "id": validas[0]["id"]}},
    )
    print(f"build {numero} ({validas[0]['id']}) enlazada a la versión {VERSION}")


# ───────────────────────── capturas ─────────────────────────


def set_capturas(asc: Asc, loc_ver: str, display_type: str) -> str:
    r = asc.call("GET", f"/appStoreVersionLocalizations/{loc_ver}/appScreenshotSets")
    for s in r.get("data") or []:
        if s["attributes"]["screenshotDisplayType"] == display_type:
            return s["id"]
    creado = asc.call(
        "POST",
        "/appScreenshotSets",
        {
            "data": {
                "type": "appScreenshotSets",
                "attributes": {"screenshotDisplayType": display_type},
                "relationships": {
                    "appStoreVersionLocalization": {"data": {"type": "appStoreVersionLocalizations", "id": loc_ver}}
                },
            }
        },
    )
    print(f"  set de capturas {display_type} creado ({creado['data']['id']})")
    return creado["data"]["id"]


def subir_captura(asc: Asc, conjunto: str, ruta: Path) -> str:
    datos = ruta.read_bytes()
    reserva = asc.call(
        "POST",
        "/appScreenshots",
        {
            "data": {
                "type": "appScreenshots",
                "attributes": {"fileName": ruta.name, "fileSize": len(datos)},
                "relationships": {"appScreenshotSet": {"data": {"type": "appScreenshotSets", "id": conjunto}}},
            }
        },
    )
    ident = reserva["data"]["id"]
    for op in reserva["data"]["attributes"]["uploadOperations"]:
        trozo = datos[op["offset"] : op["offset"] + op["length"]]
        req = urllib.request.Request(op["url"], data=trozo, method=op["method"])
        for h in op.get("requestHeaders") or []:
            req.add_header(h["name"], h["value"])
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                resp.read()
        except urllib.error.HTTPError as exc:
            raise SystemExit(f"subida de {ruta.name} falló: HTTP {exc.code} {exc.read().decode(errors='replace')[:200]}")
    asc.call(
        "PATCH",
        f"/appScreenshots/{ident}",
        {"data": {"type": "appScreenshots", "id": ident, "attributes": {"uploaded": True, "sourceFileChecksum": md5(ruta)}}},
    )
    return ident


def esperar_procesado(asc: Asc, ident: str, nombre: str, segundos: int = 300) -> str:
    inicio = time.time()
    while True:
        a = asc.call("GET", f"/appScreenshots/{ident}")["data"]["attributes"]
        estado = (a.get("assetDeliveryState") or {}).get("state")
        if estado == "COMPLETE":
            return estado
        if estado == "FAILED":
            raise SystemExit(f"{nombre}: Apple rechazó la captura: {(a.get('assetDeliveryState') or {}).get('errors')}")
        if time.time() - inicio > segundos:
            print(f"  AVISO: {nombre} sigue en {estado} tras {segundos}s; se verá en la consola")
            return estado or "?"
        time.sleep(5)


def sincronizar_capturas(asc: Asc, loc_ver: str, carpeta: Path, display_type: str) -> dict[str, str]:
    archivos = sorted(p for p in carpeta.glob("*.png") if p.is_file())
    if not archivos:
        print(f"sin capturas en {carpeta}: nada que subir (se suben cuando el lote esté)")
        return {}
    if len(archivos) > 10:
        raise SystemExit(f"{len(archivos)} capturas; Apple admite hasta 10 por tamaño")
    for p in archivos:
        if tamano_png(p) != (1320, 2868):
            raise SystemExit(f"{p.name} mide {tamano_png(p)}, no 1320×2868 (enmarcar.py --plataforma ios-6.9)")
    conjunto = set_capturas(asc, loc_ver, display_type)
    existentes = asc.call("GET", f"/appScreenshotSets/{conjunto}/appScreenshots", query={"limit": "50"})
    por_nombre = {s["attributes"]["fileName"]: s for s in existentes.get("data") or []}
    locales = {p.name: md5(p) for p in archivos}
    orden: list[str] = []
    for p in archivos:
        previa = por_nombre.get(p.name)
        estado = ((previa or {}).get("attributes") or {}).get("assetDeliveryState") or {}
        if previa and previa["attributes"].get("sourceFileChecksum") == locales[p.name] and estado.get("state") == "COMPLETE":
            print(f"  = {p.name} ya está ({previa['id']})")
            orden.append(previa["id"])
            continue
        if previa:
            asc.call("DELETE", f"/appScreenshots/{previa['id']}")
            print(f"  - {p.name} cambió: borrada la anterior ({previa['id']})")
        ident = subir_captura(asc, conjunto, p)
        estado_final = esperar_procesado(asc, ident, p.name)
        print(f"  + {p.name} subida ({ident}) · {estado_final}")
        orden.append(ident)
    for nombre, previa in por_nombre.items():
        if nombre not in locales:
            asc.call("DELETE", f"/appScreenshots/{previa['id']}")
            print(f"  - {nombre} ya no está en la carpeta: borrada ({previa['id']})")
    asc.call(
        "PATCH",
        f"/appScreenshotSets/{conjunto}/relationships/appScreenshots",
        {"data": [{"type": "appScreenshots", "id": i} for i in orden]},
    )
    print(f"set {display_type} ({conjunto}): {len(orden)} capturas en orden")
    return {"appScreenshotSet": conjunto, "appScreenshots": ",".join(orden)}


def prueba_subida(asc: Asc, loc_ver: str, display_type: str) -> None:
    """Comprueba el camino completo (reserva → partes → checksum → COMPLETE) con una imagen de prueba y la borra."""
    from PIL import Image, ImageDraw

    with tempfile.TemporaryDirectory() as tmp:
        ruta = Path(tmp) / "zz-prueba-pipeline.png"
        im = Image.new("RGB", (1320, 2868), (14, 138, 110))
        ImageDraw.Draw(im).text((100, 100), "prueba de subida; se borra sola", fill=(255, 255, 255))
        im.save(ruta)
        conjunto = set_capturas(asc, loc_ver, display_type)
        ident = subir_captura(asc, conjunto, ruta)
        estado = esperar_procesado(asc, ident, ruta.name)
        asc.call("DELETE", f"/appScreenshots/{ident}")
        print(f"prueba de subida: {estado} en {display_type} ({conjunto}); la imagen de prueba ya se borró ({ident})")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--capturas", type=Path, default=CAPTURAS)
    p.add_argument("--sin-capturas", action="store_true")
    p.add_argument("--prueba-subida", action="store_true")
    p.add_argument("--build", help="número de build (CFBundleVersion) ya procesada que se enlaza a la versión")
    p.add_argument("--aviso-url", default=AVISO_URL)
    p.add_argument("--soporte-url", default=SOPORTE_URL)
    p.add_argument("--display-type", default=DISPLAY_TYPE)
    args = p.parse_args()

    asc = Sesion(*credenciales())
    app = app_id(asc)
    version = version_editable(asc, app)
    ids = {"app": app, "appStoreVersion": version}
    ids |= metadatos(asc, app, version, args.aviso_url, args.soporte_url)
    if args.build:
        enlazar_build(asc, app, version, args.build)
    if args.prueba_subida:
        prueba_subida(asc, ids["appStoreVersionLocalization"], args.display_type)
    if not args.sin_capturas:
        ids |= sincronizar_capturas(asc, ids["appStoreVersionLocalization"], args.capturas, args.display_type)
    print("\nIDs:", json.dumps(ids, indent=2))


if __name__ == "__main__":
    try:
        main()
    except AscError as exc:
        print(f"App Store Connect: {exc}", file=sys.stderr)
        sys.exit(1)
