/**
 * CONFIGURAR del nivel 0 (docs/06-NLU.md §9): ciclo de tarjeta, colchón, ingreso recurrente, saldo de cuenta,
 * compromisos (recurrentes o de una vez) y alta de tanda. Las reglas son las de `05 §E3.1`.
 */
import type { Centavos, DiaSemana } from '@cartera/core';
import type { Ajuste, Categoria, Interpretacion, Regla } from '../esquema';
import { buscarEnDiccionario } from './diccionario';
import type { Entorno } from './entorno';
import { MESES, fechaProximaDeMes } from './fechas';
import { Lector } from './lector';
import { leerEntero, leerMonto, leerOrdinal } from './montos';
import { ARTICULOS, type Tokens, palabraDesc } from './tokens';

type ReglaRecurrente = Exclude<Regla, { tipo: 'unica' }>;

const DIAS: Readonly<Record<string, DiaSemana>> = {
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
  domingo: 7,
};
const PALABRAS_FUNCION = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'mi', 'mis', 'un', 'una']);
const SON: readonly (readonly string[])[] = [
  ['me', 'cuesta'],
  ['son'],
  ['es'],
  ['cuesta'],
  ['de'],
  ['sale', 'en'],
  ['sale'],
];
const TENGO_QUE_PAGAR: readonly (readonly string[])[] = [
  ['tengo', 'que', 'pagar'],
  ['debo', 'pagar'],
  ['me', 'toca', 'pagar'],
  ['pago'],
];

const configurar = (ajuste: Ajuste): Interpretacion => ({ intencion: 'configurar', ajuste });

function montoPositivo(l: Lector): Centavos | null {
  const lectura = leerMonto(l);
  return lectura && lectura.monto > 0 ? lectura.monto : null;
}

/** "el 15 y el último" → quincenal_15_ultimo. */
function quincenaDicha(l: Lector): boolean {
  return l.alguna(
    ['el', '15', 'y', 'el', 'ultimo'],
    ['el', 'quince', 'y', 'el', 'ultimo'],
    ['los', '15', 'y', 'ultimos'],
    ['el', '15', 'y', 'ultimo'],
    ['el', '15', 'y', 'el', '30'],
    ['el', '15', 'y', 'el', 'treinta'],
  );
}

/**
 * REGLA := cada (día N | día primero | mes el [día] N | quincena | semana [el DIA] | DIA | año el N de MES | N de MES)
 *        | el N de cada mes | los N de cada mes | todos los DIA | el 15 y el último [de cada mes]
 * `null` si no hay regla o le falta el dato (un "cada mes" sin día no se adivina).
 */
function leerRegla(l: Lector): ReglaRecurrente | null {
  const inicio = l.marca();
  const diaDeMes = (): number | null => {
    if (l.palabra('primero')) return 1;
    return leerEntero(l, 31);
  };
  if (l.palabra('cada')) {
    if (l.palabra('dia')) {
      const dia = diaDeMes();
      if (dia !== null) return { tipo: 'mensual', dia };
    } else if (l.palabra('mes')) {
      if (l.palabra('el')) {
        l.palabra('dia');
        const dia = diaDeMes();
        if (dia !== null) return { tipo: 'mensual', dia };
      }
    } else if (l.palabra('quincena')) {
      l.sep();
      quincenaDicha(l);
      return { tipo: 'quincenal_15_ultimo' };
    } else if (l.palabra('semana')) {
      if (l.palabra('el', 'los')) {
        const dia = l.ver();
        const numero = dia === undefined ? undefined : DIAS[dia];
        if (numero !== undefined) {
          l.pos++;
          return { tipo: 'semanal', dia_semana: numero };
        }
      }
    } else if (l.palabra('año')) {
      if (l.palabra('el')) {
        const dia = leerEntero(l, 31);
        const mes = l.palabra('de') ? MESES[l.ver() ?? ''] : undefined;
        if (dia !== null && mes !== undefined) {
          l.pos++;
          return { tipo: 'anual', mes, dia };
        }
      }
    } else {
      const diaSemanaDicho = l.ver();
      const numero = diaSemanaDicho === undefined ? undefined : DIAS[diaSemanaDicho];
      if (numero !== undefined) {
        l.pos++;
        return { tipo: 'semanal', dia_semana: numero };
      }
      const dia = leerEntero(l, 31);
      if (dia !== null && l.palabra('de')) {
        const mes = MESES[l.ver() ?? ''];
        if (mes !== undefined) {
          l.pos++;
          return { tipo: 'anual', mes, dia };
        }
      }
    }
    l.volver(inicio);
    return null;
  }
  if (l.palabra('el', 'los')) {
    const dia = diaDeMes();
    if (dia !== null && l.secuencia('de', 'cada', 'mes')) return { tipo: 'mensual', dia };
    l.volver(inicio);
  }
  if (l.secuencia('todos', 'los')) {
    const dia = l.ver();
    const numero = dia === undefined ? undefined : DIAS[dia];
    if (numero !== undefined) {
      l.pos++;
      return { tipo: 'semanal', dia_semana: numero };
    }
    l.volver(inicio);
  }
  if (quincenaDicha(l)) {
    l.alguna(['de', 'cada', 'mes'], ['de', 'cada', 'quincena']);
    return { tipo: 'quincenal_15_ultimo' };
  }
  l.volver(inicio);
  return null;
}

/**
 * CONCEPTO := 1 a 5 palabras (artículos y "de" permitidos) sin fechas, pagos, deudas, alias ni nombres. Categoría solo
 * si todas las palabras de contenido salen del diccionario con una sola categoría; "renta del local" → `renta_local`
 * del negocio (solo con negocio activo).
 */
function concepto(
  l: Lector,
  env: Entorno,
  fin: number,
): { concepto: string; categoria?: Categoria; espacio?: 'negocio' } | null {
  const inicio = l.marca();
  const palabras = l.t.slice(inicio, fin);
  if (palabras.length < 1 || palabras.length > 5) return null;
  const texto = l.original(inicio, fin);
  const sinArticulo = ARTICULOS.has(palabras[0] ?? '') ? palabras.slice(1) : palabras;
  if (sinArticulo.join(' ') === 'renta del local' || sinArticulo.join(' ') === 'renta de la tienda') {
    if (!env.negocio) return null;
    l.pos = fin;
    return { concepto: texto, categoria: 'renta_local', espacio: 'negocio' };
  }
  const contenido = palabras.filter((p) => !PALABRAS_FUNCION.has(p));
  if (contenido.length < 1) return null;
  if (contenido.some((p) => !palabraDesc(p) || env.nombres.has(p) || env.esAliasCuenta([p]))) return null;
  if (palabras.some((p) => !/^[a-zñ]+$/.test(p))) return null;
  l.pos = fin;
  const { categorias, cubiertas } = buscarEnDiccionario(contenido);
  const [categoria] = categorias;
  if (cubiertas.every(Boolean) && categorias.size === 1 && categoria) return { concepto: texto, categoria };
  return { concepto: texto };
}

function compromisoDe(
  c: { concepto: string; categoria?: Categoria; espacio?: 'negocio' },
  monto: Centavos,
  regla: Regla,
): Interpretacion {
  return configurar({
    tipo: 'compromiso',
    concepto: c.concepto,
    monto,
    ...(c.categoria ? { categoria: c.categoria } : {}),
    regla,
    ...(c.espacio ? { espacio: c.espacio } : {}),
  });
}

/**
 * TARJETA_CICLO := [mi|la] ALIAS_CRED corta el N [y (pago|la pago|se paga|vence) el M | y tengo M días para pagar]
 * COLCHON       := quiero [tener] [siempre] MONTO de colchón | [quiero] [un] colchón de MONTO | guárdame MONTO de colchón
 * INGRESO_REC   := me pagan MONTO REGLA   (quincenal, mensual o semanal)
 * SALDO_CUENTA  := tengo MONTO en [la|mi] ALIAS_DEB
 * COMPROMISO    := [art] CONCEPTO (son|es|de|me cuesta) MONTO REGLA
 *                | el N de MES (tengo que pagar|pago) [art] CONCEPTO [,] (son|es|de) MONTO        → única
 *                | (tengo que pagar|pago) [art] CONCEPTO el N de MES [,] (son|es|de) MONTO        → única
 * TANDA         := (entré a|me metí a|estoy en) una tanda de MONTO cada quincena [,] somos N y me toca el ORDINAL
 */
export function configurarFrase(tokens: Tokens, env: Entorno): Interpretacion | null {
  const l = new Lector(tokens);
  const inicio = l.marca();

  // Ciclo de tarjeta.
  {
    const alias = env.alias(l, ['credito']);
    if (alias?.alias !== undefined && l.secuencia('corta', 'el')) {
      const diaCorte = leerEntero(l, 31);
      if (diaCorte === null) return null;
      if (l.fin) return configurar({ tipo: 'tarjeta_ciclo', alias: alias.alias, dia_corte: diaCorte });
      if (!l.palabra('y')) return null;
      if (
        l.alguna(
          ['la', 'pago', 'el'],
          ['pago', 'el'],
          ['se', 'paga', 'el'],
          ['vence', 'el'],
          ['la', 'tengo', 'que', 'pagar', 'el'],
        )
      ) {
        const limite = leerEntero(l, 31);
        return limite !== null && l.fin
          ? configurar({
              tipo: 'tarjeta_ciclo',
              alias: alias.alias,
              dia_corte: diaCorte,
              dia_limite_pago: limite,
            })
          : null;
      }
      if (l.palabra('tengo')) {
        const dias = leerEntero(l, 60);
        return dias !== null && l.secuencia('dias', 'para', 'pagar') && l.fin
          ? configurar({
              tipo: 'tarjeta_ciclo',
              alias: alias.alias,
              dia_corte: diaCorte,
              dias_para_pagar: dias,
            })
          : null;
      }
      return null;
    }
    l.volver(inicio);
  }

  // Colchón.
  if (
    l.alguna(
      ['quiero', 'tener', 'siempre'],
      ['quiero', 'tener'],
      ['quiero'],
      ['guardame'],
      ['aparta'],
      ['apartame'],
    )
  ) {
    const despues = l.marca();
    const monto = montoPositivo(l);
    if (monto !== null && l.secuencia('de', 'colchon') && l.fin)
      return configurar({ tipo: 'colchon', monto });
    l.volver(despues);
    l.palabra('un');
    if (l.secuencia('colchon', 'de')) {
      const m = montoPositivo(l);
      return m !== null && l.fin ? configurar({ tipo: 'colchon', monto: m }) : null;
    }
    return null;
  }
  l.volver(inicio);
  if (
    l.alguna(
      ['un', 'colchon', 'de'],
      ['colchon', 'de'],
      ['mi', 'colchon', 'es', 'de'],
      ['mi', 'colchon', 'son'],
    )
  ) {
    const m = montoPositivo(l);
    return m !== null && l.fin ? configurar({ tipo: 'colchon', monto: m }) : null;
  }

  // Ingreso recurrente.
  l.volver(inicio);
  if (l.alguna(['me', 'pagan'], ['me', 'depositan'], ['cobro'], ['gano'])) {
    const monto = montoPositivo(l);
    if (monto === null) return null;
    const regla = leerRegla(l);
    if (regla === null || !l.fin) return null;
    if (regla.tipo === 'anual') return null;
    return configurar({ tipo: 'ingreso_recurrente', monto, regla });
  }

  // Saldo de cuenta (conciliación): "tengo 4,200 en BBVA". Con efectivo es arqueo (otra producción).
  l.volver(inicio);
  if (l.palabra('tengo')) {
    const monto = leerMonto(l);
    if (monto) {
      if (l.palabra('en')) {
        const ref = env.alias(l, ['debito']);
        if (ref?.alias !== undefined && l.fin && !monto.aproximado) {
          return configurar({ tipo: 'saldo_cuenta', alias: ref.alias, monto: monto.monto });
        }
      }
      return null;
    }
    l.volver(inicio);
  }

  // Tanda.
  l.volver(inicio);
  if (l.alguna(['entre', 'a'], ['me', 'meti', 'a'], ['me', 'meti', 'en'], ['estoy', 'en'])) {
    if (!l.secuencia('una', 'tanda', 'de')) return null;
    const aportacion = montoPositivo(l);
    if (aportacion === null || !l.secuencia('cada', 'quincena')) return null;
    l.sep();
    if (!l.palabra('somos')) return null;
    const participantes = leerEntero(l, 50);
    if (participantes === null || participantes < 2) return null;
    l.sep();
    if (!l.alguna(['y', 'me', 'toca', 'el'], ['me', 'toca', 'el'], ['y', 'soy', 'el'], ['soy', 'el']))
      return null;
    const turno = leerOrdinal(l, participantes);
    if (turno === null || !l.fin) return null;
    return configurar({
      tipo: 'tanda',
      aportacion,
      participantes,
      turno,
      regla: { tipo: 'quincenal_15_ultimo' },
    });
  }

  // Compromiso de una sola vez: "el 3 de noviembre tengo que pagar el predial, son 3 mil".
  l.volver(inicio);
  if (l.palabra('el')) {
    const dia = leerEntero(l, 31);
    const mes = dia !== null && l.palabra('de') ? MESES[l.ver() ?? ''] : undefined;
    if (dia !== null && mes !== undefined) {
      l.pos++;
      const fecha = fechaProximaDeMes(env.hoy, dia, mes);
      if (fecha === null || !l.alguna(...TENGO_QUE_PAGAR)) return null;
      const inicioConcepto = l.marca();
      for (let fin = inicioConcepto + 1; fin < l.largo; fin++) {
        l.volver(fin);
        l.sep();
        if (!l.alguna(...SON)) continue;
        const monto = montoPositivo(l);
        if (monto === null || !l.fin) continue;
        l.volver(inicioConcepto);
        const c = concepto(l, env, fin);
        return c ? compromisoDe(c, monto, { tipo: 'unica', fecha }) : null;
      }
      return null;
    }
    l.volver(inicio);
  }
  if (l.alguna(...TENGO_QUE_PAGAR)) {
    const inicioConcepto = l.marca();
    for (let fin = inicioConcepto + 1; fin < l.largo; fin++) {
      l.volver(fin);
      if (!l.palabra('el')) continue;
      const dia = leerEntero(l, 31);
      const mes = dia !== null && l.palabra('de') ? MESES[l.ver() ?? ''] : undefined;
      if (dia === null || mes === undefined) continue;
      l.pos++;
      const fecha = fechaProximaDeMes(env.hoy, dia, mes);
      l.sep();
      if (fecha === null || !l.alguna(...SON)) return null;
      const monto = montoPositivo(l);
      if (monto === null || !l.fin) return null;
      l.volver(inicioConcepto);
      const c = concepto(l, env, fin);
      return c ? compromisoDe(c, monto, { tipo: 'unica', fecha }) : null;
    }
    return null;
  }

  // Compromiso recurrente: "la renta son 6,500 cada día primero".
  l.volver(inicio);
  for (let fin = inicio + 1; fin < l.largo; fin++) {
    l.volver(fin);
    if (!l.alguna(...SON)) continue;
    const monto = montoPositivo(l);
    if (monto === null) continue;
    const regla = leerRegla(l);
    if (regla === null || !l.fin) continue;
    l.volver(inicio);
    const c = concepto(l, env, fin);
    return c ? compromisoDe(c, monto, regla) : null;
  }
  return null;
}
