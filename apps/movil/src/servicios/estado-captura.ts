/**
 * Estado de la captura automática (`ajuste` `captura`): divulgación aceptada (RF-PRI-02, `08 §3.1`), apps
 * autorizadas, últimas señales del módulo nativo y detección de captura inactiva (RF-CAP-07, CA-M5-06).
 */
import { z } from 'zod';
import { exigirConsentimiento } from '../privacidad/consentimiento';
import type { Contexto } from './contexto';
import { borrarAjuste, escribirAjuste, leerAjuste } from './preferencias';

/** Sin eventos del servicio en 72 h con apps bancarias instaladas → aviso de captura inactiva. */
export const HORAS_CAPTURA_INACTIVA = 72;
const MS_INACTIVA = HORAS_CAPTURA_INACTIVA * 60 * 60 * 1000;

const Guardado = z.strictObject({
  /** Instante en que aceptó la divulgación destacada (evidencia del consentimiento de captura). */
  divulgacion_en: z.int().nullable(),
  activada: z.boolean(),
  activada_en: z.int().nullable(),
  /** Paquetes autorizados (lista blanca; el código nativo descarta todo lo demás, RF-CAP-02). */
  apps: z.array(z.string()),
  /** Últimas señales del módulo nativo. */
  apps_instaladas: z.array(z.string()),
  ultimo_evento: z.int().nullable(),
  permiso: z.enum(['concedido', 'denegado', 'desconocido']),
});
type Guardado = z.infer<typeof Guardado>;

const CLAVE = 'captura';
const INICIAL: Guardado = {
  divulgacion_en: null,
  activada: false,
  activada_en: null,
  apps: [],
  apps_instaladas: [],
  ultimo_evento: null,
  permiso: 'desconocido',
};

export interface EstadoCapturaVista {
  readonly divulgacionAceptada: boolean;
  readonly activada: boolean;
  readonly apps: readonly string[];
  readonly appsInstaladas: readonly string[];
  readonly permiso: 'concedido' | 'denegado' | 'desconocido';
  readonly ultimoEvento: number | null;
  /** RF-CAP-07: "No he visto notificaciones de tu banco en 3 días." */
  readonly inactiva: boolean;
}

/**
 * "Vuelve a activar la lectura de notificaciones" tras restaurar un respaldo. Ajuste aparte: el de `captura` es
 * estricto y lo traen respaldos de versiones anteriores.
 */
const CLAVE_REACTIVAR = 'captura_reactivar';
const Reactivar = z.strictObject({ desde: z.int() });

function leer(ctx: Contexto): Guardado {
  return leerAjuste(ctx, CLAVE, Guardado) ?? INICIAL;
}

function escribir(ctx: Contexto, valor: Guardado): void {
  escribirAjuste(ctx, CLAVE, Guardado, valor);
}

export function obtenerEstadoCaptura(ctx: Contexto): EstadoCapturaVista {
  const g = leer(ctx);
  return {
    divulgacionAceptada: g.divulgacion_en !== null,
    activada: g.activada,
    apps: g.apps,
    appsInstaladas: g.apps_instaladas,
    permiso: g.permiso,
    ultimoEvento: g.ultimo_evento,
    inactiva: esInactiva(ctx, g),
  };
}

function esInactiva(ctx: Contexto, g: Guardado): boolean {
  if (!g.activada || g.apps_instaladas.length === 0) return false;
  const desde = Math.max(g.ultimo_evento ?? 0, g.activada_en ?? 0);
  return ctx.reloj.ahora() - desde >= MS_INACTIVA;
}

/** RF-CAP-07 (CA-M5-06). */
export function capturaInactiva(ctx: Contexto): boolean {
  return esInactiva(ctx, leer(ctx));
}

/** "Activar" en la divulgación destacada: guarda el instante (antes de abrir el ajuste del sistema). */
export function aceptarDivulgacionCaptura(ctx: Contexto): void {
  exigirConsentimiento(ctx);
  const g = leer(ctx);
  if (g.divulgacion_en === null) escribir(ctx, { ...g, divulgacion_en: ctx.reloj.ahora() });
}

/** Con el permiso concedido y las apps elegidas, la captura queda activa. */
export function activarCaptura(ctx: Contexto, apps: readonly string[]): void {
  exigirConsentimiento(ctx);
  const g = leer(ctx);
  const ahora = ctx.reloj.ahora();
  escribir(ctx, {
    ...g,
    divulgacion_en: g.divulgacion_en ?? ahora,
    activada: true,
    activada_en: g.activada ? (g.activada_en ?? ahora) : ahora,
    apps: [...new Set(apps)].sort(),
  });
  borrarAjuste(ctx, CLAVE_REACTIVAR);
}

/** También descarta "Vuelve a activar la lectura de notificaciones": la persona decidió dejarla apagada. */
export function desactivarCaptura(ctx: Contexto): void {
  exigirConsentimiento(ctx);
  escribir(ctx, { ...leer(ctx), activada: false });
  borrarAjuste(ctx, CLAVE_REACTIVAR);
}

/**
 * Al restaurar un respaldo (pendiente 47): el ajuste restaurado puede decir "activada", pero en el teléfono nuevo
 * no hay acceso a notificaciones ni lista blanca nativa. La captura queda apagada, las señales del teléfono
 * anterior se olvidan y Hoy pide volver a activarla. Sin captura activa en el respaldo no hay nada que pedir.
 */
export function apagarCapturaTrasRestaurar(ctx: Contexto): void {
  const g = leer(ctx);
  if (!g.activada) return;
  escribir(ctx, { ...g, activada: false, permiso: 'desconocido', apps_instaladas: [] });
  escribirAjuste(ctx, CLAVE_REACTIVAR, Reactivar, { desde: ctx.reloj.ahora() });
}

/** Tarjeta de Hoy "Vuelve a activar la lectura de notificaciones" (hasta reactivarla o descartarla). */
export function reactivarCapturaPendiente(ctx: Contexto): boolean {
  return leerAjuste(ctx, CLAVE_REACTIVAR, Reactivar) !== null && !leer(ctx).activada;
}

/**
 * Señales del módulo nativo (al abrir la app y al volver a ella): permiso, apps bancarias instaladas y último
 * evento del servicio. El último evento nunca retrocede.
 */
export function registrarSenalesCaptura(
  ctx: Contexto,
  s: {
    /** `no_disponible` (sin módulo nativo) no cambia lo guardado. */
    permiso?: 'concedido' | 'denegado' | 'no_disponible';
    appsInstaladas?: readonly string[];
    ultimoEvento?: number | null;
  },
): void {
  const g = leer(ctx);
  const ultimo =
    s.ultimoEvento === undefined || s.ultimoEvento === null
      ? g.ultimo_evento
      : Math.max(g.ultimo_evento ?? 0, s.ultimoEvento);
  escribir(ctx, {
    ...g,
    ...(s.permiso && s.permiso !== 'no_disponible' ? { permiso: s.permiso } : {}),
    ...(s.appsInstaladas ? { apps_instaladas: [...new Set(s.appsInstaladas)].sort() } : {}),
    ultimo_evento: ultimo,
  });
}
