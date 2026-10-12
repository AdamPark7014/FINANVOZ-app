import { esCentavos, type Centavos } from '../dinero';
import { ErrorDominio } from '../errores';
import { partes } from '../fecha';
import {
  esTipoTransaccion,
  type AsientoPropuesto,
  type CuentaParaPatron,
  type TipoTransaccion,
  type TransaccionPorValidar,
} from './tipos';

type Clase = (c: CuentaParaPatron) => boolean;
type Lado = readonly CuentaParaPatron[];

// ── Clases de cuenta (`04 §2`, `§3.1`) ─────────────────────────────────────────────────────────
const activo =
  (subtipo: string): Clase =>
  (c) =>
    c.naturaleza === 'activo' && c.subtipo === subtipo;
const pasivo =
  (subtipo: string): Clase =>
  (c) =>
    c.naturaleza === 'pasivo' && c.subtipo === subtipo;
const contraparte =
  (subtipo: string): Clase =>
  (c) =>
    c.naturaleza === 'contraparte' && c.subtipo === subtipo;
const capital =
  (subtipo: string): Clase =>
  (c) =>
    c.naturaleza === 'capital' && c.subtipo === subtipo;
const o =
  (...clases: Clase[]): Clase =>
  (c) =>
    clases.some((clase) => clase(c));

/** "Líquida" = `liquida = 1` (efectivo, débito o billetera). */
const liquida: Clase = (c) => c.liquida && c.naturaleza === 'activo';
const efectivo = activo('efectivo');
const tarjeta = pasivo('tarjeta_credito');
const msi = pasivo('msi');
const porAsignar = pasivo('por_asignar');
const porAsignarEntradas = activo('por_asignar_entradas');
const transito = activo('transito');
/** "Propia" = líquida, ahorro o externa. */
const propia = o(liquida, activo('ahorro'), activo('externa'));
const personaOPareja = o(contraparte('persona'), contraparte('pareja'));
const tanda = contraparte('tanda');
const cliente = contraparte('cliente');
const gasto: Clase = (c) => c.naturaleza === 'gasto';
const ingreso: Clase = (c) => c.naturaleza === 'ingreso';
const ingresoReembolso: Clase = (c) => ingreso(c) && c.categoriaSlug === 'reembolso';
const gastoImpuestos: Clase = (c) => gasto(c) && c.categoriaSlug === 'impuestos';
const deBalance: Clase = (c) =>
  c.naturaleza === 'activo' || c.naturaleza === 'pasivo' || c.naturaleza === 'contraparte';

/** Exactamente un asiento en el lado y de la clase dada. */
const una = (lado: Lado, clase: Clase): boolean => lado.length === 1 && clase(lado[0] as CuentaParaPatron);
/** Uno o más asientos en el lado, todos de la clase dada. */
const todas = (lado: Lado, clase: Clase): boolean => lado.length >= 1 && lado.every(clase);
const distintas = (debe: Lado, haber: Lado): boolean => debe[0]?.id !== haber[0]?.id;
const contra = (cuenta: Clase, capitalClase: Clase) => (debe: Lado, haber: Lado) =>
  (una(debe, cuenta) && una(haber, capitalClase)) || (una(debe, capitalClase) && una(haber, cuenta));

interface Contexto {
  readonly estimada: boolean;
}
type Patron = (debe: Lado, haber: Lado, ctx: Contexto) => boolean;

/**
 * Patrón de cuentas por tipo (`04 §3.1`). `debe` son las cuentas con monto positivo; `haber`, las de monto
 * negativo. Las cuentas puente (`por_asignar` si el dinero sale, `por_asignar_entradas` si entra) solo se
 * admiten en los tipos con una sola cuenta propia.
 */
const PATRONES: Record<TipoTransaccion, Patron> = {
  gasto: (d, h) => todas(d, gasto) && una(h, o(liquida, tarjeta, porAsignar)),
  ingreso: (d, h) => una(d, o(liquida, porAsignarEntradas, tarjeta)) && todas(h, ingreso),
  transferencia: (d, h) => una(d, propia) && una(h, propia) && distintas(d, h),
  transferencia_pendiente: (d, h) =>
    (una(d, transito) && una(h, propia)) || (una(d, tarjeta) && una(h, transito)),
  retiro_efectivo: (d, h) => una(d, efectivo) && una(h, o(liquida, tarjeta)) && distintas(d, h),
  pago_tarjeta: (d, h) => una(d, tarjeta) && una(h, o(propia, porAsignar)),
  prestamo_otorgado: (d, h) => una(d, personaOPareja) && una(h, o(liquida, tarjeta, porAsignar)),
  pago_prestamo: (d, h) => una(d, personaOPareja) && una(h, o(liquida, tarjeta, porAsignar)),
  cobro_prestamo: (d, h) => una(d, o(liquida, tarjeta, porAsignarEntradas)) && una(h, personaOPareja),
  prestamo_recibido: (d, h) => una(d, o(liquida, tarjeta, porAsignarEntradas)) && una(h, personaOPareja),
  compra_msi: (d, h) => todas(d, gasto) && una(h, msi),
  reclasificacion_msi: (d, h) => una(d, msi) && una(h, tarjeta) && d[0]?.padreId === h[0]?.id,
  liquidacion_msi: (d, h) => una(d, msi) && una(h, tarjeta) && d[0]?.padreId === h[0]?.id,
  cuenta_dividida: (d, h) => {
    // Pagaste tú: una parte propia (gasto) y una o más partes ajenas (persona o pareja).
    const pagasteTu =
      d.filter(gasto).length === 1 &&
      d.filter(personaOPareja).length >= 1 &&
      d.every(o(gasto, personaOPareja)) &&
      una(h, o(liquida, tarjeta, porAsignar));
    // Pagó otra persona (M16): solo tu parte, contra lo que le debes.
    const pagoOtra = una(d, gasto) && una(h, personaOPareja);
    return pagasteTu || pagoOtra;
  },
  aportacion_tanda: (d, h) => una(d, tanda) && una(h, o(liquida, porAsignar)),
  cobro_tanda: (d, h) => una(d, o(liquida, porAsignarEntradas)) && una(h, tanda),
  ajuste_arqueo: (d, h, ctx) => ctx.estimada && todas(d, gasto) && una(h, efectivo),
  reembolso: (d, h) => una(d, o(tarjeta, liquida)) && todas(h, o(gasto, ingresoReembolso)),
  saldo_inicial: contra(deBalance, capital('saldos_iniciales')),
  conciliacion: contra(deBalance, capital('ajuste_conciliacion')),
  // Una reversa solo la crea `anular` (E2 regla 2), nunca `registrar`.
  reversa: () => false,
  venta_credito: (d, h) => una(d, cliente) && todas(h, ingreso),
  cobro_cliente: (d, h) => una(d, o(liquida, porAsignarEntradas)) && una(h, cliente),
  retiro_dueno: (d, h) => una(d, o(propia, transito)) && una(h, o(propia, tarjeta)),
  aportacion_dueno: (d, h) => una(d, o(propia, transito)) && una(h, o(propia, tarjeta)),
  pago_impuestos: (d, h) => una(d, gastoImpuestos) && una(h, o(liquida, porAsignar)),
};

const SOLO_NEGOCIO: ReadonlySet<TipoTransaccion> = new Set([
  'venta_credito',
  'cobro_cliente',
  'pago_impuestos',
]);

/** `04 §2.4`: solo `retiro_dueno` y `aportacion_dueno` cruzan espacios, y en su sentido. */
function espaciosValidos(tipo: TipoTransaccion, debe: Lado, haber: Lado): boolean {
  if (tipo === 'retiro_dueno') {
    return debe.every((c) => c.espacio === 'personal') && haber.every((c) => c.espacio === 'negocio');
  }
  if (tipo === 'aportacion_dueno') {
    return debe.every((c) => c.espacio === 'negocio') && haber.every((c) => c.espacio === 'personal');
  }
  const todas = [...debe, ...haber];
  const espacio = todas[0]?.espacio;
  if (!todas.every((c) => c.espacio === espacio)) return false;
  return !SOLO_NEGOCIO.has(tipo) || espacio === 'negocio';
}

/**
 * Reglas de forma de cualquier transacción, reversas incluidas (E2 regla 1): ≥ 2 asientos, montos enteros
 * distintos de cero y suma cero.
 */
export function validarAsientos(asientos: readonly AsientoPropuesto[]): void {
  if (asientos.length < 2) {
    throw new ErrorDominio('asientos_insuficientes', 'una transacción necesita al menos 2 asientos');
  }
  let suma: Centavos = 0;
  for (const a of asientos) {
    if (!esCentavos(a.monto) || a.monto === 0) {
      throw new ErrorDominio('monto_invalido', 'cada asiento lleva un entero de centavos distinto de cero');
    }
    if (typeof a.cuentaId !== 'string' || a.cuentaId === '') {
      throw new ErrorDominio('cuenta_inexistente', 'asiento sin cuenta');
    }
    suma += a.monto;
  }
  if (!Number.isSafeInteger(suma) || suma !== 0) {
    throw new ErrorDominio('suma_distinta_de_cero', 'los asientos de una transacción suman cero');
  }
}

/** Valida el patrón de cuentas del `tipo` (`04 §3.1`) con las cuentas ya resueltas. */
export function validarPatron(
  tipo: TipoTransaccion,
  asientos: readonly AsientoPropuesto[],
  cuentas: ReadonlyMap<string, CuentaParaPatron>,
  { estimada = false }: { estimada?: boolean } = {},
): void {
  const debe: CuentaParaPatron[] = [];
  const haber: CuentaParaPatron[] = [];
  for (const a of asientos) {
    const cuenta = cuentas.get(a.cuentaId);
    if (!cuenta) throw new ErrorDominio('cuenta_inexistente', `cuenta inexistente: ${a.cuentaId}`);
    (a.monto > 0 ? debe : haber).push(cuenta);
  }
  if (!PATRONES[tipo](debe, haber, { estimada }) || !espaciosValidos(tipo, debe, haber)) {
    throw new ErrorDominio('patron_invalido', `las cuentas no corresponden al tipo ${tipo}`);
  }
}

/**
 * E2 regla 1 completa para `registrar`: tipo válido, fecha civil, forma de los asientos, cuentas existentes y
 * no archivadas, y patrón por tipo. Lanza `ErrorDominio`; no devuelve nada si la transacción es válida.
 */
export function validarTransaccion(
  tx: TransaccionPorValidar,
  cuentas: ReadonlyMap<string, CuentaParaPatron>,
): void {
  if (!esTipoTransaccion(tx.tipo)) {
    throw new ErrorDominio('tipo_invalido', `tipo de transacción inválido: ${String(tx.tipo)}`);
  }
  partes(tx.fecha);
  validarAsientos(tx.asientos);
  for (const a of tx.asientos) {
    const cuenta = cuentas.get(a.cuentaId);
    if (!cuenta) throw new ErrorDominio('cuenta_inexistente', `cuenta inexistente: ${a.cuentaId}`);
    if (cuenta.archivada) throw new ErrorDominio('cuenta_archivada', `cuenta archivada: ${a.cuentaId}`);
  }
  validarPatron(tx.tipo, tx.asientos, cuentas, { estimada: tx.estimada ?? false });
}
