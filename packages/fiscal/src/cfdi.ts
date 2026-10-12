import { type CfdiLeido, ErrorDominio, esFecha } from '@cartera/core';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { decimalACentavos } from './decimal';

export const NS_CFDI4 = 'http://www.sat.gob.mx/cfd/4';
export const NS_TIMBRE = 'http://www.sat.gob.mx/TimbreFiscalDigital';

/**
 * Códigos de `ErrorDominio` de `parsearCfdi`. `version_no_soportada` y `sin_timbre` son los de `05 §E13.1`;
 * los demás distinguen por qué un XML no se importa.
 */
export type CodigoErrorCfdi =
  | 'xml_invalido'
  | 'no_es_cfdi'
  | 'version_no_soportada'
  | 'sin_timbre'
  | 'cfdi_invalido'
  | 'importe_invalido';

/** Nodo de fast-xml-parser: atributos bajo `@`, hijos por nombre calificado, siempre en listas. */
interface Nodo {
  '@'?: Record<string, string>;
  [hijo: string]: unknown;
}

/** Un elemento con su ámbito de espacios de nombres ya resuelto. */
interface Elemento {
  nodo: Nodo;
  ns: ReadonlyMap<string, string>;
}

const ATRIBUTOS = '@';

const lector = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  attributesGroupName: ATRIBUTOS,
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: true,
  ignoreDeclaration: true,
  ignorePiTags: true,
  // Entidades XML y referencias numéricas (&amp;, &#xC9;); sin DOCTYPE no hay entidades propias.
  processEntities: true,
  htmlEntities: true,
  isArray: (_nombre, _ruta, _hoja, esAtributo) => !esAtributo,
});

const error = (codigo: CodigoErrorCfdi, mensaje: string) => new ErrorDominio(codigo, mensaje);

function atributos(nodo: Nodo): Record<string, string> {
  return nodo[ATRIBUTOS] ?? {};
}

/** Ámbito de un elemento: el del padre más sus declaraciones `xmlns` / `xmlns:p`. */
function ambito(nodo: Nodo, padre: ReadonlyMap<string, string>): ReadonlyMap<string, string> {
  let ns: Map<string, string> | null = null;
  for (const [nombre, valor] of Object.entries(atributos(nodo))) {
    if (nombre === 'xmlns' || nombre.startsWith('xmlns:')) {
      ns ??= new Map(padre);
      ns.set(nombre === 'xmlns' ? '' : nombre.slice(6), valor);
    }
  }
  return ns ?? padre;
}

function nombreExpandido(
  calificado: string,
  ns: ReadonlyMap<string, string>,
): { uri: string | null; local: string } {
  const i = calificado.indexOf(':');
  const prefijo = i < 0 ? '' : calificado.slice(0, i);
  return { uri: ns.get(prefijo) ?? null, local: i < 0 ? calificado : calificado.slice(i + 1) };
}

function esNodo(v: unknown): v is Nodo {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Hijos de `padre` con espacio de nombres `uri` y nombre local `local` (sin importar el prefijo). */
function hijos(padre: Elemento, uri: string, local: string): Elemento[] {
  const salida: Elemento[] = [];
  for (const [clave, valor] of Object.entries(padre.nodo)) {
    if (clave === ATRIBUTOS || clave === '#text' || !Array.isArray(valor)) continue;
    for (const v of valor) {
      if (!esNodo(v)) continue;
      const ns = ambito(v, padre.ns);
      const n = nombreExpandido(clave, ns);
      if (n.uri === uri && n.local === local) salida.push({ nodo: v, ns });
    }
  }
  return salida;
}

/** Ruta de hijos; `[]` si falta algún paso. */
function ruta(desde: Elemento, uri: string, ...locales: string[]): Elemento[] {
  return locales.reduce<Elemento[]>(
    (actuales, local) => actuales.flatMap((e) => hijos(e, uri, local)),
    [desde],
  );
}

function unico(elementos: Elemento[], que: string): Elemento {
  const [e] = elementos;
  if (!e || elementos.length > 1) throw error('cfdi_invalido', `se esperaba un solo ${que}`);
  return e;
}

function requerido(e: Elemento, nombre: string): string {
  const v = atributos(e.nodo)[nombre];
  if (v === undefined || v === '') throw error('cfdi_invalido', `falta el atributo ${nombre}`);
  return v;
}

function opcional(e: Elemento, nombre: string): string | null {
  const v = atributos(e.nodo)[nombre];
  return v === undefined || v === '' ? null : v;
}

function leerRaiz(xml: string): Elemento {
  const texto = xml.replace(/^\uFEFF/, '');
  // Un CFDI nunca trae DOCTYPE: sin él no hay entidades externas ni expansiones (XXE, "billion laughs").
  if (texto.trim() === '' || /<!DOCTYPE/i.test(texto) || XMLValidator.validate(texto) !== true) {
    throw error('xml_invalido', 'el archivo no es XML bien formado');
  }
  const documento = lector.parse(texto) as Record<string, unknown>;
  const elementos = Object.entries(documento).filter(([clave]) => clave !== '#text');
  const [primero] = elementos;
  const [nodo] = primero && Array.isArray(primero[1]) ? (primero[1] as unknown[]) : [];
  if (!primero || elementos.length !== 1 || !esNodo(nodo))
    throw error('xml_invalido', 'se esperaba un solo elemento raíz');
  const ns = ambito(nodo, new Map());
  const n = nombreExpandido(primero[0], ns);
  if (n.local !== 'Comprobante') throw error('no_es_cfdi', 'la raíz no es un Comprobante');
  if (n.uri !== NS_CFDI4) throw error('version_no_soportada', 'solo se lee CFDI 4.0');
  return { nodo, ns };
}

/**
 * E13.1 · Lee un CFDI 4.0 (`05 §E13.1`). Lanza `ErrorDominio` con un `CodigoErrorCfdi`
 * (`version_no_soportada` para el 3.3, `sin_timbre` sin `TimbreFiscalDigital`): un XML que no se
 * puede leer no se importa. Puro: no toca la red, el disco ni el reloj.
 */
export function parsearCfdi(xml: string): CfdiLeido {
  const comprobante = leerRaiz(xml);
  const timbres = ruta(comprobante, NS_CFDI4, 'Complemento').flatMap((c) =>
    hijos(c, NS_TIMBRE, 'TimbreFiscalDigital'),
  );
  if (timbres.length === 0) throw error('sin_timbre', 'el CFDI no está timbrado');
  const timbre = unico(timbres, 'TimbreFiscalDigital');
  const emisor = unico(ruta(comprobante, NS_CFDI4, 'Emisor'), 'Emisor');
  const receptor = unico(ruta(comprobante, NS_CFDI4, 'Receptor'), 'Receptor');

  const fecha = requerido(comprobante, 'Fecha').slice(0, 10);
  if (!esFecha(fecha)) throw error('cfdi_invalido', 'Fecha no es una fecha');

  let iva = 0;
  for (const t of ruta(comprobante, NS_CFDI4, 'Impuestos', 'Traslados', 'Traslado')) {
    const importe = opcional(t, 'Importe');
    if (opcional(t, 'Impuesto') === '002' && importe !== null) iva += decimalACentavos(importe);
  }

  return {
    uuid: requerido(timbre, 'UUID').toUpperCase(),
    fecha,
    tipo_comprobante: requerido(comprobante, 'TipoDeComprobante'),
    forma_pago: opcional(comprobante, 'FormaPago'),
    metodo_pago: opcional(comprobante, 'MetodoPago'),
    moneda: opcional(comprobante, 'Moneda'),
    subtotal: decimalACentavos(requerido(comprobante, 'SubTotal')),
    total: decimalACentavos(requerido(comprobante, 'Total')),
    iva_trasladado: iva,
    emisor_rfc: requerido(emisor, 'Rfc'),
    emisor_nombre: opcional(emisor, 'Nombre'),
    receptor_rfc: requerido(receptor, 'Rfc'),
    uso_cfdi: opcional(receptor, 'UsoCFDI'),
  };
}
