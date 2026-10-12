/** E14 · Detección de suscripciones (`docs/05-MOTORES.md §E14`). Puro: recibe `hoy`, nunca lee el reloj. */
import { CATALOGO_SEMILLA } from './captura/categorizar';
import type { Centavos } from './dinero';
import { normalizarComercio } from './comercios';
import { conDia, diaSemana, diferenciaDias, partes, sumarDias, type PlainDate } from './fecha';
import type { Regla } from './recurrencia';

export type Periodicidad = 'mensual' | 'semanal' | 'anual';

interface ParametrosPeriodicidad {
  nombre: Periodicidad;
  minimoDias: number;
  maximoDias: number;
  cargosMinimos: number;
  cargosAlAnio: number;
}

/** Tabla de E14 en orden de desempate (mensual, semanal, anual). */
const PERIODICIDADES: readonly ParametrosPeriodicidad[] = [
  { nombre: 'mensual', minimoDias: 27, maximoDias: 33, cargosMinimos: 3, cargosAlAnio: 12 },
  { nombre: 'semanal', minimoDias: 6, maximoDias: 8, cargosMinimos: 4, cargosAlAnio: 52 },
  { nombre: 'anual', minimoDias: 358, maximoDias: 372, cargosMinimos: 2, cargosAlAnio: 1 },
];
const TOLERANCIA_MONTO_BP = 1500;
const GRACIA_DIAS = 7;
export const VENTANA_SUSCRIPCIONES_DIAS = 400;
const ANCLAS = 3;
/** Con el comercio en el catálogo semilla de suscripciones bastan 2 cargos mensuales (E14-02). */
const CARGOS_MINIMOS_CATALOGO = 2;

/**
 * Catálogo semilla de suscripciones: los prefijos de la categoría `suscripciones` de `comercios_mx.json`
 * (`07 §6`), ya normalizados. E14 compara el comercio normalizado exacto (como el oráculo).
 */
export const CATALOGO_SUSCRIPCIONES: readonly string[] = CATALOGO_SEMILLA.filter(
  (e) => e.categoria === 'suscripciones',
).map((e) => e.prefijo);

/** Gasto vigente (no anulado) con su comercio tal como se capturó. */
export interface GastoSuscripcion {
  fecha: PlainDate;
  monto: Centavos;
  comercio: string | null | undefined;
}

export interface Suscripcion {
  /** Comercio normalizado (E9.1). */
  comercio: string;
  periodicidad: Periodicidad;
  cargos: number;
  monto_tipico: Centavos;
  ultimo_cargo: PlainDate;
  proximo_cargo: PlainDate | null;
  costo_anual: Centavos;
  monto_anterior: Centavos | null;
  estado: 'activa' | 'inactiva';
  /** Regla del programado que crea "Convertir en compromiso" (E14, Uso). */
  regla: Regla;
}

export interface ResumenSuscripciones {
  cantidad: number;
  costo_anual: Centavos;
  /** `piso(Σ costo_anual / 12)`: "Pagas unos $X al mes". */
  mensual: Centavos;
}

type Cargo = readonly [PlainDate, Centavos];

function compararCargos(a: Cargo, b: Cargo): number {
  if (a[0] !== b[0]) return a[0] < b[0] ? -1 : 1;
  return a[1] - b[1];
}

/** E14.1 · Serie hacia atrás desde el ancla; los días se miden contra el último cargo aceptado. */
function corrida(lista: readonly Cargo[], ancla: number, mn: number, mx: number): Cargo[] {
  const anclaCargo = lista[ancla] as Cargo;
  const ref = anclaCargo[1];
  const serie: Cargo[] = [anclaCargo];
  for (let i = ancla - 1; i >= 0; i--) {
    const cargo = lista[i] as Cargo;
    const dias = diferenciaDias(cargo[0], (serie[0] as Cargo)[0]);
    if (dias < mn) continue;
    if (dias > mx) break;
    if (Math.abs(cargo[1] - ref) * 10000 > TOLERANCIA_MONTO_BP * ref) continue;
    serie.unshift(cargo);
  }
  return serie;
}

function medianaBaja(xs: readonly number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) / 2)] as number;
}

interface Candidato {
  largo: number;
  indice: number;
  k: number;
  p: ParametrosPeriodicidad;
  serie: Cargo[];
}

function mejor(a: Candidato, b: Candidato): Candidato {
  if (a.largo !== b.largo) return a.largo > b.largo ? a : b;
  if (a.indice !== b.indice) return a.indice < b.indice ? a : b;
  return a.k <= b.k ? a : b;
}

/**
 * E14 · `detectarSuscripciones(gastos, hoy, catalogo)` sobre los gastos de los últimos 400 días (hasta `hoy`),
 * agrupados por comercio normalizado. Orden: activas primero, por costo anual descendente.
 */
export function detectarSuscripciones(
  gastos: readonly GastoSuscripcion[],
  hoy: PlainDate,
  catalogo: readonly string[],
): Suscripcion[] {
  const desde = sumarDias(hoy, -VENTANA_SUSCRIPCIONES_DIAS);
  const enCatalogo = new Set(catalogo);
  const grupos = new Map<string, Cargo[]>();
  for (const g of gastos) {
    const c = normalizarComercio(g.comercio);
    if (!c || g.fecha < desde || g.fecha > hoy) continue;
    const lista = grupos.get(c) ?? [];
    lista.push([g.fecha, g.monto]);
    grupos.set(c, lista);
  }
  const out: Suscripcion[] = [];
  for (const [comercio, cargos] of grupos) {
    const lista = [...cargos].sort(compararCargos);
    let elegido: Candidato | null = null;
    PERIODICIDADES.forEach((p, indice) => {
      const minimo =
        p.nombre === 'mensual' && enCatalogo.has(comercio) ? CARGOS_MINIMOS_CATALOGO : p.cargosMinimos;
      for (let k = 1; k <= Math.min(ANCLAS, lista.length); k++) {
        const serie = corrida(lista, lista.length - k, p.minimoDias, p.maximoDias);
        if (serie.length < minimo) continue;
        const c: Candidato = { largo: serie.length, indice, k, p, serie };
        elegido = elegido ? mejor(elegido, c) : c;
      }
    });
    if (elegido) out.push(describir(comercio, elegido, hoy));
  }
  out.sort((a, b) => {
    if (a.estado !== b.estado) return a.estado === 'activa' ? -1 : 1;
    if (a.costo_anual !== b.costo_anual) return b.costo_anual - a.costo_anual;
    return a.comercio < b.comercio ? -1 : a.comercio > b.comercio ? 1 : 0;
  });
  return out;
}

function describir(comercio: string, { p, serie }: Candidato, hoy: PlainDate): Suscripcion {
  const ultimo = serie[serie.length - 1] as Cargo;
  const ultimaFecha = ultimo[0];
  const activa = diferenciaDias(ultimaFecha, hoy) <= p.maximoDias + GRACIA_DIAS;
  const u = partes(ultimaFecha);
  let proximo: PlainDate;
  let regla: Regla;
  if (p.nombre === 'mensual') {
    const dia = Math.max(...serie.slice(-3).map(([f]) => partes(f).dia));
    proximo = conDia(u.anio, u.mes + 1, dia);
    regla = { tipo: 'mensual', dia };
  } else if (p.nombre === 'anual') {
    proximo = conDia(u.anio + 1, u.mes, u.dia);
    regla = { tipo: 'anual', mes: u.mes, dia: u.dia };
  } else {
    proximo = sumarDias(ultimaFecha, 7);
    regla = { tipo: 'semanal', dia_semana: diaSemana(ultimaFecha) };
  }
  const monto = medianaBaja(serie.map(([, m]) => m));
  const distintos = serie.filter(([, m]) => m !== ultimo[1]);
  const previo = distintos[distintos.length - 1];
  return {
    comercio,
    periodicidad: p.nombre,
    cargos: serie.length,
    monto_tipico: monto,
    ultimo_cargo: ultimaFecha,
    proximo_cargo: activa ? proximo : null,
    costo_anual: monto * p.cargosAlAnio,
    monto_anterior: previo && previo[1] < ultimo[1] ? previo[1] : null,
    estado: activa ? 'activa' : 'inactiva',
    regla,
  };
}

/** `E14-01.resumen_activas`: cantidad, costo anual y `piso(costo anual / 12)` de las activas. */
export function resumenActivas(suscripciones: readonly Suscripcion[]): ResumenSuscripciones {
  const activas = suscripciones.filter((s) => s.estado === 'activa');
  const costo = activas.reduce((t, s) => t + s.costo_anual, 0);
  return { cantidad: activas.length, costo_anual: costo, mensual: Math.floor(costo / 12) };
}
