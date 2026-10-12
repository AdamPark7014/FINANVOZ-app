"""Vectores de conocimiento de E17 (docs/05-MOTORES.md §E17): XChaCha20-Poly1305 y el blob de un evento.

Implementación independiente en Python (solo biblioteca estándar) de HChaCha20, ChaCha20 (RFC 8439) y Poly1305,
para que las pruebas de `packages/sincronizacion` no se validen contra la misma biblioteca que usan
(`@noble/ciphers`). Comprueba primero el vector A.3.1 de draft-irtf-cfrg-xchacha-03 y después escribe
`kat.json` con ese vector y el de un evento compartido.

    python3 fixtures/sincronizacion/kat.py            # verifica que kat.json coincide
    python3 fixtures/sincronizacion/kat.py --escribir # lo regenera
"""

import base64
import json
import os
import struct
import sys

MASCARA = 0xFFFFFFFF


def _rotl(v, c):
    return ((v << c) & MASCARA) | (v >> (32 - c))


def _cuarto(s, a, b, c, d):
    s[a] = (s[a] + s[b]) & MASCARA
    s[d] = _rotl(s[d] ^ s[a], 16)
    s[c] = (s[c] + s[d]) & MASCARA
    s[b] = _rotl(s[b] ^ s[c], 12)
    s[a] = (s[a] + s[b]) & MASCARA
    s[d] = _rotl(s[d] ^ s[a], 8)
    s[c] = (s[c] + s[d]) & MASCARA
    s[b] = _rotl(s[b] ^ s[c], 7)


def _rondas(s):
    for _ in range(10):
        _cuarto(s, 0, 4, 8, 12)
        _cuarto(s, 1, 5, 9, 13)
        _cuarto(s, 2, 6, 10, 14)
        _cuarto(s, 3, 7, 11, 15)
        _cuarto(s, 0, 5, 10, 15)
        _cuarto(s, 1, 6, 11, 12)
        _cuarto(s, 2, 7, 8, 13)
        _cuarto(s, 3, 4, 9, 14)


CONSTANTES = [0x61707865, 0x3320646E, 0x79622D32, 0x6B206574]


def hchacha20(llave, nonce16):
    s = CONSTANTES + list(struct.unpack("<8I", llave)) + list(struct.unpack("<4I", nonce16))
    _rondas(s)
    return struct.pack("<8I", *(s[0:4] + s[12:16]))


def _bloque(llave, contador, nonce12):
    inicial = CONSTANTES + list(struct.unpack("<8I", llave)) + [contador] + list(struct.unpack("<3I", nonce12))
    s = list(inicial)
    _rondas(s)
    return struct.pack("<16I", *[(x + y) & MASCARA for x, y in zip(s, inicial)])


def chacha20(llave, contador, nonce12, datos):
    salida = bytearray()
    for i in range(0, len(datos), 64):
        flujo = _bloque(llave, contador + i // 64, nonce12)
        salida += bytes(a ^ b for a, b in zip(datos[i : i + 64], flujo))
    return bytes(salida)


def poly1305(llave, mensaje):
    r = int.from_bytes(llave[:16], "little") & 0x0FFFFFFC0FFFFFFC0FFFFFFC0FFFFFFF
    s = int.from_bytes(llave[16:], "little")
    p = (1 << 130) - 5
    acc = 0
    for i in range(0, len(mensaje), 16):
        trozo = mensaje[i : i + 16] + b"\x01"
        acc = (acc + int.from_bytes(trozo, "little")) * r % p
    return ((acc + s) & ((1 << 128) - 1)).to_bytes(16, "little")


def _relleno(n):
    return b"\x00" * ((16 - n % 16) % 16)


def xchacha20poly1305_cifrar(llave, nonce24, texto, aad):
    sub = hchacha20(llave, nonce24[:16])
    nonce12 = b"\x00" * 4 + nonce24[16:]
    llave_poly = _bloque(sub, 0, nonce12)[:32]
    cifrado = chacha20(sub, 1, nonce12, texto)
    mac = aad + _relleno(len(aad)) + cifrado + _relleno(len(cifrado))
    mac += struct.pack("<QQ", len(aad), len(cifrado))
    return cifrado + poly1305(llave_poly, mac)


def _hex(b):
    return b.hex()


def vectores():
    # draft-irtf-cfrg-xchacha-03, apéndice A.3.1.
    llave = bytes(range(0x80, 0xA0))
    nonce = bytes(range(0x40, 0x58))
    aad = bytes.fromhex("50515253c0c1c2c3c4c5c6c7")
    texto = (
        b"Ladies and Gentlemen of the class of '99: If I could offer you only one tip for the future, "
        b"sunscreen would be it."
    )
    esperado_borrador = (
        "bd6d179d3e83d43b9576579493c0e939572a1700252bfaccbed2902c21396cbb731c7f1b0b4aa6440bf3a82f4eda7e39"
        "ae64c6708c54c216cb96b72e1213b4522f8c9ba40db5d945b11b69b982c1bb9e3f3fac2bc369488f76b2383565d3fff9"
        "21f9664c97637da9768812f615c68b13b52e"
    )
    etiqueta_borrador = "c0875924c1c7987947deafd8780acf49"
    salida = xchacha20poly1305_cifrar(llave, nonce, texto, aad)
    assert _hex(salida) == esperado_borrador + etiqueta_borrador, "no reproduce draft-irtf-cfrg-xchacha A.3.1"

    # Evento de E17: AAD = "grupo_id|id|autor"; blob = base64(nonce ‖ texto cifrado ‖ etiqueta).
    llave_grupo = bytes(range(0x00, 0x20))
    nonce_evento = bytes(range(0xA0, 0xB8))
    grupo_id = "7f3c1a52-8d4e-4b6a-9c21-0e5f7a8b9c0d"
    evento_id = "3b9f6c2e-1a7d-4e58-b4c3-9d2a6f1e8b70"
    autor = "a"
    contenido = (
        '{"tipo":"gasto_compartido_creado","creado_en":1792022400000,"cuerpo":{"fecha":"2026-10-12",'
        '"total":120000,"pago":"a","proporcion_a_bp":5000,"descripcion":"Súper","categoria":"super"}}'
    )
    aad_evento = f"{grupo_id}|{evento_id}|{autor}".encode("utf-8")
    cifrado = xchacha20poly1305_cifrar(llave_grupo, nonce_evento, contenido.encode("utf-8"), aad_evento)
    return {
        "descripcion": (
            "Vectores de E17 (docs/05-MOTORES.md §E17) generados por fixtures/sincronizacion/kat.py, "
            "implementación independiente en Python sin dependencias."
        ),
        "xchacha20poly1305": [
            {
                "id": "XC-01",
                "fuente": "draft-irtf-cfrg-xchacha-03 §A.3.1",
                "llave_hex": _hex(llave),
                "nonce_hex": _hex(nonce),
                "aad_hex": _hex(aad),
                "texto_utf8": texto.decode("utf-8"),
                "cifrado_y_etiqueta_hex": _hex(salida),
            }
        ],
        "eventos": [
            {
                "id": "E17-KAT-01",
                "llave_hex": _hex(llave_grupo),
                "nonce_hex": _hex(nonce_evento),
                "fila": {"grupo_id": grupo_id, "id": evento_id, "autor": autor},
                "contenido_utf8": contenido,
                "aad_utf8": aad_evento.decode("utf-8"),
                "blob": base64.b64encode(nonce_evento + cifrado).decode("ascii"),
            }
        ],
    }


def main():
    ruta = os.path.join(os.path.dirname(os.path.abspath(__file__)), "kat.json")
    texto = json.dumps(vectores(), ensure_ascii=False, indent=2) + "\n"
    if "--escribir" in sys.argv:
        with open(ruta, "w", encoding="utf-8", newline="\n") as f:
            f.write(texto)
        print(f"escrito {ruta}")
        return
    with open(ruta, encoding="utf-8") as f:
        if json.load(f) != json.loads(texto):
            print("kat.json no coincide con kat.py", file=sys.stderr)
            sys.exit(1)
    print("kat.json coincide")


if __name__ == "__main__":
    main()
