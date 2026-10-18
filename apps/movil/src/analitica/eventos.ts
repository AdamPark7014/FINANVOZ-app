import { z } from 'zod';

/**
 * Lista blanca de la analítica (`03 §8`, RNF-05, regla 9). Solo estos eventos y estas propiedades pueden salir
 * del teléfono, y solo con el opt-in de estadísticas. Cada propiedad es un valor de catálogo, un booleano o un
 * número chico acotado: no cabe un monto, un comercio, un alias, un nombre, un RFC ni un texto. Un evento con
 * una propiedad de más, un valor fuera de catálogo o un nombre desconocido se descarta completo.
 *
 * Entran los eventos de M2–M7, `plantillas_remotas`, `widget` y `modo_explicar` (M10); los de respaldo,
 * suscripciones, negocio y paquete para el contador se agregan con su hito.
 */
export const EVENTOS_PERMITIDOS = {
  app_abierta: z.strictObject({}),
  /** Pasos visibles del onboarding (O1–O7); "1" ocurre antes del consentimiento y por eso nunca sale. */
  onboarding_paso: z.strictObject({ paso: z.int().min(1).max(10) }),
  movimiento_registrado: z.strictObject({
    origen: z.enum(['voz', 'texto', 'formulario', 'captura', 'arqueo']),
    nivel_interprete: z.enum(['reglas', 'nube']).optional(),
    pregunto: z.boolean(),
    latencia_bucket: z.enum(['<1s', '1-3s', '3-8s', '>8s']).optional(),
    espacio: z.enum(['personal', 'negocio']),
  }),
  correccion: z.strictObject({
    campo: z.enum(['monto', 'categoria', 'cuenta', 'fecha', 'descripcion', 'tipo', 'otro']),
  }),
  /** `banco_id` solo si está en el catálogo de plantillas (RF-CAP-06: el conteo por banco, nunca el texto). */
  captura: z.strictObject({ banco_id: z.string().regex(/^[a-z][a-z0-9_]{1,31}$/), reconocida: z.boolean() }),
  arqueo: z.strictObject({ resultado: z.enum(['exacto', 'faltante', 'sobrante']) }),
  simulacion_vista: z.strictObject({
    escenarios: z.int().min(1).max(40),
    recomendado_tipo: z.enum(['base', 'contado_hoy', 'esperar', 'msi']),
  }),
  plan: z.strictObject({
    evento: z.enum([
      'paywall_visto',
      'prueba_iniciada',
      'compra',
      'restaurada',
      'cancelada',
      'vencida',
      'cuota_agotada',
    ]),
  }),
  /**
   * Revisión diaria de plantillas remotas (`07 §3.1`): la versión activa al terminar (1 = embebidas) y el código
   * del resultado; nunca el contenido del archivo. "No toca" y "sin llaves" no son revisiones y no se envían.
   */
  plantillas_remotas: z.strictObject({
    version: z.int().min(1).max(999),
    resultado: z.enum([
      'aceptada',
      'sin_cambios',
      'sin_red',
      'respuesta_invalida',
      'sin_llaves',
      'firma_invalida',
      'json_invalido',
      'formato_invalido',
      'plantillas_invalidas',
      'version_no_mayor',
      'app_antigua',
    ]),
  }),
  /** Agregar o quitar el widget "Hoy puedes" (`02 §21`); la tarea sin interfaz lo deja pendiente. */
  widget: z.strictObject({ evento: z.enum(['agregado', 'quitado']) }),
  /**
   * Modo explicar terminó con respuesta (`06 §6`, `02 §22`): si el modelo pasó la validación de cifras o cayó en
   * plantilla; cuántas vueltas a `/llm/turno` (1–4). Sin pregunta, montos ni texto de la respuesta.
   */
  modo_explicar: z.strictObject({
    resultado: z.enum(['explicacion', 'plantilla']),
    vueltas: z.int().min(1).max(4),
  }),
} as const;

type Eventos = typeof EVENTOS_PERMITIDOS;
export type NombreEvento = keyof Eventos;

/** Un evento permitido con sus propiedades tipadas. */
export type EventoAnalitica = {
  [N in NombreEvento]: { nombre: N; propiedades: z.infer<Eventos[N]> };
}[NombreEvento];

/**
 * Propiedades técnicas fijas que acompañan a cada evento: sin perfil de persona (eventos anónimos) y sin
 * geolocalización por IP. No llevan nada de la persona.
 */
export const PROPIEDADES_TECNICAS = {
  $process_person_profile: false,
  $geoip_disable: true,
  $lib: 'finanvoz',
} as const;

/**
 * Valida contra la lista blanca. Devuelve el evento limpio o `null` (y entonces no se envía nada). `banco_id`
 * además debe existir en `bancosPermitidos`, para que un comercio con forma de id no pueda colarse.
 */
export function validarEvento(
  evento: unknown,
  bancosPermitidos: ReadonlySet<string>,
): EventoAnalitica | null {
  if (!evento || typeof evento !== 'object') return null;
  const { nombre, propiedades } = evento as { nombre?: unknown; propiedades?: unknown };
  if (typeof nombre !== 'string' || !Object.hasOwn(EVENTOS_PERMITIDOS, nombre)) return null;
  const forma = EVENTOS_PERMITIDOS[nombre as NombreEvento] as z.ZodType;
  const r = forma.safeParse(propiedades);
  if (!r.success) return null;
  const limpio = r.data as Record<string, unknown>;
  if (nombre === 'captura' && !bancosPermitidos.has(limpio.banco_id as string)) return null;
  return { nombre, propiedades: limpio } as EventoAnalitica;
}

/** Latencia de registro en cubetas (nunca el valor exacto). */
export function bucketLatencia(ms: number): '<1s' | '1-3s' | '3-8s' | '>8s' {
  if (ms < 1000) return '<1s';
  if (ms < 3000) return '1-3s';
  if (ms < 8000) return '3-8s';
  return '>8s';
}
