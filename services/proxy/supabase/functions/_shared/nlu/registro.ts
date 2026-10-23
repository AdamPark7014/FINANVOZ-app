// Registro solo de metadatos (docs/03-ARQUITECTURA.md §6; regla 9): hash de usuario, endpoint, proveedor, modelo,
// tokens, latencia y código. Nunca cuerpos de petición o respuesta, texto dictado, montos ni alias.

export interface EventoRegistro {
  usuario_hash: string | null;
  endpoint: string;
  codigo: string;
  estado_http: number;
  proveedor?: string | undefined;
  modelo?: string | undefined;
  tokens_entrada?: number | undefined;
  tokens_salida?: number | undefined;
  /** De la entrada, leídos de caché y escritos en caché: si los leídos caen a 0, algo rompió la caché. */
  tokens_cache_leidos?: number | undefined;
  tokens_cache_escritos?: number | undefined;
  latencia_ms?: number | undefined;
  llamadas?: number | undefined;
  /** Resultados de herramientas ya en la conversación (`/llm/turno`, 0–3); ayuda a medir vueltas sin PII. */
  resultados_herramienta?: number | undefined;
  /** Estado HTTP del proveedor cuando falló (sin su cuerpo). */
  estado_proveedor?: number | undefined;
}

const CAMPOS_TEXTO = ['usuario_hash', 'endpoint', 'codigo', 'proveedor', 'modelo'] as const;
const CAMPOS_NUMERO = [
  'estado_http',
  'tokens_entrada',
  'tokens_salida',
  'tokens_cache_leidos',
  'tokens_cache_escritos',
  'latencia_ms',
  'llamadas',
  'resultados_herramienta',
  'estado_proveedor',
] as const;
/** Los textos permitidos son identificadores cortos (códigos, nombres de modelo, hashes hex). */
const IDENTIFICADOR = /^[\w.:/-]{1,80}$/;

/**
 * Arma la línea de registro copiando solo los campos permitidos, de tipo correcto. Aunque quien llama pasara algo de
 * más en tiempo de ejecución, no llega al registro.
 */
export function lineaRegistro(evento: EventoRegistro): string {
  const fuente = evento as unknown as Record<string, unknown>;
  const salida: Record<string, string | number | null> = {};
  for (const campo of CAMPOS_TEXTO) {
    const v = fuente[campo];
    if (typeof v === 'string' && IDENTIFICADOR.test(v)) salida[campo] = v;
    else if (campo === 'usuario_hash' && v === null) salida[campo] = null;
  }
  for (const campo of CAMPOS_NUMERO) {
    const v = fuente[campo];
    if (typeof v === 'number' && Number.isFinite(v)) salida[campo] = Math.round(v);
  }
  return JSON.stringify(salida);
}

export type Registrador = (evento: EventoRegistro) => void;

export const registrarEnConsola: Registrador = (evento) => console.log(lineaRegistro(evento));

/** Hash irreversible del id de usuario con sal secreta (el id no se registra). */
export async function hashUsuario(id: string, sal: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${sal}:${id}`));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}
