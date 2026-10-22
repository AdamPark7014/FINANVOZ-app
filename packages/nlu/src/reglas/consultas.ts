/**
 * CONSULTA del nivel 0 (docs/06-NLU.md §6 y §9): preguntas tipadas con rangos de §3.1. Cada forma consume la frase
 * completa (sin signos) o devuelve `null`; las preguntas abiertas (`explicar`) van al nivel 2.
 */
import type { Interpretacion } from '../esquema';
import { leerCategoriaConsulta } from './categorias';
import type { Entorno } from './entorno';
import { esteAnio, esteMesContraElPasado, leerPeriodo, ultimosTreintaDias, type Rango } from './fechas';
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
];
const COMPARAR: readonly (readonly string[])[] = [
  ['estoy', 'gastando', 'mas'],
  ['gasto', 'mas'],
  ['llevo', 'mas'],
  ['he', 'gastado', 'mas'],
  ['voy', 'gastando', 'mas'],
];

const rango = (r: Rango) => ({ desde: r.desde, hasta: r.hasta });

export function consulta(tokens: Tokens, env: Entorno): Interpretacion | null {
  const l = new Lector(tokens);
  const inicio = l.marca();
  const completa = (...formas: readonly (readonly string[])[]) => {
    l.volver(inicio);
    return formas.some((f) => l.secuencia(...f) && l.fin);
  };

  if (completa(...HOY_PUEDES)) return consultar({ tipo: 'hoy_puedes' });
  if (completa(...DEUDA_TARJETAS)) return consultar({ tipo: 'deuda_tarjetas' });
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

  // ¿qué pagos tengo en los próximos 7 días? → compromisos
  l.volver(inicio);
  if (l.alguna(...COMPROMISOS)) {
    const periodo = leerPeriodo(l, env.hoy, env.ultimoIngreso);
    if (periodo && l.fin && periodo.desde >= env.hoy)
      return consultar({ tipo: 'compromisos', ...rango(periodo) });
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
    // ¿cuánto gasté [en CAT] PERIODO? / ¿cuánto gasté PERIODO [en CAT]?
    l.volver(despuesDeCuanto);
    if (l.alguna(...GASTADO)) {
      let categoria: ReturnType<typeof leerCategoriaConsulta> = null;
      let periodo = leerPeriodo(l, env.hoy, env.ultimoIngreso);
      if (l.palabra('en', 'de')) {
        categoria = leerCategoriaConsulta(l);
        if (!categoria) return null;
      }
      if (!periodo) periodo = leerPeriodo(l, env.hoy, env.ultimoIngreso);
      if (!periodo || !l.fin) return null;
      return categoria
        ? consultar({ tipo: 'gasto_por_categoria', ...rango(periodo), categoria })
        : consultar({ tipo: 'gasto_total', ...rango(periodo) });
    }
  }
  return null;
}
