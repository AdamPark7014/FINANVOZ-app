/**
 * O3 · ingreso (docs/06-NLU.md §13). Los datos van en cualquier orden, cada uno a lo más una vez, con comas o "y"
 * entre ellos; la frase completa o `null`.
 *
 *   INGRESO   := VARIA | [VERBO] DATO ([,] [y] DATO)*
 *   DATO      := [VERBO] MONTO [netos|libres|limpios] | REGLA_ING | FIN_SEMANA
 *   VERBO     := me pagan | me depositan | cobro | gano | recibo | mi sueldo es [de] | mi quincena es [de]
 *              | son | eran | es de                                     (corrección: «no, son 12 mil»)
 *   REGLA_ING := leerRegla de configurar ("cada quincena", "cada mes el 30", "cada viernes", "el 15 y el último")
 *              | a la quincena | por quincena | quincenal | los días 15 y 30                → quincena (15 y último)
 *              | cada 14 días | cada catorce días | cada dos semanas | catorcenal           → catorcenal, sin ancla
 *              | a la semana | por semana | cada semana | semanal                          → semanal, sin día
 *              | al mes | por mes | cada mes | mensual                                      → mensual, sin día
 *   FIN_SEMANA := si cae en fin de semana [me] (pagan|depositan) (antes | después | el mismo día)
 *   VARIA     := varía | mi sueldo varía | no tengo [un] sueldo fijo
 *
 * "brutos" no es lo que llega → `null` (el neto no se adivina). Una regla anual no es un sueldo → `null`.
 */
import { leerRegla } from '../reglas/configurar';
import { Lector } from '../reglas/lector';
import type { Tokens } from '../reglas/tokens';
import { leerCifra } from './comun';
import type { Cifra, LecturaPaso } from './esquema';

type LecturaIngreso = Extract<LecturaPaso, { paso: 'ingreso' }>;
type Frecuencia = NonNullable<LecturaIngreso['frecuencia']>;
type Regla = NonNullable<LecturaIngreso['regla']>;

const VERBOS: readonly (readonly string[])[] = [
  ['mi', 'sueldo', 'es', 'de'],
  ['mi', 'sueldo', 'es'],
  ['mi', 'quincena', 'es', 'de'],
  ['mi', 'quincena', 'es'],
  ['me', 'pagan'],
  ['me', 'depositan'],
  ['cobro'],
  ['gano'],
  ['recibo'],
  // Corrección en la tarjeta «Entendí» del onboarding: «no, son 12 mil».
  ['son'],
  ['eran'],
  ['es', 'de'],
];
const VARIA: readonly (readonly string[])[] = [
  ['varia'],
  ['mi', 'sueldo', 'varia'],
  ['mi', 'ingreso', 'varia'],
  ['no', 'tengo', 'sueldo', 'fijo'],
  ['no', 'tengo', 'un', 'sueldo', 'fijo'],
];
const QUINCENA: readonly (readonly string[])[] = [
  ['a', 'la', 'quincena'],
  ['por', 'quincena'],
  ['quincenal'],
  ['quincenales'],
  ['los', 'dias', '15', 'y', '30'],
  ['los', 'dias', 'quince', 'y', 'treinta'],
];
const CATORCENA: readonly (readonly string[])[] = [
  ['cada', '14', 'dias'],
  ['cada', 'catorce', 'dias'],
  ['cada', 'dos', 'semanas'],
  ['catorcenal'],
];
const SEMANA: readonly (readonly string[])[] = [
  ['a', 'la', 'semana'],
  ['por', 'semana'],
  ['cada', 'semana'],
  ['semanal'],
  ['semanales'],
];
const MES: readonly (readonly string[])[] = [
  ['al', 'mes'],
  ['por', 'mes'],
  ['cada', 'mes'],
  ['mensual'],
  ['mensuales'],
];

const FRECUENCIA_DE_REGLA: Readonly<Record<Regla['tipo'], Frecuencia | null>> = {
  quincenal_15_ultimo: 'quincena',
  quincenal_dias: 'quincena',
  semanal: 'semanal',
  catorcenal: 'catorcenal',
  mensual: 'mensual',
  anual: null,
};

/** REGLA_ING; `null` sin mover el cursor si no hay. `anual` → error (no es un sueldo). */
function leerReglaIngreso(l: Lector): { frecuencia: Frecuencia; regla?: Regla } | 'anual' | null {
  const regla = leerRegla(l);
  if (regla) {
    const frecuencia = FRECUENCIA_DE_REGLA[regla.tipo];
    return frecuencia === null ? 'anual' : { frecuencia, regla };
  }
  if (l.alguna(...QUINCENA)) return { frecuencia: 'quincena', regla: { tipo: 'quincenal_15_ultimo' } };
  if (l.alguna(...CATORCENA)) return { frecuencia: 'catorcenal' };
  if (l.alguna(...SEMANA)) return { frecuencia: 'semanal' };
  if (l.alguna(...MES)) return { frecuencia: 'mensual' };
  return null;
}

function leerFinDeSemana(l: Lector): LecturaIngreso['finDeSemana'] | null {
  const inicio = l.marca();
  if (!l.alguna(['si', 'cae', 'en', 'fin', 'de', 'semana'], ['cuando', 'cae', 'en', 'fin', 'de', 'semana'])) {
    return null;
  }
  l.sep();
  l.palabra('me');
  if (l.palabra('pagan', 'depositan')) {
    if (l.palabra('antes')) return 'antes';
    if (l.palabra('despues')) return 'despues';
    if (l.alguna(['el', 'mismo', 'dia'], ['ese', 'mismo', 'dia'])) return 'mismo';
  }
  l.volver(inicio);
  return null;
}

export function leerIngreso(tokens: Tokens): LecturaIngreso | null {
  const l = new Lector(tokens);
  if (l.alguna(...VARIA) && l.fin) return { paso: 'ingreso', frecuencia: 'varia' };
  l.volver(0);

  let verbo = false;
  let monto: Cifra | undefined;
  let regla: { frecuencia: Frecuencia; regla?: Regla } | undefined;
  let finDeSemana: LecturaIngreso['finDeSemana'];
  let primero = true;
  while (!l.fin) {
    if (!primero) {
      l.sep();
      l.palabra('y');
    }
    primero = false;
    if (!verbo && monto === undefined && l.alguna(...VERBOS)) {
      verbo = true;
      continue;
    }
    if (monto === undefined) {
      const c = leerCifra(l, false);
      if (c) {
        monto = c;
        l.palabra('netos', 'libres', 'limpios');
        continue;
      }
    }
    if (regla === undefined) {
      const r = leerReglaIngreso(l);
      if (r === 'anual') return null;
      if (r) {
        regla = r;
        continue;
      }
    }
    if (finDeSemana === undefined) {
      const f = leerFinDeSemana(l);
      if (f) {
        finDeSemana = f;
        continue;
      }
    }
    return null; // sobra algo ("brutos", otra cifra, otra regla)
  }
  if (monto === undefined && regla === undefined && finDeSemana === undefined) return null;
  return {
    paso: 'ingreso',
    ...(monto ? { monto } : {}),
    ...(regla ? { frecuencia: regla.frecuencia } : {}),
    ...(regla?.regla ? { regla: regla.regla } : {}),
    ...(finDeSemana ? { finDeSemana } : {}),
  };
}
