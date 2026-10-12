import { diaSemana, esFecha, type PlainDate } from '@cartera/core';
import type { ContextoInterprete, CuentaContexto } from '../contexto';
import type { Espacio } from '../esquema';
import { normalizarAlias } from '../normalizar';

const NOMBRES_DIA = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'] as const;

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

function aliasLimpios(valores: readonly string[]): string[] {
  const salida: string[] = [];
  for (const v of valores) {
    const a = sinNumeros(normalizarAlias(v));
    if (a !== '' && !salida.includes(a)) salida.push(a);
  }
  return salida;
}

/**
 * Contexto mínimo que viaja al proxy (`docs/06-NLU.md §4`): tipos y alias de cuentas (más el nombre, sin
 * números), alias de contactos y clientes, fechas. Sin ids, sin saldos, sin últimos 4 dígitos y sin el nombre
 * del negocio: solo se copian los campos de la lista.
 */
export function contextoMinimo(datos: DatosContexto): ContextoInterprete {
  if (!esFecha(datos.hoy)) throw new TypeError('hoy debe ser una fecha civil');
  const conNegocio = datos.espacios?.includes('negocio') ?? false;
  const espacios: Espacio[] = conNegocio ? ['personal', 'negocio'] : ['personal'];
  const cuentas: CuentaContexto[] = [];
  for (const c of datos.cuentas) {
    const espacio = c.espacio ?? 'personal';
    if (espacio === 'negocio' && !conNegocio) continue;
    cuentas.push({
      tipo: c.tipo,
      alias: aliasLimpios([...c.alias, ...(c.nombre ? [c.nombre] : [])]),
      espacio,
    });
  }
  const contactos = (datos.contactos ?? []).map(aliasLimpios).filter((a) => a.length > 0);
  const clientes = conNegocio ? (datos.clientes ?? []).map(aliasLimpios).filter((a) => a.length > 0) : [];
  return {
    fecha_referencia: datos.hoy,
    dia_semana: NOMBRES_DIA[diaSemana(datos.hoy) - 1] ?? '',
    espacios,
    cuentas,
    contactos,
    ...(conNegocio ? { clientes } : {}),
    ...(datos.ultimoIngreso ? { ultimo_ingreso: datos.ultimoIngreso } : {}),
    ...(datos.proximoIngreso ? { proximo_ingreso: datos.proximoIngreso } : {}),
  };
}
