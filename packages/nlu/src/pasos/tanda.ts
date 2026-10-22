/**
 * Alta de tanda (docs/06-NLU.md §13): TK01 ampliado a cada semana, cada mes y cada 14 días. Datos en cualquier orden
 * separados por "y" o coma, cada uno a lo más una vez. Nunca se infiere la fecha de inicio (la pide el formulario).
 *
 *   TANDA := DATO ((y | , | , y) DATO)*
 *   DATO  := [ENTRADA] una tanda [FREC] [de MONTO] [FREC]                     → aportación, frecuencia
 *          | [de|doy|pongo|aporto] MONTO [FREC]                               → aportación, frecuencia
 *          | FREC
 *          | somos N [personas|participantes] | son N (personas|participantes)  → participantes (2 a 50)
 *          | (me toca|soy|mi turno es) el (ORDINAL | [número] N)                → turno (≤ participantes)
 *   ENTRADA := entré a | me metí a | me metí en | estoy en | voy a entrar a
 *   FREC  := cada (semana | quincena | mes | 14 días | catorce días | dos semanas) | semanal | quincenal | mensual
 *          | catorcenal | a la semana | a la quincena | al mes
 */
import { Lector } from '../reglas/lector';
import { leerEntero, leerOrdinal } from '../reglas/montos';
import type { Tokens } from '../reglas/tokens';
import { leerCifra, partir } from './comun';
import type { Cifra, LecturaPaso } from './esquema';

type LecturaTanda = Extract<LecturaPaso, { paso: 'tanda' }>;
type Frecuencia = NonNullable<LecturaTanda['frecuencia']>;

const FRECUENCIAS: readonly {
  readonly frases: readonly (readonly string[])[];
  readonly frecuencia: Frecuencia;
}[] = [
  { frases: [['cada', 'semana'], ['a', 'la', 'semana'], ['semanal']], frecuencia: 'semanal' },
  { frases: [['cada', 'quincena'], ['a', 'la', 'quincena'], ['quincenal']], frecuencia: 'quincenal' },
  {
    frases: [['cada', '14', 'dias'], ['cada', 'catorce', 'dias'], ['cada', 'dos', 'semanas'], ['catorcenal']],
    frecuencia: 'catorcenal',
  },
  { frases: [['cada', 'mes'], ['al', 'mes'], ['mensual']], frecuencia: 'mensual' },
];
const ENTRADA: readonly (readonly string[])[] = [
  ['voy', 'a', 'entrar', 'a'],
  ['entre', 'a'],
  ['me', 'meti', 'a'],
  ['me', 'meti', 'en'],
  ['estoy', 'en'],
];

function leerFrecuencia(l: Lector): Frecuencia | null {
  for (const f of FRECUENCIAS) if (l.alguna(...f.frases)) return f.frecuencia;
  return null;
}

type Dato = { aportacion?: Cifra; frecuencia?: Frecuencia; participantes?: number; turno?: number };

function leerDato(tramo: Tokens): Dato | null {
  const l = new Lector(tramo);
  const aportacionYFrecuencia = (): Dato | null => {
    let frecuencia = leerFrecuencia(l);
    let aportacion: Cifra | null = null;
    if (l.palabra('de')) {
      aportacion = leerCifra(l, false);
      if (!aportacion) return null;
    }
    if (frecuencia === null) frecuencia = leerFrecuencia(l);
    if (!l.fin || (aportacion === null && frecuencia === null)) return null;
    return { ...(aportacion ? { aportacion } : {}), ...(frecuencia ? { frecuencia } : {}) };
  };

  // [ENTRADA] una tanda [FREC] [de MONTO] [FREC]
  l.alguna(...ENTRADA);
  if (l.secuencia('una', 'tanda')) return aportacionYFrecuencia();

  // [de|doy|pongo|aporto] MONTO [FREC]  ·  FREC
  l.volver(0);
  l.palabra('de', 'doy', 'pongo', 'aporto');
  const aportacion = leerCifra(l, false);
  if (aportacion) {
    const frecuencia = leerFrecuencia(l);
    return l.fin ? { aportacion, ...(frecuencia ? { frecuencia } : {}) } : null;
  }
  l.volver(0);
  const sola = leerFrecuencia(l);
  if (sola && l.fin) return { frecuencia: sola };

  // somos N [personas|participantes] | son N (personas|participantes)
  l.volver(0);
  const somos = l.palabra('somos');
  if (somos || l.palabra('son')) {
    const n = leerEntero(l, 50);
    const conSustantivo = l.palabra('personas', 'participantes');
    if (n !== null && n >= 2 && (somos || conSustantivo) && l.fin) return { participantes: n };
    return null;
  }

  // (me toca|soy|mi turno es) el (ORDINAL | [número] N)
  l.volver(0);
  if (l.alguna(['me', 'toca', 'el'], ['soy', 'el'], ['mi', 'turno', 'es', 'el'])) {
    const turno = leerOrdinal(l, 50);
    return turno !== null && l.fin ? { turno } : null;
  }
  return null;
}

const MAX_DATOS = 4;

/** "Me metí a una tanda de 300 cada 14 días, somos 8 y me toca el primero". */
export function leerTanda(tokens: Tokens): LecturaTanda | null {
  const datos = partir(tokens, leerDato, MAX_DATOS);
  if (!datos) return null;
  const lectura: Dato = {};
  for (const d of datos) {
    for (const clave of Object.keys(d) as (keyof Dato)[]) {
      if (lectura[clave] !== undefined) return null; // cada dato una vez
    }
    Object.assign(lectura, d);
  }
  if (
    lectura.turno !== undefined &&
    lectura.participantes !== undefined &&
    lectura.turno > lectura.participantes
  ) {
    return null;
  }
  return { paso: 'tanda', ...lectura };
}
