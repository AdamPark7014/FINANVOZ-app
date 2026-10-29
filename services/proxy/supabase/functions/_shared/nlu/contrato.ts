// Contrato de `POST /nlu/interpretar` (docs/03-ARQUITECTURA.md §6). Puro: lo usan la Edge Function (Deno),
// las pruebas (Vitest) y la evaluación (`pnpm eval:nlu --nivel nube`).

/** Contexto mínimo (docs/06-NLU.md §4): sin ids, sin saldos, sin dígitos de tarjeta, sin nombre del negocio. */
export interface ContextoMinimo {
  fecha_referencia: string;
  dia_semana?: string;
  espacios: ('personal' | 'negocio')[];
  cuentas: {
    tipo: 'efectivo' | 'debito' | 'credito' | 'billetera';
    alias: string[];
    espacio?: 'personal' | 'negocio';
  }[];
  contactos?: string[][];
  clientes?: string[][];
  ultimo_ingreso?: string;
  proximo_ingreso?: string;
  /**
   * El turno anterior de la conversación (docs/06-NLU.md §15): lo que el usuario dijo antes y cómo se entendió.
   * Nunca lleva lo que contestó la app (cifras de consultas, saldos).
   */
  anterior?: TurnoAnterior;
}

export interface TurnoAnterior {
  frase: string;
  interpretacion: Record<string, unknown>;
}

export interface SolicitudInterpretar {
  texto: string;
  contexto_min: ContextoMinimo;
  version_esquema: string | number;
}

export interface RespuestaInterpretar {
  interpretacion: unknown;
  proveedor: string;
  modelo: string;
  tokens_entrada: number;
  tokens_salida: number;
  latencia_ms: number;
}

/** Códigos de error del cuerpo `{ error }` y su estado HTTP. */
export const ESTADO_POR_ERROR = {
  solicitud_invalida: 400,
  no_autorizado: 401,
  metodo: 405,
  limite_diario: 429,
  limite_mensual: 429,
  tope_global: 429,
  proveedor_fallo: 502,
  sin_configurar: 503,
  tiempo_agotado: 504,
  error_interno: 500,
} as const;
export type CodigoError = keyof typeof ESTADO_POR_ERROR;

export const TEXTO_MAXIMO = 500;
export const CUERPO_MAXIMO_BYTES = 16 * 1024;
const ALIAS_MAXIMO = 60;
const LISTA_MAXIMA = 50;

const CLAVES_SOLICITUD = new Set(['texto', 'contexto_min', 'version_esquema']);
/** El turno anterior serializado cabe en esto (la app no lo manda si es más largo). */
export const ANTERIOR_MAXIMO = 3000;
const CLAVES_ANTERIOR = new Set(['frase', 'interpretacion']);
const INTENCIONES = new Set([
  'registrar',
  'corregir',
  'anular',
  'revisar_duplicados',
  'arqueo',
  'consultar',
  'simular',
  'configurar',
  'gasto_compartido',
  'aclarar',
  'fuera_de_alcance',
]);
const CLAVES_CONTEXTO = new Set([
  'fecha_referencia',
  'dia_semana',
  'espacios',
  'cuentas',
  'contactos',
  'clientes',
  'ultimo_ingreso',
  'proximo_ingreso',
  'anterior',
]);
const CLAVES_CUENTA = new Set(['tipo', 'alias', 'espacio']);
const TIPOS_CUENTA = new Set(['efectivo', 'debito', 'credito', 'billetera']);
const ESPACIOS = new Set(['personal', 'negocio']);
const DIAS = new Set([
  'lunes',
  'martes',
  'miercoles',
  'miércoles',
  'jueves',
  'viernes',
  'sabado',
  'sábado',
  'domingo',
]);
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

type Objeto = Record<string, unknown>;
const esObjeto = (v: unknown): v is Objeto => typeof v === 'object' && v !== null && !Array.isArray(v);
const soloClaves = (o: Objeto, permitidas: Set<string>) => Object.keys(o).every((c) => permitidas.has(c));
const esTextoCorto = (v: unknown): v is string =>
  typeof v === 'string' && v.trim() !== '' && v.length <= ALIAS_MAXIMO;
const esListaAlias = (v: unknown): v is string[] =>
  Array.isArray(v) && v.length >= 1 && v.length <= LISTA_MAXIMA && v.every(esTextoCorto);
const esFechaOpcional = (v: unknown) => v === undefined || (typeof v === 'string' && FECHA.test(v));

/** Solo lo dicho y una interpretación con intención conocida, sin pasar de `ANTERIOR_MAXIMO` caracteres. */
function anteriorValido(v: unknown): v is TurnoAnterior {
  if (!esObjeto(v) || !soloClaves(v, CLAVES_ANTERIOR)) return false;
  if (typeof v.frase !== 'string' || v.frase.trim() === '' || v.frase.length > TEXTO_MAXIMO) return false;
  const i = v.interpretacion;
  if (!esObjeto(i) || typeof i.intencion !== 'string' || !INTENCIONES.has(i.intencion)) return false;
  return JSON.stringify(v).length <= ANTERIOR_MAXIMO;
}

function contextoValido(v: unknown): v is ContextoMinimo {
  if (!esObjeto(v) || !soloClaves(v, CLAVES_CONTEXTO)) return false;
  if (typeof v.fecha_referencia !== 'string' || !FECHA.test(v.fecha_referencia)) return false;
  if (
    v.dia_semana !== undefined &&
    !(typeof v.dia_semana === 'string' && DIAS.has(v.dia_semana.toLowerCase()))
  )
    return false;
  if (!esFechaOpcional(v.ultimo_ingreso) || !esFechaOpcional(v.proximo_ingreso)) return false;
  if (!Array.isArray(v.espacios) || !v.espacios.every((e) => ESPACIOS.has(e as string))) return false;
  if (!Array.isArray(v.cuentas) || v.cuentas.length > LISTA_MAXIMA) return false;
  for (const c of v.cuentas) {
    if (!esObjeto(c) || !soloClaves(c, CLAVES_CUENTA)) return false;
    if (!TIPOS_CUENTA.has(c.tipo as string)) return false;
    if (!(Array.isArray(c.alias) && c.alias.length <= LISTA_MAXIMA && c.alias.every(esTextoCorto)))
      return false;
    if (c.espacio !== undefined && !ESPACIOS.has(c.espacio as string)) return false;
  }
  for (const lista of [v.contactos, v.clientes]) {
    if (lista === undefined) continue;
    if (!Array.isArray(lista) || lista.length > LISTA_MAXIMA || !lista.every(esListaAlias)) return false;
  }
  return v.anterior === undefined || anteriorValido(v.anterior);
}

/**
 * Valida el cuerpo. Las claves desconocidas se rechazan (incluidas las del contexto): así un cliente no puede
 * mandar al proveedor saldos, ids ni otros datos que `06 §4` excluye.
 */
export function validarSolicitud(cuerpo: unknown): SolicitudInterpretar | null {
  if (!esObjeto(cuerpo) || !soloClaves(cuerpo, CLAVES_SOLICITUD)) return null;
  const { texto, contexto_min, version_esquema } = cuerpo;
  if (typeof texto !== 'string' || texto.trim() === '' || texto.length > TEXTO_MAXIMO) return null;
  const version = version_esquema;
  if (!(
    (typeof version === 'string' && version !== '' && version.length <= 32) ||
    Number.isInteger(version)
  )) {
    return null;
  }
  if (!contextoValido(contexto_min)) return null;
  return { texto, contexto_min, version_esquema: version as string | number };
}
