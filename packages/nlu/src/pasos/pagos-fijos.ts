/**
 * O5 · pagos fijos (docs/06-NLU.md §13).
 *
 *   PAGOS     := PAGO ((y | , | , y) PAGO)*                                                  hasta 5
 *   PAGO      := [art] CONCEPTO [,] [son|es|de|cuesta|me cuesta|sale en|sale] MONTO COLA
 *              | (pago|me cobran) MONTO de [art] CONCEPTO COLA
 *   COLA      := [[,] CUANDO] [[,] [y] CUENTA] [[,] [y] RESTANTES]
 *   CONCEPTO  := el de `configurar` (1 a 5 palabras, sin fechas, pagos ni alias) o un servicio común: renta, luz,
 *                agua, gas, internet, celular, gimnasio, streaming, tanda, Netflix, Spotify, Disney, Max, Prime,
 *                YouTube, colegiatura, seguro…
 *   CUANDO    := leerRegla de configurar ("cada mes el 10", "cada quincena", "cada 15 de febrero")
 *              | el [día] (N | primero) [de cada mes]                                         → mensual (en este paso)
 *              | cada mes | al mes | mensual · a la quincena | quincenal · cada semana | a la semana | semanal
 *              | cada año | al año | anual                                                     → solo la frecuencia
 *              | cada dos meses | bimestral                                                    → sin regla, aviso cada_dos_meses
 *   CUENTA    := (sale de | se paga con | lo pago con | la pago con | con | desde) ALIAS de una cuenta que ya existe
 *   RESTANTES := [me|le] faltan N pagos
 *
 * Sin conector y sin CUANDO solo vale un concepto conocido ("renta 4500", "Netflix 219"): "gané 500" no es un pago
 * fijo. Una fecha única ("el 3 de noviembre") no es un pago fijo → `null`.
 */
import { concepto, leerRegla } from '../reglas/configurar';
import { buscarEnDiccionario } from '../reglas/diccionario';
import { Entorno } from '../reglas/entorno';
import { Lector } from '../reglas/lector';
import { leerEntero } from '../reglas/montos';
import { ARTICULOS, type Tokens } from '../reglas/tokens';
import { leerCifra, mayusculaInicial, partir, unica } from './comun';
import { FRECUENCIA_PAGO_DE, type Cifra, type LecturaPaso } from './esquema';
import type { ContextoPaso } from './tipos';

type LecturaPagos = Extract<LecturaPaso, { paso: 'pagos_fijos' }>;
type PagoLeido = LecturaPagos['pagos'][number];
type Cuando = Pick<PagoLeido, 'frecuencia' | 'regla' | 'avisos'>;

/** Servicios que valen como concepto aunque `configurar` no los acepte ("tanda") o no estén en el diccionario. */
const SERVICIOS = new Set([
  'renta',
  'luz',
  'agua',
  'gas',
  'internet',
  'celular',
  'telefono',
  'cable',
  'gimnasio',
  'gym',
  'streaming',
  'tanda',
  'netflix',
  'spotify',
  'disney',
  'disney plus',
  'max',
  'hbo max',
  'prime',
  'prime video',
  'amazon prime',
  'youtube',
  'youtube premium',
  'colegiatura',
  'seguro',
  'seguro del coche',
  'seguro del carro',
  'seguro de gastos medicos',
  'predial',
  'mantenimiento',
]);
const CONECTORES: readonly (readonly string[])[] = [
  ['me', 'cuesta'],
  ['sale', 'en'],
  ['son'],
  ['es'],
  ['de'],
  ['cuesta'],
  ['sale'],
];
const MES: readonly (readonly string[])[] = [
  ['cada', 'mes'],
  ['al', 'mes'],
  ['por', 'mes'],
  ['mensual'],
  ['mensuales'],
];
const QUINCENA: readonly (readonly string[])[] = [
  ['a', 'la', 'quincena'],
  ['por', 'quincena'],
  ['quincenal'],
];
const SEMANA: readonly (readonly string[])[] = [
  ['cada', 'semana'],
  ['a', 'la', 'semana'],
  ['por', 'semana'],
  ['semanal'],
];
const ANIO: readonly (readonly string[])[] = [['cada', 'año'], ['al', 'año'], ['por', 'año'], ['anual']];
const BIMESTRE: readonly (readonly string[])[] = [
  ['cada', 'dos', 'meses'],
  ['cada', '2', 'meses'],
  ['cada', 'bimestre'],
  ['bimestral'],
  ['bimestrales'],
];
const CON_CUENTA: readonly (readonly string[])[] = [
  ['sale', 'de'],
  ['se', 'paga', 'con'],
  ['lo', 'pago', 'con'],
  ['la', 'pago', 'con'],
  ['los', 'pago', 'con'],
  ['con'],
  ['desde'],
];

function leerCuando(l: Lector): Cuando | null {
  const inicio = l.marca();
  const regla = leerRegla(l);
  if (regla) {
    const frecuencia = FRECUENCIA_PAGO_DE[regla.tipo];
    return frecuencia ? { frecuencia, regla } : { regla };
  }
  if (l.palabra('el')) {
    l.palabra('dia');
    const dia = l.palabra('primero') ? 1 : leerEntero(l, 31);
    if (dia !== null) {
      l.secuencia('de', 'cada', 'mes');
      return { frecuencia: 'mensual', regla: { tipo: 'mensual', dia } };
    }
    l.volver(inicio);
  }
  if (l.alguna(...BIMESTRE)) return { avisos: ['cada_dos_meses'] };
  if (l.alguna(...MES)) return { frecuencia: 'mensual' };
  if (l.alguna(...QUINCENA)) return { frecuencia: 'quincenal', regla: { tipo: 'quincenal_15_ultimo' } };
  if (l.alguna(...SEMANA)) return { frecuencia: 'semanal' };
  if (l.alguna(...ANIO)) return { frecuencia: 'anual' };
  return null;
}

/** COLA desde el cursor hasta el final del tramo; `null` si sobra algo. */
function leerCola(
  l: Lector,
  env: Entorno,
): { cuando: Cuando | null; cuentaAlias?: string; pagosRestantes?: number } | null {
  let marca = l.marca();
  l.sep();
  const cuando = leerCuando(l);
  if (!cuando) l.volver(marca);

  let cuentaAlias: string | undefined;
  marca = l.marca();
  l.sep();
  l.palabra('y');
  if (l.alguna(...CON_CUENTA)) {
    const ref = env.alias(l);
    if (ref?.alias === undefined) return null;
    cuentaAlias = ref.alias;
  } else l.volver(marca);

  let pagosRestantes: number | undefined;
  marca = l.marca();
  l.sep();
  l.palabra('y');
  if (l.alguna(['me', 'faltan'], ['le', 'faltan'], ['faltan'])) {
    const n = leerEntero(l, 600);
    if (n === null || !l.palabra('pagos')) return null;
    pagosRestantes = n;
  } else l.volver(marca);

  if (!l.fin) return null;
  return {
    cuando,
    ...(cuentaAlias !== undefined ? { cuentaAlias } : {}),
    ...(pagosRestantes !== undefined ? { pagosRestantes } : {}),
  };
}

/**
 * Palabras que nunca son parte del concepto en este paso (conectores, días y frecuencias): así "la renta son 4,500"
 * solo se lee de una forma.
 */
const NO_CONCEPTO = new Set([
  'son',
  'es',
  'cuesta',
  'sale',
  'cobran',
  'dia',
  'dias',
  'primero',
  'mensual',
  'mensuales',
  'quincenal',
  'semanal',
  'anual',
  'bimestral',
  'bimestrales',
  'bimestre',
  'faltan',
  'desde',
]);
const ENLACES_CONCEPTO = new Set(['de', 'del', 'la', 'el', 'los', 'las']);

/** Concepto de `[inicio, fin)`: servicio conocido o `concepto` de configurar. Sin artículo y con mayúscula. */
function leerConcepto(
  tramo: Tokens,
  env: Entorno,
  inicio: number,
  fin: number,
): { texto: string; conocido: boolean } | null {
  const palabras = tramo.t.slice(inicio, fin);
  const sinArticulo = ARTICULOS.has(palabras[0] ?? '') ? palabras.slice(1) : palabras;
  if (sinArticulo.length === 0 || sinArticulo.some((p) => NO_CONCEPTO.has(p))) return null;
  // "de", "del" o un artículo solo van entre palabras ("el seguro del coche"), nunca al principio ni al final.
  if (
    ENLACES_CONCEPTO.has(sinArticulo[0] ?? '') ||
    ENLACES_CONCEPTO.has(sinArticulo[sinArticulo.length - 1] ?? '')
  ) {
    return null;
  }
  const desde = fin - sinArticulo.length;
  const texto = mayusculaInicial(tramo.o.slice(desde, fin).join(' '));
  if (SERVICIOS.has(sinArticulo.join(' '))) return { texto, conocido: true };
  const l = new Lector(tramo);
  l.volver(inicio);
  const c = concepto(l, env, fin);
  if (!c) return null;
  const { cubiertas } = buscarEnDiccionario(sinArticulo.filter((p) => !['de', 'del'].includes(p)));
  return { texto, conocido: cubiertas.length > 0 && cubiertas.every(Boolean) };
}

function armarPago(
  conceptoLeido: { texto: string; conocido: boolean },
  monto: Cifra,
  cola: NonNullable<ReturnType<typeof leerCola>>,
  conConector: boolean,
): PagoLeido | null {
  if (!conConector && cola.cuando === null && !conceptoLeido.conocido) return null;
  return {
    concepto: conceptoLeido.texto,
    monto,
    ...(cola.cuando ?? {}),
    ...(cola.cuentaAlias !== undefined ? { cuentaAlias: cola.cuentaAlias } : {}),
    ...(cola.pagosRestantes !== undefined ? { pagosRestantes: cola.pagosRestantes } : {}),
  };
}

function leerPago(tramo: Tokens, env: Entorno): PagoLeido | null {
  const n = tramo.t.length;
  const candidatas: PagoLeido[] = [];
  const l = new Lector(tramo);

  // [art] CONCEPTO [,] [CONECTOR] MONTO COLA
  for (let k = 1; k < n; k++) {
    const c = leerConcepto(tramo, env, 0, k);
    if (!c) continue;
    l.volver(k);
    const conComa = l.sep();
    const conConector = l.alguna(...CONECTORES) || conComa;
    const monto = leerCifra(l, false);
    if (!monto) continue;
    const cola = leerCola(l, env);
    if (!cola) continue;
    const pago = armarPago(c, monto, cola, conConector);
    if (pago) candidatas.push(pago);
  }

  // (pago|me cobran) MONTO de [art] CONCEPTO COLA
  l.volver(0);
  if (l.alguna(['me', 'cobran'], ['pago'])) {
    const monto = leerCifra(l, false);
    if (monto && l.palabra('de')) {
      const inicio = l.marca();
      for (let k = inicio + 1; k <= n; k++) {
        const c = leerConcepto(tramo, env, inicio, k);
        if (!c) continue;
        l.volver(k);
        const cola = leerCola(l, env);
        if (!cola) continue;
        const pago = armarPago(c, monto, cola, true);
        if (pago) candidatas.push(pago);
      }
    }
  }
  return unica(candidatas);
}

const MAX_PAGOS = 5;

/** "La renta son 4,500 el día primero y el internet 500 el 10". */
export function leerPagosFijos(tokens: Tokens, contexto: ContextoPaso): LecturaPagos | null {
  const env = new Entorno(contexto);
  const pagos = partir(tokens, (tramo) => leerPago(tramo, env), MAX_PAGOS);
  return pagos ? { paso: 'pagos_fijos', pagos } : null;
}
