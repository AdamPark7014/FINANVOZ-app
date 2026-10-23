/**
 * O4 · efectivo y cuentas (docs/06-NLU.md §13).
 *
 *   EFECTIVO := [ya] [traigo|tengo|cargo|llevo|me quedan|me queda] MONTO0 [(en|de) LUGAR]
 *             | [ya] no (traigo|tengo|cargo|llevo) (nada|ni un peso|ni un varo) [(en|de) LUGAR]
 *             | MONTO_SUELTO con cero ("son 500", "cero", "nada")
 *   LUGAR    := [el] efectivo | la cartera | mi cartera | billetes | cash | la bolsa | mi bolsa
 *
 *   CUENTAS  := CLAUSULA ((y | , | , y) CLAUSULA)*                                     hasta 6, cada destino una vez
 *   CLAUSULA := [VERBO] MONTO0 (en|de) DESTINO | en DESTINO [VERBO] MONTO0
 *   VERBO    := tengo | traigo | hay | me quedan | me queda | son | eran      ("son": corrección, «no, son 4 mil en BBVA»)
 *   DESTINO  := LUGAR                                                                  → efectivo
 *             | [mi|la] [cuenta de | tarjeta de débito de | la de] INSTITUCION          → débito o billetera (catálogo)
 *             | [mi|la] [cuenta de] ahorro(s) de INSTITUCION                            → ahorro
 *
 * Un banco que no está en el catálogo (o "la caja de ahorro del trabajo") → `null`: no se inventa una cuenta.
 */
import { Lector } from '../reglas/lector';
import { montoSuelto } from '../reglas/monto-dictado';
import type { Tokens } from '../reglas/tokens';
import { leerCifra, partir } from './comun';
import type { Cifra, LecturaPaso } from './esquema';
import { leerInstitucion, type Institucion } from './instituciones';

const LUGARES: readonly (readonly string[])[] = [
  ['el', 'efectivo'],
  ['efectivo'],
  ['la', 'cartera'],
  ['mi', 'cartera'],
  ['billetes'],
  ['cash'],
  ['la', 'bolsa'],
  ['mi', 'bolsa'],
];
const NADA: readonly (readonly string[])[] = [['ni', 'un', 'peso'], ['ni', 'un', 'varo'], ['nada']];
const VERBOS_EFECTIVO: readonly (readonly string[])[] = [
  ['me', 'quedan'],
  ['me', 'queda'],
  ['traigo'],
  ['tengo'],
  ['cargo'],
  ['llevo'],
];
const VERBOS_CUENTA: readonly (readonly string[])[] = [
  ['me', 'quedan'],
  ['me', 'queda'],
  ['tengo'],
  ['traigo'],
  ['hay'],
  // Corrección en la tarjeta «Entendí» del onboarding: «no, son 4 mil en BBVA».
  ['son'],
  ['eran'],
];
const PREFIJOS_AHORRO: readonly (readonly string[])[] = [
  ['mi', 'cuenta', 'de', 'ahorro', 'de'],
  ['la', 'cuenta', 'de', 'ahorro', 'de'],
  ['cuenta', 'de', 'ahorro', 'de'],
  ['mis', 'ahorros', 'de'],
  ['mi', 'ahorro', 'de'],
  ['el', 'ahorro', 'de'],
  ['ahorros', 'de'],
  ['ahorro', 'de'],
];
const PREFIJOS_CUENTA: readonly (readonly string[])[] = [
  ['mi', 'tarjeta', 'de', 'debito', 'de'],
  ['la', 'tarjeta', 'de', 'debito', 'de'],
  ['tarjeta', 'de', 'debito', 'de'],
  ['mi', 'cuenta', 'de'],
  ['la', 'cuenta', 'de'],
  ['cuenta', 'de'],
  ['la', 'de'],
  ['mi'],
  ['la'],
  ['el'],
  [],
];

type CuentaLeida = Extract<LecturaPaso, { paso: 'cuentas' }>['cuentas'][number];

const lugarOpcional = (l: Lector) => !l.palabra('en', 'de') || l.alguna(...LUGARES);

/** El efectivo que trae la persona ("¿Cuánto traes ahorita?"). */
export function leerEfectivo(tokens: Tokens): Cifra | null {
  const l = new Lector(tokens);
  l.palabra('ya');
  if (l.palabra('no')) {
    if (!l.palabra('traigo', 'tengo', 'cargo', 'llevo') || !l.alguna(...NADA)) return null;
    return lugarOpcional(l) && l.fin ? { monto: 0, aproximado: false } : null;
  }
  l.alguna(...VERBOS_EFECTIVO);
  const cifra = leerCifra(l, true) ?? (l.alguna(...NADA) ? { monto: 0, aproximado: false } : null);
  if (cifra && lugarOpcional(l) && l.fin) return cifra;
  const suelto = montoSuelto(tokens, { admiteCero: true });
  return suelto ? { monto: suelto.centavos, aproximado: suelto.aproximado } : null;
}

type Destino = { tipo: 'efectivo' } | { tipo: 'cuenta' | 'ahorro'; institucion: Institucion };

function leerDestino(l: Lector): Destino | null {
  if (l.alguna(...LUGARES)) return { tipo: 'efectivo' };
  const inicio = l.marca();
  if (l.alguna(...PREFIJOS_AHORRO)) {
    const i = leerInstitucion(l, 'cuenta');
    if (i) return { tipo: 'ahorro', institucion: i };
    l.volver(inicio);
    return null;
  }
  for (const prefijo of PREFIJOS_CUENTA) {
    l.volver(inicio);
    if (!l.secuencia(...prefijo)) continue;
    const i = leerInstitucion(l, 'cuenta');
    if (i) return { tipo: 'cuenta', institucion: i };
  }
  l.volver(inicio);
  return null;
}

type Clausula = { destino: Destino; saldo: Cifra };

function leerClausula(tramo: Tokens): Clausula | null {
  const l = new Lector(tramo);
  // en DESTINO [tengo|traigo|hay] MONTO0
  if (l.palabra('en')) {
    const destino = leerDestino(l);
    if (destino) {
      l.alguna(...VERBOS_CUENTA);
      const saldo = leerCifra(l, true);
      if (saldo && l.fin) return { destino, saldo };
    }
    l.volver(0);
  }
  // [tengo|traigo|hay] MONTO0 (en|de) DESTINO
  l.alguna(...VERBOS_CUENTA);
  const saldo = leerCifra(l, true);
  if (!saldo || !l.palabra('en', 'de')) return null;
  const destino = leerDestino(l);
  return destino && l.fin ? { destino, saldo } : null;
}

const MAX_CLAUSULAS = 6;

/** "Tengo 4 mil 200 en BBVA, 800 en Spin y como 300 en efectivo". */
export function leerCuentas(tokens: Tokens): Extract<LecturaPaso, { paso: 'cuentas' }> | null {
  const clausulas = partir(tokens, leerClausula, MAX_CLAUSULAS);
  if (!clausulas) return null;
  let efectivo: Cifra | undefined;
  const cuentas: CuentaLeida[] = [];
  const vistos = new Set<string>();
  for (const { destino, saldo } of clausulas) {
    if (destino.tipo === 'efectivo') {
      if (efectivo !== undefined) return null; // el efectivo, una sola vez
      efectivo = saldo;
      continue;
    }
    const i = destino.institucion;
    const subtipo = destino.tipo === 'ahorro' ? 'ahorro' : i.cuenta;
    if (subtipo === null) return null;
    const clave = `${i.id}:${subtipo}`;
    if (vistos.has(clave)) return null; // la misma cuenta dos veces: no se suma ni se adivina
    vistos.add(clave);
    cuentas.push({
      nombre: subtipo === 'ahorro' ? `Ahorro ${i.nombre}` : i.nombre,
      institucion: i.id,
      subtipo,
      saldo,
    });
  }
  return { paso: 'cuentas', ...(efectivo !== undefined ? { efectivo } : {}), cuentas };
}
