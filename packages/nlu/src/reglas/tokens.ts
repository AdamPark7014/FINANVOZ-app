/**
 * Corte en palabras del nivel 0 (docs/06-NLU.md §9). Tres vistas alineadas de cada palabra: `t` normalizada
 * (minúsculas, sin acentos, con ñ), `o` original en minúsculas (para la descripción) y `c` cruda (para saber si una
 * palabra venía con mayúscula, como un comercio). La coma, los dos puntos y el punto y coma que separan partes de
 * la frase se vuelven el token `SEP`; las comas de miles ("1,250") no se tocan.
 */

export const SEP = ',';

export interface Tokens {
  readonly t: readonly string[];
  readonly o: readonly string[];
  readonly c: readonly string[];
}

export const ARTICULOS = new Set(['un', 'una', 'unos', 'unas', 'el', 'la', 'los', 'las']);

/** Palabras de enlace que una `DESC` nunca contiene. */
export const PALABRAS_PROHIBIDAS_DESC = new Set([
  'por',
  'con',
  'en',
  'de',
  'del',
  'para',
  'a',
  'al',
  'y',
  'que',
  'me',
  'te',
  'se',
  'le',
  'nos',
]);

/**
 * Salvaguardas del nivel 0 (más estrictas que la gramática, nunca más laxas): una `DESC` con alguna de estas
 * palabras no se toma como gasto, porque la frase habla de fechas, de cómo se pagó, de deudas, tandas, ingresos o
 * del negocio. Esas frases tienen su propia producción o van al nivel 2.
 */
export const PALABRAS_QUE_DESCARTAN = new Set([
  // fechas y recurrencia
  'hoy',
  'ayer',
  'anoche',
  'antier',
  'anteayer',
  'hace',
  'mañana',
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
  'domingo',
  'semana',
  'mes',
  'pasado',
  'pasada',
  'quincena',
  'cada',
  'año',
  'proximo',
  'proxima',
  'siempre',
  // medios de pago, deudas y otros tipos de movimiento
  'efectivo',
  'cash',
  'billetes',
  'debito',
  'credito',
  'tarjeta',
  'cajero',
  'transferencia',
  'deposito',
  'minimo',
  'mensualidad',
  'meses',
  'msi',
  'prestamo',
  'prestado',
  'prestada',
  'prestados',
  'prestadas',
  'deuda',
  'abono',
  'tanda',
  'nomina',
  'sueldo',
  'ingreso',
  'ingresos',
  'retiro',
  'venta',
  'ventas',
  'cobro',
  'pago',
  'pagos',
  'reembolso',
  'devolucion',
  'premio',
  'bono',
  'aguinaldo',
  'beca',
  'rendimientos',
  'saldo',
  'colchon',
  'cuenta',
  'cuentas',
  'medio',
  'media',
  'entre',
  // negocio
  'tienda',
  'negocio',
  'caja',
  'cliente',
  'clientes',
  'mercancia',
  'local',
  'insumos',
  'fiado',
]);

/** Minúsculas y sin acentos, pero conservando la ñ ("uñas" no es "unas"). */
export function sinAcentosConEnie(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/(?<!n)̃|(?!̃)\p{Mn}/gu, '')
    .normalize('NFC');
}

/** Alias en forma comparable sin quitar palabras: minúsculas, sin acentos, sin signos. */
export function formaSimple(s: string): string {
  return sinAcentosConEnie(s)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Palabra que puede ir en una `DESC`: solo letras y ninguna de enlace, de fecha, de pago, de deuda o de negocio. */
export function palabraDesc(p: string): boolean {
  return /^[a-zñ]+$/.test(p) && !PALABRAS_PROHIBIDAS_DESC.has(p) && !PALABRAS_QUE_DESCARTAN.has(p);
}

export function tokenizar(texto: string): Tokens {
  const t: string[] = [];
  const o: string[] = [];
  const c: string[] = [];
  const piezas = texto
    .replace(/[¿¡?!]/g, ' ')
    .split(/\s+/)
    .filter((p) => p !== '');
  for (const pieza of piezas) {
    let cuerpo = pieza;
    let separador = false;
    const conSigno = /^(.*?)[,:;]+$/.exec(cuerpo);
    if (conSigno) {
      cuerpo = conSigno[1] ?? '';
      separador = true;
    }
    cuerpo = cuerpo.replace(/\.+$/, '').replace(/^["'(]+|["')]+$/g, '');
    if (cuerpo !== '') {
      c.push(cuerpo);
      o.push(cuerpo.toLowerCase());
      t.push(sinAcentosConEnie(cuerpo));
    }
    if (separador && t.length > 0 && t[t.length - 1] !== SEP) {
      c.push(SEP);
      o.push(SEP);
      t.push(SEP);
    }
  }
  while (t[t.length - 1] === SEP) {
    t.pop();
    o.pop();
    c.pop();
  }
  return { t, o, c };
}

/** Sub-rango `[inicio, fin)` de los tokens. */
export function recortar(tokens: Tokens, inicio: number, fin: number): Tokens {
  return { t: tokens.t.slice(inicio, fin), o: tokens.o.slice(inicio, fin), c: tokens.c.slice(inicio, fin) };
}

/** Tokens sin los separadores (para las producciones que los ignoran). */
export function sinSeparadores(tokens: Tokens): Tokens {
  const indices = tokens.t.flatMap((x, i) => (x === SEP ? [] : [i]));
  return {
    t: indices.map((i) => tokens.t[i] ?? ''),
    o: indices.map((i) => tokens.o[i] ?? ''),
    c: indices.map((i) => tokens.c[i] ?? ''),
  };
}
