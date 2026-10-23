// Orquestación del nivel nube (docs/06-NLU.md §2 y §10.1; 03 §6):
//   proveedor principal → si 5xx/429/red/tiempo, un intento con el alterno (sin alterno, otro con el mismo proveedor)
//   → quitar null (variante nulable) → validar con Zod → si falla, un reintento con el error → si vuelve a fallar,
//   aclarar/no_entendi.
// Cada intento tiene su tope (`TIEMPO_INTENTO_INTERPRETAR_MS`, ~4 s) y todos descuentan de un presupuesto total
// (`PRESUPUESTO_TOTAL_MS`) menor que el tiempo máximo del cliente: un intento que ya no cabe no se inicia.
// No registra nada: devuelve metadatos para que el manejador los registre (regla 9).
import type { ContextoMinimo } from './contrato.ts';
import { construirPrompt, mensajeCorreccion, type Prompt } from './prompt.ts';
import {
  type Adaptador,
  FallaProveedor,
  type NombreProveedor,
  PRESUPUESTO_TOTAL_MS,
  TIEMPO_INTENTO_INTERPRETAR_MS,
  TIEMPO_MAXIMO_MS,
  TIEMPO_MINIMO_INTENTO_MS,
} from './proveedores.ts';

/** Validación inyectada (en el proxy, el esquema Zod generado; en la evaluación, el de `@cartera/nlu`). */
export type Validador = (valor: unknown) => { ok: true; valor: unknown } | { ok: false; error: string };

export interface OpcionesTiempo {
  /** Tope de cada llamada a un proveedor (`interpretar`: `TIEMPO_INTENTO_INTERPRETAR_MS`; `turno`: `TIEMPO_MAXIMO_MS`). */
  tiempoMaximoMs?: number;
  /** Presupuesto total de la petición, del que descuenta cada intento. */
  presupuestoMs?: number;
  /** Si lo que queda del presupuesto es menor, no se inicia otro intento. */
  tiempoMinimoIntentoMs?: number;
  ahora: () => number;
}

export interface OpcionesInterpretar extends OpcionesTiempo {
  /**
   * Principal primero, alterno después (se usa como mucho uno alterno). Con uno solo, el segundo intento tras un
   * tiempo agotado, 5xx, 429 o falla de red es con el mismo proveedor.
   */
  adaptadores: readonly Adaptador[];
  validar: Validador;
}

export type ResultadoInterpretar =
  | ({
      ok: true;
      interpretacion: unknown;
      proveedor: NombreProveedor;
      modelo: string;
      latencia_ms: number;
      /** `ok`, `reintento_validacion` o `no_entendi` (para el registro de metadatos). */
      desenlace: 'ok' | 'reintento_validacion' | 'no_entendi';
      llamadas: number;
    } & UsoTokens)
  | ({
      ok: false;
      codigo: 'proveedor_fallo' | 'tiempo_agotado';
      proveedor: NombreProveedor | undefined;
      modelo: string | undefined;
      latencia_ms: number;
      llamadas: number;
      estado_proveedor: number | undefined;
    } & UsoTokens);

/** Tokens sumados de todas las llamadas de una petición; la caché, aparte, para vigilar el costo (sin PII). */
export interface UsoTokens {
  tokens_entrada: number;
  tokens_salida: number;
  tokens_cache_leidos: number;
  tokens_cache_escritos: number;
}

export const usoVacio = (): UsoTokens => ({
  tokens_entrada: 0,
  tokens_salida: 0,
  tokens_cache_leidos: 0,
  tokens_cache_escritos: 0,
});

export function sumarUso(uso: UsoTokens, r: Partial<UsoTokens>): void {
  uso.tokens_entrada += r.tokens_entrada ?? 0;
  uso.tokens_salida += r.tokens_salida ?? 0;
  uso.tokens_cache_leidos += r.tokens_cache_leidos ?? 0;
  uso.tokens_cache_escritos += r.tokens_cache_escritos ?? 0;
}

export const NO_ENTENDI = {
  intencion: 'aclarar',
  motivo: 'no_entendi',
  pregunta: 'No te entendí. ¿Me lo dices de otra forma?',
} as const;

/** Rutas y mensajes de Zod sin valores (el mensaje de Zod no incluye el dato). */
export function describirErrorZod(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
): string {
  return issues
    .slice(0, 8)
    .map((i) => `${i.path.map(String).join('.') || '(raíz)'}: ${i.message}`)
    .join('; ');
}

function quitarNulos(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(quitarNulos);
  if (typeof valor !== 'object' || valor === null) return valor;
  const salida: Record<string, unknown> = {};
  for (const [clave, v] of Object.entries(valor)) if (v !== null) salida[clave] = quitarNulos(v);
  return salida;
}

/** Saca `interpretacion` de la raíz `{ interpretacion }` y valida. */
function leer(texto: string, adaptador: Adaptador, validar: Validador) {
  let json: unknown;
  try {
    json = JSON.parse(texto);
  } catch {
    return { ok: false as const, error: 'la respuesta no es JSON' };
  }
  if (adaptador.nulable) json = quitarNulos(json);
  if (typeof json !== 'object' || json === null || !('interpretacion' in json)) {
    return { ok: false as const, error: 'falta la raíz {"interpretacion": ...}' };
  }
  return validar((json as { interpretacion: unknown }).interpretacion);
}

/** Corre `fn` con un tiempo máximo: al vencer, aborta la señal y lanza `FallaProveedor('tiempo')`. */
export async function conTiempo<T>(ms: number, fn: (senal: AbortSignal) => Promise<T>): Promise<T> {
  const control = new AbortController();
  const temporizador = setTimeout(() => control.abort(), ms);
  try {
    return await Promise.race([
      fn(control.signal),
      new Promise<never>((_, rechazar) =>
        control.signal.addEventListener('abort', () => rechazar(new FallaProveedor('tiempo')), {
          once: true,
        }),
      ),
    ]);
  } finally {
    clearTimeout(temporizador);
  }
}

/**
 * Plazos de los intentos de una petición que empezó en `inicio`: cada uno recibe `min(tope por intento, restante)`;
 * si lo que queda no llega al mínimo devuelve `null` y no se inicia otro intento. El primero siempre se intenta y
 * no lee el reloj (acaba de leerse para `inicio`).
 */
export function crearPresupuesto(opciones: OpcionesTiempo, inicio: number): () => number | null {
  const tope = opciones.tiempoMaximoMs ?? TIEMPO_MAXIMO_MS;
  const total = opciones.presupuestoMs ?? PRESUPUESTO_TOTAL_MS;
  const minimo = opciones.tiempoMinimoIntentoMs ?? TIEMPO_MINIMO_INTENTO_MS;
  let primero = true;
  return () => {
    if (primero) {
      primero = false;
      return Math.min(tope, total);
    }
    const restante = total - (opciones.ahora() - inicio);
    return restante < minimo ? null : Math.min(tope, restante);
  };
}

export async function interpretar(
  texto: string,
  contexto: ContextoMinimo,
  opciones: OpcionesInterpretar,
): Promise<ResultadoInterpretar> {
  const inicio = opciones.ahora();
  const plazo = crearPresupuesto(
    { ...opciones, tiempoMaximoMs: opciones.tiempoMaximoMs ?? TIEMPO_INTENTO_INTERPRETAR_MS },
    inicio,
  );
  const prompt: Prompt = construirPrompt(texto, contexto);
  const [principal, alterno] = opciones.adaptadores;
  // Sin alterno (p. ej. `NLU_PROVEEDORES=anthropic`), el segundo intento es con el mismo proveedor.
  const candidatos = principal ? [principal, alterno ?? principal] : [];
  const uso = usoVacio();
  let llamadas = 0;
  let ultimaFalla: FallaProveedor | undefined;
  let ultimo: Adaptador | undefined;

  for (const adaptador of candidatos) {
    // Sin presupuesto para el alterno se responde con la falla del principal (el manejador devuelve el cupo).
    const tiempo = plazo();
    if (tiempo === null) break;
    ultimo = adaptador;
    let respuesta;
    try {
      llamadas += 1;
      respuesta = await conTiempo(tiempo, (senal) => adaptador.llamar({ prompt, senal }));
    } catch (e) {
      const falla = e instanceof FallaProveedor ? e : new FallaProveedor('servidor');
      ultimaFalla = falla;
      // Ante un 4xx (que no sea 429) el alterno no se intenta: el error es de la petición (03 §6, solo 5xx).
      if (falla.tipo === 'cliente') break;
      continue;
    }
    sumarUso(uso, respuesta);

    const base = { proveedor: adaptador.nombre, modelo: adaptador.modelo };
    const primera = leer(respuesta.texto, adaptador, opciones.validar);
    if (primera.ok) {
      return {
        ok: true,
        ...base,
        interpretacion: primera.valor,
        ...uso,
        latencia_ms: opciones.ahora() - inicio,
        desenlace: 'ok',
        llamadas,
      };
    }

    // Reintento único con el error de validación, con el mismo proveedor. Sin presupuesto, no_entendi.
    let segunda: ReturnType<typeof leer> = { ok: false, error: '' };
    const tiempoReintento = plazo();
    if (tiempoReintento !== null) {
      try {
        llamadas += 1;
        const reintento = { salidaAnterior: respuesta.texto, correccion: mensajeCorreccion(primera.error) };
        const r = await conTiempo(tiempoReintento, (senal) => adaptador.llamar({ prompt, reintento, senal }));
        sumarUso(uso, r);
        segunda = leer(r.texto, adaptador, opciones.validar);
      } catch {
        // Si el reintento falla, se responde no_entendi: ya hubo una respuesta del proveedor.
      }
    }
    return {
      ok: true,
      ...base,
      interpretacion: segunda.ok ? segunda.valor : NO_ENTENDI,
      ...uso,
      latencia_ms: opciones.ahora() - inicio,
      desenlace: segunda.ok ? 'reintento_validacion' : 'no_entendi',
      llamadas,
    };
  }

  return {
    ok: false,
    codigo: ultimaFalla?.tipo === 'tiempo' ? 'tiempo_agotado' : 'proveedor_fallo',
    proveedor: ultimo?.nombre,
    modelo: ultimo?.modelo,
    ...uso,
    latencia_ms: opciones.ahora() - inicio,
    llamadas,
    estado_proveedor: ultimaFalla?.estado,
  };
}
