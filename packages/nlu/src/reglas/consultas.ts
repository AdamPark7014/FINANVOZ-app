/**
 * CONSULTA del nivel 0 (docs/06-NLU.md §6 y §9): preguntas tipadas con rangos de §3.1. Cada forma consume la frase
 * completa (sin signos) o devuelve `null`; las preguntas abiertas (`explicar`) van al nivel 2. «¿Cuánto gasté?»
 * sin periodo pregunta de cuándo con chips (28-10-2026); la respuesta llega pegada tras una coma o como seguimiento.
 */
import type { Interpretacion } from '../esquema';
import { leerCategoriaConsulta } from './categorias';
import type { Entorno } from './entorno';
import {
  esteAnio,
  esteMes,
  esteMesContraElPasado,
  hastaElIngreso,
  leerPeriodo,
  leerPeriodoAdelante,
  ultimosTreintaDias,
  type Rango,
} from './fechas';
import { Lector } from './lector';
import type { Tokens } from './tokens';

type Consulta = Extract<Interpretacion, { intencion: 'consultar' }>['consulta'];

const consultar = (consulta: Consulta): Interpretacion => ({ intencion: 'consultar', consulta });

const CUANTO: readonly (readonly string[])[] = [['cuanto'], ['que', 'tanto'], ['cuanta', 'lana']];
const GASTADO: readonly (readonly string[])[] = [
  ['llevo', 'gastado'],
  ['llevo', 'gastados'],
  ['llevo', 'de', 'gasto'],
  ['llevo', 'de', 'gastos'],
  ['he', 'gastado'],
  ['gaste'],
  ['llevo'],
];
/**
 * Las formas con «llevo» hablan de lo que va: sin periodo, el mes en curso [1, hoy] (`06 §9.2`). «Llevo» a secas
 * además pide categoría: «¿cuánto llevo?» sin más también es «cuánto efectivo traigo» y se deja al nivel 2.
 */
const LLEVO_GASTADO: readonly (readonly string[])[] = [
  ['llevo', 'gastado'],
  ['llevo', 'gastados'],
  ['llevo', 'de', 'gasto'],
  ['llevo', 'de', 'gastos'],
];
const HOY_PUEDES: readonly (readonly string[])[] = [
  ['cuanto', 'puedo', 'gastar', 'hoy'],
  ['cuanto', 'puedo', 'gastar'],
  ['cuanto', 'me', 'queda', 'para', 'gastar', 'hoy'],
  ['cuanto', 'me', 'queda', 'para', 'gastar'],
  ['cuanto', 'tengo', 'para', 'gastar', 'hoy'],
  ['cuanto', 'tengo', 'para', 'gastar'],
  ['que', 'tanto', 'puedo', 'gastar', 'hoy'],
  ['que', 'tanto', 'puedo', 'gastar'],
];
const DEUDA_TARJETAS: readonly (readonly string[])[] = [
  // «¿Cuánto debo?» a secas: lo de las tarjetas (lo que debes a personas se ve en Cuentas › Debes).
  ['cuanto', 'debo'],
  ['cuanto', 'debo', 'en', 'total'],
  ['que', 'tanto', 'debo'],
  ['cuanto', 'debo', 'de', 'credito'],
  ['cuanto', 'debo', 'en', 'mis', 'tarjetas', 'de', 'credito'],
  ['cuanto', 'debo', 'de', 'tarjetas'],
  ['cuanto', 'debo', 'de', 'tarjeta'],
  ['cuanto', 'debo', 'en', 'tarjetas'],
  ['cuanto', 'debo', 'de', 'las', 'tarjetas'],
  ['cuanto', 'debo', 'en', 'las', 'tarjetas'],
  ['cuanto', 'debo', 'de', 'la', 'tarjeta'],
  ['cuanto', 'debo', 'en', 'mis', 'tarjetas'],
  ['cuanto', 'debo', 'de', 'mis', 'tarjetas'],
  ['cuanto', 'debo', 'en', 'total', 'de', 'tarjetas'],
];
const POR_COBRAR: readonly (readonly string[])[] = [
  ['quien', 'me', 'debe', 'dinero'],
  ['quien', 'me', 'debe'],
  ['quienes', 'me', 'deben', 'dinero'],
  ['quienes', 'me', 'deben'],
  ['cuanto', 'me', 'deben'],
  ['que', 'me', 'deben'],
];
const MAYORES_GASTOS: readonly (readonly string[])[] = [
  ['en', 'que', 'se', 'me', 'va', 'el', 'dinero'],
  ['en', 'que', 'se', 'va', 'mi', 'dinero'],
  ['en', 'que', 'se', 'me', 'va', 'la', 'lana'],
  ['en', 'que', 'gasto', 'mas'],
  ['en', 'que', 'estoy', 'gastando', 'mas'],
  ['cuales', 'son', 'mis', 'mayores', 'gastos'],
  ['cuales', 'son', 'mis', 'gastos', 'mas', 'grandes'],
];
const SUSCRIPCIONES: readonly (readonly string[])[] = [
  ['que', 'suscripciones', 'tengo'],
  ['cuales', 'son', 'mis', 'suscripciones'],
  ['cuanto', 'pago', 'de', 'suscripciones'],
  ['cuanto', 'pago', 'en', 'suscripciones'],
  ['cuanto', 'gasto', 'en', 'suscripciones'],
];
const PUEDO_RETIRAR: readonly (readonly string[])[] = [
  ['cuanto', 'puedo', 'sacar', 'del', 'negocio'],
  ['cuanto', 'puedo', 'sacar', 'de', 'la', 'tienda'],
  ['cuanto', 'puedo', 'sacar', 'de', 'la', 'caja'],
  ['cuanto', 'puedo', 'retirar', 'del', 'negocio'],
  ['cuanto', 'puedo', 'retirar', 'de', 'la', 'tienda'],
  ['cuanto', 'le', 'puedo', 'sacar', 'al', 'negocio'],
];
const COMPROMISOS: readonly (readonly string[])[] = [
  ['que', 'pagos', 'tengo'],
  ['que', 'compromisos', 'tengo'],
  ['que', 'tengo', 'que', 'pagar'],
  ['que', 'me', 'toca', 'pagar'],
  ['que', 'pagos', 'vienen'],
  ['que', 'pagos', 'se', 'vienen'],
  ['que', 'pagos', 'me', 'tocan'],
  ['que', 'debo', 'pagar'],
  ['que', 'me', 'falta', 'pagar'],
  ['que', 'pago'],
  ['que', 'se', 'viene'],
  ['que', 'viene'],
  ['que', 'se', 'vence'],
  ['que', 'vence'],
  ['que', 'me', 'vence'],
];
/** «¿Cuánto tengo?» sin cuenta: lo que tienes en todas (efectivo y débito), como en Cuentas. */
const SALDO_TOTAL: readonly (readonly string[])[] = [
  ['cuanto', 'dinero', 'tengo', 'en', 'total'],
  ['cuanto', 'dinero', 'tengo'],
  ['cuanto', 'tengo', 'en', 'total'],
  ['cuanto', 'tengo', 'en', 'mis', 'cuentas'],
  ['cuanto', 'tengo', 'en', 'las', 'cuentas'],
  ['cuanto', 'hay', 'en', 'mis', 'cuentas'],
  ['cuanta', 'lana', 'tengo'],
  ['cuanto', 'tengo'],
];
/** Cuándo llega el próximo ingreso (Gratis: es la fecha que ya dice «Hoy puedes»). */
const PROXIMO_INGRESO: readonly (readonly string[])[] = [
  ['cuando', 'me', 'pagan', 'la', 'quincena'],
  ['cuando', 'me', 'pagan'],
  ['cuando', 'me', 'depositan', 'la', 'quincena'],
  ['cuando', 'me', 'depositan'],
  ['cuando', 'cae', 'la', 'quincena'],
  ['cuando', 'cae', 'mi', 'quincena'],
  ['cuando', 'me', 'cae', 'la', 'quincena'],
  ['cuando', 'llega', 'la', 'quincena'],
  ['cuando', 'llega', 'mi', 'quincena'],
  ['cuando', 'me', 'llega', 'la', 'quincena'],
  ['cuando', 'me', 'llega', 'el', 'sueldo'],
  ['cuando', 'es', 'la', 'proxima', 'quincena'],
  ['cuando', 'es', 'mi', 'proxima', 'quincena'],
  ['cuando', 'es', 'la', 'quincena'],
  ['cuando', 'es', 'mi', 'quincena'],
  ['cuando', 'cobro'],
  ['cuando', 'me', 'toca', 'cobrar'],
  ['cuanto', 'falta', 'para', 'la', 'quincena'],
  ['cuanto', 'falta', 'para', 'mi', 'quincena'],
  ['cuanto', 'falta', 'para', 'que', 'me', 'paguen'],
  ['cuantos', 'dias', 'faltan', 'para', 'la', 'quincena'],
  ['cuantos', 'dias', 'faltan', 'para', 'que', 'me', 'paguen'],
];
/** Por qué la cifra de hoy es esa: el desglose de E4 que ya muestra «Cómo lo calculé» (Gratis). */
const DESGLOSE_HOY: readonly (readonly string[])[] = [
  ['por', 'que', 'tengo', 'tan', 'poco', 'para', 'gastar', 'hoy'],
  ['por', 'que', 'tengo', 'tan', 'poco', 'para', 'gastar'],
  ['por', 'que', 'tengo', 'tan', 'poco', 'hoy'],
  ['por', 'que', 'tengo', 'tan', 'poco'],
  ['por', 'que', 'tan', 'poco', 'hoy'],
  ['por', 'que', 'tan', 'poco'],
  ['por', 'que', 'tan', 'poquito'],
  ['por', 'que', 'puedo', 'gastar', 'tan', 'poco', 'hoy'],
  ['por', 'que', 'puedo', 'gastar', 'tan', 'poco'],
  ['por', 'que', 'me', 'toca', 'tan', 'poco', 'hoy'],
  ['por', 'que', 'me', 'toca', 'tan', 'poco'],
  ['por', 'que', 'me', 'alcanza', 'tan', 'poco', 'hoy'],
  ['por', 'que', 'puedo', 'gastar', 'eso', 'hoy'],
  ['por', 'que', 'puedo', 'gastar', 'eso'],
  ['como', 'lo', 'calculaste'],
  ['como', 'calculaste', 'lo', 'de', 'hoy'],
  ['como', 'calculas', 'lo', 'de', 'hoy'],
  ['como', 'calculas', 'lo', 'que', 'puedo', 'gastar'],
  ['como', 'sacaste', 'eso'],
  ['como', 'sacaste', 'lo', 'de', 'hoy'],
  ['de', 'donde', 'sale', 'eso'],
  ['de', 'donde', 'sale', 'lo', 'de', 'hoy'],
  ['de', 'donde', 'salio', 'eso'],
  ['explicame', 'lo', 'de', 'hoy'],
  ['explicame', 'como', 'lo', 'calculaste'],
];
const COMPARAR: readonly (readonly string[])[] = [
  ['estoy', 'gastando', 'mas'],
  ['gasto', 'mas'],
  ['llevo', 'mas'],
  ['he', 'gastado', 'mas'],
  ['voy', 'gastando', 'mas'],
];

const rango = (r: Rango) => ({ desde: r.desde, hasta: r.hasta });

export const PREGUNTA_PERIODO = '¿De cuándo? ¿Hoy, esta semana o este mes?';
/** Chips de «¿De cuándo?»: cada uno se lee como periodo pegado a la pregunta o como seguimiento. */
export const OPCIONES_PERIODO = ['Hoy', 'Esta semana', 'Este mes'] as const;

export function consulta(tokens: Tokens, env: Entorno): Interpretacion | null {
  const l = new Lector(tokens);
  const inicio = l.marca();
  const completa = (...formas: readonly (readonly string[])[]) =>
    formas.some((f) => {
      l.volver(inicio);
      return l.secuencia(...f) && l.fin;
    });

  if (completa(...HOY_PUEDES)) return consultar({ tipo: 'hoy_puedes' });
  if (completa(...DESGLOSE_HOY)) return consultar({ tipo: 'desglose_hoy' });
  if (completa(...PROXIMO_INGRESO)) return consultar({ tipo: 'proximo_ingreso' });
  if (completa(...DEUDA_TARJETAS)) return consultar({ tipo: 'deuda_tarjetas' });
  if (completa(...SALDO_TOTAL)) return consultar({ tipo: 'saldo' });
  if (completa(...POR_COBRAR)) return consultar({ tipo: 'por_cobrar' });
  if (completa(...SUSCRIPCIONES)) return consultar({ tipo: 'suscripciones' });
  if (completa(...MAYORES_GASTOS))
    return consultar({ tipo: 'mayores_gastos', ...rango(ultimosTreintaDias(env.hoy)), limite: 5 });
  if (env.negocio && completa(...PUEDO_RETIRAR)) return consultar({ tipo: 'puedo_retirar' });

  // ¿cuánto tengo en BBVA? → saldo
  l.volver(inicio);
  if (l.alguna(['cuanto', 'tengo'], ['cuanto', 'hay'], ['cuanto', 'me', 'queda'], ['cuanto', 'queda'])) {
    if (l.palabra('en')) {
      const ref = env.alias(l);
      if (ref && ref.alias !== undefined && l.fin) return consultar({ tipo: 'saldo', alias: ref.alias });
    }
  }

  // ¿cuánto debo en la Nu? / ¿cuánto le debo a la oro? → saldo de esa tarjeta («En tu Nu debes $X»)
  l.volver(inicio);
  if (l.alguna(['cuanto', 'le', 'debo'], ['cuanto', 'debo']) && l.palabra('en', 'a', 'de')) {
    const ref = env.alias(l, ['credito']);
    if (ref && ref.alias !== undefined && l.fin) return consultar({ tipo: 'saldo', alias: ref.alias });
  }

  // ¿qué pagos tengo en los próximos 7 días? / ¿qué pago esta semana? / ¿qué tengo que pagar? → compromisos,
  // siempre hacia adelante; sin periodo, hasta el próximo ingreso.
  for (const forma of COMPROMISOS) {
    l.volver(inicio);
    if (!l.secuencia(...forma)) continue;
    if (l.fin)
      return consultar({ tipo: 'compromisos', ...rango(hastaElIngreso(env.hoy, env.proximoIngreso)) });
    const periodo = leerPeriodoAdelante(l, env.hoy, env.proximoIngreso);
    if (periodo && l.fin) return consultar({ tipo: 'compromisos', ...rango(periodo) });
  }

  // ¿estoy gastando más en comida que el mes pasado? → comparar_periodos
  l.volver(inicio);
  if (l.alguna(...COMPARAR)) {
    let categoria: ReturnType<typeof leerCategoriaConsulta> = null;
    if (l.palabra('en', 'de')) {
      categoria = leerCategoriaConsulta(l);
      if (!categoria) return null;
    }
    if (l.secuencia('que', 'el', 'mes', 'pasado') && l.fin) {
      const { actual, anterior } = esteMesContraElPasado(env.hoy);
      return consultar({ tipo: 'comparar_periodos', ...(categoria ? { categoria } : {}), actual, anterior });
    }
  }

  // ¿cuánto llevo de impuestos este mes? / ¿cuánto llevo de deducibles este año?
  l.volver(inicio);
  if (l.alguna(...CUANTO)) {
    const despuesDeCuanto = l.marca();
    if (
      l.alguna(
        ['llevo', 'de', 'impuestos'],
        ['llevo', 'en', 'impuestos'],
        ['debo', 'de', 'impuestos'],
        ['tengo', 'apartado', 'de', 'impuestos'],
      )
    ) {
      const periodo = leerPeriodo(l, env.hoy, env.ultimoIngreso);
      if (env.negocio && periodo && l.fin) return consultar({ tipo: 'impuestos', ...rango(periodo) });
      return null;
    }
    l.volver(despuesDeCuanto);
    if (
      l.alguna(
        ['llevo', 'de', 'deducibles'],
        ['llevo', 'de', 'deducible'],
        ['llevo', 'deducible'],
        ['llevo', 'de', 'deducciones'],
        ['tengo', 'de', 'deducibles'],
      )
    ) {
      // Sin periodo, el ejercicio en curso.
      const periodo = leerPeriodo(l, env.hoy, env.ultimoIngreso) ?? esteAnio(env.hoy);
      return l.fin ? consultar({ tipo: 'deducciones', ...rango(periodo) }) : null;
    }
    // ¿cuánto gasté [en CAT] PERIODO? / ¿cuánto gasté PERIODO [en CAT]? / ¿cuánto llevo en CAT [PERIODO]?
    l.volver(despuesDeCuanto);
    const conGastado = l.alguna(...LLEVO_GASTADO);
    l.volver(despuesDeCuanto);
    const llevo = l.ver() === 'llevo';
    if (l.alguna(...GASTADO)) {
      let categoria: ReturnType<typeof leerCategoriaConsulta> = null;
      let periodo = leerPeriodo(l, env.hoy, env.ultimoIngreso);
      if (l.palabra('en', 'de')) {
        categoria = leerCategoriaConsulta(l);
        if (!categoria) return null;
      }
      // La respuesta a «¿De cuándo?» puede llegar pegada tras una coma: «¿cuánto gasté?, esta semana».
      if (!periodo) {
        l.sep();
        periodo = leerPeriodo(l, env.hoy, env.ultimoIngreso);
      }
      if (!periodo && llevo && (conGastado || categoria)) periodo = esteMes(env.hoy);
      if (!periodo && !llevo && l.fin) {
        // «¿Cuánto gasté [en comida]?» sin periodo: se pregunta de cuándo, con chips.
        const parcial = categoria ? { tipo: 'gasto_por_categoria', categoria } : { tipo: 'gasto_total' };
        return {
          intencion: 'aclarar',
          motivo: 'fecha_ambigua',
          pregunta: PREGUNTA_PERIODO,
          opciones: [...OPCIONES_PERIODO],
          parcial: { consulta: parcial },
        };
      }
      if (!periodo || !l.fin) return null;
      return categoria
        ? consultar({ tipo: 'gasto_por_categoria', ...rango(periodo), categoria })
        : consultar({ tipo: 'gasto_total', ...rango(periodo) });
    }
  }
  return null;
}
