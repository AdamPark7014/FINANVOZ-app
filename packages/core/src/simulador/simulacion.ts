import { exigirCentavos, type Centavos } from '../dinero';
import { ErrorDominio } from '../errores';
import { diferenciaDias, partes, sumarDias, type PlainDate } from '../fecha';
import {
  claseDia,
  construirPools,
  MIN_DIAS_HISTORIAL,
  validarHistorial,
  type DiaHistorial,
} from './historial';

/** Un horizonte `[inicio, fin)` de la simulación (E8.3). En H₀ `ingreso` y `compromisos` valen 0. */
export interface HorizonteSimulacion {
  readonly inicio: PlainDate;
  readonly fin: PlainDate;
  readonly ingreso: Centavos;
  readonly compromisos: Centavos;
}

export interface EntradaSimulacion {
  readonly historial: readonly DiaHistorial[];
  readonly horizontes: readonly HorizonteSimulacion[];
  /** `E₀ = libre` de E4. */
  readonly excedente_inicial: Centavos;
  /** Trayectorias. Hoy: 10 000. */
  readonly n: number;
  /** Entero de 32 bits sin signo (`semillaDelDia`). */
  readonly semilla: number;
  /** Hoy es una ocurrencia de ingreso recibida hoy: ese día usa la clase `pago`. */
  readonly hoy_es_dia_de_pago?: boolean;
}

export type ResultadoSimulacion =
  | { readonly estado: 'datos_insuficientes' }
  | {
      readonly estado: 'ok';
      readonly exitos: number;
      readonly probabilidad: number;
      /** Cuantiles del excedente al final de H₀ (rango más cercano). */
      readonly p10_h0: Centavos;
      readonly p50_h0: Centavos;
      readonly p90_h0: Centavos;
    };

/**
 * Cálculo que avanza por bloques (`03 §5.3`): `avanzar(max)` corre hasta `max` trayectorias más y devuelve
 * `true` al terminar. El resultado es idéntico al de una sola vez para cualquier tamaño de bloque: las
 * trayectorias se recorren en orden y el PRNG nunca se reinicia.
 */
export interface Paso<T> {
  /** Unidades de trabajo totales (trayectorias). */
  readonly total: number;
  hechas(): number;
  avanzar(maximo: number): boolean;
  /** Lanza `calculo_incompleto` si todavía no termina. */
  resultado(): T;
}

/** Rango más cercano: elemento `techo(p·N) − 1` de la lista ordenada (`p` en puntos base). */
export function cuantil(ordenados: ArrayLike<number>, pBp: number): number {
  const n = ordenados.length;
  if (n === 0) throw new ErrorDominio('cuantil_invalido', 'lista vacía');
  const k = Math.max(1, Math.ceil((pBp * n) / 10000));
  return ordenados[k - 1] as number;
}

function exigirEntero(valor: number, campo: string, minimo: number, maximo = Number.MAX_SAFE_INTEGER): void {
  if (!Number.isSafeInteger(valor) || valor < minimo || valor > maximo) {
    throw new ErrorDominio('simulacion_invalida', `${campo} fuera de rango`);
  }
}

/** Un paso ya terminado (sin trabajo). */
export function pasoTerminado<T>(valor: T): Paso<T> {
  return { total: 0, hechas: () => 0, avanzar: () => true, resultado: () => valor };
}

/** E8.4 · Crea la simulación por bloques. Valida la entrada y prepara pools y días antes de correr. */
export function crearSimulacion(e: EntradaSimulacion): Paso<ResultadoSimulacion> {
  exigirEntero(e.n, 'n', 1);
  exigirEntero(e.semilla, 'semilla', 0, 0xffffffff);
  exigirCentavos(e.excedente_inicial, 'excedente_inicial', { minimo: Number.MIN_SAFE_INTEGER });
  validarHistorial(e.historial);
  if (e.horizontes.length === 0) throw new ErrorDominio('simulacion_invalida', 'sin horizontes');
  for (const h of e.horizontes) {
    partes(h.inicio);
    partes(h.fin);
    if (h.fin < h.inicio) throw new ErrorDominio('simulacion_invalida', 'horizonte con fin < inicio');
    exigirCentavos(h.ingreso, 'ingreso');
    exigirCentavos(h.compromisos, 'compromisos');
  }
  if (e.historial.length < MIN_DIAS_HISTORIAL) return pasoTerminado({ estado: 'datos_insuficientes' });

  const pools = construirPools(e.historial);
  const fechasIngreso = new Set(e.horizontes.slice(1).map((h) => h.inicio));
  const h0 = e.horizontes[0] as HorizonteSimulacion;
  if (e.hoy_es_dia_de_pago) fechasIngreso.add(h0.inicio);
  // Por horizonte: el pool de cada día y el ajuste `ingreso − compromisos` al entrar (k > 0).
  const diasPorHorizonte: (readonly number[])[][] = e.horizontes.map((h) =>
    Array.from(
      { length: diferenciaDias(h.inicio, h.fin) },
      (_, i) => pools[claseDia(sumarDias(h.inicio, i), fechasIngreso)],
    ),
  );
  const ajustes = e.horizontes.map((h, k) => (k === 0 ? 0 : h.ingreso - h.compromisos));
  const K = e.horizontes.length;
  const n = e.n;
  const e0 = e.excedente_inicial;

  let a = e.semilla | 0; // estado de mulberry32 (E8.1), en línea por rendimiento
  let i = 0;
  let exitos = 0;
  const finales = new Float64Array(n);

  return {
    total: n,
    hechas: () => i,
    avanzar(maximo: number): boolean {
      exigirEntero(maximo, 'maximo', 1);
      const hasta = Math.min(n, i + maximo);
      for (; i < hasta; i++) {
        let E = e0;
        let ok = true;
        for (let k = 0; k < K; k++) {
          if (k > 0) E += ajustes[k] as number;
          const dias = diasPorHorizonte[k] as (readonly number[])[];
          for (let d = 0; d < dias.length; d++) {
            const pool = dias[d] as readonly number[];
            a = (a + 0x6d2b79f5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            const u = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
            E -= pool[Math.floor(u * pool.length)] as number;
          }
          if (k === 0) finales[i] = E;
          if (E < 0) ok = false; // no se corta: siempre se consumen todos los días
        }
        if (ok) exitos++;
      }
      return i === n;
    },
    resultado(): ResultadoSimulacion {
      if (i < n) throw new ErrorDominio('calculo_incompleto', 'la simulación no ha terminado');
      const ordenados = finales.slice().sort();
      return {
        estado: 'ok',
        exitos,
        probabilidad: exitos / n,
        p10_h0: cuantil(ordenados, 1000),
        p50_h0: cuantil(ordenados, 5000),
        p90_h0: cuantil(ordenados, 9000),
      };
    },
  };
}

/** Corre un paso hasta terminar (sin ceder el hilo). */
export function correrCompleto<T>(paso: Paso<T>): T {
  while (!paso.avanzar(Math.max(1, paso.total))) {
    /* un solo bloque basta */
  }
  return paso.resultado();
}

/** E8.4 · Monte Carlo de una sola vez (vectores `E8.simulacion`). */
export function simular(e: EntradaSimulacion): ResultadoSimulacion {
  return correrCompleto(crearSimulacion(e));
}
