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
  /**
   * Fecha civil del último archivo `.cartera` exportado (hoja de compartir). Opcional: los estados guardados antes
   * no la traen. También cuenta como respaldo para el aviso de 14 días.
   */
  ultimo_archivo: z.string().nullable().optional(),
});
type Estado = z.infer<typeof Estado>;

const INICIAL: Estado = {
  automatico: false,
  solo_wifi: true,
  ultimo: null,
  pedir_correo: false,
  ultimo_archivo: null,
};

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
  /** Último respaldo en la nube (o restaurado). */
  readonly ultimo: PlainDate | null;
  /** Último archivo `.cartera` exportado. */
  readonly ultimoArchivo: PlainDate | null;
  /**
   * El más reciente de los dos: "Último respaldo: hace 2 días" · "Último respaldo: ayer (archivo exportado)" ·
   * sin ninguno, "Todavía no tienes respaldos en la nube." o, en una build sin nube, una invitación a exportar.
   */
  readonly textoUltimo: string;
  /** Solo la nube, para la tarjeta de la nube: "Último respaldo: hace 2 días" · "Todavía no…". */
  readonly textoUltimoNube: string;
  /** 14 días o más sin respaldo (desde el último en la nube o en archivo, o desde el onboarding). */
  readonly pendiente: boolean;
  /** La sesión de correo ya no sirve: pedir correo y código otra vez. */
  readonly pedirCorreo: boolean;
}

export const TEXTO_SIN_RESPALDOS_NUBE = 'Todavía no tienes respaldos en la nube.';
export const TEXTO_SIN_RESPALDOS =
  'Todavía no tienes respaldos. Exporta un archivo y guárdalo fuera del teléfono.';

function haceDias(desde: PlainDate, hoy: PlainDate): string {
  const d = diferenciaDias(desde, hoy);
  if (d <= 0) return 'hoy';
  if (d === 1) return 'ayer';
  return `hace ${d} días`;
}

/** La fecha más reciente (civiles `YYYY-MM-DD`: se comparan como texto). */
function fechaMasReciente(
  a: PlainDate | null | undefined,
  b: PlainDate | null | undefined,
): PlainDate | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return a >= b ? a : b;
}

/** Referencia del aviso de 14 días: el último respaldo (nube o archivo) o, si nunca hubo, el fin del onboarding. */
function desdeAviso(ctx: Contexto): PlainDate | null {
  const e = leer(ctx);
  return fechaMasReciente(e.ultimo, e.ultimo_archivo) ?? fechaOnboarding(ctx);
}

/**
 * Ajustes → Respaldo. `conNube: false` en builds sin nube (sin Supabase): sin respaldos, el texto invita a exportar
 * un archivo en vez de hablar de la nube.
 */
export function obtenerRespaldoNube(
  ctx: Contexto,
  opciones: { readonly conNube?: boolean } = {},
): VistaRespaldoNube {
  const e = leer(ctx);
  const hoy = ctx.reloj.hoy();
  const archivo = e.ultimo_archivo ?? null;
  const reciente = fechaMasReciente(e.ultimo, archivo);
  const textoUltimoNube = e.ultimo ? `Último respaldo: ${haceDias(e.ultimo, hoy)}` : TEXTO_SIN_RESPALDOS_NUBE;
  const textoUltimo =
    reciente === null
      ? opciones.conNube === false
        ? TEXTO_SIN_RESPALDOS
        : TEXTO_SIN_RESPALDOS_NUBE
      : reciente === e.ultimo
        ? textoUltimoNube
        : `Último respaldo: ${haceDias(reciente, hoy)} (archivo exportado)`;
  return {
    automatico: e.automatico,
    soloWifi: e.solo_wifi,
    ultimo: e.ultimo,
    ultimoArchivo: archivo,
    textoUltimo,
    textoUltimoNube,
    pendiente: respaldoPendiente(desdeAviso(ctx), hoy),
    pedirCorreo: e.pedir_correo,
  };
}

/**
 * Tras abrir la hoja de compartir con el `.cartera`: guarda la fecha para que la tarjeta de Ajustes y el aviso
 * "Respalda tus datos" la cuenten. El sistema no dice si la persona guardó el archivo o cerró la hoja; contar de más
 * aquí solo retrasa un aviso, nunca toca el dinero. Sin datos del archivo: solo la fecha civil.
 */
export function registrarRespaldoArchivo(ctx: Contexto): PlainDate {
  const fecha = ctx.reloj.hoy();
  escribir(ctx, { ultimo_archivo: fecha });
  return fecha;
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
  // El archivo exportado no depende de la cuenta de la nube: su fecha se conserva.
  escribir(ctx, { ...INICIAL, ultimo_archivo: leer(ctx).ultimo_archivo ?? null });
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

/**
 * Deja en el teléfono exactamente los avisos de respaldo pendiente (idempotente). Con `conNube: false` (build sin
 * respaldo en la nube) no hay nada que atender: se quitan los que hubiera.
 */
export function sincronizarAvisoRespaldo(
  ctx: Contexto,
  puerto: PuertoNotificaciones,
  horaActual: HoraDelDia,
  { conNube = true }: { readonly conNube?: boolean } = {},
): Promise<ResultadoSincronizacion> {
  const plan = conNube ? planAvisoRespaldo(ctx, horaActual) : [];
  return sincronizarAvisos(puerto, plan, PREFIJO_AVISO_RESPALDO);
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
