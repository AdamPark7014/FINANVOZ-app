import { exigirCentavos, type Centavos } from '../dinero';
import { ErrorDominio } from '../errores';
import { distribuirMayorResiduo } from '../reparto';
import type { AsientoPropuesto, MovimientoPropuesto, TipoTransaccion } from './tipos';

/**
 * Constructores de asientos de E2 para los casos 1 a 23b de `docs/04-DATOS.md §4`. Son puros: reciben ids de
 * cuentas y montos en centavos (> 0) y devuelven el `tipo` con sus asientos (débito +, crédito −). La
 * validación del patrón contra las cuentas reales la hace `validarTransaccion` al registrar.
 */

function monto(valor: unknown, campo = 'monto'): Centavos {
  return exigirCentavos(valor, campo, { minimo: 1 });
}

/** Dos asientos: `debe +monto` / `haber −monto`. */
function par(tipo: TipoTransaccion, debe: string, haber: string, valor: Centavos): MovimientoPropuesto {
  const m = monto(valor);
  return {
    tipo,
    asientos: [
      { cuentaId: debe, monto: m },
      { cuentaId: haber, monto: -m },
    ],
  };
}

/** Casos 1, 2, 13, 18 ("Pagué algo"): `gasto:<cat> +` / líquida, tarjeta o `por_asignar` −. */
export function construirGasto(e: { categoria: string; pago: string; monto: Centavos }): MovimientoPropuesto {
  return par('gasto', e.categoria, e.pago, e.monto);
}

/** Casos 5, 20, 19 ("Alguien más la pagó" como regalo): destino + / `ingreso:<cat>` −. */
export function construirIngreso(e: {
  destino: string;
  categoria: string;
  monto: Centavos;
}): MovimientoPropuesto {
  return par('ingreso', e.destino, e.categoria, e.monto);
}

/** Caso 18 ("A otra cuenta mía"): propia + / propia −. */
export function construirTransferencia(e: {
  origen: string;
  destino: string;
  monto: Centavos;
}): MovimientoPropuesto {
  return par('transferencia', e.destino, e.origen, e.monto);
}

/** Caso 15: salida sin pareja, `activo:transito +` / cuenta origen −. */
export function construirSalidaPendiente(e: {
  origen: string;
  transito: string;
  monto: Centavos;
}): MovimientoPropuesto {
  return par('transferencia_pendiente', e.transito, e.origen, e.monto);
}

/** Caso 17: pago recibido en tarjeta sin ver la salida, `pasivo:tarjeta +` / `activo:transito −`. */
export function construirPagoRecibidoPendiente(e: {
  tarjeta: string;
  transito: string;
  monto: Centavos;
}): MovimientoPropuesto {
  return par('transferencia_pendiente', e.tarjeta, e.transito, e.monto);
}

/** Casos 4 y 12: `activo:efectivo +` / otra líquida o tarjeta −. */
export function construirRetiroEfectivo(e: {
  efectivo: string;
  origen: string;
  monto: Centavos;
}): MovimientoPropuesto {
  return par('retiro_efectivo', e.efectivo, e.origen, e.monto);
}

/** Casos 3, 16, 19: `pasivo:tarjeta +` / propia (o `por_asignar`) −. No es gasto. */
export function construirPagoTarjeta(e: {
  tarjeta: string;
  origen: string;
  monto: Centavos;
}): MovimientoPropuesto {
  return par('pago_tarjeta', e.tarjeta, e.origen, e.monto);
}

/** Caso 7a y 18 ("Le presté a Caro"): `contraparte:<persona> +` / líquida o tarjeta −. */
export function construirPrestamoOtorgado(e: {
  persona: string;
  origen: string;
  monto: Centavos;
}): MovimientoPropuesto {
  return par('prestamo_otorgado', e.persona, e.origen, e.monto);
}

/** Caso 7b: líquida + / `contraparte:<persona>` −. No es ingreso. */
export function construirCobroPrestamo(e: {
  persona: string;
  destino: string;
  monto: Centavos;
}): MovimientoPropuesto {
  return par('cobro_prestamo', e.destino, e.persona, e.monto);
}

/** Caso 7c y 19 ("Alguien más la pagó", le debes): líquida o tarjeta + / `contraparte:<persona>` −. */
export function construirPrestamoRecibido(e: {
  persona: string;
  destino: string;
  monto: Centavos;
}): MovimientoPropuesto {
  return par('prestamo_recibido', e.destino, e.persona, e.monto);
}

/** Caso 7d: `contraparte:<persona> +` / líquida o tarjeta −. */
export function construirPagoPrestamo(e: {
  persona: string;
  origen: string;
  monto: Centavos;
}): MovimientoPropuesto {
  return par('pago_prestamo', e.persona, e.origen, e.monto);
}

/** Caso 6a (y 6d como reemplazo): `gasto:<cat> +` / `pasivo:tarjeta:<id>:msi:<plan> −` (E6.2). */
export function construirCompraMsi(e: {
  categoria: string;
  cuentaMsi: string;
  monto: Centavos;
}): MovimientoPropuesto {
  return par('compra_msi', e.categoria, e.cuentaMsi, e.monto);
}

/** Caso 6b: cuota k en el corte, `msi +cuota` / tarjeta madre −cuota, clave `msi:{plan}:{k}` (E6.2). */
export function construirReclasificacionMsi(e: {
  planId: string;
  k: number;
  cuentaMsi: string;
  tarjeta: string;
  cuota: Centavos;
}): MovimientoPropuesto {
  if (!Number.isSafeInteger(e.k) || e.k < 1) {
    throw new ErrorDominio('cuota_invalida', 'k es el número de cuota, desde 1');
  }
  return {
    ...par('reclasificacion_msi', e.cuentaMsi, e.tarjeta, e.cuota),
    claveIdempotencia: `msi:${e.planId}:${e.k}`,
  };
}

/** Caso 6e: liquidar MSI por adelantado, `msi +x` / tarjeta madre −x. */
export function construirLiquidacionMsi(e: {
  cuentaMsi: string;
  tarjeta: string;
  monto: Centavos;
}): MovimientoPropuesto {
  return par('liquidacion_msi', e.cuentaMsi, e.tarjeta, e.monto);
}

/**
 * Casos 11, 6c y 23b: `saldo_inicial`. `saldo` va con el signo del libro (activo +, pasivo o deuda −):
 * BBVA con 3,590 → `+359000`; un plan MSI con 7,000 por pagar → `−700000`.
 */
export function construirSaldoInicial(e: {
  cuenta: string;
  capital: string;
  saldo: Centavos;
}): MovimientoPropuesto {
  const s = exigirCentavos(e.saldo, 'saldo', { minimo: Number.MIN_SAFE_INTEGER });
  if (s === 0) throw new ErrorDominio('monto_invalido', 'un saldo inicial de cero no se registra');
  return s > 0 ? par('saldo_inicial', e.cuenta, e.capital, s) : par('saldo_inicial', e.capital, e.cuenta, -s);
}

/** Caso 6c: plan MSI que ya existía, `capital:saldos_iniciales +restante` / msi −restante (E6.2, E6-06). */
export function construirMsiExistente(e: {
  cuentaMsi: string;
  capital: string;
  mensualidad: Centavos;
  restantes: number;
}): MovimientoPropuesto {
  if (!Number.isSafeInteger(e.restantes) || e.restantes < 1) {
    throw new ErrorDominio('cuota_invalida', 'restantes es un entero ≥ 1');
  }
  return construirSaldoInicial({
    cuenta: e.cuentaMsi,
    capital: e.capital,
    saldo: -monto(e.mensualidad, 'mensualidad') * e.restantes,
  });
}

/**
 * Caso 22: `conciliacion` por la diferencia `saldoReal − saldoLibro` (ambos con el signo del libro).
 * BBVA dice 4,200 y el libro 4,350 → `capital:ajuste_conciliacion +150` / `activo:bbva −150`.
 */
export function construirConciliacion(e: {
  cuenta: string;
  capital: string;
  saldoLibro: Centavos;
  saldoReal: Centavos;
}): MovimientoPropuesto {
  const libro = exigirCentavos(e.saldoLibro, 'saldoLibro', { minimo: Number.MIN_SAFE_INTEGER });
  const real = exigirCentavos(e.saldoReal, 'saldoReal', { minimo: Number.MIN_SAFE_INTEGER });
  const diferencia = real - libro;
  if (diferencia === 0) throw new ErrorDominio('sin_diferencia', 'el saldo ya coincide');
  return diferencia > 0
    ? par('conciliacion', e.cuenta, e.capital, diferencia)
    : par('conciliacion', e.capital, e.cuenta, -diferencia);
}

/**
 * Caso 8: cuenta dividida que pagaste tú. `total` se reparte con mayor residuo entre tu parte (índice 0) y la
 * de cada persona; con `pesos` omitido, a partes iguales. Si el reparto no es exacto, el centavo extra cae
 * primero en tu parte (no infla lo que te deben).
 */
export function construirCuentaDividida(e: {
  categoria: string;
  personas: readonly string[];
  pago: string;
  total: Centavos;
  pesos?: readonly number[];
}): MovimientoPropuesto {
  const total = monto(e.total, 'total');
  if (e.personas.length === 0) {
    throw new ErrorDominio('patron_invalido', 'una cuenta dividida necesita al menos otra persona');
  }
  const pesos = e.pesos ?? [1, ...e.personas.map(() => 1)];
  if (pesos.length !== e.personas.length + 1) {
    throw new ErrorDominio('pesos_invalidos', 'un peso para ti y uno por persona');
  }
  const partes = distribuirMayorResiduo(total, pesos);
  if (partes.some((p) => p <= 0)) {
    throw new ErrorDominio('monto_invalido', 'cada parte debe ser mayor que cero');
  }
  const [propia, ...ajenas] = partes as [Centavos, ...Centavos[]];
  return {
    tipo: 'cuenta_dividida',
    asientos: [
      { cuentaId: e.categoria, monto: propia },
      ...e.personas.map((persona, i) => ({ cuentaId: persona, monto: ajenas[i] as Centavos })),
      { cuentaId: e.pago, monto: -total },
    ],
  };
}

/** Casos 9 y 23: `contraparte:tanda +` / líquida −. Ni gasto ni ingreso. */
export function construirAportacionTanda(e: {
  tanda: string;
  origen: string;
  monto: Centavos;
}): MovimientoPropuesto {
  return par('aportacion_tanda', e.tanda, e.origen, e.monto);
}

/** Casos 9 y 23: líquida + / `contraparte:tanda` −. */
export function construirCobroTanda(e: {
  tanda: string;
  destino: string;
  monto: Centavos;
}): MovimientoPropuesto {
  return par('cobro_tanda', e.destino, e.tanda, e.monto);
}

/**
 * Caso 10: `ajuste_arqueo` con las propuestas confirmadas de E7 (`gasto:<cat> +` cada una) contra el
 * efectivo por el hueco. Siempre `estimada = 1`.
 */
export function construirAjusteArqueo(e: {
  efectivo: string;
  propuestas: readonly AsientoPropuesto[];
}): MovimientoPropuesto {
  if (e.propuestas.length === 0) throw new ErrorDominio('asientos_insuficientes', 'arqueo sin propuestas');
  const propuestas = e.propuestas.map((p) => ({ cuentaId: p.cuentaId, monto: monto(p.monto) }));
  const hueco = propuestas.reduce((s, p) => s + p.monto, 0);
  return {
    tipo: 'ajuste_arqueo',
    estimada: true,
    asientos: [...propuestas, { cuentaId: e.efectivo, monto: -hueco }],
  };
}

/**
 * Caso 21: devolución, tarjeta o líquida + / `gasto:<cat>` − (o `ingreso:reembolso` − si no se encontró el
 * cargo original).
 */
export function construirReembolso(e: {
  destino: string;
  contra: string;
  monto: Centavos;
}): MovimientoPropuesto {
  return par('reembolso', e.destino, e.contra, e.monto);
}

/** Caso 14: espejo exacto (asientos con signo invertido) de una transacción. */
export function construirReversa(asientos: readonly AsientoPropuesto[]): MovimientoPropuesto {
  return { tipo: 'reversa', asientos: asientos.map((a) => ({ cuentaId: a.cuentaId, monto: -a.monto })) };
}
