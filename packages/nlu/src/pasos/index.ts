/**
 * Lectores por paso del onboarding (docs/06-NLU.md §13): lo que la persona dicta en O3 (ingreso), O4 (efectivo,
 * cuentas, tarjeta), O5 (pagos fijos), O7 (colchón) y en el alta de una tanda, leído con el nivel 0 (sin red).
 *
 * Cómo interpreta un paso:
 * 1. Arma el contexto del paso: las cuentas reales y, en cuentas y tarjeta, el catálogo de instituciones de ese
 *    tipo (`instituciones.ts`), y llama `interpretarReglas`.
 * 2. Si lo que entendió corresponde al paso, lo convierte con `lecturaDesdeInterpretacion` (ingreso recurrente →
 *    ingreso, arqueo → efectivo, saldo de cuenta → cuentas, ciclo de tarjeta → tarjeta, compromiso recurrente →
 *    pagos fijos, colchón, tanda).
 * 3. Si no, aplica la gramática propia del paso (cada archivo de esta carpeta).
 * Toda salida se valida con Zod (`LecturaPaso`); ante la duda, `null`. No toca el golden set principal.
 */
import { normalizarAlias } from '../normalizar';
import type { Interpretacion } from '../esquema';
import { interpretarReglas } from '../reglas';
import { montoSuelto } from '../reglas/monto-dictado';
import { recortar, tokenizar, type Tokens } from '../reglas/tokens';
import { hayAproximado, mayusculaInicial } from './comun';
import { leerCuentas, leerEfectivo } from './cuentas';
import {
  FRECUENCIA_PAGO_DE,
  LecturaPaso as EsquemaLecturaPaso,
  type Cifra,
  type LecturaPaso,
} from './esquema';
import { leerIngreso } from './ingreso';
import { cuentasDelCatalogo, institucionPorAlias } from './instituciones';
import { leerPagosFijos } from './pagos-fijos';
import { leerTanda } from './tanda';
import { leerTarjeta } from './tarjeta';
import type { ContextoPaso, Paso } from './tipos';

export {
  LecturaPaso as EsquemaLecturaPaso,
  PASOS,
  FRECUENCIAS_INGRESO,
  FRECUENCIAS_PAGO,
  FRECUENCIAS_TANDA,
  SUBTIPOS_CUENTA,
} from './esquema';
export type { Cifra, ContextoPaso, LecturaDe, LecturaPaso, Paso } from './tipos';
export { INSTITUCIONES, type Institucion } from './instituciones';

/** O7: el colchón de `configurar` o una cifra suelta, con cero ("nada", "cero"); acepta "MONTO de colchón". */
function leerColchon(tokens: Tokens): Extract<LecturaPaso, { paso: 'colchon' }> | null {
  const n = tokens.t.length;
  const sinCola =
    tokens.t[n - 2] === 'de' && tokens.t[n - 1] === 'colchon' ? recortar(tokens, 0, n - 2) : tokens;
  const m = montoSuelto(sinCola, { admiteCero: true });
  return m ? { paso: 'colchon', monto: { monto: m.centavos, aproximado: m.aproximado } } : null;
}

function leerEfectivoPaso(tokens: Tokens): Extract<LecturaPaso, { paso: 'efectivo' }> | null {
  const efectivo = leerEfectivo(tokens);
  return efectivo ? { paso: 'efectivo', efectivo } : null;
}

const GRAMATICAS: Readonly<Record<Paso, (tokens: Tokens, contexto: ContextoPaso) => LecturaPaso | null>> = {
  ingreso: (t) => leerIngreso(t),
  efectivo: (t) => leerEfectivoPaso(t),
  cuentas: (t) => leerCuentas(t),
  tarjeta: (t) => leerTarjeta(t),
  pagos_fijos: (t, c) => leerPagosFijos(t, c),
  colchon: (t) => leerColchon(t),
  tanda: (t) => leerTanda(t),
};

/** Contexto del paso: en cuentas y tarjeta, las instituciones del catálogo entran como alias (06 §13). */
function contextoDelPaso(paso: Paso, contexto: ContextoPaso): ContextoPaso {
  if (paso !== 'cuentas' && paso !== 'tarjeta') return contexto;
  const uso = paso === 'cuentas' ? 'cuenta' : 'credito';
  return { ...contexto, cuentas: [...contexto.cuentas, ...cuentasDelCatalogo(uso, contexto.cuentas)] };
}

const cifra = (monto: number, aproximado = false): Cifra => ({ monto, aproximado });

/** Nombre de un alias del contexto: el de la institución si es del catálogo; si no, tal como se dijo. */
function nombreDeAlias(alias: string): { nombre: string; institucion?: string } {
  const i = institucionPorAlias(alias);
  return i ? { nombre: i.nombre, institucion: i.id } : { nombre: mayusculaInicial(alias) };
}

/** Tipo de la cuenta (real o del catálogo) a la que apunta un alias ya normalizado. */
function tipoDeAlias(alias: string, contexto: ContextoPaso | undefined): string | undefined {
  return contexto?.cuentas.find((c) => c.alias.some((a) => normalizarAlias(a) === alias))?.tipo;
}

/**
 * Convierte lo que entendió el nivel 0 (o la nube) en la lectura de un paso; `null` si no corresponde a ese paso.
 * `contexto` sirve para saber si un alias es de débito o de billetera.
 */
export function lecturaDesdeInterpretacion(
  paso: Paso,
  i: Interpretacion,
  contexto?: ContextoPaso,
): LecturaPaso | null {
  if (i.intencion === 'arqueo') {
    const efectivo = cifra(i.efectivo_real, i.aproximado === true);
    if (paso === 'efectivo') return { paso: 'efectivo', efectivo };
    if (paso === 'cuentas') return { paso: 'cuentas', efectivo, cuentas: [] };
    return null;
  }
  if (i.intencion !== 'configurar') return null;
  const a = i.ajuste;
  switch (paso) {
    case 'ingreso': {
      if (a.tipo !== 'ingreso_recurrente' || a.monto === undefined || a.regla === undefined) return null;
      const frecuencia = {
        quincenal_15_ultimo: 'quincena',
        quincenal_dias: 'quincena',
        semanal: 'semanal',
        catorcenal: 'catorcenal',
        mensual: 'mensual',
        anual: null,
      } as const;
      const f = frecuencia[a.regla.tipo];
      return f ? { paso: 'ingreso', monto: cifra(a.monto), frecuencia: f, regla: a.regla } : null;
    }
    case 'cuentas': {
      if (a.tipo !== 'saldo_cuenta' || a.alias === undefined) return null;
      const tipo = tipoDeAlias(a.alias, contexto);
      const i2 = institucionPorAlias(a.alias, 'cuenta');
      const subtipo = tipo === 'billetera' || tipo === 'debito' ? tipo : i2?.cuenta;
      if (!subtipo) return null;
      return { paso: 'cuentas', cuentas: [{ ...nombreDeAlias(a.alias), subtipo, saldo: cifra(a.monto) }] };
    }
    case 'tarjeta': {
      if (a.tipo !== 'tarjeta_ciclo') return null;
      return {
        paso: 'tarjeta',
        ...(a.alias !== undefined ? { nombre: nombreDeAlias(a.alias).nombre } : {}),
        ...(a.dia_corte !== undefined ? { diaCorte: a.dia_corte } : {}),
        ...(a.dia_limite_pago !== undefined ? { diaLimitePago: a.dia_limite_pago } : {}),
        ...(a.dias_para_pagar !== undefined && a.dia_limite_pago === undefined
          ? { diasParaPagar: a.dias_para_pagar }
          : {}),
      };
    }
    case 'pagos_fijos': {
      if (a.tipo !== 'compromiso' || a.regla.tipo === 'unica' || (a.espacio ?? 'personal') !== 'personal')
        return null;
      const frecuencia = FRECUENCIA_PAGO_DE[a.regla.tipo];
      const texto = a.concepto?.trim() ?? '';
      const sinArticulo = texto.replace(/^(el|la|los|las|mi|mis)\s+/i, '');
      if (sinArticulo === '') return null;
      return {
        paso: 'pagos_fijos',
        pagos: [
          {
            concepto: mayusculaInicial(sinArticulo),
            monto: cifra(a.monto),
            ...(frecuencia ? { frecuencia } : {}),
            regla: a.regla,
          },
        ],
      };
    }
    case 'colchon':
      return a.tipo === 'colchon' ? { paso: 'colchon', monto: cifra(a.monto) } : null;
    case 'tanda': {
      if (a.tipo !== 'tanda') return null;
      const frecuencias = {
        semanal: 'semanal',
        quincenal_15_ultimo: 'quincenal',
        quincenal_dias: 'quincenal',
        catorcenal: 'catorcenal',
        mensual: 'mensual',
        anual: null,
      } as const;
      const frecuencia = frecuencias[a.regla.tipo];
      if (!frecuencia) return null;
      return {
        paso: 'tanda',
        aportacion: cifra(a.aportacion),
        frecuencia,
        participantes: a.participantes,
        turno: a.turno,
      };
    }
    case 'efectivo':
      return null;
  }
}

/** Las producciones de `configurar` no guardan "como": si la frase lo dijo, la cifra del paso es aproximada. */
function conAproximado(l: LecturaPaso, tokens: Tokens): LecturaPaso {
  if (!hayAproximado(tokens)) return l;
  const aprox = (c: Cifra): Cifra => ({ ...c, aproximado: true });
  switch (l.paso) {
    case 'ingreso':
      return l.monto ? { ...l, monto: aprox(l.monto) } : l;
    case 'colchon':
      return { ...l, monto: aprox(l.monto) };
    case 'pagos_fijos':
      return { ...l, pagos: l.pagos.map((p) => ({ ...p, monto: aprox(p.monto) })) };
    case 'tanda':
      return l.aportacion ? { ...l, aportacion: aprox(l.aportacion) } : l;
    default:
      return l;
  }
}

function validar(l: LecturaPaso | null): LecturaPaso | null {
  if (l === null) return null;
  const r = EsquemaLecturaPaso.safeParse(l);
  return r.success ? r.data : null;
}

/**
 * Lee lo que la persona dictó en un paso del onboarding. `null` si no está seguro: la pantalla deja el campo como
 * estaba y la persona lo escribe (o, con red, lo intenta la nube). Nunca registra en logs el texto ni las cifras
 * (regla 9).
 */
export function interpretarPaso(paso: Paso, texto: string, contexto: ContextoPaso): LecturaPaso | null {
  const tokens = tokenizar(texto);
  if (tokens.t.length === 0) return null;
  const delPaso = contextoDelPaso(paso, contexto);
  const i = interpretarReglas(texto, delPaso);
  const desdeReglas = i ? lecturaDesdeInterpretacion(paso, i, delPaso) : null;
  return (
    validar(desdeReglas && conAproximado(desdeReglas, tokens)) ?? validar(GRAMATICAS[paso](tokens, contexto))
  );
}
