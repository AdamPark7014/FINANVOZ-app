#!/usr/bin/env node
// Genera los estados de cuenta en PDF **sintéticos** de M15 (`docs/07-CAPTURA.md §8`): tres bancos ficticios
// (Banco B, Banco E y Banco F), uno de ellos también protegido con contraseña, y un PDF "escaneado" (solo una
// imagen, sin texto). Por cada banco escribe:
//
//   <banco>.pdf   el PDF (PDF 1.4 sin comprimir, Helvetica con WinAnsiEncoding, sin fechas de creación)
//   <banco>.txt   el texto que debe salir del PDF, ya normalizado (renglones con un espacio entre columnas)
//   <banco>.json  lo que el analizador del banco debe leer (CA-M15-01). Sale de los mismos datos que el PDF, no
//                 del analizador: es el contrato contra el que se prueba `packages/core`.
//
// Las pruebas comprueban que este script reproduce byte a byte los archivos del repositorio (Vitest), que PDFBox
// extrae de cada PDF exactamente su .txt (JVM, `nucleo-jvm`) y que el analizador lee de cada .txt su .json.
//
//   node fixtures/pdf/generar.mjs            escribe los archivos
//   node fixtures/pdf/generar.mjs --verificar  falla si algún archivo difiere de lo que generaría
//
// Sin dependencias: solo `node:crypto` (MD5 para la contraseña de RC4 de 40 bits) y `node:fs`.
// Nunca se suben estados de cuenta reales al repositorio.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));

/** Contraseña (sintética) de `banco_e.protegido.pdf`. La usan las pruebas de la JVM. */
export const CONTRASENA_PRUEBA = 'PRUEBA2026';

// ——— Formato de montos y fechas ———

/** 123456 → "1,234.56". */
function pesos(centavos) {
  const negativo = centavos < 0;
  const abs = Math.abs(centavos);
  const entero = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negativo ? '-' : ''}${entero}.${String(abs % 100).padStart(2, '0')}`;
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_LARGOS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

function partes(fecha) {
  const [a, m, d] = fecha.split('-').map(Number);
  return { a, m, d };
}
/** La fecha civil siguiente (aritmética en UTC, sin zona horaria). */
function diaSiguiente(f) {
  const d = new Date(`${f}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
/** 2026-09-11 → 11/09/2026 */
const fechaB = (f) => {
  const { a, m, d } = partes(f);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${a}`;
};
/** 2026-09-11 → 11-sep-2026 */
const fechaE = (f) => {
  const { a, m, d } = partes(f);
  return `${String(d).padStart(2, '0')}-${MESES[m - 1]}-${a}`;
};
/** 2026-09-11 → 11 de septiembre de 2026 */
const fechaLarga = (f) => {
  const { a, m, d } = partes(f);
  return `${d} de ${MESES_LARGOS[m - 1]} de ${a}`;
};
/** 2026-09-11 → 11 SEP */
const fechaF = (f) => {
  const { m, d } = partes(f);
  return `${String(d).padStart(2, '0')} ${MESES[m - 1].toUpperCase()}`;
};

// ——— Datos de los tres estados de cuenta ———

const CARGO = 'cargo';
const PAGO = 'pago';
const ABONO = 'abono';
const COMISION = 'comision';
const ES_ABONO = (tipo) => tipo === PAGO || tipo === ABONO;

/** Banco B: 42 movimientos en dos páginas (CA-M15-02), fechas dd/mm/aaaa, abonos con signo menos. */
const BANCO_B = {
  ultimos4: '8812',
  desde: '2026-09-11',
  hasta: '2026-10-10',
  limite: '2026-10-30',
  limiteCredito: 3000000,
  saldoAnterior: 1248035,
  pagoMinimo: 95000,
  movimientos: [
    ['2026-09-11', 'OXXO REFORMA 4521', 8950, CARGO],
    ['2026-09-12', 'WALMART EXPRESS NARVARTE', 124530, CARGO],
    ['2026-09-12', 'UBER TRIP', 8700, CARGO],
    ['2026-09-13', 'STARBUCKS INSURGENTES', 9800, CARGO],
    ['2026-09-14', 'PEMEX ESTACION 2231', 90000, CARGO],
    ['2026-09-15', 'SU PAGO GRACIAS', 1200000, PAGO],
    ['2026-09-15', 'NETFLIX COM', 29900, CARGO],
    ['2026-09-16', 'SORIANA HIPER COYOACAN', 153275, CARGO],
    ['2026-09-17', 'FARMACIA DEL AHORRO', 31240, CARGO],
    ['2026-09-18', 'RAPPI RESTAURANTE', 24590, CARGO],
    ['2026-09-19', 'CINEPOLIS PERISUR', 36000, CARGO],
    ['2026-09-20', 'LIVERPOOL INSURGENTES', 189900, CARGO],
    ['2026-09-20', 'UBER TRIP', 11250, CARGO],
    ['2026-09-21', 'OXXO REFORMA 4521', 5600, CARGO],
    ['2026-09-22', 'SPOTIFY', 12900, CARGO],
    ['2026-09-23', 'COSTCO SATELITE', 241060, CARGO],
    ['2026-09-24', 'DEVOLUCION LIVERPOOL', 45000, ABONO],
    ['2026-09-24', 'GASOLINERA G500', 75000, CARGO],
    ['2026-09-25', 'TACOS EL GUERO', 18500, CARGO],
    ['2026-09-26', 'AMAZON MX MARKETPLACE', 64900, CARGO],
    ['2026-09-27', 'SANBORNS CENTRO', 42080, CARGO],
    ['2026-09-28', 'UBER EATS', 27840, CARGO],
    ['2026-09-29', 'CHEDRAUI SELECTO', 110420, CARGO],
    ['2026-09-30', 'TELCEL RECARGA', 20000, CARGO],
    ['2026-09-30', 'SU PAGO GRACIAS', 950000, PAGO],
    ['2026-10-01', 'STARBUCKS INSURGENTES', 10400, CARGO],
    ['2026-10-02', 'HOME DEPOT TLALPAN', 127600, CARGO],
    ['2026-10-02', 'OXXO REFORMA 4521', 7450, CARGO],
    ['2026-10-03', 'SUPERAMA DEL VALLE', 86510, CARGO],
    ['2026-10-04', 'DIDI VIAJE', 9600, CARGO],
    ['2026-10-04', 'PETCO MASCOTAS', 54000, CARGO],
    ['2026-10-05', 'GANDHI LIBRERIA', 38900, CARGO],
    ['2026-10-05', 'CAFETERIA LA PARROQUIA', 21500, CARGO],
    ['2026-10-06', 'LA COMER UNIVERSIDAD', 98045, CARGO],
    ['2026-10-06', 'SMART FIT', 49900, CARGO],
    ['2026-10-07', 'OXXO GAS 2231', 65000, CARGO],
    ['2026-10-07', 'VIPS RESTAURANTE', 34200, CARGO],
    ['2026-10-08', 'BONIFICACION PROMOCION', 10000, ABONO],
    ['2026-10-08', 'ZARA PERISUR', 129900, CARGO],
    ['2026-10-09', 'UBER TRIP', 14320, CARGO],
    ['2026-10-10', 'COMISION ANUALIDAD', 65000, COMISION],
    ['2026-10-10', 'IVA COMISION ANUALIDAD', 10400, COMISION],
  ],
  msi: [
    { descripcion: 'TIENDA DEPARTAMENTAL EJEMPLO', fecha: '2026-07-20', original: 1200000, n: 3, total: 12 },
    { descripcion: 'ELECTRONICA SINTETICA', fecha: '2026-09-25', original: 600000, n: 1, total: 6 },
  ],
};

/** Banco E: dos fechas por renglón (operación y cargo), meses abreviados, abonos con sufijo CR. */
const BANCO_E = {
  ultimos4: '4410',
  desde: '2026-08-29',
  hasta: '2026-09-28',
  limite: '2026-10-18',
  limiteCredito: 1500000,
  saldoAnterior: 200000,
  pagoMinimo: 35000,
  movimientos: [
    ['2026-08-30', 'MERCADO LIBRE MX', 45900, CARGO],
    ['2026-09-01', 'SU PAGO SPEI RECIBIDO', 200000, PAGO],
    ['2026-09-03', 'BODEGA AURRERA TLAHUAC', 68730, CARGO],
    ['2026-09-06', 'DIDI FOOD', 23450, CARGO],
    ['2026-09-09', 'TOTALPLAY SERVICIO', 59900, CARGO],
    ['2026-09-12', 'SEVEN ELEVEN CENTRO', 4500, CARGO],
    ['2026-09-15', 'FARMACIAS GUADALAJARA', 18760, CARGO],
    ['2026-09-19', 'DEVOLUCION MERCADO LIBRE', 45900, ABONO],
    ['2026-09-22', 'CABIFY VIAJE', 15600, CARGO],
    ['2026-09-27', 'CINEMEX ANTARA', 28000, CARGO],
  ],
  msi: [{ descripcion: 'COLCHONES SINTETICOS', fecha: '2026-06-15', original: 720000, n: 4, total: 12 }],
};

/** Banco F: fechas sin año ("02 SEP"), fechas largas en el encabezado, acentos y texto con kerning (TJ). */
const BANCO_F = {
  ultimos4: '1022',
  desde: '2026-09-01',
  hasta: '2026-09-30',
  limite: '2026-10-20',
  limiteCredito: 1000000,
  saldoAnterior: 290000,
  pagoMinimo: 42000,
  movimientos: [
    ['2026-09-02', 'PANADERÍA LA ESPIGA', 8640, CARGO],
    ['2026-09-04', 'CAFÉ DEL BOSQUE', 7200, CARGO],
    ['2026-09-05', 'PAGO DESDE APP', 290000, PAGO],
    ['2026-09-10', 'SUPERMERCADO SINTÉTICO', 132015, CARGO],
    ['2026-09-17', 'INTERESES ORDINARIOS', 3512, COMISION],
    ['2026-09-21', 'ÓPTICA DE PRUEBA', 95000, CARGO],
    ['2026-09-29', 'GASOLINERA ÑANDÚ', 60000, CARGO],
  ],
  msi: [{ descripcion: 'MUEBLERIA EJEMPLO', fecha: '2026-08-10', original: 300000, n: 2, total: 6 }],
};

function cuotaMsi(p) {
  // Cuotas iguales salvo la última, que absorbe el residuo (como E6).
  return Math.floor(p.original / p.total);
}
function pendienteMsi(p) {
  return p.original - cuotaMsi(p) * p.n;
}

function totales(e) {
  const cargos = e.movimientos.filter((m) => !ES_ABONO(m[3])).reduce((s, m) => s + m[2], 0);
  const abonos = e.movimientos.filter((m) => ES_ABONO(m[3])).reduce((s, m) => s + m[2], 0);
  const cuotas = e.msi.reduce((s, p) => s + cuotaMsi(p), 0);
  const saldoCorte = e.saldoAnterior + cargos - abonos + cuotas;
  return { cargos, abonos, cuotas, saldoCorte };
}

// ——— Páginas como renglones de "corridas" de texto en una posición x ———

/**
 * Un renglón: corridas `{x, texto, negritas?, tj?}`; `tj` parte el texto en pedazos con kerning (`TJ`). El texto
 * que debe extraerse es la unión de las corridas con un espacio.
 */
const r = (...corridas) => corridas.map((c) => (typeof c === 'string' ? { x: 40, texto: c } : c));
const en = (x, texto, extra = {}) => ({ x, texto, ...extra });

function documentoB() {
  const e = BANCO_B;
  const t = totales(e);
  const encabezado = (pagina, de) => [
    r(en(40, 'BANCO B · ESTADO DE CUENTA', { negritas: true }), en(430, `Página ${pagina} de ${de}`)),
    r(`Tarjeta de crédito terminación ${e.ultimos4}`),
  ];
  const columnas = r(en(40, 'FECHA', { negritas: true }), en(120, 'DESCRIPCIÓN', { negritas: true }), en(430, 'IMPORTE', { negritas: true }));
  const renglon = ([f, d, m, tipo]) =>
    r(en(40, fechaB(f)), en(120, d), en(430, `${ES_ABONO(tipo) ? '-' : ''}$${pesos(m)}`));
  const p1 = [
    ...encabezado(1, 2),
    r('Titular: PERSONA SINTÉTICA DE PRUEBA'),
    r(`Periodo: ${fechaB(e.desde)} al ${fechaB(e.hasta)}`),
    r(en(40, 'Fecha de corte:'), en(250, fechaB(e.hasta))),
    r(en(40, 'Fecha límite de pago:'), en(250, fechaB(e.limite))),
    r(en(40, 'Límite de crédito:'), en(250, `$${pesos(e.limiteCredito)}`)),
    r(en(40, 'Saldo anterior:'), en(250, `$${pesos(e.saldoAnterior)}`)),
    r(en(40, 'Saldo al corte:'), en(250, `$${pesos(t.saldoCorte)}`)),
    r(en(40, 'Pago para no generar intereses:'), en(250, `$${pesos(t.saldoCorte)}`)),
    r(en(40, 'Pago mínimo:'), en(250, `$${pesos(e.pagoMinimo)}`)),
    r(en(40, 'MOVIMIENTOS DEL PERIODO', { negritas: true })),
    columnas,
    ...e.movimientos.slice(0, 30).map(renglon),
  ];
  const p2 = [
    ...encabezado(2, 2),
    columnas,
    ...e.movimientos.slice(30).map(renglon),
    r(en(40, 'Total de cargos:'), en(430, `$${pesos(t.cargos)}`)),
    r(en(40, 'Total de abonos:'), en(430, `-$${pesos(t.abonos)}`)),
    r(en(40, 'COMPRAS A MESES SIN INTERESES', { negritas: true })),
    r(
      en(40, 'DESCRIPCIÓN', { negritas: true }),
      en(220, 'ORIGINAL', { negritas: true }),
      en(300, 'PENDIENTE', { negritas: true }),
      en(380, 'MENSUALIDAD', { negritas: true }),
      en(470, 'NÚM.', { negritas: true }),
    ),
    ...e.msi.map((p) =>
      r(
        en(40, p.descripcion),
        en(220, `$${pesos(p.original)}`),
        en(300, `$${pesos(pendienteMsi(p))}`),
        en(380, `$${pesos(cuotaMsi(p))}`),
        en(470, `${p.n} de ${p.total}`),
      ),
    ),
    r('Este documento es sintético y sirve solo para pruebas.'),
  ];
  return [p1, p2];
}

function documentoE() {
  const e = BANCO_E;
  const t = totales(e);
  const p1 = [
    r(en(40, 'Banco E', { negritas: true }), en(300, 'Estado de cuenta mensual')),
    r(`Número de tarjeta: **** **** **** ${e.ultimos4}`),
    r(`Período: del ${fechaE(e.desde)} al ${fechaE(e.hasta)}`),
    r(en(40, 'Fecha de corte'), en(260, fechaE(e.hasta))),
    r(en(40, 'Fecha límite de pago'), en(260, fechaE(e.limite))),
    r(en(40, 'Límite de crédito'), en(260, pesos(e.limiteCredito))),
    r(en(40, 'Saldo anterior'), en(260, pesos(e.saldoAnterior))),
    r(en(40, 'Saldo al corte'), en(260, pesos(t.saldoCorte))),
    r(en(40, 'Pago para no generar intereses'), en(260, pesos(t.saldoCorte))),
    r(en(40, 'Pago mínimo'), en(260, pesos(e.pagoMinimo))),
    r(en(40, 'DETALLE DE MOVIMIENTOS', { negritas: true })),
    r(en(40, 'Operación'), en(110, 'Cargo'), en(180, 'Concepto'), en(450, 'Importe')),
    ...e.movimientos.map(([f, d, m, tipo]) => {
      const cargo = diaSiguiente(f);
      return r(en(40, fechaE(f)), en(110, fechaE(cargo)), en(180, d), en(450, `${pesos(m)}${ES_ABONO(tipo) ? ' CR' : ''}`));
    }),
    r(en(40, 'Total cargos'), en(450, pesos(t.cargos))),
    r(en(40, 'Total abonos'), en(450, `${pesos(t.abonos)} CR`)),
    r(en(40, 'MESES SIN INTERESES', { negritas: true })),
    r(en(40, 'Compra'), en(110, 'Concepto'), en(260, 'Original'), en(330, 'Saldo'), en(400, 'Pago del mes'), en(490, 'Pago')),
    ...e.msi.map((p) =>
      r(
        en(40, fechaE(p.fecha)),
        en(110, p.descripcion),
        en(260, pesos(p.original)),
        en(330, pesos(pendienteMsi(p))),
        en(400, pesos(cuotaMsi(p))),
        en(490, `${p.n}/${p.total}`),
      ),
    ),
    r('Documento sintético para pruebas.'),
  ];
  return [p1];
}

function documentoF() {
  const e = BANCO_F;
  const t = totales(e);
  // Las descripciones van con kerning: el extractor debe unir los pedazos sin espacios de más.
  const kerning = (texto) => {
    const mitad = Math.ceil(texto.length / 2);
    return [texto.slice(0, mitad), texto.slice(mitad)];
  };
  const p1 = [
    r(en(40, 'BANCO F', { negritas: true })),
    r('RESUMEN DE TU TARJETA DE CRÉDITO'),
    r(`Cuenta: ${e.ultimos4}`),
    r(`Periodo facturado: ${fechaLarga(e.desde)} - ${fechaLarga(e.hasta)}`),
    r(`Corte: ${fechaLarga(e.hasta)}`),
    r(`Paga a más tardar el: ${fechaLarga(e.limite)}`),
    r(en(40, 'Tu límite de crédito'), en(300, `$ ${pesos(e.limiteCredito)}`)),
    r(en(40, 'Adeudo del periodo anterior'), en(300, `$ ${pesos(e.saldoAnterior)}`)),
    r(en(40, 'Saldo total al corte'), en(300, `$ ${pesos(t.saldoCorte)}`)),
    r(en(40, 'Para no pagar intereses'), en(300, `$ ${pesos(t.saldoCorte)}`)),
    r(en(40, 'Pago mínimo'), en(300, `$ ${pesos(e.pagoMinimo)}`)),
    r(en(40, 'TUS MOVIMIENTOS', { negritas: true })),
    ...e.movimientos.map(([f, d, m, tipo]) =>
      r(en(40, fechaF(f)), en(110, d, { tj: kerning(d) }), en(430, `${ES_ABONO(tipo) ? '-' : ''}$ ${pesos(m)}`)),
    ),
    r(en(40, 'TUS MESES SIN INTERESES', { negritas: true })),
    ...e.msi.map((p) =>
      r(
        en(40, `${p.descripcion} · Mensualidad ${p.n} de ${p.total} · $ ${pesos(cuotaMsi(p))}`),
        en(390, `Resta $ ${pesos(pendienteMsi(p))}`),
        en(500, `de $ ${pesos(p.original)}`),
      ),
    ),
    r(en(40, 'Banco F · documento sintético'), en(430, 'Hoja 1/1')),
  ];
  return [p1];
}

// ——— Escritura del PDF ———

/** Codifica texto a WinAnsiEncoding (el subconjunto Latin-1 que usamos) como cadena literal de PDF. */
function literal(texto) {
  let s = '(';
  for (const ch of texto) {
    const c = ch.codePointAt(0);
    if (ch === '·') s += '\\267';
    else if (c > 0xff) throw new Error(`carácter fuera de WinAnsi: ${ch}`);
    else if (ch === '(' || ch === ')' || ch === '\\') s += `\\${ch}`;
    else if (c < 0x20 || c > 0x7e) s += `\\${c.toString(8).padStart(3, '0')}`;
    else s += ch;
  }
  return `${s})`;
}

function contenidoPagina(renglones) {
  const ops = [];
  let y = 752;
  for (const renglon of renglones) {
    for (const c of renglon) {
      const fuente = c.negritas ? '/F2' : '/F1';
      if (c.tj) {
        const [a, b] = c.tj;
        ops.push(`BT ${fuente} 9 Tf 1 0 0 1 ${c.x} ${y} Tm [${literal(a)} 15 ${literal(b)}] TJ ET`);
      } else {
        ops.push(`BT ${fuente} 9 Tf 1 0 0 1 ${c.x} ${y} Tm ${literal(c.texto)} Tj ET`);
      }
    }
    y -= 14;
    if (y < 40) throw new Error('la página se desborda');
  }
  return Buffer.from(`${ops.join('\n')}\n`, 'latin1');
}

/** Bytes de una imagen gris de 16×16 (para el PDF "escaneado"). */
function imagenGris() {
  const b = Buffer.alloc(256);
  for (let i = 0; i < 256; i++) b[i] = (i * 37 + (i >> 4) * 11) & 0xff;
  return b;
}

// RC4 (para el PDF con contraseña, estándar de seguridad R2 de 40 bits).
function rc4(llave, datos) {
  const s = Array.from({ length: 256 }, (_, i) => i);
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + s[i] + llave[i % llave.length]) & 0xff;
    [s[i], s[j]] = [s[j], s[i]];
  }
  const salida = Buffer.alloc(datos.length);
  let i = 0;
  j = 0;
  for (let k = 0; k < datos.length; k++) {
    i = (i + 1) & 0xff;
    j = (j + s[i]) & 0xff;
    [s[i], s[j]] = [s[j], s[i]];
    salida[k] = datos[k] ^ s[(s[i] + s[j]) & 0xff];
  }
  return salida;
}
const md5 = (...partes) => createHash('md5').update(Buffer.concat(partes)).digest();
const RELLENO = Buffer.from(
  '28bf4e5e4e758a4164004e56fffa01082e2e00b6d0683e802f0ca9fe6453697a',
  'hex',
);
const rellenar = (clave) => Buffer.concat([Buffer.from(clave, 'latin1'), RELLENO]).subarray(0, 32);

function seguridad(usuario, propietario, id) {
  const p = -44; // imprimir y copiar: las mismas que usan los bancos (no importan para leer el texto)
  const o = rc4(md5(rellenar(propietario)).subarray(0, 5), rellenar(usuario));
  const pBytes = Buffer.alloc(4);
  pBytes.writeInt32LE(p);
  const llave = md5(rellenar(usuario), o, pBytes, id).subarray(0, 5);
  const u = rc4(llave, RELLENO);
  return { o, u, p, llave };
}

function llaveObjeto(llave, num) {
  const extra = Buffer.from([num & 0xff, (num >> 8) & 0xff, (num >> 16) & 0xff, 0, 0]);
  return md5(llave, extra).subarray(0, Math.min(llave.length + 5, 16));
}

/**
 * Arma el PDF: catálogo, páginas, dos fuentes Type1 estándar y un flujo de contenido por página. Con
 * `contrasena`, cifra los flujos con RC4 de 40 bits (V1, R2).
 */
function escribirPdf(paginas, { semilla, contrasena = null, escaneado = false }) {
  const id = md5(Buffer.from(`finanvoz-sintetico-${semilla}`, 'utf8'));
  const sec = contrasena ? seguridad(contrasena, 'propietario-sintetico', id) : null;
  const objetos = []; // [num, cuerpo (Buffer)]
  // 1 catálogo, 2 páginas, 3 F1, 4 F2, 5 imagen (si escaneado), luego por página: página y contenido.
  const primeraPagina = escaneado ? 6 : 5;
  const kids = paginas.map((_, i) => `${primeraPagina + i * 2} 0 R`).join(' ');
  objetos.push([1, Buffer.from('<< /Type /Catalog /Pages 2 0 R >>', 'latin1')]);
  objetos.push([2, Buffer.from(`<< /Type /Pages /Kids [${kids}] /Count ${paginas.length} >>`, 'latin1')]);
  objetos.push([3, Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>', 'latin1')]);
  objetos.push([
    4,
    Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>', 'latin1'),
  ]);
  const flujo = (num, dic, datos) => {
    const cuerpo = sec ? rc4(llaveObjeto(sec.llave, num), datos) : datos;
    return Buffer.concat([
      Buffer.from(`<< ${dic}/Length ${cuerpo.length} >>\nstream\n`, 'latin1'),
      cuerpo,
      Buffer.from('\nendstream', 'latin1'),
    ]);
  };
  if (escaneado) {
    objetos.push([
      5,
      flujo(5, '/Type /XObject /Subtype /Image /Width 16 /Height 16 /ColorSpace /DeviceGray /BitsPerComponent 8 ', imagenGris()),
    ]);
  }
  paginas.forEach((renglones, i) => {
    const num = primeraPagina + i * 2;
    const recursos = escaneado ? '<< /XObject << /Im1 5 0 R >> >>' : '<< /Font << /F1 3 0 R /F2 4 0 R >> >>';
    objetos.push([
      num,
      Buffer.from(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources ${recursos} /Contents ${num + 1} 0 R >>`,
        'latin1',
      ),
    ]);
    const contenido = escaneado ? Buffer.from('q 612 0 0 792 0 0 cm /Im1 Do Q\n', 'latin1') : contenidoPagina(renglones);
    objetos.push([num + 1, flujo(num + 1, '', contenido)]);
  });
  if (sec) {
    objetos.push([
      objetos.length + 1,
      Buffer.from(
        `<< /Filter /Standard /V 1 /R 2 /Length 40 /O <${sec.o.toString('hex')}> /U <${sec.u.toString('hex')}> /P ${sec.p} >>`,
        'latin1',
      ),
    ]);
  }
  objetos.sort((a, b) => a[0] - b[0]);

  const partes = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1')];
  let desplazamiento = partes[0].length;
  const xref = [];
  for (const [num, cuerpo] of objetos) {
    xref[num] = desplazamiento;
    const bloque = Buffer.concat([Buffer.from(`${num} 0 obj\n`, 'latin1'), cuerpo, Buffer.from('\nendobj\n', 'latin1')]);
    partes.push(bloque);
    desplazamiento += bloque.length;
  }
  const total = objetos.length + 1;
  let tabla = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let i = 1; i < total; i++) tabla += `${String(xref[i]).padStart(10, '0')} 00000 n \n`;
  const cifrado = sec ? ` /Encrypt ${total - 1} 0 R` : '';
  tabla += `trailer\n<< /Size ${total} /Root 1 0 R${cifrado} /ID [<${id.toString('hex')}> <${id.toString('hex')}>] >>\nstartxref\n${desplazamiento}\n%%EOF\n`;
  partes.push(Buffer.from(tabla, 'latin1'));
  return Buffer.concat(partes);
}

/** El texto que debe extraerse: renglones con sus corridas unidas por un espacio; páginas seguidas. */
function textoEsperado(paginas) {
  return `${paginas
    .flatMap((renglones) => renglones.map((renglon) => renglon.map((c) => c.texto.trim()).join(' ')))
    .join('\n')}\n`;
}

/** Lo que debe leer el analizador (`EstadoCuentaLeido` en snake_case), directo de los datos del estado. */
function jsonEsperado(banco, nombre, e, conTotales) {
  const t = totales(e);
  const json = {
    analizador: `${banco}.estado.v1`,
    banco,
    nombre_banco: nombre,
    ultimos4: e.ultimos4,
    periodo: { desde: e.desde, hasta: e.hasta },
    corte: e.hasta,
    limite: e.limite,
    limite_credito: e.limiteCredito,
    saldo_anterior: e.saldoAnterior,
    saldo_corte: t.saldoCorte,
    pngi: t.saldoCorte,
    pago_minimo: e.pagoMinimo,
    total_cargos: conTotales ? t.cargos : null,
    total_abonos: conTotales ? t.abonos : null,
    movimientos: e.movimientos.map(([fecha, descripcion, monto, tipo], indice) => ({
      indice,
      fecha,
      descripcion,
      monto,
      tipo,
    })),
    msi: e.msi.map((p) => ({
      descripcion: p.descripcion,
      monto_original: p.original,
      saldo_pendiente: pendienteMsi(p),
      cuota: cuotaMsi(p),
      cuota_numero: p.n,
      cuotas_totales: p.total,
    })),
    renglones_sin_leer: 0,
    cuadra: conTotales ? true : null,
  };
  return Buffer.from(`${JSON.stringify(json, null, 2)}\n`, 'utf8');
}

export function generar() {
  const b = documentoB();
  const e = documentoE();
  const f = documentoF();
  return {
    'banco_b.pdf': escribirPdf(b, { semilla: 'banco_b' }),
    'banco_b.txt': Buffer.from(textoEsperado(b), 'utf8'),
    'banco_b.json': jsonEsperado('banco_b', 'Banco B', BANCO_B, true),
    'banco_e.pdf': escribirPdf(e, { semilla: 'banco_e' }),
    'banco_e.txt': Buffer.from(textoEsperado(e), 'utf8'),
    'banco_e.json': jsonEsperado('banco_e', 'Banco E', BANCO_E, true),
    'banco_e.protegido.pdf': escribirPdf(e, { semilla: 'banco_e', contrasena: CONTRASENA_PRUEBA }),
    'banco_f.pdf': escribirPdf(f, { semilla: 'banco_f' }),
    'banco_f.txt': Buffer.from(textoEsperado(f), 'utf8'),
    'banco_f.json': jsonEsperado('banco_f', 'Banco F', BANCO_F, false),
    'escaneado.pdf': escribirPdf([[]], { semilla: 'escaneado', escaneado: true }),
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const verificar = process.argv.includes('--verificar');
  let distintos = 0;
  for (const [nombre, bytes] of Object.entries(generar())) {
    const ruta = join(DIR, nombre);
    if (verificar) {
      let actual = null;
      try {
        actual = readFileSync(ruta);
      } catch {
        // falta
      }
      if (!actual || !actual.equals(bytes)) {
        distintos++;
        console.error(`difiere: ${nombre}`);
      }
    } else {
      writeFileSync(ruta, bytes);
      console.log(`escrito: ${nombre} (${bytes.length} bytes)`);
    }
  }
  if (distintos > 0) process.exit(1);
}
