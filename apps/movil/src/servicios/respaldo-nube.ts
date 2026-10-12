import { z } from 'zod';
import { diferenciaDias, ErrorDominio, type PlainDate } from '@cartera/core';
import { leerEncabezado } from '@cartera/respaldo';
import type { HoraDelDia } from '../avisos/planificar';
import { sincronizarAvisos, type PuertoNotificaciones, type ResultadoSincronizacion } from '../avisos/puerto';
import {
  planificarAvisosRespaldo,
  PREFIJO_AVISO_RESPALDO,
  respaldoPendiente,
  type AvisoRespaldo,
} from '../avisos/respaldo';
import type { CuentaRespaldo, ErrorCuenta, ModoCodigo } from '../nube/cuenta-respaldo';
import type { ErrorRespaldoNube, RespaldoNube, RespaldoRemoto } from '../nube/respaldo-nube';
import { fechaOnboarding } from './ajustes';
import { obtenerPreferenciasAvisos } from './avisos-tarjetas';
import type { Contexto } from './contexto';
import { escribirAjuste, leerAjuste } from './preferencias';
import { generarRespaldo, type DependenciasRespaldo } from './respaldo';

/**
 * Respaldo en la nube (M9, `02 §19`): cuenta de respaldo (correo → código), "Respaldar ahora", respaldo
 * automático semanal con Wi-Fi, borrar la cuenta y restaurar el más reciente. La nube (`nube/respaldo-nube.ts`)
 * y la cuenta (`nube/cuenta-respaldo.ts`) llegan inyectadas: en Node se prueban con dobles. El blob sale ya
 * cifrado con la llave guardada (`generarRespaldo`); la contraseña nunca se guarda ni se pide aquí.
 *
 * Estado local en `ajuste` (`respaldo_nube`): si el automático está activo, si es solo con Wi-Fi, la fecha civil
 * del último respaldo en la nube y si la nube pidió volver a entrar con el correo. Nada de esto se registra.
 */

export type { CuentaRespaldo, ErrorCuenta, ModoCodigo, ErrorRespaldoNube, RespaldoNube, RespaldoRemoto };

/** Lo que la app necesita de la nube para el respaldo (la raíz lo arma con `nube/expo.ts`). */
export interface NubeRespaldo {
  readonly cuenta: CuentaRespaldo;
  readonly respaldos: RespaldoNube;
}

/** Tipo de red del teléfono para el automático (`expo-network` en la app). */
export type TipoRed = 'wifi' | 'celular' | 'ninguna';

const CLAVE = 'respaldo_nube';
/** El automático es semanal (`02 §19`). */
export const DIAS_RESPALDO_AUTOMATICO = 7;

const Estado = z.strictObject({
  automatico: z.boolean(),
  solo_wifi: z.boolean(),
  /** Fecha civil del último respaldo en la nube (o del respaldo restaurado). */
  ultimo: z.string().nullable(),
  /** La nube respondió `sin_correo`: hay que pedir otra vez el correo y el código. */
  pedir_correo: z.boolean(),
});
type Estado = z.infer<typeof Estado>;

const INICIAL: Estado = { automatico: false, solo_wifi: true, ultimo: null, pedir_correo: false };

function leer(ctx: Contexto): Estado {
  return leerAjuste(ctx, CLAVE, Estado) ?? INICIAL;
}

function escribir(ctx: Contexto, cambios: Partial<Estado>): Estado {
  const nuevo = { ...leer(ctx), ...cambios };
  escribirAjuste(ctx, CLAVE, Estado, nuevo);
  return nuevo;
}

export interface VistaRespaldoNube {
  readonly automatico: boolean;
  readonly soloWifi: boolean;
  readonly ultimo: PlainDate | null;
  /** "Último respaldo: hace 2 días" · "Todavía no tienes respaldos en la nube." */
  readonly textoUltimo: string;
  /** 14 días o más sin respaldo (desde el último o desde el onboarding). */
  readonly pendiente: boolean;
  /** La sesión de correo ya no sirve: pedir correo y código otra vez. */
  readonly pedirCorreo: boolean;
}

function haceDias(desde: PlainDate, hoy: PlainDate): string {
  const d = diferenciaDias(desde, hoy);
  if (d <= 0) return 'hoy';
  if (d === 1) return 'ayer';
  return `hace ${d} días`;
}

/** Referencia del aviso de 14 días: el último respaldo o, si nunca hubo, el fin del onboarding. */
function desdeAviso(ctx: Contexto): PlainDate | null {
  return leer(ctx).ultimo ?? fechaOnboarding(ctx);
}

export function obtenerRespaldoNube(ctx: Contexto): VistaRespaldoNube {
  const e = leer(ctx);
  const hoy = ctx.reloj.hoy();
  return {
    automatico: e.automatico,
    soloWifi: e.solo_wifi,
    ultimo: e.ultimo,
    textoUltimo: e.ultimo
      ? `Último respaldo: ${haceDias(e.ultimo, hoy)}`
      : 'Todavía no tienes respaldos en la nube.',
    pendiente: respaldoPendiente(desdeAviso(ctx), hoy),
    pedirCorreo: e.pedir_correo,
  };
}

/** Ajustes → Respaldo: interruptores del automático semanal y de "solo con Wi-Fi". */
export function fijarRespaldoAutomatico(
  ctx: Contexto,
  cambios: { readonly automatico?: boolean; readonly soloWifi?: boolean },
): VistaRespaldoNube {
  escribir(ctx, {
    ...(cambios.automatico === undefined ? {} : { automatico: cambios.automatico }),
    ...(cambios.soloWifi === undefined ? {} : { solo_wifi: cambios.soloWifi }),
  });
  return obtenerRespaldoNube(ctx);
}

export type ErrorRespaldar = ErrorRespaldoNube | 'sin_contrasena' | 'local';
export type ResultadoRespaldar = { ok: true; fecha: PlainDate } | { ok: false; error: ErrorRespaldar };

type DepsCifrado = Pick<DependenciasRespaldo, 'cripto' | 'almacen'>;

/**
 * "Respaldar ahora" y el automático: cifra todo el libro con la llave guardada, lo sube (el servidor deja los 4
 * más recientes, CA-M9-04) y guarda la fecha. Si la nube pide el correo, lo marca para que la pantalla lo pida.
 */
export async function respaldarEnNube(
  deps: { readonly cifrado: DepsCifrado; readonly respaldos: RespaldoNube },
  ctx: Contexto,
): Promise<ResultadoRespaldar> {
  let bytes: Uint8Array;
  try {
    bytes = await generarRespaldo(deps.cifrado, ctx);
  } catch (e) {
    const sinContrasena = e instanceof ErrorDominio && e.codigo === 'respaldo_sin_contrasena';
    return { ok: false, error: sinContrasena ? 'sin_contrasena' : 'local' };
  }
  const r = await deps.respaldos.subir(bytes, leerEncabezado(bytes).encabezado.version);
  if (!r.ok) {
    if (r.error === 'sin_correo' || r.error === 'sin_sesion') escribir(ctx, { pedir_correo: true });
    return { ok: false, error: r.error };
  }
  const fecha = ctx.reloj.hoy();
  escribir(ctx, { ultimo: fecha, pedir_correo: false });
  return { ok: true, fecha };
}

export type MotivoSinRespaldo = 'apagado' | 'reciente' | 'sin_red' | 'sin_wifi' | 'pedir_correo';

/** ¿Le toca al automático? Semanal, con la red que pide el ajuste y con la sesión de correo vigente. */
export function motivoRespaldoAutomatico(ctx: Contexto, red: TipoRed): MotivoSinRespaldo | null {
  const e = leer(ctx);
  if (!e.automatico) return 'apagado';
  if (e.pedir_correo) return 'pedir_correo';
  if (e.ultimo && diferenciaDias(e.ultimo, ctx.reloj.hoy()) < DIAS_RESPALDO_AUTOMATICO) return 'reciente';
  if (red === 'ninguna') return 'sin_red';
  if (e.solo_wifi && red !== 'wifi') return 'sin_wifi';
  return null;
}

export type ResultadoAutomatico =
  | { readonly tipo: 'hecho'; readonly fecha: PlainDate }
  | { readonly tipo: 'omitido'; readonly motivo: MotivoSinRespaldo }
  | { readonly tipo: 'error'; readonly error: ErrorRespaldar };

/**
 * Tarea semanal en segundo plano (`expo-background-task`, `03` tabla de arquitectura): corre con el teléfono
 * bloqueado porque cifra con la llave guardada. Solo pregunta la red cuando ya le toca.
 */
export async function ejecutarRespaldoAutomatico(
  deps: {
    readonly cifrado: DepsCifrado;
    readonly respaldos: RespaldoNube;
    readonly red: () => Promise<TipoRed>;
  },
  ctx: Contexto,
): Promise<ResultadoAutomatico> {
  const previo = motivoRespaldoAutomatico(ctx, 'wifi');
  if (previo) return { tipo: 'omitido', motivo: previo };
  const red = await deps.red().catch((): TipoRed => 'ninguna');
  const motivo = motivoRespaldoAutomatico(ctx, red);
  if (motivo) return { tipo: 'omitido', motivo };
  const r = await respaldarEnNube(deps, ctx);
  return r.ok ? { tipo: 'hecho', fecha: r.fecha } : { tipo: 'error', error: r.error };
}

/**
 * Confirma el código del correo (vincular o entrar). Con éxito, la nube deja de pedir el correo. Devuelve el
 * usuario para que la raíz vuelva a identificar las compras (pendiente 58).
 */
export async function confirmarCodigoRespaldo(
  cuenta: CuentaRespaldo,
  ctx: Contexto,
  correo: string,
  codigo: string,
  modo: ModoCodigo,
): Promise<{ ok: true; usuarioId: string; cambioUsuario: boolean } | { ok: false; error: ErrorCuenta }> {
  const antes = await cuenta.estado().catch(() => null);
  const r = await cuenta.verificarCodigo(correo, codigo, modo);
  if (!r.ok) return r;
  escribir(ctx, { pedir_correo: false });
  return { ok: true, usuarioId: r.usuarioId, cambioUsuario: antes?.usuarioId !== r.usuarioId };
}

/**
 * "Borrar cuenta de respaldo" de punta a punta (CA-M9-07): el servidor borra los archivos y el usuario; después
 * se olvida la sesión (la siguiente petición crea un anónimo nuevo) y el estado local vuelve al inicio. La
 * contraseña de respaldo (llave guardada) se conserva: sigue sirviendo para exportar archivos.
 */
export async function borrarCuentaRespaldo(
  nube: NubeRespaldo,
  ctx: Contexto,
): Promise<{ ok: true } | { ok: false; error: ErrorRespaldoNube }> {
  const r = await nube.respaldos.borrarCuenta();
  if (!r.ok) return r;
  await nube.cuenta.olvidarSesion();
  escribir(ctx, INICIAL);
  return { ok: true };
}

/** El más reciente por `creadoEn` (o por nombre, que lleva la hora UTC). */
function masReciente(lista: readonly RespaldoRemoto[]): RespaldoRemoto | null {
  return (
    [...lista].sort((a, b) =>
      a.creadoEn !== b.creadoEn ? (a.creadoEn < b.creadoEn ? 1 : -1) : a.nombre < b.nombre ? 1 : -1,
    )[0] ?? null
  );
}

/**
 * Restaurar desde la nube (`02 §19`, CA-M9-05): lista los respaldos de la cuenta y baja el más reciente. Lo
 * demás (contraseña, `prepararRestauracion`, `restaurarRespaldo`) es igual que con un archivo.
 */
export async function bajarUltimoRespaldo(
  respaldos: RespaldoNube,
): Promise<
  | { ok: true; bytes: Uint8Array; respaldo: RespaldoRemoto }
  | { ok: false; error: ErrorRespaldoNube | 'sin_respaldos' }
> {
  const lista = await respaldos.listar();
  if (!lista.ok) return lista;
  const ultimo = masReciente(lista.respaldos);
  if (!ultimo) return { ok: false, error: 'sin_respaldos' };
  const r = await respaldos.bajar(ultimo.nombre);
  if (!r.ok) return r;
  return { ok: true, bytes: r.bytes, respaldo: ultimo };
}

/**
 * Tras restaurar (archivo o nube): el respaldo abierto cuenta como el último (su fecha), así el aviso de 14 días
 * y el automático siguen desde ahí. El estado restaurado puede traer `pedir_correo` del otro teléfono: se limpia.
 */
export function registrarRespaldoRestaurado(ctx: Contexto, fecha: PlainDate): void {
  const e = leer(ctx);
  escribir(ctx, { ultimo: e.ultimo && e.ultimo > fecha ? e.ultimo : fecha, pedir_correo: false });
}

/** Avisos "Respaldo pendiente" que deben quedar programados (`02 §13`, CA-M9-06). */
export function planAvisoRespaldo(ctx: Contexto, horaActual: HoraDelDia): AvisoRespaldo[] {
  const pref = obtenerPreferenciasAvisos(ctx);
  return planificarAvisosRespaldo({
    hoy: ctx.reloj.hoy(),
    horaActual,
    desde: desdeAviso(ctx),
    activo: pref.respaldo,
    silencio: pref.silencio,
    horaPreferida: pref.hora,
  });
}

/** Deja en el teléfono exactamente los avisos de respaldo pendiente (idempotente). */
export function sincronizarAvisoRespaldo(
  ctx: Contexto,
  puerto: PuertoNotificaciones,
  horaActual: HoraDelDia,
): Promise<ResultadoSincronizacion> {
  return sincronizarAvisos(puerto, planAvisoRespaldo(ctx, horaActual), PREFIJO_AVISO_RESPALDO);
}

/** Mensaje de UI para un error del respaldo en la nube o de la cuenta (`02 §14`); nunca lleva datos. */
export function mensajeErrorNube(error: ErrorRespaldar | ErrorCuenta | 'sin_respaldos'): string {
  switch (error) {
    case 'sin_red':
      return 'No hay internet. Intenta de nuevo cuando tengas conexión.';
    case 'sin_correo':
    case 'sin_sesion':
      return 'Vuelve a entrar con tu correo para seguir respaldando.';
    case 'sin_contrasena':
      return 'Primero crea la contraseña de tus respaldos.';
    case 'demasiado_grande':
      return 'Tu respaldo es más grande de lo que cabe en la nube. Exporta un archivo.';
    case 'ocupado':
      return 'Ya se está guardando un respaldo. Intenta en un momento.';
    case 'no_encontrado':
    case 'sin_respaldos':
      return 'No encontré respaldos en la nube con ese correo.';
    case 'correo_invalido':
      return 'Revisa tu correo.';
    case 'codigo_invalido':
      return 'El código no es correcto o ya venció. Pide otro.';
    case 'demasiados_intentos':
      return 'Hiciste muchos intentos. Espera unos minutos.';
    case 'sin_cuenta':
      return 'No encontré una cuenta de respaldo con ese correo.';
    case 'local':
      return 'No pude preparar tu respaldo. Intenta de nuevo.';
    default:
      return 'No pude conectar con la nube. Intenta más tarde.';
  }
}
