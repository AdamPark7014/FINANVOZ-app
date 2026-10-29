import { diaSemana, esFecha, type PlainDate } from '@cartera/core';
import type { ContextoInterprete, CuentaContexto, TurnoAnterior } from '../contexto';
import type { Espacio } from '../esquema';
import { normalizarAlias } from '../normalizar';

const NOMBRES_DIA = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'] as const;

/**
 * Límites de `POST /nlu/interpretar` (`services/proxy/.../_shared/nlu/contrato.ts`). Lo que los rebasa es un 400
 * y la frase no se interpretaría nunca.
 */
export const TEXTO_MAXIMO_NUBE = 500;
export const ALIAS_MAXIMO_CONTEXTO = 60;
export const LISTA_MAXIMA_CONTEXTO = 50;
/** El cuerpo entero admite 16 KiB; el resto queda para el texto (500 caracteres de hasta 6 bytes ya escapados). */
export const CONTEXTO_MAXIMO_BYTES = 12 * 1024;

/** Lo que la app sabe de una cuenta. Puede traer más campos (id, saldo, dígitos): `contextoMinimo` no los copia. */
export interface CuentaApp {
  readonly tipo: CuentaContexto['tipo'];
  readonly nombre?: string;
  readonly alias: readonly string[];
  readonly espacio?: Espacio;
}

export interface DatosContexto {
  readonly hoy: PlainDate;
  readonly espacios?: readonly Espacio[];
  readonly cuentas: readonly CuentaApp[];
  /** Alias de cada contacto. */
  readonly contactos?: readonly (readonly string[])[];
  /** Alias de cada cliente del fiado; solo viajan con el negocio activo. */
  readonly clientes?: readonly (readonly string[])[];
  readonly ultimoIngreso?: PlainDate | null;
  readonly proximoIngreso?: PlainDate | null;
}

/** Quita palabras con 3 o más cifras: en un nombre como "Nu ••4410" son parte del número de la tarjeta. */
function sinNumeros(alias: string): string {
  return alias
    .split(' ')
    .filter((t) => !/\d{3,}/.test(t))
    .join(' ');
}

/** Un alias de más de 60 caracteres se descarta (recortado ya no sería lo que la persona dice). */
function aliasLimpios(valores: readonly string[]): string[] {
  const salida: string[] = [];
  for (const v of valores) {
    if (salida.length === LISTA_MAXIMA_CONTEXTO) break;
    const a = sinNumeros(normalizarAlias(v));
    if (a !== '' && a.length <= ALIAS_MAXIMO_CONTEXTO && !salida.includes(a)) salida.push(a);
  }
  return salida;
}

/** Bytes en UTF-8 de un texto ya serializado (`JSON.stringify` escapa los sustitutos sueltos). */
function bytesUtf8(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c < 0xdc00) {
      n += 4;
      i++;
    } else n += 3;
  }
  return n;
}

/** Los primeros elementos (en el orden recibido) que caben en la lista y en el presupuesto de bytes. */
function primerosQueCaben<T>(elementos: readonly T[], presupuesto: { restante: number }): T[] {
  const salida: T[] = [];
  for (const e of elementos) {
    if (salida.length === LISTA_MAXIMA_CONTEXTO) break;
    const costo = bytesUtf8(JSON.stringify(e)) + 1;
    if (costo > presupuesto.restante) break;
    presupuesto.restante -= costo;
    salida.push(e);
  }
  return salida;
}

/**
 * Contexto mínimo que viaja al proxy (`docs/06-NLU.md §4`): tipos y alias de cuentas (más el nombre, sin
 * números), alias de contactos y clientes, fechas. Sin ids, sin saldos, sin últimos 4 dígitos y sin el nombre
 * del negocio: solo se copian los campos de la lista.
 *
 * Respeta los límites del proxy: hasta 50 cuentas, contactos y clientes, 50 alias de hasta 60 caracteres cada
 * uno y `CONTEXTO_MAXIMO_BYTES` en total. Si no cabe todo, viajan los primeros en el orden recibido: primero las
 * cuentas, luego los contactos y al final los clientes.
 */
export function contextoMinimo(datos: DatosContexto): ContextoInterprete {
  if (!esFecha(datos.hoy)) throw new TypeError('hoy debe ser una fecha civil');
  const conNegocio = datos.espacios?.includes('negocio') ?? false;
  const espacios: Espacio[] = conNegocio ? ['personal', 'negocio'] : ['personal'];
  const todas: CuentaContexto[] = [];
  for (const c of datos.cuentas) {
    const espacio = c.espacio ?? 'personal';
    if (espacio === 'negocio' && !conNegocio) continue;
    todas.push({
      tipo: c.tipo,
      alias: aliasLimpios([...c.alias, ...(c.nombre ? [c.nombre] : [])]),
      espacio,
    });
  }
  const base: ContextoInterprete = {
    fecha_referencia: datos.hoy,
    dia_semana: NOMBRES_DIA[diaSemana(datos.hoy) - 1] ?? '',
    espacios,
    cuentas: [],
    contactos: [],
    ...(conNegocio ? { clientes: [] } : {}),
    ...(datos.ultimoIngreso ? { ultimo_ingreso: datos.ultimoIngreso } : {}),
    ...(datos.proximoIngreso ? { proximo_ingreso: datos.proximoIngreso } : {}),
  };
  const presupuesto = { restante: CONTEXTO_MAXIMO_BYTES - bytesUtf8(JSON.stringify(base)) };
  const cuentas = primerosQueCaben(todas, presupuesto);
  const contactos = primerosQueCaben(
    (datos.contactos ?? []).map(aliasLimpios).filter((a) => a.length > 0),
    presupuesto,
  );
  const clientes = conNegocio
    ? primerosQueCaben(
        (datos.clientes ?? []).map(aliasLimpios).filter((a) => a.length > 0),
        presupuesto,
      )
    : [];
  return { ...base, cuentas, contactos, ...(conNegocio ? { clientes } : {}) };
}

/** El turno anterior serializado cabe en esto (`ANTERIOR_MAXIMO` del contrato del proxy). */
export const ANTERIOR_MAXIMO_NUBE = 3000;

/**
 * El turno anterior tal como viaja al proxy (`06 §15`): lo dicho y lo entendido, nunca cifras de respuestas. Si no
 * cabe en el contrato, `undefined` y la frase va sola, como antes.
 */
export function anteriorParaNube(anterior: TurnoAnterior | null | undefined): TurnoAnterior | undefined {
  if (!anterior) return undefined;
  const frase = anterior.frase.trim();
  if (frase === '' || frase.length > TEXTO_MAXIMO_NUBE) return undefined;
  const a: TurnoAnterior = { frase, interpretacion: anterior.interpretacion };
  return JSON.stringify(a).length <= ANTERIOR_MAXIMO_NUBE ? a : undefined;
}
