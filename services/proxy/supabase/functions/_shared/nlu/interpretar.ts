// Orquestación del nivel nube (docs/06-NLU.md §2 y §10.1; 03 §6):
//   proveedor principal (8 s) → si 5xx/429/red/tiempo, un intento con el alterno (8 s)
//   → quitar null (variante nulable) → validar con Zod → si falla, un reintento con el error → si vuelve a fallar,
//   aclarar/no_entendi.
// No registra nada: devuelve metadatos para que el manejador los registre (regla 9).
import type { ContextoMinimo } from './contrato.ts';
import { construirPrompt, mensajeCorreccion, type Prompt } from './prompt.ts';
import { type Adaptador, FallaProveedor, type NombreProveedor, TIEMPO_MAXIMO_MS } from './proveedores.ts';

/** Validación inyectada (en el proxy, el esquema Zod generado; en la evaluación, el de `@cartera/nlu`). */
export type Validador = (valor: unknown) => { ok: true; valor: unknown } | { ok: false; error: string };

export interface OpcionesInterpretar {
  /** Principal primero, alterno después (se usa como mucho uno alterno). */
  adaptadores: readonly Adaptador[];
  validar: Validador;
  tiempoMaximoMs?: number;
  ahora: () => number;
}

export type ResultadoInterpretar =
  | {
      ok: true;
      interpretacion: unknown;
      proveedor: NombreProveedor;
      modelo: string;
      tokens_entrada: number;
      tokens_salida: number;
      latencia_ms: number;
      /** `ok`, `reintento_validacion` o `no_entendi` (para el registro de metadatos). */
      desenlace: 'ok' | 'reintento_validacion' | 'no_entendi';
      llamadas: number;
    }
  | {
      ok: false;
      codigo: 'proveedor_fallo' | 'tiempo_agotado';
      proveedor: NombreProveedor | undefined;
      modelo: string | undefined;
      tokens_entrada: number;
      tokens_salida: number;
      latencia_ms: number;
      llamadas: number;
      estado_proveedor: number | undefined;
    };

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

async function conTiempo<T>(ms: number, fn: (senal: AbortSignal) => Promise<T>): Promise<T> {
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

export async function interpretar(
  texto: string,
  contexto: ContextoMinimo,
  opciones: OpcionesInterpretar,
): Promise<ResultadoInterpretar> {
  const inicio = opciones.ahora();
  const tiempo = opciones.tiempoMaximoMs ?? TIEMPO_MAXIMO_MS;
  const prompt: Prompt = construirPrompt(texto, contexto);
  const candidatos = opciones.adaptadores.slice(0, 2);
  let tokensEntrada = 0;
  let tokensSalida = 0;
  let llamadas = 0;
  let ultimaFalla: FallaProveedor | undefined;
  let ultimo: Adaptador | undefined;

  for (const adaptador of candidatos) {
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
    tokensEntrada += respuesta.tokens_entrada;
    tokensSalida += respuesta.tokens_salida;

    const base = { proveedor: adaptador.nombre, modelo: adaptador.modelo };
    const primera = leer(respuesta.texto, adaptador, opciones.validar);
    if (primera.ok) {
      return {
        ok: true,
        ...base,
        interpretacion: primera.valor,
        tokens_entrada: tokensEntrada,
        tokens_salida: tokensSalida,
        latencia_ms: opciones.ahora() - inicio,
        desenlace: 'ok',
        llamadas,
      };
    }

    // Reintento único con el error de validación, con el mismo proveedor.
    let segunda: ReturnType<typeof leer> = { ok: false, error: '' };
    try {
      llamadas += 1;
      const reintento = { salidaAnterior: respuesta.texto, correccion: mensajeCorreccion(primera.error) };
      const r = await conTiempo(tiempo, (senal) => adaptador.llamar({ prompt, reintento, senal }));
      tokensEntrada += r.tokens_entrada;
      tokensSalida += r.tokens_salida;
      segunda = leer(r.texto, adaptador, opciones.validar);
    } catch {
      // Si el reintento falla, se responde no_entendi: ya hubo una respuesta del proveedor.
    }
    return {
      ok: true,
      ...base,
      interpretacion: segunda.ok ? segunda.valor : NO_ENTENDI,
      tokens_entrada: tokensEntrada,
      tokens_salida: tokensSalida,
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
    tokens_entrada: tokensEntrada,
    tokens_salida: tokensSalida,
    latencia_ms: opciones.ahora() - inicio,
    llamadas,
    estado_proveedor: ultimaFalla?.estado,
  };
}
