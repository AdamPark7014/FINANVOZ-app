/**
 * «No entendí» con reparación en un toque (docs/diseno/OLA-7-ASISTENTE.md §3, CA-O7 3): a partir de una frase que el
 * nivel 0 no entendió, hasta 4 opciones ordenadas de la más a la menos probable, siempre con «otra» al final, y para
 * cada una la frase reescrita en una forma que el nivel 0 sí entiende («los 300 del Beto» → «le presté 300 a Beto» /
 * «el Beto me pagó 300 de lo que me debía»). Elegir una opción con frase la registra por la vía normal
 * (`registrarTexto`); sin frase, abre el formulario con ese tipo y el monto oído.
 *
 * Cómo decide:
 * 1. Recorre la frase y reconoce piezas con las mismas reglas del nivel 0: fechas (`leerFechaRegistro`, con la fecha
 *    del contexto), cuentas (`Entorno.metodo`/`alias`), montos (`leerMonto`) y personas (contactos, parentescos con
 *    artículo o nombres con mayúscula fuera de la primera palabra). Lo demás son palabras de la descripción.
 * 2. Pistas por palabra: «le di/pasé/presté» (sale dinero hacia alguien), «me pagó/dio/regresó» (alguien me paga),
 *    «me pagaron/depositaron/cayó» (ingreso), verbos de gasto o palabras del diccionario, una tarjeta de crédito, dos
 *    cuentas propias o un verbo de traspaso. Cada tipo suma puntos fijos; empates en el orden de `TIPOS_REPARACION`.
 * 3. Una frase reescrita solo existe si las piezas no son ambiguas (un monto, a lo más una fecha y una persona) y si
 *    `interpretarReglas` la entiende como ese tipo de movimiento con ese monto; si no, la opción va sin frase.
 *
 * Determinista: no usa el reloj (la fecha viene en el contexto). Nunca registra en logs lo oído (regla 9).
 */
import type { ContextoInterprete } from '../contexto';
import type { RefCuenta } from '../esquema';
import { interpretarReglas } from '../reglas';
import { buscarEnDiccionario } from '../reglas/diccionario';
import { Entorno } from '../reglas/entorno';
import { leerFechaRegistro } from '../reglas/fechas';
import { Lector } from '../reglas/lector';
import { leerMonto, type LecturaMonto } from '../reglas/montos';
import { ARTICULOS, SEP, formaSimple, palabraDesc, tokenizar } from '../reglas/tokens';
import { institucionPorAlias } from './instituciones';

export const TIPOS_REPARACION = [
  'gasto',
  'ingreso',
  'prestamo',
  'me_pagaron',
  'pago_tarjeta',
  'transferencia',
  'otra',
] as const;
export type TipoReparacion = (typeof TIPOS_REPARACION)[number];
type TipoMovimiento = Exclude<TipoReparacion, 'otra'>;

export interface OpcionReparacion {
  tipo: TipoReparacion;
  /** Frase que el nivel 0 entiende tal cual como este tipo de movimiento (minúsculas, cifras en dígitos). */
  frase?: string;
  /** El único monto oído, en centavos, para prellenar el formulario. */
  monto?: number;
}

/** Hasta 3 tipos de movimiento más «otra». */
export const MAX_OPCIONES_REPARACION = 4;

const TIPO_MOVIMIENTO: Readonly<Record<TipoMovimiento, string>> = {
  gasto: 'gasto',
  ingreso: 'ingreso',
  prestamo: 'prestamo_otorgado',
  me_pagaron: 'cobro_prestamo',
  pago_tarjeta: 'pago_tarjeta',
  transferencia: 'transferencia',
};

/** Contexto sin cuentas ni contactos para cuando la app no lo pasa (solo sirve para validar la forma). */
const CONTEXTO_NEUTRO: ContextoInterprete = {
  fecha_referencia: '2000-01-01',
  espacios: ['personal'],
  cuentas: [],
};

const PARENTESCOS = new Set([
  'primo',
  'prima',
  'hermano',
  'hermana',
  'carnal',
  'tio',
  'tia',
  'vecino',
  'vecina',
  'compadre',
  'comadre',
  'compa',
  'cuñado',
  'cuñada',
  'suegro',
  'suegra',
  'jefe',
  'jefa',
  'amigo',
  'amiga',
  'novio',
  'novia',
  'mama',
  'papa',
  'abuelo',
  'abuela',
  'hijo',
  'hija',
  'sobrino',
  'sobrina',
  'esposo',
  'esposa',
  'roomie',
]);

/** Nombres con mayúscula que son comercios y no personas ("los 300 del Oxxo"). */
const COMERCIOS = new Set([
  'oxxo',
  'seven',
  'walmart',
  'aurrera',
  'bodega',
  'soriana',
  'chedraui',
  'costco',
  'sams',
  'liverpool',
  'palacio',
  'coppel',
  'elektra',
  'sanborns',
  'sears',
  'suburbia',
  'starbucks',
  'mcdonalds',
  'cinepolis',
  'cinemex',
  'amazon',
  'mercado',
  'libre',
  'similares',
  'benavides',
  'telcel',
  'telmex',
  'izzi',
  'totalplay',
  'megacable',
  'cfe',
  'pemex',
  'heb',
  'superama',
  'farmacias',
  'farmacia',
]);

/** Palabras de relleno o de función que nunca son descripción ni nombre. */
const RELLENO = new Set([
  'ya',
  'este',
  'esta',
  'esto',
  'eso',
  'pues',
  'eh',
  'mmm',
  'osea',
  'bueno',
  'ahi',
  'oye',
  'nada',
  'algo',
  'todo',
  'todos',
  'mas',
  'menos',
  'muy',
  'bien',
  'tambien',
  'otra',
  'otro',
  'vez',
  'si',
  'no',
  'solo',
  'nomas',
  'apenas',
  'casi',
  'lo',
  'les',
  'mis',
  'tus',
  'sus',
  'su',
  'tu',
  'yo',
  'mi',
  'el',
  'ella',
  'ellos',
  'aqui',
  'alla',
  'alli',
  'porque',
  'pero',
  'entonces',
  'igual',
  'tipo',
  'cosa',
  'cosas',
  'dinero',
  'lana',
  'feria',
  'pesos',
  'peso',
  'varos',
  'unos',
  'unas',
  'como',
  'don',
  'doña',
  'brutos',
  'netos',
  'libres',
  'limpios',
]);

/** Verbos frecuentes en lo dictado: nunca son descripción ni nombre. */
const VERBOS = new Set([
  'gaste',
  'compre',
  'pague',
  'comi',
  'cene',
  'desayune',
  'coopere',
  'cargue',
  'eche',
  'puse',
  'di',
  'dio',
  'dieron',
  'pase',
  'paso',
  'pasaron',
  'mande',
  'mando',
  'mandaron',
  'deposite',
  'deposito',
  'depositaron',
  'transferi',
  'transfirio',
  'transfirieron',
  'movi',
  'traspase',
  'preste',
  'presto',
  'prestaron',
  'fie',
  'debe',
  'debia',
  'deben',
  'debian',
  'debo',
  'pago',
  'pagaron',
  'pagado',
  'cobraron',
  'cobre',
  'cobro',
  'costo',
  'salio',
  'saque',
  'retire',
  'regreso',
  'regresaron',
  'devolvio',
  'devolvieron',
  'cayo',
  'cayeron',
  'llego',
  'llegaron',
  'entro',
  'entraron',
  'gane',
  'vendi',
  'regalaron',
  'regale',
  'reembolsaron',
  'tengo',
  'traigo',
  'hay',
  'fue',
  'fueron',
  'era',
  'eran',
  'es',
  'son',
  'estuvo',
  'quedo',
  'hice',
  'tuve',
  'fui',
  'abone',
  'liquide',
]);

/** Después de estos pronombres viene un verbo ("me cobraron", "le di"). */
const PRONOMBRES_VERBO = new Set(['me', 'le', 'te', 'se', 'nos', 'les']);

const ME_PAGA_UNA_PERSONA = new Set([
  'pago',
  'dio',
  'paso',
  'regreso',
  'devolvio',
  'deposito',
  'mando',
  'transfirio',
]);
const ME_ENTRA = new Set([
  'pagan',
  'depositan',
  'cae',
  'caen',
  'pagaron',
  'depositaron',
  'dieron',
  'cayo',
  'cayeron',
  'llego',
  'llegaron',
  'entro',
  'entraron',
  'regalaron',
  'reembolsaron',
  'transfirieron',
  'mandaron',
]);
const PALABRAS_INGRESO = new Set([
  'cobre',
  'gane',
  'vendi',
  'quincena',
  'sueldo',
  'nomina',
  'aguinaldo',
  'bono',
  'reembolso',
  'devolucion',
  'rendimientos',
  'honorarios',
  'ingreso',
  'ingresos',
  'venta',
  'ventas',
]);
const LE_SALE = new Set(['di', 'preste', 'pase', 'mande', 'deposite', 'transferi', 'fie', 'eche']);
const PALABRAS_PRESTAMO = new Set(['preste', 'prestamo', 'prestado', 'fie', 'fiado']);
const PALABRAS_DEUDA = new Set(['debe', 'debia', 'deben', 'debian']);
const PALABRAS_GASTO = new Set([
  'gaste',
  'compre',
  'pague',
  'comi',
  'cene',
  'desayune',
  'coopere',
  'cargue',
  'eche',
  'costo',
  'salio',
  'cobraron',
]);
const PALABRAS_PAGO_TARJETA = new Set(['pague', 'abone', 'liquide', 'pago', 'abono', 'minimo', 'total']);
const PALABRAS_TRASPASO = new Set([
  'pase',
  'transferi',
  'movi',
  'mande',
  'traspase',
  'traspaso',
  'transferencia',
]);

interface Mencion {
  tipo: RefCuenta['tipo'];
  /** Alias normalizado; sin él, la cuenta se dijo por tipo ("en efectivo", "con débito"). */
  alias?: string;
  /** El alias tal como se dijo ("Nu", "Mercado Pago"). */
  dicho: string;
}

interface Persona {
  articulo: '' | 'el' | 'la' | 'mi' | 'su';
  nombre: string;
}

interface Rasgos {
  montos: LecturaMonto[];
  fechas: string[];
  personas: Persona[];
  cuentas: Mencion[];
  /** Primera descripción: palabras seguidas, con su artículo si lo llevaba. */
  desc: { articulo?: string; palabras: string; dicho: string } | null;
  palabras: ReadonlySet<string>;
  /** "me pago", "le di": pronombre + verbo. */
  pares: ReadonlySet<string>;
  diccionario: boolean;
  /**
   * La frase dice algo que una frase reescrita perdería: una cifra que el nivel 0 no lee ("dos cincuenta"), una
   * fecha que no lee ("la semana pasada") o meses sin intereses. Entonces no se reescribe nada.
   */
  dudosa: boolean;
  /** Una cifra que el nivel 0 no lee: tampoco hay monto para prellenar. */
  cifraDudosa: boolean;
}

const esVerbo = (t: string, o: string) =>
  VERBOS.has(t) ||
  (/[éí]$/.test(o) && !buscarEnDiccionario([t]).cubiertas.every(Boolean)) ||
  // Imperativo con pronombre pegado: "transfiérele", "cuéntame", "pásale".
  (/[áéíóú]/.test(o) && /(le|lo|la|les|los|las|me|te|nos)$/.test(o));

/** Palabras de cifra: si `leerMonto` no las lee ahí, la cifra es ambigua ("dos cincuenta", "medio kilo de"). */
const PALABRAS_CIFRA = new Set([
  'uno',
  'dos',
  'tres',
  'cuatro',
  'cinco',
  'seis',
  'siete',
  'ocho',
  'nueve',
  'diez',
  'once',
  'doce',
  'trece',
  'catorce',
  'quince',
  'veinte',
  'treinta',
  'cuarenta',
  'cincuenta',
  'sesenta',
  'setenta',
  'ochenta',
  'noventa',
  'cien',
  'ciento',
  'doscientos',
  'trescientos',
  'cuatrocientos',
  'quinientos',
  'seiscientos',
  'setecientos',
  'ochocientos',
  'novecientos',
  'mil',
  'millon',
  'millones',
  'kilo',
  'kilos',
  'luca',
  'lucas',
]);
const esCifra = (t: string) => /^\$?\d/.test(t) || PALABRAS_CIFRA.has(t) || /^(dieci|veinti)/.test(t);

/** Lo que una frase reescrita perdería si quedó sin leer: fechas y periodos, meses, repartos. */
const PIERDE_DATO = new Set([
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
  'meses',
  'msi',
  'mensualidad',
  'mensualidades',
  'entre',
  'mitad',
  'medias',
  'partes',
]);

class Escaner {
  private readonly env: Entorno;
  private readonly contexto: ContextoInterprete;

  constructor(
    private readonly l: Lector,
    contexto: ContextoInterprete | undefined,
  ) {
    this.contexto = contexto ?? CONTEXTO_NEUTRO;
    this.env = new Entorno(this.contexto);
  }

  private crudo(inicio: number, fin: number): string {
    return this.l.tokens.c.slice(inicio, fin).join(' ');
  }

  /** El alias tal como se dijo: el sufijo más largo del tramo que es un alias de una cuenta del contexto. */
  private aliasDicho(inicio: number, fin: number): string {
    for (let k = fin - inicio; k >= 1; k--) {
      const palabras = this.l.t.slice(fin - k, fin).join(' ');
      if (this.contexto.cuentas.some((c) => c.alias.some((a) => formaSimple(a) === palabras)))
        return this.crudo(fin - k, fin);
    }
    return this.crudo(inicio, fin);
  }

  cuenta(): Mencion | null {
    const l = this.l;
    const inicio = l.marca();
    const ref = this.env.metodo(l) ?? this.env.alias(l);
    if (ref) {
      return ref.alias === undefined
        ? { tipo: ref.tipo, dicho: '' }
        : { tipo: ref.tipo, alias: ref.alias, dicho: this.aliasDicho(inicio, l.pos) };
    }
    if (l.palabra('efectivo', 'cash', 'billetes')) return { tipo: 'efectivo', dicho: '' };
    return null;
  }

  /** Palabra que puede ser un nombre propio: no es nada más que el nivel 0 conozca. */
  private nombrePropio(t: string, o: string): boolean {
    return (
      t.length >= 2 &&
      palabraDesc(t) &&
      !ARTICULOS.has(t) &&
      !RELLENO.has(t) &&
      !PRONOMBRES_VERBO.has(t) &&
      !COMERCIOS.has(t) &&
      !esVerbo(t, o) &&
      !buscarEnDiccionario([t]).cubiertas.every(Boolean) &&
      !this.env.esAliasCuenta([t]) &&
      institucionPorAlias(t) === undefined
    );
  }

  /** PERSONA := [a|al|de|del|con|para] [el|la|mi|su] [don|doña] (CONTACTO | PARENTESCO | Nombre). */
  persona(): Persona | null {
    const l = this.l;
    const inicio = l.marca();
    let articulo: Persona['articulo'] = '';
    if (l.palabra('al', 'del')) articulo = 'el';
    else l.palabra('a', 'de', 'con', 'para');
    if (articulo === '') {
      const a = l.ver();
      if (a === 'el' || a === 'la' || a === 'mi' || a === 'su') {
        articulo = a;
        l.pos++;
      }
    }
    const desde = l.marca();
    l.palabra('don', 'doña');
    const nombre = l.pos;
    for (const n of [2, 1]) {
      if (this.env.esNombreConocido(l.t.slice(nombre, nombre + n))) {
        l.pos = nombre + n;
        return { articulo, nombre: this.crudo(desde, l.pos) };
      }
    }
    const t = l.ver();
    const o = l.tokens.o[nombre] ?? '';
    if (t !== undefined && PARENTESCOS.has(t) && articulo !== '' && nombre === desde) {
      l.pos++;
      return { articulo, nombre: o };
    }
    const c = l.tokens.c[nombre] ?? '';
    const conMayuscula = /^\p{Lu}/u.test(c);
    // La primera palabra siempre viene con mayúscula: solo es nombre si sigue "me", "le" o "ya" ("Beto me debe 300").
    const posicionValida = nombre > 0 || ['me', 'le', 'ya'].includes(l.t[1] ?? '');
    if (t !== undefined && conMayuscula && posicionValida && this.nombrePropio(t, o)) {
      l.pos++;
      return { articulo, nombre: this.crudo(desde, l.pos) };
    }
    l.volver(inicio);
    return null;
  }

  fecha(): string | null {
    const l = this.l;
    const inicio = l.marca();
    return leerFechaRegistro(l, this.contexto.fecha_referencia) === null
      ? null
      : l.tokens.o.slice(inicio, l.pos).join(' ');
  }

  rasgos(): Rasgos {
    const l = this.l;
    const { t, o } = l.tokens;
    const r: Rasgos = {
      montos: [],
      fechas: [],
      personas: [],
      cuentas: [],
      desc: null,
      palabras: new Set(t),
      pares: new Set(t.slice(1).map((p, i) => `${t[i]} ${p}`)),
      diccionario: false,
      dudosa: false,
      cifraDudosa: false,
    };
    let tramo: number[] = [];
    let tramos = 0;
    const cerrar = () => {
      if (tramo.length > 0) tramos++;
      if (r.desc === null && tramo.length > 0 && tramo.length <= 3) {
        const primero = tramo[0] ?? 0;
        const anterior = t[primero - 1];
        r.desc = {
          ...(anterior !== undefined && ARTICULOS.has(anterior) ? { articulo: o[primero - 1] } : {}),
          palabras: tramo.map((i) => o[i]).join(' '),
          // La primera palabra de lo dictado siempre trae mayúscula: ahí no dice nada.
          dicho: tramo.map((i) => (i === 0 ? o[i] : l.tokens.c[i])).join(' '),
        };
      }
      tramo = [];
    };
    while (!l.fin) {
      const i = l.pos;
      const actual = t[i] ?? '';
      if (actual === SEP) {
        cerrar();
        l.pos++;
        continue;
      }
      const fecha = this.fecha();
      if (fecha !== null) {
        r.fechas.push(fecha);
        cerrar();
        continue;
      }
      const cuenta = this.cuenta();
      if (cuenta) {
        r.cuentas.push(cuenta);
        cerrar();
        continue;
      }
      const monto = leerMonto(l);
      if (monto && monto.monto > 0) {
        r.montos.push(monto);
        cerrar();
        continue;
      }
      if (monto) l.volver(i);
      if (esCifra(actual) || PIERDE_DATO.has(actual)) {
        r.dudosa = true;
        if (esCifra(actual)) r.cifraDudosa = true;
        cerrar();
        l.pos++;
        continue;
      }
      const persona = this.persona();
      if (persona) {
        r.personas.push(persona);
        cerrar();
        continue;
      }
      l.pos++;
      const previa = t[i - 1];
      const tras = previa !== undefined && PRONOMBRES_VERBO.has(previa);
      if (buscarEnDiccionario([actual]).cubiertas.every(Boolean)) r.diccionario = true;
      const contenido =
        palabraDesc(actual) &&
        !ARTICULOS.has(actual) &&
        !RELLENO.has(actual) &&
        !tras &&
        !esVerbo(actual, o[i] ?? '') &&
        institucionPorAlias(actual) === undefined &&
        actual.length >= 2;
      if (contenido) tramo.push(i);
      else cerrar();
    }
    cerrar();
    // Dos descripciones ("tacos y una coca", "croquetas para el perro") no caben en una sola: no se adivina.
    return tramos > 1 ? { ...r, desc: null } : r;
  }
}

const pesos = (centavos: number) =>
  centavos % 100 === 0
    ? String(centavos / 100)
    : `${Math.floor(centavos / 100)}.${String(centavos % 100).padStart(2, '0')}`;

function objeto(p: Persona): string {
  return p.articulo === '' || p.articulo === 'el' ? `a ${p.nombre}` : `a ${p.articulo} ${p.nombre}`;
}

function sujeto(p: Persona): string {
  return p.articulo === '' ? p.nombre : `${p.articulo} ${p.nombre}`;
}

/** Frases candidatas de cada tipo, de la más fiel a la más simple. */
function candidatas(tipo: TipoMovimiento, r: Rasgos): string[] {
  const [lectura, otroMonto] = r.montos;
  if (!lectura || otroMonto || r.dudosa || r.fechas.length > 1 || r.personas.length > 1) return [];
  const cifras = lectura.aproximado
    ? [`como ${pesos(lectura.monto)}`, pesos(lectura.monto)]
    : [pesos(lectura.monto)];
  const fecha = r.fechas[0] === undefined ? '' : `${r.fechas[0]} `;
  const [persona] = r.personas;
  const credito = r.cuentas.filter((c) => c.tipo === 'credito' && c.alias !== undefined);
  const propias = r.cuentas.filter((c) => c.tipo !== 'credito');
  const conAlias = propias.filter((c) => c.alias !== undefined);
  const salida: string[] = [];
  for (const m of cifras) {
    switch (tipo) {
      case 'gasto': {
        if (r.cuentas.length > 1) return [];
        const [cuenta] = r.cuentas;
        const metodos =
          cuenta === undefined
            ? ['']
            : [
                cuenta.tipo === 'efectivo'
                  ? ' en efectivo'
                  : cuenta.alias === undefined
                    ? ` con ${cuenta.tipo === 'credito' ? 'crédito' : 'débito'}`
                    : ` con ${cuenta.tipo === 'credito' ? 'la ' : ''}${cuenta.dicho}`,
                '',
              ];
        const desc = r.desc;
        const nucleos = desc
          ? [...new Set([desc.dicho, desc.palabras])].flatMap((d) => [
              ...(desc.articulo ? [`gasté ${m} en ${desc.articulo} ${d}`] : []),
              `gasté ${m} en ${d}`,
            ])
          : [];
        for (const metodo of metodos) {
          for (const nucleo of [...nucleos, `registra ${m}`]) salida.push(`${fecha}${nucleo}${metodo}`);
        }
        break;
      }
      case 'ingreso': {
        if (credito.length > 0 || propias.some((c) => c.tipo === 'efectivo') || conAlias.length > 1)
          return [];
        const [destino] = conAlias;
        salida.push(`${fecha}me depositaron ${m}${destino ? ` en ${destino.dicho}` : ''}`);
        break;
      }
      case 'prestamo':
        if (persona) salida.push(`${fecha}le presté ${m} ${objeto(persona)}`);
        break;
      case 'me_pagaron':
        if (persona) salida.push(`${fecha}${sujeto(persona)} me pagó ${m} de lo que me debía`);
        break;
      case 'pago_tarjeta': {
        const [tarjeta, otra] = credito;
        if (!tarjeta || otra || propias.length > 1) return [];
        const [origen] = propias;
        const desde =
          origen === undefined
            ? ''
            : origen.tipo === 'efectivo'
              ? ' en efectivo'
              : origen.alias === undefined
                ? ''
                : ` desde ${origen.dicho}`;
        salida.push(`${fecha}pagué ${m} de la ${tarjeta.dicho}${desde}`);
        break;
      }
      case 'transferencia': {
        const [de, a, otra] = conAlias;
        if (!de || !a || otra || de.alias === a.alias || credito.length > 0) return [];
        salida.push(`${fecha}pasé ${m} de ${de.dicho} a ${a.dicho}`);
        break;
      }
    }
  }
  return salida;
}

function entiende(frase: string, tipo: TipoMovimiento, monto: number, contexto: ContextoInterprete): boolean {
  const i = interpretarReglas(frase, contexto);
  if (i?.intencion !== 'registrar' || i.movimientos.length !== 1) return false;
  const [m] = i.movimientos;
  return m?.tipo === TIPO_MOVIMIENTO[tipo] && m.monto === monto;
}

interface Puntuacion {
  /** Puntos por tipo (más alto = más probable); `null` = no aplica a esta frase. */
  puntos: Record<TipoMovimiento, number | null>;
  /** Con qué completar si quedan menos de 2 tipos, según hacia dónde va el dinero. */
  respaldo: readonly TipoMovimiento[];
}

function puntuar(r: Rasgos): Puntuacion {
  const hay = (s: ReadonlySet<string>) => [...r.palabras].some((p) => s.has(p));
  const par = (pronombre: string, s: ReadonlySet<string>) =>
    [...s].some((v) => r.pares.has(`${pronombre} ${v}`));
  const persona = r.personas.length > 0;
  /** Alguien me pagó ("Juan me pagó", "el Beto me regresó"). */
  const mePagaron = persona && par('me', ME_PAGA_UNA_PERSONA);
  /** Alguien me debe: lo más probable es que le haya prestado. */
  const meDebe = hay(PALABRAS_DEUDA);
  const sale = par('le', LE_SALE) || hay(PALABRAS_PRESTAMO);
  /** Le pagué a alguien: el dinero sale, aunque no sea préstamo. */
  const lePague = r.pares.has('le pague');
  const yoDebo = r.palabras.has('debo');
  const entra = par('me', ME_ENTRA) || hay(PALABRAS_INGRESO);
  const gasto = hay(PALABRAS_GASTO) || par('me', new Set(['cobraron', 'costo', 'salio'])) || r.diccionario;
  const tarjeta =
    r.cuentas.some((c) => c.tipo === 'credito' && c.alias !== undefined) || r.palabras.has('tarjeta');
  const propias = new Set(r.cuentas.filter((c) => c.tipo !== 'credito' && c.alias).map((c) => c.alias));
  const traspaso = hay(PALABRAS_TRASPASO) && propias.size >= 1;
  const prestamoPosible = (persona || hay(PALABRAS_PRESTAMO) || meDebe) && !yoDebo && !mePagaron;
  const entreDos = mePagaron || meDebe;
  return {
    puntos: {
      gasto: entreDos && !gasto ? null : 10 + (gasto ? 30 : 0) + (r.desc ? 5 : 0),
      ingreso: sale || lePague || (entreDos && !entra) || (tarjeta && !entra) ? null : 8 + (entra ? 30 : 0),
      prestamo: prestamoPosible ? 20 + (persona ? 20 : 0) + (sale ? 30 : 0) + (meDebe ? 40 : 0) : null,
      me_pagaron: persona && !sale && !yoDebo && !lePague ? 19 + 20 + (mePagaron ? 40 : 0) : null,
      pago_tarjeta: tarjeta ? 25 + (hay(PALABRAS_PAGO_TARJETA) ? 30 : 0) : null,
      transferencia: traspaso || propias.size >= 2 ? 30 + (traspaso ? 30 : 0) : null,
    },
    respaldo:
      sale || lePague
        ? ['gasto', 'prestamo', 'ingreso']
        : mePagaron || entra
          ? ['ingreso', 'gasto']
          : ['gasto', 'ingreso'],
  };
}

/**
 * Opciones para reparar lo que el nivel 0 no entendió, de la más a la menos probable: 2 o 3 tipos de movimiento y
 * «otra» al final (`[]` si no se oyó nada). `contexto` da las cuentas, los contactos y la fecha; sin él no se
 * reconocen alias ni fechas, y las frases se validan contra un contexto sin cuentas.
 */
export function sugerirReparacion(oido: string, contexto?: ContextoInterprete): OpcionReparacion[] {
  const tokens = tokenizar(oido);
  if (tokens.t.length === 0) return [];
  const r = new Escaner(new Lector(tokens), contexto).rasgos();
  const { puntos, respaldo } = puntuar(r);
  const orden = TIPOS_REPARACION.filter((t): t is TipoMovimiento => t !== 'otra');
  const elegidos = orden
    .filter((t) => puntos[t] !== null)
    .sort((a, b) => (puntos[b] ?? 0) - (puntos[a] ?? 0) || orden.indexOf(a) - orden.indexOf(b))
    .slice(0, MAX_OPCIONES_REPARACION - 1);
  // Siempre al menos dos tipos (CA-O7 3: tres opciones con «otra»): primero los que aplican, luego cualquiera.
  for (const aplica of [true, false]) {
    for (const tipo of respaldo) {
      if (elegidos.length < 2 && !elegidos.includes(tipo) && (puntos[tipo] !== null) === aplica)
        elegidos.push(tipo);
    }
  }
  const [lectura, otroMonto] = r.montos;
  const monto = lectura && !otroMonto && !r.cifraDudosa ? lectura.monto : undefined;
  const validacion = contexto ?? CONTEXTO_NEUTRO;
  const opciones: OpcionReparacion[] = elegidos.map((tipo) => {
    const frase =
      monto === undefined ? undefined : candidatas(tipo, r).find((f) => entiende(f, tipo, monto, validacion));
    return {
      tipo,
      ...(frase !== undefined ? { frase } : {}),
      ...(monto !== undefined ? { monto } : {}),
    };
  });
  return [...opciones, { tipo: 'otra' }];
}
