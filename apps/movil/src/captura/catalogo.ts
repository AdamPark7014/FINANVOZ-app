import { compilarPlantillas, type CatalogoPlantillas } from '@cartera/core';
import sinteticas from '../../../../fixtures/notificaciones/plantillas.ejemplo.json';
import { catalogoConRemotas, type ArchivoPlantillas } from './plantillas-remotas';
import reales from './plantillas/reales.json';
import type { NotificacionCruda } from './tipos';

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

let catalogoDeLaApp: CatalogoPlantillas | null = null;
let remotasActivas: ArchivoPlantillas | null = null;

/**
 * Catálogo con el que corre la app: las plantillas remotas activas (`07 §3.1`, ya verificadas) ganan por id de
 * banco sobre las embebidas; las reales siempre y las sintéticas solo con `__DEV__` (en Node, donde no existe
 * `__DEV__`, también: pruebas y semillas).
 */
export function catalogoApp(): CatalogoPlantillas {
  if (!catalogoDeLaApp) {
    const embebidos = typeof __DEV__ === 'undefined' || __DEV__ ? [reales, sinteticas] : [reales];
    try {
      catalogoDeLaApp = catalogoConRemotas(embebidos, remotasActivas);
    } catch {
      // Una remota que no combina con las embebidas se descarta completa: quedan las embebidas.
      catalogoDeLaApp = catalogoConRemotas(embebidos, null);
    }
  }
  return catalogoDeLaApp;
}

/** Fija (o quita, con `null`) el archivo remoto verificado que usa `catalogoApp()`. */
export function fijarPlantillasRemotas(archivo: ArchivoPlantillas | null): void {
  remotasActivas = archivo;
  catalogoDeLaApp = null;
}

/** Nombre visible de un banco del catálogo ("Banco A (débito)"); su id si no trae nombre. */
export function nombreBanco(catalogo: CatalogoPlantillas, banco: string | null): string {
  if (banco === null) return 'tu banco';
  return catalogo.bancos.find((b) => b.id === banco)?.nombre ?? banco;
}
