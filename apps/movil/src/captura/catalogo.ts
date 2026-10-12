import { compilarPlantillas, type CatalogoPlantillas } from '@cartera/core';
import sinteticas from '../../../../fixtures/notificaciones/plantillas.ejemplo.json';
import reales from './plantillas/reales.json';
import type { NotificacionCruda } from './tipos';

interface ArchivoPlantillas {
  readonly version?: number;
  readonly bancos: readonly unknown[];
  readonly plantillas: readonly unknown[];
}

/**
 * Une archivos de plantillas en uno (`07 §3`): los bancos y plantillas de cada archivo en orden, así que las
 * reales ganan sobre las sintéticas. Cualquier error invalida el catálogo completo.
 */
export function combinarPlantillas(archivos: readonly ArchivoPlantillas[]): CatalogoPlantillas {
  return compilarPlantillas({
    version: 1,
    bancos: archivos.flatMap((a) => a.bancos),
    plantillas: archivos.flatMap((a) => a.plantillas),
  });
}

/**
 * Plantillas embebidas en la app (`version: 1`, `07 §3.1`). Las sintéticas de `fixtures/` (paquetes
 * `mx.ejemplo.*`, que no existen en ningún teléfono) solo entran en builds de desarrollo, para probar con `adb`
 * y con la semilla `e-captura`.
 */
export function catalogoEmbebido(incluirSinteticas: boolean): CatalogoPlantillas {
  return combinarPlantillas(incluirSinteticas ? [reales, sinteticas] : [reales]);
}

/** Paquete del sistema que publica las notificaciones de `adb shell cmd notification post`. */
export const PAQUETE_ADB = 'com.android.shell';

/**
 * Mapeo de depuración (`07 §2.5`): una notificación de `com.android.shell` con etiqueta `<banco_id>` se trata
 * como si viniera del primer paquete de ese banco. Fuera de depuración, el paquete es el que reportó Android.
 */
export function paqueteEfectivo(
  n: Pick<NotificacionCruda, 'paquete' | 'etiqueta'>,
  catalogo: CatalogoPlantillas,
  depuracion: boolean,
): string {
  if (!depuracion || n.paquete !== PAQUETE_ADB || !n.etiqueta) return n.paquete;
  return catalogo.bancos.find((b) => b.id === n.etiqueta)?.paquetesAndroid[0] ?? n.paquete;
}

/** Paquetes de todos los bancos del catálogo (candidatos para la lista blanca). */
export function paquetesConocidos(catalogo: CatalogoPlantillas): string[] {
  return catalogo.bancos.flatMap((b) => b.paquetesAndroid);
}

/** Nombre visible de un banco del catálogo ("Banco A (débito)"); su id si no trae nombre. */
export function nombreBanco(catalogo: CatalogoPlantillas, banco: string | null): string {
  if (banco === null) return 'tu banco';
  return catalogo.bancos.find((b) => b.id === banco)?.nombre ?? banco;
}
