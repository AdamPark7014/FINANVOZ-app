import { ErrorDominio } from '@cartera/core';
import {
  abrirRespaldo,
  crearLlaveRespaldo,
  escribirRespaldo,
  leerEncabezado,
  type CriptoRespaldo,
  type LlaveRespaldo,
} from '@cartera/respaldo';
import type { BaseAbierta, PuertoSqlite } from '../db/abrir';
import { almacenEnMemoria, type AlmacenSeguro } from '../db/llave';
import { datosExportacion, type DatosExportados } from '../privacidad/exportar';
import { guardarLlaveRespaldo, leerLlaveRespaldo } from '../respaldo/llave';
import { restaurarEnBaseNueva, validarDatosRespaldo } from '../respaldo/importar';
import type { Contexto } from './contexto';
import { etiquetaDiaMes } from './formato';

/**
 * Respaldo cifrado `.cartera` (M9, `05 §E16`, `02 §19`). Todo lo nativo llega en `DependenciasRespaldo`
 * (`respaldo/expo.ts` en la app; `node:crypto` y better-sqlite3 en pruebas). La contraseña nunca se guarda ni se
 * envía: se guarda la llave derivada con su sal, así el respaldo automático cifra sin pedirla.
 */
export interface DependenciasRespaldo {
  readonly cripto: CriptoRespaldo;
  readonly almacen: AlmacenSeguro;
  readonly aleatorio: (n: number) => Uint8Array;
  /** Base de la app (la que reemplaza una restauración). */
  readonly puertoBase: PuertoSqlite;
  /** Base desechable en memoria para el ensayo de la importación antes de tocar la real. */
  readonly puertoEnsayo: () => PuertoSqlite;
}

/** Archivos del sistema: hoja de compartir y selector (`respaldo/expo.ts` en la app). */
export interface ArchivosRespaldo {
  compartir(nombre: string, bytes: Uint8Array): Promise<void>;
  /** `null` si la persona cancela. */
  elegir(): Promise<Uint8Array | null>;
}

/** Mínimo de caracteres de la contraseña de respaldo (`02 §19`). */
export const MIN_CONTRASENA_RESPALDO = 10;

/** Mismo mensaje para contraseña equivocada y archivo dañado, a propósito (`02 §19`). */
export const MENSAJE_NO_ABRE = 'No pude abrir el respaldo. Revisa la contraseña o el archivo.';

export type ProblemaContrasena = 'corta' | 'no_coincide';

/** Validación de la contraseña nueva (se escribe dos veces). `null` si está bien. */
export function validarContrasenaNueva(contrasena: string, confirmacion: string): ProblemaContrasena | null {
  if ([...contrasena.normalize('NFKC')].length < MIN_CONTRASENA_RESPALDO) return 'corta';
  if (contrasena.normalize('NFKC') !== confirmacion.normalize('NFKC')) return 'no_coincide';
  return null;
}

export function tieneContrasenaRespaldo(deps: Pick<DependenciasRespaldo, 'almacen'>): boolean {
  return leerLlaveRespaldo(deps.almacen) !== null;
}

/**
 * Crea la contraseña de respaldo o la cambia (CA-M9-08): sal nueva de 16 bytes y llave nueva (scrypt con
 * `n = 2^17`), guardadas en el almacén seguro. Los respaldos anteriores siguen abriéndose con su contraseña.
 */
export async function fijarContrasenaRespaldo(
  deps: Pick<DependenciasRespaldo, 'cripto' | 'almacen'>,
  contrasena: string,
  confirmacion: string,
): Promise<void> {
  const problema = validarContrasenaNueva(contrasena, confirmacion);
  if (problema) throw new ErrorDominio(`contrasena_${problema}`, 'la contraseña de respaldo no es válida');
  guardarLlaveRespaldo(deps.almacen, await crearLlaveRespaldo(deps.cripto, contrasena));
}

/** Nombre sugerido del archivo: `finanvoz-2026-10-12.cartera`. */
export function nombreArchivoRespaldo(ctx: Contexto): string {
  return `finanvoz-${ctx.reloj.hoy()}.cartera`;
}

/**
 * Bytes del `.cartera` con todo el libro, cifrados con la llave guardada (sin pedir la contraseña). Es lo que
 * comparte "Exportar respaldo" y lo que sube el respaldo automático semanal.
 */
export async function generarRespaldo(
  deps: Pick<DependenciasRespaldo, 'cripto' | 'almacen'>,
  ctx: Contexto,
): Promise<Uint8Array> {
  const llave = leerLlaveRespaldo(deps.almacen);
  if (!llave) throw new ErrorDominio('respaldo_sin_contrasena', 'primero crea la contraseña de respaldo');
  const datos = datosExportacion(ctx);
  return escribirRespaldo(deps.cripto, llave, JSON.stringify(datos), {
    creadoEn: new Date(datos.generado_en).toISOString().replace(/\.\d{3}Z$/, 'Z'),
    versionEsquema: datos.version_esquema,
  });
}

/** Fecha de creación del respaldo según su encabezado, sin contraseña (listas de respaldos en la nube). */
export function fechaRespaldo(archivo: Uint8Array): string {
  return leerEncabezado(archivo).encabezado.creado_en;
}

/** Respaldo ya descifrado, validado y ensayado: listo para reemplazar la base. */
export interface RespaldoListo {
  readonly datos: DatosExportados;
  readonly llave: LlaveRespaldo;
  /** Movimientos vigentes que trae ("Listo: recuperé 1,284 movimientos"). */
  readonly movimientos: number;
  /** Fecha civil en que se hizo el respaldo. */
  readonly fecha: string;
}

function contarVigentes(datos: DatosExportados): number {
  const transacciones = datos.tablas.transaccion ?? [];
  const anuladas = new Set(transacciones.map((t) => t.revierte_a ?? null).filter((x) => x !== null));
  return transacciones.filter((t) => t.tipo !== 'reversa' && !anuladas.has(t.id ?? '')).length;
}

/**
 * Abre un `.cartera` con la contraseña: valida el encabezado sin derivar, descifra, valida el contenido con Zod
 * y ensaya la importación en una base en memoria (integridad incluida) antes de tocar la base real. Contraseña
 * equivocada y archivo alterado fallan igual (`respaldo_corrupto_o_contrasena_incorrecta`).
 */
export async function prepararRestauracion(
  deps: Pick<DependenciasRespaldo, 'cripto' | 'aleatorio' | 'puertoEnsayo'>,
  archivo: Uint8Array,
  contrasena: string,
): Promise<RespaldoListo> {
  const abierto = await abrirRespaldo(deps.cripto, archivo, contrasena);
  const datos = validarDatosRespaldo(abierto.json);
  const ensayo = restaurarEnBaseNueva({
    puerto: deps.puertoEnsayo(),
    almacen: almacenEnMemoria(),
    aleatorio: deps.aleatorio,
    datos,
  });
  ensayo.cerrar();
  return { datos, llave: abierto.llave, movimientos: contarVigentes(datos), fecha: datos.fecha };
}

/**
 * Reemplaza la base por la del respaldo (la raíz ya cerró la anterior y borró todo) y guarda la llave del
 * respaldo para que el automático siga con la misma contraseña en este teléfono.
 */
export function restaurarRespaldo(
  deps: Pick<DependenciasRespaldo, 'almacen' | 'aleatorio' | 'puertoBase'>,
  listo: RespaldoListo,
): BaseAbierta {
  const base = restaurarEnBaseNueva({
    puerto: deps.puertoBase,
    almacen: deps.almacen,
    aleatorio: deps.aleatorio,
    datos: listo.datos,
  });
  guardarLlaveRespaldo(deps.almacen, listo.llave);
  return base;
}

/** Mensaje de UI para un error del respaldo (`02 §19`); nunca lleva datos. */
export function mensajeErrorRespaldo(error: unknown): string {
  const codigo = error instanceof ErrorDominio ? error.codigo : '';
  switch (codigo) {
    case 'respaldo_no_reconocido':
      return 'Ese archivo no es un respaldo de Finanvoz.';
    case 'respaldo_version_no_soportada':
      return 'Ese respaldo es de una versión más nueva de Finanvoz. Actualiza la app e intenta de nuevo.';
    case 'respaldo_sin_contrasena':
      return 'Primero crea la contraseña de tus respaldos.';
    case 'contrasena_corta':
      return `Usa al menos ${MIN_CONTRASENA_RESPALDO} caracteres.`;
    case 'contrasena_no_coincide':
      return 'Las contraseñas no coinciden.';
    default:
      return MENSAJE_NO_ABRE;
  }
}

/** `1284` → `"1,284"` (sin depender de Intl). */
function conComas(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function movimientos(n: number): string {
  return `${conComas(n)} ${n === 1 ? 'movimiento' : 'movimientos'}`;
}

/** "Tu respaldo del 11 oct 2026 trae 1,284 movimientos." */
export function resumenRespaldo(listo: Pick<RespaldoListo, 'fecha' | 'movimientos'>): string {
  return `Tu respaldo del ${etiquetaDiaMes(listo.fecha)} ${listo.fecha.slice(0, 4)} trae ${movimientos(listo.movimientos)}.`;
}

/** "Listo: recuperé 1,284 movimientos" (`02 §19`). */
export function mensajeRestaurado(listo: Pick<RespaldoListo, 'movimientos'>): string {
  return `Listo: recuperé ${movimientos(listo.movimientos)}`;
}
