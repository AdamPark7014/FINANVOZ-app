/**
 * SIMULAR del nivel 0 (docs/06-NLU.md §9): "¿me alcanza para unos tenis de 1,500?", "¿puedo comprar una tele de
 * 12 mil a 12 meses?", "si me compro un celular de 8 mil el viernes, ¿llego a la quincena?". En simulación los días
 * van hacia adelante y "la quincena" es el próximo ingreso del contexto.
 */
import type { Interpretacion } from '../esquema';
import type { Entorno } from './entorno';
import { leerFechaSimulacion } from './fechas';
import { Lector } from './lector';
import { leerEntero, leerMonto } from './montos';
import { ARTICULOS, type Tokens, palabraDesc } from './tokens';

const ABRE: readonly (readonly string[])[] = [
  ['me', 'conviene', 'esperar', 'a', 'la', 'quincena', 'para', 'comprar'],
  ['me', 'conviene', 'esperar', 'a', 'la', 'quincena', 'para', 'comprarme'],
  ['me', 'alcanza', 'para'],
  ['me', 'alcanzaria', 'para'],
  ['me', 'alcanza', 'para', 'comprar'],
  ['puedo', 'comprar'],
  ['puedo', 'comprarme'],
  ['me', 'compro'],
  ['me', 'conviene', 'comprar'],
  ['me', 'conviene', 'comprarme'],
  ['compro'],
];
const COLA: readonly (readonly string[])[] = [
  ['llego', 'a', 'la', 'quincena'],
  ['llego', 'bien', 'a', 'la', 'quincena'],
  ['me', 'alcanza', 'para', 'la', 'quincena'],
  ['me', 'alcanza', 'hasta', 'la', 'quincena'],
  ['aguanto', 'hasta', 'la', 'quincena'],
  ['la', 'libro', 'hasta', 'la', 'quincena'],
  ['me', 'alcanza'],
  ['llego'],
  ['aguanto'],
  ['me', 'conviene'],
];

export function simular(tokens: Tokens, env: Entorno): Interpretacion | null {
  const l = new Lector(tokens);
  const condicional = l.palabra('si');
  const forma = ABRE.find((f) => f.every((p, k) => l.ver(k) === p));
  if (!forma) return null;
  l.pos += forma.length;
  const esperarQuincena = forma[0] === 'me' && forma[1] === 'conviene' && forma[2] === 'esperar';
  // La descripción conserva el artículo («unos tenis»): de él sale el pronombre de la respuesta («Si los compras…»).
  const inicioDesc = l.marca();
  l.palabra(...ARTICULOS);
  let n = 0;
  while (n < 3) {
    const p = l.ver();
    if (p === undefined || !palabraDesc(p) || env.nombres.has(p) || env.esAliasCuenta([p])) break;
    l.pos++;
    n++;
  }
  if (n === 0 || !l.palabra('de', 'por', 'en')) return null;
  const descripcion = l.original(inicioDesc, l.pos - 1);
  const lectura = leerMonto(l);
  if (!lectura || lectura.monto <= 0) return null;
  let meses: number | undefined;
  if (l.palabra('a')) {
    const m = leerEntero(l, 48);
    if (m === null || m < 2 || !l.palabra('meses', 'msi')) return null;
    l.alguna(['sin', 'intereses'], ['msi']);
    meses = m;
  }
  let fecha: string | undefined;
  if (esperarQuincena) {
    if (env.proximoIngreso === undefined || env.proximoIngreso < env.hoy) return null;
    fecha = env.proximoIngreso;
  } else {
    const dicha = leerFechaSimulacion(l, env.hoy, env.proximoIngreso);
    if (dicha !== null) fecha = dicha;
  }
  if (l.sep() || condicional) {
    if (!l.fin && !l.alguna(...COLA)) return null;
  }
  if (!l.fin) return null;
  return {
    intencion: 'simular',
    compra: {
      precio: lectura.monto,
      descripcion,
      ...(meses !== undefined ? { meses } : {}),
      ...(fecha !== undefined ? { fecha } : {}),
    },
  };
}
