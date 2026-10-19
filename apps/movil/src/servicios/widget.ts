import { z } from 'zod';
import { exigirConsentimiento, obtenerConsentimiento } from '../privacidad/consentimiento';
import { estadisticasActivas } from '../privacidad/estadisticas';
import { obtenerBloqueo, onboardingCompletado } from './ajustes';
import type { Contexto } from './contexto';
import { dias, miles } from './formato';
import { obtenerHoy, type VistaHoy } from './hoy';
import { escribirAjuste, leerAjuste } from './preferencias';

/**
 * Widget de Android "Hoy puedes" (M10, `02 §21`, RF-INT-03, Gratis). Aquí solo se arma lo que muestra: la cifra
 * sale de `obtenerHoy` (E4 en `packages/core`) y el componente nativo (`src/widget`) la pinta tal cual.
 */

/** Tocar el widget abre la app en "/" (Inicio decide onboarding o Hoy). */
export const ENLACE_WIDGET = 'finanvoz:///';
/** Micrófono del widget: abre Registrar y empieza a escuchar de una vez. */
export const ENLACE_DICTAR_WIDGET = 'finanvoz:///registrar?dictar=1';

export interface VistaWidget {
  /** `cifra`: "Hoy puedes $214 · 4 días"; `oculto`: "Ocultar montos"; `mensaje`: sin cifra (sin ingreso, sin datos). */
  readonly tipo: 'cifra' | 'oculto' | 'mensaje';
  readonly titulo: string | null;
  /** "$214"; `null` si no se muestra ninguna cifra. */
  readonly cifra: string | null;
  /** "4 días". */
  readonly detalle: string | null;
  /** La línea completa; también es la etiqueta para el lector de pantalla. */
  readonly texto: string;
  readonly enlace: string;
}

const AjustesWidget = z.strictObject({ ocultarMontos: z.boolean() });
export type AjustesWidget = z.infer<typeof AjustesWidget>;

/** "Ocultar montos": lo elegido, o encendido por omisión si el bloqueo biométrico está activo (`02 §21`). */
export function obtenerAjustesWidget(ctx: Contexto): AjustesWidget {
  return leerAjuste(ctx, 'widget', AjustesWidget) ?? { ocultarMontos: obtenerBloqueo(ctx).activo };
}

export function fijarOcultarMontosWidget(ctx: Contexto, ocultarMontos: boolean): void {
  exigirConsentimiento(ctx);
  escribirAjuste(ctx, 'widget', AjustesWidget, { ocultarMontos });
}

const mensaje = (texto: string, tipo: 'oculto' | 'mensaje' = 'mensaje'): VistaWidget => ({
  tipo,
  titulo: null,
  cifra: null,
  detalle: null,
  texto,
  enlace: ENLACE_WIDGET,
});

/**
 * Pura: de la vista de Hoy (o `null` si todavía no hay datos o no se pudieron leer) a lo que muestra el widget.
 * Con "Ocultar montos" no sale ninguna cifra, ni en el texto accesible.
 */
export function construirVistaWidget(
  hoy: Pick<VistaHoy, 'estado' | 'hoyPuedesPesos' | 'dias'> | null,
  ajustes: AjustesWidget,
): VistaWidget {
  if (ajustes.ocultarMontos) return mensaje('Toca para ver tu día', 'oculto');
  if (!hoy) return mensaje('Toca para empezar');
  if (hoy.estado === 'sin_ingreso') return mensaje('Dime cada cuándo te pagan');
  const titulo = hoy.estado === 'libre_negativo' ? 'Hoy:' : 'Hoy puedes';
  const cifra = `$${miles(hoy.estado === 'libre_negativo' ? 0 : hoy.hoyPuedesPesos)}`;
  const detalle = dias(hoy.dias);
  return {
    tipo: 'cifra',
    titulo,
    cifra,
    detalle,
    texto: `${titulo} ${cifra} · ${detalle}`,
    enlace: ENLACE_WIDGET,
  };
}

/**
 * Lo que debe mostrar el widget ahora. Antes del consentimiento o del onboarding no calcula nada (ni escribe).
 * Lo llaman la app tras cada escritura (`SincronizarWidget`) y la tarea del widget en segundo plano.
 */
export function obtenerVistaWidget(ctx: Contexto): VistaWidget {
  const ajustes = obtenerAjustesWidget(ctx);
  if (ajustes.ocultarMontos) return construirVistaWidget(null, ajustes);
  if (!obtenerConsentimiento(ctx) || !onboardingCompletado(ctx)) return construirVistaWidget(null, ajustes);
  return construirVistaWidget(obtenerHoy(ctx), ajustes);
}

/** `widget {evento}` de la analítica (`03 §8`). */
export type EventoWidget = 'agregado' | 'quitado';

const CLAVE_EVENTOS = 'widget_eventos';
const MAX_PENDIENTES = 20;
const EventosWidget = z.strictObject({
  pendientes: z.array(z.enum(['agregado', 'quitado'])).max(MAX_PENDIENTES),
});

/**
 * La tarea del widget corre sin interfaz y no puede enviar analítica: deja el evento pendiente y la app lo envía
 * al volver a primer plano (`tomarEventosWidget`). Sin el opt-in de estadísticas no guarda nada.
 */
export function anotarEventoWidget(ctx: Contexto, evento: EventoWidget): void {
  if (!estadisticasActivas(ctx)) return;
  const pendientes = leerAjuste(ctx, CLAVE_EVENTOS, EventosWidget)?.pendientes ?? [];
  escribirAjuste(ctx, CLAVE_EVENTOS, EventosWidget, {
    pendientes: [...pendientes, evento].slice(-MAX_PENDIENTES),
  });
}

/** Devuelve los eventos pendientes del widget y los olvida. */
export function tomarEventosWidget(ctx: Contexto): EventoWidget[] {
  const pendientes = leerAjuste(ctx, CLAVE_EVENTOS, EventosWidget)?.pendientes ?? [];
  if (pendientes.length > 0) escribirAjuste(ctx, CLAVE_EVENTOS, EventosWidget, { pendientes: [] });
  return pendientes;
}
