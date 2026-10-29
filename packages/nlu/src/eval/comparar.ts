/**
 * Comparación de una interpretación obtenida contra la esperada del golden set (docs/06-NLU.md §8).
 * Devuelve la lista de rutas de campos que no coinciden (vacía = caso correcto). Las rutas nunca llevan valores,
 * solo nombres de campo, para que el reporte no exponga montos ni texto dictado (regla 9).
 */
import { normalizarAlias } from '../normalizar';

type Valor = unknown;
type Objeto = Record<string, Valor>;

const esObjeto = (v: Valor): v is Objeto => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Campos que nunca se evalúan. */
const IGNORADOS = new Set(['descripcion', 'concepto', 'pregunta', 'parcial', 'opciones']);
const CAMPOS_CUENTA = new Set(['origen', 'destino']);
/** Personas y alias se comparan normalizados con `normalizarAlias`. */
const CAMPOS_NORMALIZADOS = new Set(['contraparte', 'alias', 'grupo']);

function contenidoEnAlgunSentido(a: string, b: string): boolean {
  const na = normalizarAlias(a);
  const nb = normalizarAlias(b);
  return na.includes(nb) || nb.includes(na);
}

function compararRefCuenta(esperado: Valor, obtenido: Valor, ruta: string, fallas: string[]): void {
  const ref = esObjeto(obtenido) ? obtenido : { tipo: 'desconocido' };
  if (!esObjeto(esperado)) {
    fallas.push(ruta);
    return;
  }
  if (esperado.tipo !== ref.tipo) fallas.push(`${ruta}.tipo`);
  if (typeof esperado.alias === 'string') {
    if (typeof ref.alias !== 'string' || normalizarAlias(esperado.alias) !== normalizarAlias(ref.alias)) {
      fallas.push(`${ruta}.alias`);
    }
  }
}

function compararValor(
  esperado: Valor,
  obtenido: Valor,
  ruta: string,
  campo: string,
  fallas: string[],
): void {
  if (IGNORADOS.has(campo)) return;
  // `null` en el esperado: el campo no debe venir («¿y de contado?» quita los meses; «¿cuánto tengo?» no lleva alias).
  if (esperado === null) {
    if (obtenido !== undefined && obtenido !== null) fallas.push(ruta);
    return;
  }
  if (CAMPOS_CUENTA.has(campo)) {
    compararRefCuenta(esperado, obtenido, ruta, fallas);
    return;
  }
  if (CAMPOS_NORMALIZADOS.has(campo) && typeof esperado === 'string') {
    if (typeof obtenido !== 'string' || normalizarAlias(esperado) !== normalizarAlias(obtenido))
      fallas.push(ruta);
    return;
  }
  if (campo === 'participantes' && Array.isArray(esperado)) {
    // Los participantes se comparan normalizados y sin importar el orden.
    const normalizar = (lista: Valor[]) =>
      lista.map((x) => (typeof x === 'string' ? normalizarAlias(x) : JSON.stringify(x))).sort();
    if (
      !Array.isArray(obtenido) ||
      JSON.stringify(normalizar(esperado)) !== JSON.stringify(normalizar(obtenido))
    ) {
      fallas.push(ruta);
    }
    return;
  }
  if (campo === 'texto' && typeof esperado === 'string') {
    // Referencia.texto y filtro.texto: contenido en un sentido o en el otro.
    if (typeof obtenido !== 'string' || !contenidoEnAlgunSentido(esperado, obtenido)) fallas.push(ruta);
    return;
  }
  if (Array.isArray(esperado)) {
    if (!Array.isArray(obtenido) || obtenido.length !== esperado.length) {
      fallas.push(ruta);
      return;
    }
    esperado.forEach((e, i) => compararValor(e, obtenido[i], `${ruta}[${i}]`, campo, fallas));
    return;
  }
  if (esObjeto(esperado)) {
    if (!esObjeto(obtenido)) {
      fallas.push(ruta);
      return;
    }
    compararObjeto(esperado, obtenido, ruta, fallas);
    return;
  }
  if (esperado !== obtenido) fallas.push(ruta);
}

function compararObjeto(esperado: Objeto, obtenido: Objeto, ruta: string, fallas: string[]): void {
  for (const [campo, valor] of Object.entries(esperado)) {
    compararValor(valor, obtenido[campo], ruta === '' ? campo : `${ruta}.${campo}`, campo, fallas);
  }
}

/** Campos del esperado que no coinciden con lo obtenido (subconjunto, §8). `null` obtenido = no respondió. */
export function compararInterpretacion(esperado: Objeto, obtenido: Objeto): string[] {
  if (esperado.intencion !== obtenido.intencion) return ['intencion'];
  if (esperado.intencion === 'aclarar') return esperado.motivo === obtenido.motivo ? [] : ['motivo'];
  if (esperado.intencion === 'fuera_de_alcance') return [];
  const fallas: string[] = [];
  compararObjeto(esperado, obtenido, '', fallas);
  return fallas;
}
