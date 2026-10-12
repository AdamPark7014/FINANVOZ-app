import { exigirCentavos, type Centavos } from './dinero';
import { distribuirMayorResiduo } from './reparto';

/** Debajo de $50.00 todo el hueco va a `varios_efectivo` (E7). */
export const UMBRAL_REPARTO_ARQUEO: Centavos = 5000;
/** Categorías del historial que reciben su parte; el resto va a `varios_efectivo`. */
export const CATEGORIAS_ARQUEO = 3;
export const CATEGORIA_VARIOS_EFECTIVO = 'varios_efectivo';
export const CATEGORIA_VENTAS = 'ventas';

/** Gasto en efectivo confirmado y no estimado de los últimos 60 días. */
export interface GastoHistorial {
  categoria: string;
  monto: Centavos;
}

export interface Propuesta {
  categoria: string;
  monto: Centavos;
}

export interface EntradaArqueo {
  /** Saldo contable de la cuenta de efectivo; puede ser negativo. */
  saldo_contable: Centavos;
  /** Lo que el usuario dice traer. */
  efectivo_real: Centavos;
  historial: readonly GastoHistorial[];
  /** Montos "por asignar" que el usuario confirma en este arqueo como pagados en efectivo. */
  marcados?: readonly Centavos[];
}

export type AccionArqueo = 'ninguna' | 'aclarar_sobrante' | 'proponer_gastos_estimados';

export interface ResultadoArqueo {
  reasignado: Centavos;
  hueco: Centavos;
  accion: AccionArqueo;
  propuesta: Propuesta[];
}

const SIN_MINIMO = { minimo: Number.MIN_SAFE_INTEGER };

function sumarMarcados(marcados: readonly Centavos[]): Centavos {
  let total = 0;
  for (const m of marcados) total += exigirCentavos(m, 'marcados');
  return exigirCentavos(total, 'reasignado');
}

/**
 * E7 · Arqueo de efectivo. Primero se reasignan los marcados al efectivo; después se calcula el
 * hueco (al revés se contarían dos veces, E7-08). Nada se registra sin confirmación.
 */
export function arqueo(e: EntradaArqueo): ResultadoArqueo {
  const saldo = exigirCentavos(e.saldo_contable, 'saldo_contable', SIN_MINIMO);
  const real = exigirCentavos(e.efectivo_real, 'efectivo_real');
  const reasignado = sumarMarcados(e.marcados ?? []);
  const hueco = exigirCentavos(saldo - reasignado - real, 'hueco', SIN_MINIMO);

  if (hueco === 0) return { reasignado, hueco, accion: 'ninguna', propuesta: [] };
  if (hueco < 0) return { reasignado, hueco, accion: 'aclarar_sobrante', propuesta: [] };

  const porCategoria = new Map<string, Centavos>();
  for (const g of e.historial) {
    const monto = exigirCentavos(g.monto, 'historial.monto');
    porCategoria.set(g.categoria, (porCategoria.get(g.categoria) ?? 0) + monto);
  }
  const orden = [...porCategoria.entries()]
    .filter(([, monto]) => monto > 0)
    .sort(([ca, ma], [cb, mb]) => (ma !== mb ? mb - ma : ca < cb ? -1 : ca > cb ? 1 : 0));

  if (hueco < UMBRAL_REPARTO_ARQUEO || orden.length === 0) {
    return {
      reasignado,
      hueco,
      accion: 'proponer_gastos_estimados',
      propuesta: [{ categoria: CATEGORIA_VARIOS_EFECTIVO, monto: hueco }],
    };
  }

  const top = orden.slice(0, CATEGORIAS_ARQUEO);
  const resto = orden.slice(CATEGORIAS_ARQUEO).reduce((s, [, monto]) => s + monto, 0);
  const categorias = top.map(([c]) => c);
  const pesos = top.map(([, monto]) => monto);
  if (resto > 0) {
    categorias.push(CATEGORIA_VARIOS_EFECTIVO);
    pesos.push(resto);
  }
  const montos = distribuirMayorResiduo(hueco, pesos);
  return {
    reasignado,
    hueco,
    accion: 'proponer_gastos_estimados',
    propuesta: categorias.map((categoria, i) => ({ categoria, monto: montos[i] ?? 0 })),
  };
}

export interface EntradaCorteDeCaja {
  saldo_contable: Centavos;
  efectivo_real: Centavos;
  /** Gastos por asignar del negocio pagados con la caja (se reasignan primero, como en E7). */
  marcados?: readonly Centavos[];
}

export type AccionCorte = 'ninguna' | 'proponer_ventas' | 'aclarar_faltante';

export interface ResultadoCorteDeCaja {
  reasignado: Centavos;
  esperado: Centavos;
  diferencia: Centavos;
  accion: AccionCorte;
  propuesta: Propuesta[];
}

/**
 * E7.2 · Corte de caja (espacio negocio): lo normal es que sobre dinero (ventas en efectivo no
 * anotadas). Un faltante se pregunta (retiro del dueño, gasto del negocio o ajuste).
 */
export function corteDeCaja(e: EntradaCorteDeCaja): ResultadoCorteDeCaja {
  const saldo = exigirCentavos(e.saldo_contable, 'saldo_contable', SIN_MINIMO);
  const real = exigirCentavos(e.efectivo_real, 'efectivo_real');
  const reasignado = sumarMarcados(e.marcados ?? []);
  const esperado = exigirCentavos(saldo - reasignado, 'esperado', SIN_MINIMO);
  const diferencia = exigirCentavos(real - esperado, 'diferencia', SIN_MINIMO);
  const base = { reasignado, esperado, diferencia };
  if (diferencia === 0) return { ...base, accion: 'ninguna', propuesta: [] };
  if (diferencia > 0) {
    return {
      ...base,
      accion: 'proponer_ventas',
      propuesta: [{ categoria: CATEGORIA_VENTAS, monto: diferencia }],
    };
  }
  return { ...base, accion: 'aclarar_faltante', propuesta: [] };
}
