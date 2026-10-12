import type { Breadcrumb, ErrorEvent, Exception, StackFrame } from '@sentry/react-native';

/**
 * Depuración de reportes de error (regla 9, RNF-05, CA-M2-06).
 *
 * Política: lista blanca. Del evento original solo se copian campos técnicos conocidos
 * (tipo de error, pila, versión, dispositivo sin nombre, etiquetas permitidas); todo lo demás
 * se descarta. Los textos libres que sobreviven pasan por `depurarTexto`. Nada de montos,
 * comercios, alias, nombres, RFC ni texto dictado o de notificación puede llegar a Sentry:
 *
 * - Mensajes de error y `captureMessage`: solo códigos `snake_case` con guion bajo
 *   (`migracion_fallida`) o el `codigo` de un `ErrorDominio`; cualquier otro texto se reemplaza.
 * - Migas de consola: se descartan. Migas de UI y toques: sin mensaje ni datos.
 * - `request`, `user`, `extra` y contextos fuera de la lista blanca: se descartan.
 */

export const TEXTO_DEPURADO = '[depurado]';

/** Códigos propios: `snake_case` con al menos un guion bajo (una palabra suelta podría ser un comercio). */
const RE_CODIGO = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/;

export function esCodigo(texto: unknown): texto is string {
  return typeof texto === 'string' && texto.length <= 64 && RE_CODIGO.test(texto);
}

/**
 * Mensajes del motor de JavaScript que solo nombran identificadores del código. Se conservan
 * (depurados) para poder diagnosticar; cualquier otro mensaje se reemplaza.
 */
const MENSAJES_TECNICOS = [
  /^Cannot read propert(?:y|ies) (?:'[\w$]+' )?of (?:undefined|null)/,
  /^undefined is not (?:a function|an object)/,
  /^null is not an object/,
  /^[\w$.]+ is not a function/,
  /^[\w$]+ is not defined$/,
  /^Maximum call stack size exceeded$/,
  /^Network request failed$/,
  /^Aborted$/,
];

const LARGO_MAXIMO = 200;

/**
 * Quita de un texto libre lo que parezca dato de la persona: montos (`$1,234.56`, `−$25`,
 * `25 pesos`), secuencias de 3 o más dígitos (cuentas, tarjetas, teléfonos, cantidades),
 * correos, RFC/CURP e identificadores UUID.
 */
export function depurarTexto(texto: string): string {
  return texto
    .slice(0, LARGO_MAXIMO * 2)
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[correo]')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[id]')
    .replace(/\b[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3,8}\b/gi, '[rfc]')
    .replace(/(?:[-−]\s?)?\$\s?\d(?:[\d,.]*\d)?/g, '[monto]')
    .replace(/\d[\d,.]*\s?(?:pesos|peso|mxn|varos|baros|lucas|centavos)\b/gi, '[monto]')
    .replace(/\d(?:[\d,.\s-]*\d)?/g, (m) => (m.replace(/\D/g, '').length >= 3 ? '[n]' : m))
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, LARGO_MAXIMO);
}

function depurarValorError(valor: unknown, original: unknown): string {
  const codigo = (original as { codigo?: unknown } | null)?.codigo;
  if (esCodigo(codigo)) return codigo;
  if (esCodigo(valor)) return valor;
  if (typeof valor === 'string' && MENSAJES_TECNICOS.some((re) => re.test(valor))) {
    return depurarTexto(valor);
  }
  return TEXTO_DEPURADO;
}

function copiar<T extends object>(origen: T | undefined, campos: readonly (keyof T)[]): Partial<T> {
  const destino: Partial<T> = {};
  if (!origen) return destino;
  for (const campo of campos) {
    const v = origen[campo];
    if (v !== undefined && (typeof v !== 'object' || v === null)) destino[campo] = v;
  }
  return destino;
}

const CAMPOS_MARCO: readonly (keyof StackFrame)[] = [
  'filename',
  'abs_path',
  'module',
  'function',
  'lineno',
  'colno',
  'in_app',
  'platform',
  'instruction_addr',
  'addr_mode',
];

function depurarExcepcion(e: Exception, original: unknown): Exception {
  const limpia: Exception = {
    ...copiar(e, ['type', 'module', 'thread_id']),
    value: depurarValorError(e.value, original),
  };
  if (e.mechanism) {
    limpia.mechanism = {
      type: e.mechanism.type,
      ...copiar(e.mechanism, ['handled', 'synthetic', 'is_exception_group', 'exception_id', 'parent_id']),
    };
  }
  if (e.stacktrace?.frames) {
    limpia.stacktrace = { frames: e.stacktrace.frames.map((f) => copiar(f, CAMPOS_MARCO)) };
  }
  return limpia;
}

/** Contextos permitidos y sus campos. `device.name` (nombre que la persona puso al teléfono) no entra. */
const CONTEXTOS: Record<string, readonly string[]> = {
  app: [
    'app_identifier',
    'app_name',
    'app_version',
    'app_build',
    'app_start_time',
    'in_foreground',
    'build_type',
  ],
  device: [
    'family',
    'model',
    'model_id',
    'brand',
    'manufacturer',
    'arch',
    'simulator',
    'memory_size',
    'free_memory',
    'low_memory',
    'orientation',
    'screen_density',
    'screen_dpi',
    'screen_height_pixels',
    'screen_width_pixels',
    'battery_level',
    'charging',
    'online',
    'processor_count',
  ],
  os: ['name', 'version', 'build', 'kernel_version', 'rooted'],
  runtime: ['name', 'version'],
  react_native_context: [
    'js_engine',
    'hermes_version',
    'react_native_version',
    'fabric',
    'turbo_module',
    'expo',
  ],
  trace: ['trace_id', 'span_id', 'parent_span_id', 'op', 'status'],
};

/**
 * Etiquetas y extras propios permitidos. Las llaves con catálogo solo aceptan esos valores;
 * las demás, un identificador en minúsculas (`hoy`, `onboarding-o4`) o un código. Los números
 * solo en llaves numéricas (nunca un monto).
 */
const CATALOGOS: Record<string, readonly string[]> = {
  'event.origin': ['javascript', 'android', 'ios'],
  'event.environment': ['javascript', 'java', 'native'],
  origen: ['voz', 'texto', 'formulario', 'captura', 'arqueo'],
  nivel_interprete: ['reglas', 'nube', 'por_interpretar'],
  espacio: ['personal', 'negocio'],
};
const LLAVES_IDENTIFICADOR = ['pantalla', 'codigo', 'resultado', 'latencia_bucket'];
const LLAVES_NUMERICAS = ['paso', 'version_esquema', 'migracion'];

export const ETIQUETAS_PERMITIDAS: readonly string[] = [
  ...Object.keys(CATALOGOS),
  ...LLAVES_IDENTIFICADOR,
  ...LLAVES_NUMERICAS,
];
export const EXTRAS_PERMITIDOS = ETIQUETAS_PERMITIDAS;

const RE_IDENTIFICADOR = /^[a-z][a-z0-9-]{0,47}$/;

function depurarPrimitivos(
  origen: Record<string, unknown> | undefined,
): Record<string, string | number | boolean> | undefined {
  if (!origen) return undefined;
  const destino: Record<string, string | number | boolean> = {};
  for (const [llave, catalogo] of Object.entries(CATALOGOS)) {
    const v = origen[llave];
    if (typeof v === 'string' && catalogo.includes(v)) destino[llave] = v;
  }
  for (const llave of LLAVES_IDENTIFICADOR) {
    const v = origen[llave];
    if (typeof v === 'string' && (RE_IDENTIFICADOR.test(v) || esCodigo(v))) destino[llave] = v;
  }
  for (const llave of LLAVES_NUMERICAS) {
    const v = origen[llave];
    if (typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v < 100) destino[llave] = v;
  }
  return Object.keys(destino).length > 0 ? destino : undefined;
}

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Segmentos de ruta estáticos o plantillas de Expo Router: `movimientos`, `[id]`, `(pestanas)`. */
const RE_SEGMENTO = /^(?:[a-z][a-z-]*|\[{1,2}(?:\.\.\.)?\w+\]{1,2}|\([\w-]+\))$/;

/**
 * Ruta o URL sin consulta ni fragmento; cada segmento que no sea estático se reemplaza
 * (`/movimientos/550e…` → `/movimientos/[id]`, `/comercio/OXXO` → `/comercio/[param]`).
 */
function depurarRuta(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const sinConsulta = v.split(/[?#]/)[0] ?? '';
  const m = /^([a-z][a-z0-9+.-]*:\/\/[^/]+)?(.*)$/i.exec(sinConsulta);
  const base = m?.[1] ?? '';
  const ruta = (m?.[2] ?? '')
    .split('/')
    .map((s) => {
      if (s === '') return s;
      if (RE_UUID.test(s)) return '[id]';
      return RE_SEGMENTO.test(s) ? s : '[param]';
    })
    .join('/');
  return `${base}${ruta}`.slice(0, LARGO_MAXIMO);
}

const CATEGORIAS_SIN_TEXTO = /^(?:ui\.|touch$|sentry\.|navigation\.|xhr$|fetch$|http$)/;

/**
 * `beforeBreadcrumb`: descarta consola, quita mensaje y datos de UI y toques, conserva solo
 * método, estado y ruta sin consulta en red, y origen/destino en navegación.
 */
export function depurarMiga(miga: Breadcrumb): Breadcrumb | null {
  const categoria = miga.category ?? '';
  if (categoria === 'console' || categoria === 'log') return null;
  const limpia: Breadcrumb = copiar(miga, ['type', 'level', 'category', 'timestamp']);
  if (!CATEGORIAS_SIN_TEXTO.test(categoria) && esCodigo(miga.message)) {
    limpia.message = miga.message;
  }
  const datos = miga.data as Record<string, unknown> | undefined;
  if (!datos) return limpia;
  if (categoria === 'navigation') {
    const from = depurarRuta(datos.from);
    const to = depurarRuta(datos.to);
    limpia.data = { ...(from === undefined ? {} : { from }), ...(to === undefined ? {} : { to }) };
  } else if (categoria === 'xhr' || categoria === 'fetch' || categoria === 'http') {
    const url = depurarRuta(datos.url);
    limpia.data = {
      ...copiar(datos as { method?: unknown; status_code?: unknown }, ['method', 'status_code']),
      ...(url === undefined ? {} : { url }),
    };
  } else if (categoria === 'app.lifecycle' || categoria === 'device.event') {
    const estado = datos.state ?? datos.action;
    if (esCodigo(estado) || /^[a-z]+$/.test(String(estado))) limpia.data = { state: String(estado) };
  }
  return limpia;
}

/**
 * `beforeSend`: reconstruye el evento solo con campos técnicos permitidos y textos depurados.
 */
export function depurarEvento(evento: ErrorEvent, pista?: { originalException?: unknown }): ErrorEvent {
  const original = pista?.originalException;
  const limpio: ErrorEvent = {
    type: undefined,
    ...copiar(evento, [
      'event_id',
      'timestamp',
      'start_timestamp',
      'level',
      'platform',
      'logger',
      'release',
      'dist',
      'environment',
    ]),
  };
  if (evento.sdk) limpio.sdk = evento.sdk;
  if (evento.debug_meta) limpio.debug_meta = evento.debug_meta;
  if (evento.message !== undefined)
    limpio.message = esCodigo(evento.message) ? evento.message : TEXTO_DEPURADO;
  if (evento.transaction) limpio.transaction = depurarRuta(evento.transaction) ?? TEXTO_DEPURADO;
  if (evento.fingerprint)
    limpio.fingerprint = evento.fingerprint.map((f) =>
      esCodigo(f) || f === '{{ default }}' ? f : TEXTO_DEPURADO,
    );
  if (evento.exception?.values) {
    limpio.exception = { values: evento.exception.values.map((e) => depurarExcepcion(e, original)) };
  }
  if (evento.breadcrumbs) {
    limpio.breadcrumbs = evento.breadcrumbs.map(depurarMiga).filter((m): m is Breadcrumb => m !== null);
  }
  const tags = depurarPrimitivos(evento.tags as Record<string, unknown> | undefined);
  if (tags) limpio.tags = tags;
  const extra = depurarPrimitivos(evento.extra);
  if (extra) limpio.extra = extra;
  if (evento.contexts) {
    const contextos: NonNullable<ErrorEvent['contexts']> = {};
    for (const [nombre, campos] of Object.entries(CONTEXTOS)) {
      const ctx = evento.contexts[nombre] as Record<string, unknown> | undefined;
      if (!ctx) continue;
      const copia = copiar(ctx, campos);
      if (Object.keys(copia).length > 0) contextos[nombre] = copia;
    }
    limpio.contexts = contextos;
  }
  return limpio;
}
