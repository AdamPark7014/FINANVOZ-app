import { exigirCentavos, type Centavos, type PuntosBase } from '../dinero';
import { ErrorDominio } from '../errores';
import { diferenciaDias, minFecha, partes, sumarDias, sumarMeses, type PlainDate } from '../fecha';
import { DIAS_HORIZONTE_FIJO, expandirProgramados, horizonte, type Programado } from '../horizonte';
import { planMsi } from '../msi';
import { porcentajeMostrado } from '../porcentaje';
import { proximasFechas, type Regla } from '../recurrencia';
import { recomendarTarjeta, type TarjetaCredito, type TarjetaRecomendable } from '../tarjetas';
import { MIN_DIAS_HISTORIAL, type DiaHistorial } from './historial';
import {
  crearSimulacion,
  pasoTerminado,
  correrCompleto,
  type HorizonteSimulacion,
  type Paso,
  type ResultadoSimulacion,
} from './simulacion';

/** Tope de la ventana de "¿Me alcanza?" (E8.3). */
export const TOPE_MESES_VENTANA = 24;
/** Debajo de $1,000 no se ofrece MSI si el usuario no pidió meses (E8.5). */
export const UMBRAL_PRECIO_MSI: Centavos = 100000;
/** Meses que se ofrecen si el usuario no pidió. */
export const MESES_POR_OMISION = 3;
/** Empate: a ≤ 2 puntos porcentuales del mejor. */
export const EMPATE_BP: PuntosBase = 200;
/** Ventanas de hasta 62 días usan N = 10 000; las más largas, 5 000. */
export const DIAS_VENTANA_N_COMPLETO = 62;
export const N_VENTANA_CORTA = 10000;
export const N_VENTANA_LARGA = 5000;

/** Un cargo con fecha que no está en E₀: pago planeado de tarjeta en plan, cuota MSI no facturada. */
export interface CompromisoFechado {
  readonly fecha: PlainDate;
  readonly monto: Centavos;
}

function indiceHorizonte(horizontes: readonly HorizonteSimulacion[], fecha: PlainDate): number | null {
  const k = horizontes.findIndex((h) => h.inicio <= fecha && fecha < h.fin);
  return k < 0 ? null : k;
}

/**
 * E8.3 · `H₀ = [hoy, fin_efectivo)` y después un horizonte por cada ocurrencia de ingreso pendiente, hasta que el
 * último termine después de `hasta` (mínimo 2, tope de 24 meses). Para `k ≥ 1`: `ingreso_k` = monto del ingreso
 * y `compromisos_k` = programados en `H_k` + `compromisosFechados` en `H_k`. Los de H₀ ya están en `E₀`.
 * `regla = null` (ingreso variable): solo `H₀ = [hoy, hoy + 30)`.
 */
export function construirHorizontes(
  hoy: PlainDate,
  regla: Regla | null,
  montoIngreso: Centavos,
  programados: readonly Programado[],
  hasta: PlainDate,
  recibidas: readonly PlainDate[],
  compromisosFechados: readonly CompromisoFechado[] = [],
): HorizonteSimulacion[] {
  partes(hasta);
  exigirCentavos(montoIngreso, 'monto_ingreso');
  const h = horizonte(hoy, regla, recibidas);
  if (regla === null || h.estado === 'ingreso_variable') {
    return [{ inicio: hoy, fin: sumarDias(hoy, DIAS_HORIZONTE_FIJO), ingreso: 0, compromisos: 0 }];
  }
  const limite = minFecha(hasta, sumarMeses(hoy, TOPE_MESES_VENTANA));
  const yaRecibidas = new Set(recibidas);
  // 120 ocurrencias alcanzan los 24 meses con cualquier regla (semanal: ~105).
  const siguientes = proximasFechas(regla, sumarDias(h.fin_efectivo, 1), 120).filter(
    (f) => !yaRecibidas.has(f),
  );
  const inicios = [hoy, h.fin_efectivo, ...siguientes];
  const salida: HorizonteSimulacion[] = [];
  for (let k = 0; k < inicios.length - 1; k++) {
    const inicio = inicios[k] as PlainDate;
    const fin = inicios[k + 1] as PlainDate;
    let compromisos = 0;
    if (k > 0) {
      for (const o of expandirProgramados(programados, inicio, fin)) compromisos += o.monto;
      for (const c of compromisosFechados) {
        if (inicio <= c.fecha && c.fecha < fin) compromisos += exigirCentavos(c.monto, 'compromiso');
      }
    }
    salida.push({ inicio, fin, ingreso: k === 0 ? 0 : montoIngreso, compromisos });
    if (salida.length >= 2 && fin > limite) break;
  }
  return salida;
}

export type Escenario =
  | { readonly tipo: 'base' }
  | { readonly tipo: 'contado_hoy'; readonly precio: Centavos }
  | { readonly tipo: 'esperar'; readonly precio: Centavos; readonly fecha: PlainDate }
  | { readonly tipo: 'msi'; readonly precio: Centavos; readonly meses: number; readonly tarjeta: string };

export type EscenarioCompra = Exclude<Escenario, { tipo: 'base' }>;

export type NotaEscenarios = 'uso_alto' | 'sin_tarjeta_para_msi';

export interface EscenariosGenerados {
  readonly escenarios: readonly Escenario[];
  readonly nota: NotaEscenarios | null;
  /** Uso de la tarjeta elegida para MSI con la compra (para "quedarías en 71 % de uso"); `null` sin MSI. */
  readonly uso_bp: PuntosBase | null;
}

/**
 * E8.5 · `base` y `contado_hoy` siempre; `esperar` a la fecha dicha o al próximo ingreso (si es posterior a
 * hoy); `msi` con los meses pedidos o, si no pidió y `precio ≥ $1,000`, a 3, con la tarjeta de E5.2. Si E5.2 no
 * encuentra tarjeta, `nota = 'sin_tarjeta_para_msi'`; si la encuentra con advertencia, la advertencia.
 */
export function generarEscenarios(
  precio: Centavos,
  hoy: PlainDate,
  proximoIngreso: PlainDate | null,
  tarjetas: readonly TarjetaRecomendable[],
  meses?: number,
  fechaCompra?: PlainDate,
): EscenariosGenerados {
  exigirCentavos(precio, 'precio', { minimo: 1 });
  partes(hoy);
  if (meses !== undefined && (!Number.isSafeInteger(meses) || meses < 2 || meses > 48)) {
    throw new ErrorDominio('escenario_invalido', 'meses debe ser un entero de 2 a 48');
  }
  const escenarios: Escenario[] = [{ tipo: 'base' }, { tipo: 'contado_hoy', precio }];
  const fEsperar = fechaCompra ?? proximoIngreso;
  if (fEsperar && fEsperar > hoy) escenarios.push({ tipo: 'esperar', precio, fecha: fEsperar });
  const m = meses ?? (precio >= UMBRAL_PRECIO_MSI ? MESES_POR_OMISION : null);
  let nota: NotaEscenarios | null = null;
  let uso: PuntosBase | null = null;
  if (m !== null) {
    const r = recomendarTarjeta({ fecha: hoy, monto: precio }, tarjetas);
    if (r.tarjeta) {
      escenarios.push({ tipo: 'msi', precio, meses: m, tarjeta: r.tarjeta.id });
      nota = r.advertencia === 'uso_alto' ? 'uso_alto' : null;
      uso = r.tarjeta.usoBp;
    } else {
      nota = 'sin_tarjeta_para_msi';
    }
  }
  return { escenarios, nota, uso_bp: uso };
}

export interface EntradaComparacion {
  readonly hoy: PlainDate;
  readonly excedente_inicial: Centavos;
  /** `null` = ingreso variable (solo H₀ de 30 días). */
  readonly regla_ingreso: Regla | null;
  readonly monto_ingreso: Centavos;
  readonly programados: readonly Programado[];
  readonly recibidas: readonly PlainDate[];
  readonly tarjetas: readonly (TarjetaCredito & { readonly id: string })[];
  readonly historial: readonly DiaHistorial[];
  readonly escenarios: readonly Escenario[];
  readonly semilla: number;
  readonly compromisos_fechados?: readonly CompromisoFechado[];
  readonly hoy_es_dia_de_pago?: boolean;
}

export interface ResultadoEscenario {
  readonly escenario: Escenario;
  readonly excedente_inicial: Centavos;
  readonly exitos: number;
  readonly probabilidad: number;
  /** E1.3: "< 1 %", "79 %", "> 99 %". */
  readonly porcentaje: string;
  /** Algún cargo cae después del tope de 24 meses y se ignoró. */
  readonly parcial: boolean;
}

export type ResultadoComparacion =
  | { readonly estado: 'datos_insuficientes' }
  | {
      readonly estado: 'ok';
      readonly horizontes_usados: number;
      readonly ventana_hasta: PlainDate;
      readonly dias_ventana: number;
      readonly n: number;
      readonly resultados: readonly ResultadoEscenario[];
      readonly recomendado: EscenarioCompra;
      /** Los horizontes base (sin la compra), para "cómo lo calculé". */
      readonly horizontes: readonly HorizonteSimulacion[];
    };

/** Cargos de un escenario: contado → hoy; esperar → su fecha; MSI → cada cuota en su límite (E6.1). */
export function cargosDe(
  escenario: Escenario,
  hoy: PlainDate,
  tarjetas: ReadonlyMap<string, TarjetaCredito>,
): CompromisoFechado[] {
  switch (escenario.tipo) {
    case 'base':
      return [];
    case 'contado_hoy':
      return [{ fecha: hoy, monto: escenario.precio }];
    case 'esperar':
      return [{ fecha: escenario.fecha, monto: escenario.precio }];
    case 'msi': {
      const t = tarjetas.get(escenario.tarjeta);
      if (!t)
        throw new ErrorDominio('escenario_invalido', 'la tarjeta del escenario MSI no está en la entrada');
      return planMsi(escenario.precio, escenario.meses, hoy, t).map((c) => ({
        fecha: c.limite,
        monto: c.monto,
      }));
    }
  }
}

const PREFERENCIA: Readonly<Record<EscenarioCompra['tipo'], number>> = { contado_hoy: 0, esperar: 1, msi: 2 };

/**
 * E8.5 · Comparación por bloques: todos los escenarios en la misma ventana (hasta el cargo más tardío) y con la
 * misma semilla. `total` = N × escenarios; el resultado es idéntico a `compararEscenarios`.
 */
export function crearComparacion(e: EntradaComparacion): Paso<ResultadoComparacion> {
  partes(e.hoy);
  exigirCentavos(e.excedente_inicial, 'excedente_inicial', { minimo: Number.MIN_SAFE_INTEGER });
  if (!e.escenarios.some((x) => x.tipo !== 'base')) {
    throw new ErrorDominio('escenario_invalido', 'falta al menos un escenario con compra');
  }
  if (e.historial.length < MIN_DIAS_HISTORIAL) return pasoTerminado({ estado: 'datos_insuficientes' });

  const tarjetas = new Map(e.tarjetas.map((t) => [t.id, t] as const));
  const cargos = e.escenarios.map((x) => cargosDe(x, e.hoy, tarjetas));
  let hasta = e.hoy;
  for (const cs of cargos) for (const c of cs) if (c.fecha > hasta) hasta = c.fecha;
  const hs = construirHorizontes(
    e.hoy,
    e.regla_ingreso,
    e.monto_ingreso,
    e.programados,
    hasta,
    e.recibidas,
    e.compromisos_fechados ?? [],
  );
  const ultimo = hs[hs.length - 1] as HorizonteSimulacion;
  const diasVentana = diferenciaDias(e.hoy, ultimo.fin);
  const n = diasVentana <= DIAS_VENTANA_N_COMPLETO ? N_VENTANA_CORTA : N_VENTANA_LARGA;

  const preparados = e.escenarios.map((escenario, j) => {
    const copia = hs.map((h) => ({ ...h }));
    let e0 = e.excedente_inicial;
    let parcial = false;
    for (const c of cargos[j] as CompromisoFechado[]) {
      const k = indiceHorizonte(copia, c.fecha);
      if (k === null) parcial = true;
      else if (k === 0) e0 -= c.monto;
      else (copia[k] as { compromisos: number }).compromisos += c.monto;
    }
    const paso = crearSimulacion({
      historial: e.historial,
      horizontes: copia,
      excedente_inicial: e0,
      n,
      semilla: e.semilla,
      ...(e.hoy_es_dia_de_pago ? { hoy_es_dia_de_pago: true } : {}),
    });
    return { escenario, e0, parcial, paso };
  });

  let actual = 0;
  const total = n * preparados.length;
  const hechas = () => preparados.reduce((s, p) => s + p.paso.hechas(), 0);

  return {
    total,
    hechas,
    avanzar(maximo: number): boolean {
      let resta = maximo;
      while (actual < preparados.length && resta > 0) {
        const p = preparados[actual] as (typeof preparados)[number];
        const antes = p.paso.hechas();
        if (p.paso.avanzar(resta)) actual++;
        resta -= p.paso.hechas() - antes;
      }
      return actual === preparados.length;
    },
    resultado(): ResultadoComparacion {
      if (actual < preparados.length) {
        throw new ErrorDominio('calculo_incompleto', 'la comparación no ha terminado');
      }
      const resultados: ResultadoEscenario[] = preparados.map((p) => {
        const r = p.paso.resultado() as Extract<ResultadoSimulacion, { estado: 'ok' }>;
        return {
          escenario: p.escenario,
          excedente_inicial: p.e0,
          exitos: r.exitos,
          probabilidad: r.probabilidad,
          porcentaje: porcentajeMostrado(r.exitos, n),
          parcial: p.parcial,
        };
      });
      const compras = resultados.filter((r) => r.escenario.tipo !== 'base');
      const mejor = Math.max(...compras.map((r) => r.exitos));
      const empatados = compras
        .filter((r) => (mejor - r.exitos) * 10000 <= EMPATE_BP * n)
        .sort((a, b) => {
          const ea = a.escenario as EscenarioCompra;
          const eb = b.escenario as EscenarioCompra;
          const d = PREFERENCIA[ea.tipo] - PREFERENCIA[eb.tipo];
          if (d !== 0) return d;
          const fa = ea.tipo === 'esperar' ? ea.fecha : e.hoy;
          const fb = eb.tipo === 'esperar' ? eb.fecha : e.hoy;
          return fa < fb ? -1 : fa > fb ? 1 : 0;
        });
      return {
        estado: 'ok',
        horizontes_usados: hs.length,
        ventana_hasta: ultimo.fin,
        dias_ventana: diasVentana,
        n,
        resultados,
        recomendado: (empatados[0] as ResultadoEscenario).escenario as EscenarioCompra,
        horizontes: hs,
      };
    },
  };
}

/** E8.5 · Comparación de una sola vez (vector E8-22). */
export function compararEscenarios(e: EntradaComparacion): ResultadoComparacion {
  return correrCompleto(crearComparacion(e));
}
