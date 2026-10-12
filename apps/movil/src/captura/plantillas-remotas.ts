/**
 * Plantillas remotas firmadas (`docs/07-CAPTURA.md §3.1`, ADR-018): verificación Ed25519 sobre los bytes exactos
 * del archivo con las llaves públicas configuradas al construir la app, validación con Zod, compilación de cada
 * RegExp y combinación con las plantillas embebidas. Puro: sin red, sin base y sin reloj (se prueba en Node).
 *
 * Ed25519 con `@noble/curves` (solo verificar; JS puro, igual en Node y en Hermes; decisión de M10 en
 * `docs/ESTADO.md`). Nada de aquí escribe en logs: los motivos de rechazo son códigos, sin contenido.
 */
import { ed25519 } from '@noble/curves/ed25519.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import { z } from 'zod';
import { compilarPlantillas, type CatalogoPlantillas } from '@cartera/core';
import { deBase64 } from '@cartera/respaldo';

/** Llave pública embebida (`07 §3.1`: lista `{id, llave_publica_hex}`). */
export interface LlavePlantillas {
  readonly id: string;
  /** 32 bytes en hexadecimal, minúsculas. */
  readonly llavePublicaHex: string;
}

/** Archivo de plantillas (`07 §3`): lo que necesita `compilarPlantillas` y, en remotas, la versión. */
export interface ArchivoPlantillas {
  readonly version?: number;
  readonly bancos: readonly unknown[];
  readonly plantillas: readonly unknown[];
}

/** Archivo remoto ya verificado. */
export interface ArchivoRemoto extends ArchivoPlantillas {
  readonly version: number;
  readonly emitido_en: string;
  readonly version_minima_app: string;
}

export type MotivoRechazo =
  | 'sin_llaves'
  | 'firma_invalida'
  | 'json_invalido'
  | 'formato_invalido'
  | 'plantillas_invalidas'
  | 'version_no_mayor'
  | 'app_antigua';

export type ResultadoVerificacion =
  | {
      readonly ok: true;
      readonly archivo: ArchivoRemoto;
      readonly catalogo: CatalogoPlantillas;
      readonly version: number;
      /** SHA-256 de los bytes del archivo (columna `plantilla_remota.sha256`). */
      readonly sha256: string;
      /** Firma en base64 canónico (columna `plantilla_remota.firma`). */
      readonly firma: string;
      /** Id de la llave que verificó. */
      readonly llave: string;
      /** Los bytes como texto (UTF-8 estricto: volver a codificarlo da los mismos bytes). */
      readonly contenido: string;
    }
  | { readonly ok: false; readonly motivo: MotivoRechazo };

export interface EntradaVerificacion {
  readonly bytes: Uint8Array;
  readonly firmaBase64: string;
  readonly llaves: readonly LlavePlantillas[];
  /** Versión activa (1 = solo las embebidas). Solo se acepta una mayor. */
  readonly versionActiva: number;
  /** Versión de la app (`x.y.z`), para `version_minima_app`. */
  readonly versionApp: string;
  /**
   * Excepción a "solo mayor": el mismo archivo ya aceptado (versión y SHA-256 iguales a los registrados en
   * `plantilla_remota`) cuyo contenido se perdió (p. ej., tras restaurar un respaldo). No abre un retroceso.
   */
  readonly recuperar?: { readonly version: number; readonly sha256: string } | undefined;
}

const VERSION_APP = /^(\d+)\.(\d+)\.(\d+)$/;

const EsquemaArchivo = z.object({
  version: z.int().positive(),
  emitido_en: z.string().min(1),
  version_minima_app: z.string().regex(VERSION_APP),
  advertencia: z.string().optional(),
  bancos: z.array(z.unknown()),
  plantillas: z.array(z.unknown()),
});

/** Compara versiones `x.y.z`; `null` si alguna no tiene esa forma. */
export function compararVersiones(a: string, b: string): number | null {
  const ma = VERSION_APP.exec(a.trim());
  const mb = VERSION_APP.exec(b.trim());
  if (!ma || !mb) return null;
  for (let i = 1; i <= 3; i++) {
    const d = Number(ma[i]) - Number(mb[i]);
    if (d !== 0) return d;
  }
  return 0;
}

/** UTF-8 estricto (lanza si los bytes no son UTF-8 válido); no depende de `TextDecoder`. */
function deUtf8(bytes: Uint8Array): string {
  let escapado = '';
  for (const b of bytes) escapado += (b < 16 ? '%0' : '%') + b.toString(16);
  return decodeURIComponent(escapado);
}

function iguales(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function verificaCon(llave: LlavePlantillas, firma: Uint8Array, bytes: Uint8Array): boolean {
  try {
    // RFC 8032 estricto (sin las codificaciones laxas de ZIP-215).
    return ed25519.verify(firma, bytes, hexToBytes(llave.llavePublicaHex), { zip215: false });
  } catch {
    return false;
  }
}

/**
 * Verifica un archivo remoto (`07 §3.1`): firma con alguna llave embebida, JSON en UTF-8, forma, plantillas que
 * compilan, versión mayor que la activa y `version_minima_app ≤ versionApp`. Cualquier fallo descarta el
 * archivo completo.
 */
export function verificarPlantillasRemotas(e: EntradaVerificacion): ResultadoVerificacion {
  if (e.llaves.length === 0) return { ok: false, motivo: 'sin_llaves' };
  const firmaTexto = e.firmaBase64.trim();
  const firma = deBase64(firmaTexto);
  if (!firma || firma.length !== 64) return { ok: false, motivo: 'firma_invalida' };
  const llave = e.llaves.find((l) => verificaCon(l, firma, e.bytes));
  if (!llave) return { ok: false, motivo: 'firma_invalida' };

  let contenido: string;
  let json: unknown;
  try {
    contenido = deUtf8(e.bytes);
    if (!iguales(utf8ToBytes(contenido), e.bytes)) return { ok: false, motivo: 'json_invalido' };
    json = JSON.parse(contenido);
  } catch {
    return { ok: false, motivo: 'json_invalido' };
  }
  const forma = EsquemaArchivo.safeParse(json);
  if (!forma.success) return { ok: false, motivo: 'formato_invalido' };
  const archivo: ArchivoRemoto = {
    version: forma.data.version,
    emitido_en: forma.data.emitido_en,
    version_minima_app: forma.data.version_minima_app,
    bancos: forma.data.bancos,
    plantillas: forma.data.plantillas,
  };
  let catalogo: CatalogoPlantillas;
  try {
    catalogo = compilarPlantillas(archivo);
  } catch {
    return { ok: false, motivo: 'plantillas_invalidas' };
  }

  const huella = bytesToHex(sha256(e.bytes));
  const recupera = e.recuperar?.version === archivo.version && e.recuperar.sha256 === huella;
  if (archivo.version <= e.versionActiva && !recupera) return { ok: false, motivo: 'version_no_mayor' };
  const minima = compararVersiones(archivo.version_minima_app, e.versionApp);
  if (minima === null || minima > 0) return { ok: false, motivo: 'app_antigua' };

  return {
    ok: true,
    archivo,
    catalogo,
    version: archivo.version,
    sha256: huella,
    firma: firmaTexto,
    llave: llave.id,
    contenido,
  };
}

/**
 * Huella (SHA-256 de los 32 bytes) de la llave pública del vector 1 de RFC 8032. La llave en sí no se escribe en
 * el código de la app: así el bundle de producción no la contiene (CA-M10-04) y aun así se reconoce.
 */
const HUELLA_LLAVE_PRUEBA_RFC8032 = '21fe31dfa154a261626bf854046fd2271b7bed4b6abe45aa58877ef47f9721b9';

export function esLlaveDePruebaRfc8032(hex: string): boolean {
  if (!/^[0-9a-f]{64}$/i.test(hex)) return false;
  return bytesToHex(sha256(hexToBytes(hex.toLowerCase()))) === HUELLA_LLAVE_PRUEBA_RFC8032;
}

/**
 * Lee la lista de llaves configurada al construir la app (`EXPO_PUBLIC_PLANTILLAS_LLAVES`, `id:hex` separados
 * por coma). Lo mal formado se ignora. En producción la llave de prueba de RFC 8032 se descarta aunque alguien la
 * configure (y además el escaneo del bundle la rechaza, `seguridad/secretos.ts`).
 */
export function leerLlavesPlantillas(
  texto: string | undefined,
  opciones: { readonly produccion: boolean },
): LlavePlantillas[] {
  const llaves: LlavePlantillas[] = [];
  for (const parte of (texto ?? '').split(',')) {
    const m = /^([A-Za-z0-9_.-]{1,40}):([0-9a-fA-F]{64})$/.exec(parte.trim());
    if (!m) continue;
    const llavePublicaHex = (m[2] ?? '').toLowerCase();
    if (opciones.produccion && esLlaveDePruebaRfc8032(llavePublicaHex)) continue;
    llaves.push({ id: m[1] ?? '', llavePublicaHex });
  }
  return llaves;
}

interface BancoCrudo {
  readonly id?: unknown;
  readonly paquetes_android?: unknown;
}
interface PlantillaCruda {
  readonly banco?: unknown;
}

/**
 * Catálogo con el que corre la captura (`07 §3.1`): las plantillas remotas primero y, de las embebidas, solo los
 * bancos que la remota no trae (mismo `id`) ni reclama (mismo paquete), con sus plantillas. Sin remota, las
 * embebidas tal cual (`version: 1`).
 */
export function catalogoConRemotas(
  embebidos: readonly ArchivoPlantillas[],
  remoto: ArchivoPlantillas | null,
): CatalogoPlantillas {
  const bancosEmbebidos = embebidos.flatMap((a) => a.bancos) as BancoCrudo[];
  const plantillasEmbebidas = embebidos.flatMap((a) => a.plantillas) as PlantillaCruda[];
  if (!remoto)
    return compilarPlantillas({ version: 1, bancos: bancosEmbebidos, plantillas: plantillasEmbebidas });

  const remotos = remoto.bancos as BancoCrudo[];
  const ids = new Set(remotos.map((b) => b.id));
  const paquetes = new Set(
    remotos.flatMap((b) => (Array.isArray(b.paquetes_android) ? b.paquetes_android : [])),
  );
  const quedan = bancosEmbebidos.filter(
    (b) =>
      !ids.has(b.id) &&
      !(Array.isArray(b.paquetes_android) && b.paquetes_android.some((p: unknown) => paquetes.has(p))),
  );
  const idsQuedan = new Set(quedan.map((b) => b.id));
  return compilarPlantillas({
    version: remoto.version ?? 1,
    bancos: [...remotos, ...quedan],
    plantillas: [...remoto.plantillas, ...plantillasEmbebidas.filter((p) => idsQuedan.has(p.banco))],
  });
}
