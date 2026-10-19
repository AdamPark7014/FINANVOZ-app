import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { compromisoPorMes, type DesgloseReservado, type PlainDate } from '@cartera/core';
import { esquema } from '@cartera/datos';
import { puertoEnMemoria } from '../avisos/puerto';
import { aceptarConsentimiento } from '../privacidad/consentimiento';
import { procesarApertura } from './apertura';
import { fijarPreferenciasAvisos, planAvisosTarjetas, sincronizarAvisosTarjetas } from './avisos-tarjetas';
import { confirmarCobertura } from './cobertura';
import {
  agregarPagoPlaneado,
  configurarCicloPorVoz,
  corregirSaldoTarjeta,
  editarTarjeta,
} from './config-tarjetas';
import { deshacer } from './deshacer';
import { registrarMovimiento } from './formulario';
import { obtenerHoy } from './hoy';
import { listarMovimientos } from './movimientos';
import {
  compromisoMsi12Meses,
  liquidarMsi,
  listarPlanesMsi,
  noEraParaLiquidar,
  pasarAMeses,
  registrarCompraMsi,
} from './msi';
import { listarOcurrencias } from './ocurrencias';
import {
  agregarCuenta,
  agregarPagoFijo,
  agregarTarjetaCredito,
  configurarIngreso,
  configurarIngresoVariable,
} from './onboarding';
import { escribirAjuste } from './preferencias';
import { confirmarCompraMsi, registrarTexto } from './registrar';
import { cargarEscenario } from './semilla';
import { cuotasMsiPendientes, tarjetaPorId } from './tarjetas';
import { detalleTarjeta, listarTarjetas, tarjetaDelDia } from './vista-tarjetas';
import { abrirPrueba, escenario, golden, tarjetaFixture, vector } from './__pruebas__/base';
import { nubeFalsa } from './__pruebas__/nube';

interface TarjetaFixture {
  nombre: string;
  modo: 'totalero' | 'plan';
  dia_corte: number;
  dias_para_pagar?: number;
  dia_limite_pago?: number;
  limite_credito: number;
  saldo_revolvente: number;
}
interface Cuota {
  n: number;
  monto: number;
  corte: PlainDate;
  limite: PlainDate;
}
interface VectorPlan {
  monto: number;
  meses: number;
  fecha_compra: PlainDate;
  tarjeta: string;
  esperado: { cuotas: Cuota[]; compromiso_por_mes: Record<string, number> };
}
interface VectorCortes {
  tarjeta: string;
  alta: PlainDate;
  hoy: PlainDate;
  procesados: PlainDate[];
  esperado: PlainDate[];
}
interface VectorE606 {
  mensualidad: number;
  restantes: number;
  hoy: PlainDate;
  tarjeta: string;
  esperado: { saldo_msi: number; cuotas: Cuota[] };
}
interface VectorE4 {
  entrada: { liquidez: number; colchon: number; fin_horizonte: PlainDate };
  esperado: {
    dias: number;
    reservado: number;
    desglose: DesgloseReservado;
    libre: number;
    hoy_puedes_centavos: number;
  };
}
interface VectorCobertura {
  id: string;
  ocurrencia: {
    tipo: 'ingreso' | 'egreso';
    fecha: PlainDate;
    monto: number;
    cuenta?: string | null;
    categoria?: string;
    comercio?: string;
    variable?: boolean;
  };
  movimiento: {
    sentido: 'entrada' | 'salida';
    fecha: PlainDate;
    monto: number;
    cuenta: string;
    categoria?: string;
    comercio?: string;
  };
  esperado: 'cubrir' | 'preguntar' | 'no';
}

const { transaccion, estadoCuenta, asiento, cuenta } = esquema;

function tarjetaDe(t: TarjetaFixture) {
  return {
    diaCorte: t.dia_corte,
    ...(t.dias_para_pagar !== undefined ? { diasParaPagar: t.dias_para_pagar } : {}),
    ...(t.dia_limite_pago !== undefined ? { diaLimitePago: t.dia_limite_pago } : {}),
    limiteCredito: t.limite_credito,
    modo: t.modo,
  };
}

/** Base con consentimiento, BBVA ($20,000) y la quincena; la tarjeta del fixture se da de alta el día `hoy`. */
function preparar(hoy: PlainDate = '2026-10-11', opciones: { ingresoVariable?: boolean } = {}) {
  const p = abrirPrueba(hoy);
  aceptarConsentimiento(p.ctx, { datosFinancieros: true });
  const bbva = agregarCuenta(p.ctx, { subtipo: 'debito', nombre: 'BBVA', saldo: 2_000_000, alias: ['bbva'] });
  if (opciones.ingresoVariable) configurarIngresoVariable(p.ctx);
  else
    configurarIngreso(p.ctx, { monto: 650_000, regla: { tipo: 'quincenal_15_ultimo', ajuste: 'anterior' } });
  const tarjeta = (
    id: string,
    extra: { saldo?: number; alias?: string[]; modo?: 'totalero' | 'plan' } = {},
  ) => {
    const f = tarjetaFixture<TarjetaFixture>(id);
    return agregarTarjetaCredito(p.ctx, {
      nombre: f.nombre,
      alias: extra.alias ?? [],
      ...tarjetaDe(f),
      ...(extra.modo ? { modo: extra.modo } : {}),
      saldo: extra.saldo ?? 0,
    }).cuentaId;
  };
  return { ...p, bbva, tarjeta };
}

function reclasificaciones(p: ReturnType<typeof abrirPrueba>) {
  return p.ctx.db
    .select()
    .from(transaccion)
    .where(eq(transaccion.tipo, 'reclasificacion_msi'))
    .all()
    .map((t) => ({ clave: t.claveIdempotencia, fecha: t.fecha }))
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.clave.localeCompare(b.clave)));
}

function cortesCerrados(p: ReturnType<typeof abrirPrueba>, tarjetaId: string) {
  return p.ctx.db
    .select({ corte: estadoCuenta.corte })
    .from(estadoCuenta)
    .where(eq(estadoCuenta.tarjetaId, tarjetaId))
    .all()
    .map((f) => f.corte)
    .sort();
}

/** Suma de todos los asientos en cuentas de gasto: lo que los reportes cuentan como gasto. */
function gastoTotal(p: ReturnType<typeof abrirPrueba>): number {
  return p.ctx.db
    .select({ monto: asiento.monto })
    .from(asiento)
    .innerJoin(cuenta, eq(cuenta.id, asiento.cuentaId))
    .where(eq(cuenta.naturaleza, 'gasto'))
    .all()
    .reduce((s, a) => s + a.monto, 0);
}

function recorrer(
  p: ReturnType<typeof abrirPrueba> & { reloj: { fijar(f: PlainDate): void } },
  desde: PlainDate,
  hasta: PlainDate,
) {
  // E5.3 cierra en una sola pasada todos los cortes con fecha ≤ hoy; simular cada día en rangos largos
  // no cambia reclasificaciones MSI y dispara el timeout de Vitest bajo carga (CA-M4-01).
  if (desde !== hasta) {
    p.reloj.fijar(hasta);
    procesarApertura(p.ctx);
    return;
  }
  p.reloj.fijar(hasta);
  procesarApertura(p.ctx);
}

describe('M4 · tarjetas, MSI y compromisos', () => {
  it(
    'CA-M4-01 · del 11 oct 2026 al 31 ene 2027 con el plan E6-01 hay exactamente 3 reclasificaciones; repetir no duplica',
    { timeout: 20_000 },
    () => {
      const v = vector<VectorPlan>('E6-01');
      const p = preparar(v.fecha_compra);
      const oro = p.tarjeta(v.tarjeta);
      const compra = registrarCompraMsi(p.ctx, {
        tarjetaId: oro,
        monto: v.monto,
        meses: v.meses,
        fecha: v.fecha_compra,
        categoria: 'tecnologia',
      });
      expect(compra.cuotas.map(({ n, monto, corte, limite }) => ({ n, monto, corte, limite }))).toEqual(
        v.esperado.cuotas,
      );
      expect(compra.compromisoPorMes).toEqual(v.esperado.compromiso_por_mes);

      recorrer(p, '2026-10-11', '2027-01-31');
      const esperadas = v.esperado.cuotas.map((c) => ({
        clave: `msi:${compra.planId}:${c.n}`,
        fecha: c.corte,
      }));
      expect(reclasificaciones(p)).toEqual(esperadas);
      expect(cortesCerrados(p, oro)).toEqual(vector<VectorCortes>('E6-07').esperado);

      // Repetir el proceso (y abrir Hoy varias veces) no duplica nada.
      recorrer(p, '2026-10-11', '2027-01-31');
      obtenerHoy(p.ctx);
      obtenerHoy(p.ctx);
      expect(reclasificaciones(p)).toEqual(esperadas);
      expect(cortesCerrados(p, oro)).toHaveLength(3);
      expect(listarPlanesMsi(p.ctx, oro)[0]).toMatchObject({
        estado: 'terminado',
        cuotasRestantes: 0,
        restante: 0,
      });
      expect(tarjetaPorId(p.ctx, oro).saldoRevolvente).toBe(v.monto);
      expect(cuotasMsiPendientes(p.ctx)).toEqual([]);
      expect(p.ctx.libro.comprobarIntegridad()).toEqual([]);
    },
  );

  it('CA-M4-02 · el PNGI mostrado = saldo al corte − pagos posteriores', () => {
    const p = preparar('2026-10-11');
    const oro = p.tarjeta('tarj_banamex_8812', { saldo: 120_000 });
    const compra = (monto: number, fecha: PlainDate) =>
      registrarMovimiento(p.ctx, { tipo: 'gasto', monto, fecha, categoria: 'super', origenId: oro });
    const pagar = (monto: number, fecha: PlainDate) =>
      registrarMovimiento(p.ctx, { tipo: 'pago_tarjeta', monto, fecha, origenId: p.bbva, destinoId: oro });

    compra(300_000, '2026-10-20');
    pagar(20_000, '2026-11-09'); // antes del corte: ya está dentro del saldo al corte
    compra(50_000, '2026-11-10'); // el día de corte entra en ese corte
    p.reloj.fijar('2026-11-10');
    procesarApertura(p.ctx);
    const saldoCorte = 120_000 + 300_000 - 20_000 + 50_000;
    expect(listarTarjetas(p.ctx)[0]?.ultimoCorte).toMatchObject({
      corte: '2026-11-10',
      saldoCorte,
      pngi: saldoCorte,
    });

    p.reloj.fijar('2026-11-14');
    pagar(100_000, '2026-11-12');
    compra(40_000, '2026-11-13'); // después del corte: no cambia el PNGI
    const anulada = compra(70_000, '2026-11-14');
    deshacer(p.ctx, anulada.deshacer); // una compra anulada no es un abono
    const vista = listarTarjetas(p.ctx)[0];
    expect(vista?.ultimoCorte).toMatchObject({ saldoCorte, pagosPosteriores: 100_000 });
    expect(vista?.pngi).toBe(saldoCorte - 100_000);
    expect(vista?.fechaLimite).toBe('2026-11-30');
    expect(vista?.saldoRevolvente).toBe(saldoCorte - 100_000 + 40_000);
    // Pagar más que el saldo al corte deja el PNGI en 0, nunca negativo.
    pagar(500_000, '2026-11-14');
    expect(detalleTarjeta(p.ctx, oro).pngi).toBe(0);
    expect(p.ctx.libro.comprobarIntegridad()).toEqual([]);
  });

  it('CA-M4-03 · con la semilla e5-10 la tarjeta del día es "Banamex Oro ••8812" con 50 días', () => {
    const p = abrirPrueba();
    const e = cargarEscenario(p.ctx, escenario('e5-10'));
    p.reloj.fijar(e.hoy);
    const esperado = e.esperado as { tarjeta_del_dia: string; dias_financiamiento: number };
    const t = tarjetaDelDia(p.ctx);
    expect(t).toMatchObject({
      tarjetaId: e.cuentas[esperado.tarjeta_del_dia],
      nombre: 'Banamex Oro ••8812',
      dias: esperado.dias_financiamiento,
      monto: 50_000,
      advertencia: null,
      texto: 'Si compras hoy, usa la Banamex Oro ••8812: tienes 50 días para pagar.',
    });
    expect(obtenerHoy(p.ctx).tarjetaDelDia).toEqual(t);

    // Con una sola tarjeta elegible no se muestra.
    const q = abrirPrueba();
    cargarEscenario(q.ctx, escenario('e4-01'));
    expect(obtenerHoy(q.ctx).tarjetaDelDia).toBeNull();
  });

  it('CA-M4-04 · la fecha límite se avisa 3 días antes, el corte el mismo día, y respetan el horario silencioso', async () => {
    const p = preparar('2026-10-11');
    const oro = p.tarjeta('tarj_banamex_8812', { saldo: 120_000 });
    const avisos = planAvisosTarjetas(p.ctx, '10:00');
    const limiteNov = avisos.find((a) => a.id === `tarjeta:limite:${oro}:2026-11-30`);
    expect(limiteNov).toMatchObject({ tipo: 'fecha_limite', fecha: '2026-11-27', hora: '09:00' });
    expect(limiteNov?.cuerpo).toBe('Revisa cuánto pagar para no generar intereses.'); // el corte aún no cierra
    expect(avisos.find((a) => a.id === `tarjeta:corte:${oro}:2026-11-10`)).toMatchObject({
      tipo: 'corte',
      fecha: '2026-11-10',
      hora: '09:00',
    });
    // El periodo en curso (corte 10 oct, antes del alta) también avisa su fecha límite (30 oct → 27 oct).
    expect(avisos.find((a) => a.id === `tarjeta:limite:${oro}:2026-10-30`)?.fecha).toBe('2026-10-27');

    // Con la hora de los avisos dentro del silencio (22:00–08:00), salen al terminar el silencio.
    fijarPreferenciasAvisos(p.ctx, { hora: '23:30' });
    expect(planAvisosTarjetas(p.ctx, '10:00').find((a) => a.id === limiteNov?.id)).toMatchObject({
      fecha: '2026-11-28',
      hora: '08:00',
    });
    fijarPreferenciasAvisos(p.ctx, { hora: '06:15' });
    expect(planAvisosTarjetas(p.ctx, '10:00').find((a) => a.id === limiteNov?.id)).toMatchObject({
      fecha: '2026-11-27',
      hora: '08:00',
    });
    fijarPreferenciasAvisos(p.ctx, { hora: '09:00', silencio: { inicio: '21:00', fin: '09:30' } });
    expect(planAvisosTarjetas(p.ctx, '10:00').every((a) => a.hora === '09:30')).toBe(true);
    fijarPreferenciasAvisos(p.ctx, { silencio: { inicio: '22:00', fin: '08:00' } });

    // Al cerrar el corte, el aviso lleva el PNGI; ya pagado, no se avisa.
    p.reloj.fijar('2026-11-11');
    procesarApertura(p.ctx);
    const conPngi = planAvisosTarjetas(p.ctx, '10:00').find((a) => a.id === limiteNov?.id);
    expect(conPngi).toMatchObject({
      titulo: 'Tu Banamex Oro ••8812 vence el lun 30',
      cuerpo: 'Paga $1,200 para no generar intereses.',
    });

    // Sincronizar con el puerto: idempotente, 1 por tarjeta y periodo.
    const puerto = puertoEnMemoria();
    const r1 = await sincronizarAvisosTarjetas(p.ctx, puerto, '10:00');
    expect(r1.programadas.length).toBeGreaterThan(0);
    const r2 = await sincronizarAvisosTarjetas(p.ctx, puerto, '10:00');
    expect(r2).toEqual({ programadas: [], canceladas: [], sinCambio: r1.programadas });
    registrarMovimiento(p.ctx, { tipo: 'pago_tarjeta', monto: 120_000, origenId: p.bbva, destinoId: oro });
    const r3 = await sincronizarAvisosTarjetas(p.ctx, puerto, '10:00');
    expect(r3.canceladas).toEqual([limiteNov?.id]);
    expect(puerto.lista().some((n) => n.id === limiteNov?.id)).toBe(false);
    // Fecha límite en ≤ 3 días: Hoy muestra la tarjeta de acción en vez del aviso.
    const q = preparar('2026-10-11');
    const nu = q.tarjeta('tarj_banamex_8812', { saldo: 50_000 });
    q.reloj.fijar('2026-11-28');
    const hoy = obtenerHoy(q.ctx);
    expect(hoy.tarjetasAccion[0]).toMatchObject({
      tipo: 'pago_tarjeta',
      tarjetaId: nu,
      pngi: 50_000,
      limite: '2026-11-30',
    });
  });

  it('CA-M4-05 · "Netflix $219 el día 14" + cargo de $219 en ±3 días → cubierta y E4 deja de reservarla (E3-36)', () => {
    const v = vector<VectorCobertura>('E3-36');
    const p = preparar('2026-10-11');
    const nu = p.tarjeta('tarj_nu_4410');
    const programadoId = agregarPagoFijo(p.ctx, {
      concepto: 'Netflix',
      monto: v.ocurrencia.monto,
      regla: { tipo: 'mensual', dia: 14 },
    });
    const antes = obtenerHoy(p.ctx);
    expect(
      antes.reservadoDetalle.some((r) => r.concepto === 'Netflix' && r.fecha === v.ocurrencia.fecha),
    ).toBe(true);

    p.reloj.fijar(v.movimiento.fecha);
    const r = registrarMovimiento(p.ctx, {
      tipo: 'gasto',
      monto: v.movimiento.monto,
      fecha: v.movimiento.fecha,
      categoria: 'entretenimiento',
      comercio: v.movimiento.comercio as string,
      origenId: nu,
    });
    expect(r.cobertura).toEqual({
      decision: 'cubierta',
      programadoId,
      fecha: v.ocurrencia.fecha,
      concepto: 'Netflix',
    });
    expect(
      listarOcurrencias(p.ctx, { programadoId }).find((o) => o.fecha === v.ocurrencia.fecha),
    ).toMatchObject({
      estado: 'cubierta',
      transaccionId: r.transaccionId,
    });
    const despues = obtenerHoy(p.ctx);
    expect(despues.reservadoDetalle.some((x) => x.concepto === 'Netflix')).toBe(false);
    expect(despues.tarjetasAccion.some((t) => t.tipo === 'compromiso_vencido')).toBe(false);
    // Deshacer el cargo vuelve a reservarla.
    deshacer(p.ctx, r.deshacer);
    expect(obtenerHoy(p.ctx).tarjetasAccion.some((t) => t.tipo === 'compromiso_vencido')).toBe(true);
  });

  it('CA-M4-06 · "Compré una tele de 12 mil a 12 meses sin intereses con la oro": plan, gasto completo en su categoría y 12 meses de compromiso', async () => {
    const caso = golden('S01');
    const p = preparar('2026-10-11');
    const oro = p.tarjeta('tarj_banamex_8812', { saldo: 120_000, alias: ['oro'] });
    const nube = nubeFalsa({ [caso.texto]: caso.esperado });
    const hoyAntes = obtenerHoy(p.ctx);

    const r = await registrarTexto(p.ctx, caso.texto, 'voz', { nube: nube.nube });
    if (r.resultado !== 'confirmar_msi') throw new Error(r.resultado);
    expect(r.motivo).toBe('monto_alto'); // más de $5,000: tarjeta de confirmación
    expect(r.propuesta).toMatchObject({
      entrada: { tarjetaId: oro, monto: 1_200_000, meses: 12 },
      faltaTarjeta: null,
    });
    // En la confirmación la persona elige la categoría (el intérprete no la dio).
    const g = confirmarCompraMsi(
      p.ctx,
      { ...r.propuesta.entrada, tarjetaId: oro, categoria: 'hogar', descripcion: 'tele' },
      'voz',
    );
    expect(g.compra.cuotas).toHaveLength(12);
    expect(g.compra.cuotas.every((c) => c.monto === 100_000)).toBe(true);
    // Corte el 10 y 20 días para pagar: la cuota del corte del 10 de febrero vence el 2 de marzo, así que marzo
    // junta dos cuotas y el compromiso abarca 11 meses de calendario.
    expect(g.compra.compromisoPorMes).toMatchObject({ '2026-11': 100_000, '2027-03': 200_000 });
    expect(Object.values(g.compra.compromisoPorMes).reduce((a, b) => a + b, 0)).toBe(1_200_000);
    expect(compromisoPorMes(g.compra.cuotas)).toEqual(g.compra.compromisoPorMes);
    // El gasto completo, una sola vez, en Hogar, el día de la compra.
    const movs = listarMovimientos(p.ctx).flatMap((d) => d.movimientos);
    expect(movs).toHaveLength(1);
    expect(movs[0]).toMatchObject({
      tipo: 'compra_msi',
      monto: 1_200_000,
      categoria: 'Hogar',
      fecha: '2026-10-11',
    });
    expect(gastoTotal(p)).toBe(1_200_000);
    // Visible en el detalle de la tarjeta y en el compromiso de los próximos meses.
    const d = detalleTarjeta(p.ctx, oro);
    expect(d.planes[0]).toMatchObject({
      descripcion: 'tele',
      meses: 12,
      cuotasRestantes: 12,
      cuota: 100_000,
      terminaEn: '2027-10',
    });
    expect(d.msiPorPagar).toBe(1_200_000);
    // Octubre 2026 a septiembre 2027: octubre y febrero sin cuota, marzo con dos; la de octubre 2027 queda fuera.
    const doce = compromisoMsi12Meses(p.ctx);
    expect(doce).toHaveLength(12);
    expect(doce.map((m) => m.monto)).toEqual([
      0, 100_000, 100_000, 100_000, 0, 200_000, 100_000, 100_000, 100_000, 100_000, 100_000, 100_000,
    ]);
    // La deuda revolvente no cambia y el "hoy puedes" no baja por cuotas que vencen después del horizonte.
    const hoy = obtenerHoy(p.ctx);
    expect(tarjetaPorId(p.ctx, oro).saldoRevolvente).toBe(120_000);
    expect(hoy.hoyPuedesCentavos).toBe(hoyAntes.hoyPuedesCentavos);
    // Deshacer anula la compra y el plan deja de existir.
    deshacer(p.ctx, g.deshacer);
    expect(listarPlanesMsi(p.ctx)).toEqual([]);
    expect(cuotasMsiPendientes(p.ctx)).toEqual([]);

    // Compra a meses de $5,000 o menos: registro optimista (S02).
    const s02 = golden('S02');
    p.tarjeta('tarj_nu_4410', { alias: ['nu'] });
    nube.responder(s02.texto, s02.esperado);
    const r2 = await registrarTexto(p.ctx, s02.texto, 'voz', { nube: nube.nube });
    if (r2.resultado !== 'registrado_msi') throw new Error(r2.resultado);
    expect(r2.compra).toMatchObject({ monto: 150_000, meses: 3, categoria: 'Ropa' });
    expect(p.ctx.libro.comprobarIntegridad()).toEqual([]);
  });

  it('CA-M4-07 · cortes solo posteriores al alta (E6-07 a E6-09)', () => {
    for (const id of ['E6-07', 'E6-08', 'E6-09']) {
      const v = vector<VectorCortes>(id);
      const p = preparar(v.alta);
      const t = p.tarjeta(v.tarjeta);
      for (const c of v.procesados) {
        p.reloj.fijar(c);
        procesarApertura(p.ctx);
      }
      const antes = cortesCerrados(p, t);
      expect(antes).toEqual(v.procesados);
      p.reloj.fijar(v.hoy);
      procesarApertura(p.ctx);
      expect(cortesCerrados(p, t).filter((c) => !antes.includes(c))).toEqual(v.esperado);
      expect(cortesCerrados(p, t).every((c) => c > v.alta)).toBe(true);
    }
    // Alta el 11 oct con corte el 10: el primero es el 10 nov.
    const p = preparar('2026-10-11');
    const oro = p.tarjeta('tarj_banamex_8812');
    recorrer(p, '2026-10-11', '2026-11-09');
    expect(cortesCerrados(p, oro)).toEqual([]);
    recorrer(p, '2026-11-10', '2026-11-10');
    expect(cortesCerrados(p, oro)).toEqual(['2026-11-10']);
  });

  it('CA-M4-08 · MSI que ya existía ($1,000, faltan 7): cuotas de E6-06, nunca gasto y E4 reserva solo la cuota del horizonte', () => {
    const v = vector<VectorE606>('E6-06');
    const f = tarjetaFixture<TarjetaFixture>(v.tarjeta);
    const p = preparar(v.hoy, { ingresoVariable: true });
    const { cuentaId: oro, planes } = agregarTarjetaCredito(p.ctx, {
      nombre: f.nombre,
      ...tarjetaDe(f),
      saldo: f.saldo_revolvente,
      msiPrevios: [{ mensualidad: v.mensualidad, restantes: v.restantes, descripcion: 'Refri' }],
      saldoIncluyeMsi: 'no',
    });
    const [plan] = listarPlanesMsi(p.ctx, oro);
    expect(plan?.id).toBe(planes[0]);
    expect(plan?.cuotas.map(({ n, monto, corte, limite }) => ({ n, monto, corte, limite }))).toEqual(
      v.esperado.cuotas,
    );
    expect(plan?.restante).toBe(v.esperado.saldo_msi);

    // 5 nov, ingreso variable (horizonte de 30 días, al 5 dic): la cuota 1 (límite 30 nov) aún no se factura y
    // es la única que vence en el horizonte.
    p.reloj.fijar('2026-11-05');
    expect(obtenerHoy(p.ctx).desglose).toMatchObject({
      cuotas_msi: v.mensualidad,
      tarjetas_saldo_completo: f.saldo_revolvente,
    });
    // 10 nov: se factura (deuda revolvente, reservada completa); la cuota 2 (30 dic) queda fuera del horizonte.
    p.reloj.fijar('2026-11-10');
    expect(obtenerHoy(p.ctx).desglose).toMatchObject({
      cuotas_msi: 0,
      tarjetas_saldo_completo: f.saldo_revolvente + v.mensualidad,
    });
    // Hasta la última cuota: 7 reclasificaciones y ningún gasto en ningún reporte.
    recorrer(p, '2026-11-11', '2027-05-31');
    expect(reclasificaciones(p)).toHaveLength(v.restantes);
    expect(gastoTotal(p)).toBe(0);
    expect(
      listarMovimientos(p.ctx)
        .flatMap((d) => d.movimientos)
        .filter((m) => m.categoria !== null),
    ).toEqual([]);
    expect(listarPlanesMsi(p.ctx, oro)[0]).toMatchObject({ estado: 'terminado', restante: 0 });
    expect(tarjetaPorId(p.ctx, oro).saldoRevolvente).toBe(f.saldo_revolvente + v.esperado.saldo_msi);
    expect(p.ctx.libro.comprobarIntegridad()).toEqual([]);
  });

  it('CA-M4-09 · pasar a meses $12,000 deja la deuda revolvente como antes del cargo, crea el plan y el gasto aparece una vez', () => {
    const p = preparar('2026-10-11');
    const oro = p.tarjeta('tarj_banamex_8812', { saldo: 120_000 });
    const cargo = registrarMovimiento(p.ctx, {
      tipo: 'gasto',
      monto: 1_200_000,
      categoria: 'tecnologia',
      descripcion: 'laptop',
      origenId: oro,
    });
    expect(tarjetaPorId(p.ctx, oro).saldoRevolvente).toBe(1_320_000);

    const r = pasarAMeses(p.ctx, cargo.transaccionId, 12);
    expect(tarjetaPorId(p.ctx, oro).saldoRevolvente).toBe(120_000);
    expect(listarPlanesMsi(p.ctx, oro)).toEqual([
      expect.objectContaining({
        id: r.planId,
        origen: 'pasar_a_meses',
        meses: 12,
        monto: 1_200_000,
        cuotasRestantes: 12,
      }),
    ]);
    const movs = listarMovimientos(p.ctx).flatMap((d) => d.movimientos);
    expect(movs).toEqual([
      expect.objectContaining({
        tipo: 'compra_msi',
        monto: 1_200_000,
        categoria: 'Tecnología',
        fecha: '2026-10-11',
      }),
    ]);
    expect(gastoTotal(p)).toBe(1_200_000);
    // Deshacer vuelve al cargo normal.
    deshacer(p.ctx, r.deshacer);
    expect(tarjetaPorId(p.ctx, oro).saldoRevolvente).toBe(1_320_000);
    expect(listarPlanesMsi(p.ctx)).toEqual([]);
    expect(gastoTotal(p)).toBe(1_200_000);

    // Un cargo de un periodo ya cerrado: la cuota de ese corte se factura y el estado de cuenta se recalcula.
    const otro = registrarMovimiento(p.ctx, {
      tipo: 'gasto',
      monto: 600_000,
      fecha: '2026-10-20',
      categoria: 'hogar',
      origenId: oro,
    });
    p.reloj.fijar('2026-11-12');
    procesarApertura(p.ctx);
    const antes = listarTarjetas(p.ctx)[0]?.ultimoCorte?.saldoCorte as number;
    // Las intenciones que guardó M3 (`pasar_a_meses:<id>`) se convierten al abrir la app.
    escribirAjuste(
      p.ctx,
      `pasar_a_meses:${otro.transaccionId}`,
      z.strictObject({ meses: z.int(), registrado_en: z.int() }),
      {
        meses: 6,
        registrado_en: 1,
      },
    );
    expect(procesarApertura(p.ctx).pasadosAMeses).toHaveLength(1);
    expect(listarTarjetas(p.ctx)[0]?.ultimoCorte?.saldoCorte).toBe(antes - 600_000 + 100_000);
    expect(procesarApertura(p.ctx).pasadosAMeses).toHaveLength(0);
    expect(p.ctx.libro.comprobarIntegridad()).toEqual([]);
  });

  it('CA-M4-10 · un pago que deja saldo a favor con meses activos pregunta si fue para liquidar; al confirmar, no hay más cuotas', () => {
    const p = preparar('2026-10-11');
    const oro = p.tarjeta('tarj_banamex_8812', { saldo: 120_000 });
    const tele = registrarCompraMsi(p.ctx, {
      tarjetaId: oro,
      monto: 600_000,
      meses: 6,
      categoria: 'hogar',
      descripcion: 'la tele',
    });
    const antes = obtenerHoy(p.ctx);

    const pago = registrarMovimiento(p.ctx, {
      tipo: 'pago_tarjeta',
      monto: 700_000,
      origenId: p.bbva,
      destinoId: oro,
    });
    expect(pago.preguntaLiquidar).toEqual({
      tarjetaId: oro,
      tarjeta: 'Banamex Oro ••8812',
      pregunta: '¿Este pago fue para liquidar tus meses?',
      saldoAFavor: 580_000,
      planes: [{ planId: tele.planId, descripcion: 'la tele', restante: 600_000 }],
    });
    const hoy = obtenerHoy(p.ctx);
    expect(hoy.tarjetasAccion).toContainEqual(
      expect.objectContaining({ tipo: 'liquidar_msi', tarjetaId: oro }),
    );
    // E4-07: el saldo a favor nunca sube el "hoy puedes": el libre baja exactamente lo que salió de más.
    expect(hoy.libre).toBe(antes.libre - 580_000);
    expect(listarTarjetas(p.ctx)[0]).toMatchObject({ saldoAFavor: 580_000, deudaTotal: 600_000 });

    const l = liquidarMsi(p.ctx, tele.planId);
    expect(l.monto).toBe(600_000);
    expect(listarPlanesMsi(p.ctx, oro)[0]).toMatchObject({
      estado: 'liquidado',
      restante: 0,
      cuotasRestantes: 0,
    });
    expect(tarjetaPorId(p.ctx, oro).saldoRevolvente).toBe(20_000);
    expect(obtenerHoy(p.ctx).tarjetasAccion.some((t) => t.tipo === 'liquidar_msi')).toBe(false);
    recorrer(p, '2026-10-12', '2027-05-31');
    expect(reclasificaciones(p)).toEqual([]);

    // "No": la pregunta se va y el saldo a favor se queda sin sumar al dinero libre.
    const q = preparar('2026-10-11');
    const oro2 = q.tarjeta('tarj_banamex_8812', { saldo: 0 });
    registrarCompraMsi(q.ctx, { tarjetaId: oro2, monto: 300_000, meses: 3 });
    registrarMovimiento(q.ctx, { tipo: 'pago_tarjeta', monto: 100_000, origenId: q.bbva, destinoId: oro2 });
    noEraParaLiquidar(q.ctx, oro2);
    expect(obtenerHoy(q.ctx).tarjetasAccion.some((t) => t.tipo === 'liquidar_msi')).toBe(false);
    expect(obtenerHoy(q.ctx).desglose.tarjetas_saldo_completo).toBe(0);

    // E4-07 con la semilla e4-01 y una Oro con $12,000 a favor.
    const s = abrirPrueba();
    cargarEscenario(s.ctx, escenario('e4-01'));
    const f = tarjetaFixture<TarjetaFixture>('tarj_banamex_8812');
    const oro3 = agregarTarjetaCredito(s.ctx, { nombre: f.nombre, ...tarjetaDe(f), saldo: 0 }).cuentaId;
    corregirSaldoTarjeta(s.ctx, oro3, -1_200_000);
    const v = vector<VectorE4>('E4-07');
    const h = obtenerHoy(s.ctx);
    expect(h.desglose).toEqual(v.esperado.desglose);
    expect(h.libre).toBe(v.esperado.libre);
    expect(h.hoyPuedesCentavos).toBe(v.esperado.hoy_puedes_centavos);
  });

  it('CA-M4-11 · la cobertura automática reproduce E3-30 a E3-36 con movimientos reales del libro', () => {
    for (const id of ['E3-30', 'E3-31', 'E3-32', 'E3-33', 'E3-34', 'E3-35', 'E3-36']) {
      const v = vector<VectorCobertura>(id);
      const p = preparar('2026-10-11');
      const cuentaMov = v.movimiento.cuenta.startsWith('tarj_') ? p.tarjeta(v.movimiento.cuenta) : p.bbva;
      let programadoId: string;
      if (v.ocurrencia.tipo === 'ingreso') {
        programadoId = configurarIngreso(p.ctx, {
          monto: v.ocurrencia.monto,
          regla: { tipo: 'mensual', dia: Number(v.ocurrencia.fecha.slice(8)) },
        });
      } else {
        programadoId = agregarPagoFijo(p.ctx, {
          concepto: v.ocurrencia.comercio ?? v.ocurrencia.categoria ?? 'pago',
          monto: v.ocurrencia.monto,
          regla: { tipo: 'unica', fecha: v.ocurrencia.fecha },
          categoria: v.ocurrencia.categoria ?? null,
          variable: v.ocurrencia.variable ?? false,
        });
      }
      obtenerHoy(p.ctx); // materializa
      const r =
        v.movimiento.sentido === 'entrada'
          ? registrarMovimiento(p.ctx, {
              tipo: 'ingreso',
              monto: v.movimiento.monto,
              fecha: v.movimiento.fecha,
              categoria: 'sueldo',
              destinoId: cuentaMov,
            })
          : registrarMovimiento(p.ctx, {
              tipo: 'gasto',
              monto: v.movimiento.monto,
              fecha: v.movimiento.fecha,
              categoria: v.movimiento.categoria ?? 'entretenimiento',
              ...(v.movimiento.comercio ? { comercio: v.movimiento.comercio } : {}),
              origenId: cuentaMov,
            });
      const o = listarOcurrencias(p.ctx, { programadoId }).find((x) => x.fecha === v.ocurrencia.fecha);
      const decision = r.cobertura?.decision ?? 'no';
      expect({ id, decision }).toEqual({
        id,
        decision: { cubrir: 'cubierta', preguntar: 'preguntar', no: 'no' }[v.esperado],
      });
      expect({ id, estado: o?.estado }).toEqual({
        id,
        estado: v.esperado === 'cubrir' ? 'cubierta' : 'pendiente',
      });
      const preguntas = obtenerHoy(p.ctx).tarjetasAccion.filter((t) => t.tipo === 'confirmar_cobertura');
      expect({ id, preguntas: preguntas.length }).toEqual({
        id,
        preguntas: v.esperado === 'preguntar' ? 1 : 0,
      });
      if (v.esperado === 'preguntar') {
        // Renta fija con monto distinto: pregunta; al confirmar, queda cubierta y E4 deja de reservarla.
        expect(preguntas[0]).toMatchObject({
          pregunta: '¿Este pago fue la vivienda?',
          montoProgramado: 450_000,
          montoMovimiento: 470_000,
        });
        confirmarCobertura(p.ctx, { programadoId, fecha: v.ocurrencia.fecha });
        expect(listarOcurrencias(p.ctx, { programadoId })[0]?.estado).toBe('cubierta');
        expect(obtenerHoy(p.ctx).tarjetasAccion.some((t) => t.tipo === 'confirmar_cobertura')).toBe(false);
      }
      expect(p.ctx.libro.comprobarIntegridad()).toEqual([]);
    }
  });

  it('CA-M4-12 · tarjeta en modo plan: con pagos planeados E4 reserva solo los del horizonte; sin ellos, la deuda completa (E4-08)', () => {
    const p = abrirPrueba();
    cargarEscenario(p.ctx, escenario('e4-01'));
    const bbva = listarTarjetas(p.ctx).length; // solo Nu
    expect(bbva).toBe(1);
    const f = tarjetaFixture<TarjetaFixture>('tarj_bbva_1022');
    const azul = agregarTarjetaCredito(p.ctx, {
      nombre: f.nombre,
      ...tarjetaDe(f),
      modo: 'plan',
      saldo: 900_000,
    }).cuentaId;
    const v = vector<VectorE4>('E4-08');
    const sin = obtenerHoy(p.ctx);
    expect(sin.desglose).toEqual(v.esperado.desglose);
    expect(sin.libre).toBe(v.esperado.libre);
    expect(sin.reservado).toBe(v.esperado.reservado);

    // Pagos planeados de $1,500 cada día 13: E4 reserva solo el del 13 oct (dentro del horizonte al 15).
    const origen = listarMovimientos(p.ctx).length; // sin movimientos todavía
    expect(origen).toBe(0);
    const cuentaBbva = p.ctx.db.select().from(cuenta).where(eq(cuenta.nombre, 'BBVA Débito ••5521')).get()
      ?.id as string;
    agregarPagoPlaneado(p.ctx, {
      tarjetaId: azul,
      monto: 150_000,
      regla: { tipo: 'mensual', dia: 13 },
      cuentaId: cuentaBbva,
    });
    const con = obtenerHoy(p.ctx);
    expect(con.desglose).toEqual({
      ...v.esperado.desglose,
      tarjetas_saldo_completo: 200_000,
      tarjetas_pagos_planeados: 150_000,
    });
    expect(con.reservadoDetalle).toContainEqual({
      tipo: 'tarjeta',
      concepto: f.nombre,
      monto: 150_000,
      fecha: '2026-10-13',
    });

    // Al pagar, el pago cubre su ocurrencia (E3.5: la "categoría" es la tarjeta) y deja de reservarse.
    p.reloj.fijar('2026-10-13');
    const pago = registrarMovimiento(p.ctx, {
      tipo: 'pago_tarjeta',
      monto: 150_000,
      origenId: cuentaBbva,
      destinoId: azul,
    });
    expect(pago.cobertura).toMatchObject({ decision: 'cubierta', fecha: '2026-10-13' });
    expect(obtenerHoy(p.ctx).desglose.tarjetas_pagos_planeados).toBe(0);
    // Una tarjeta totalera no acepta pagos planeados.
    const nu = listarTarjetas(p.ctx).find((t) => t.modo === 'totalero')?.id as string;
    expect(() =>
      agregarPagoPlaneado(p.ctx, { tarjetaId: nu, monto: 100, regla: { tipo: 'mensual', dia: 1 } }),
    ).toThrow(expect.objectContaining({ codigo: 'tarjeta_totalera' }));
  });

  it('configurar tarjeta por voz (K01) y por formulario: el ciclo nuevo solo aplica a cortes posteriores', () => {
    const p = preparar('2026-10-11');
    const nu = p.tarjeta('tarj_nu_4410', { alias: ['nu'] });
    const r = configurarCicloPorVoz(p.ctx, {
      tipo: 'tarjeta_ciclo',
      alias: 'nu',
      dia_corte: 20,
      dias_para_pagar: 20,
    });
    expect(r).toMatchObject({
      resultado: 'tarjeta_configurada',
      editada: { ciclo: { diaCorte: 20, diasParaPagar: 20 } },
    });
    expect(tarjetaPorId(p.ctx, nu).ciclo).toEqual({ diaCorte: 20, diasParaPagar: 20 });
    if (r.resultado !== 'tarjeta_configurada' || !r.editada.deshacer) throw new Error('sin deshacer');
    deshacer(p.ctx, r.editada.deshacer);
    expect(tarjetaPorId(p.ctx, nu).ciclo).toEqual({ diaCorte: 28, diaLimitePago: 18 });
    expect(
      configurarCicloPorVoz(p.ctx, {
        tipo: 'tarjeta_ciclo',
        alias: 'azul',
        dia_corte: 5,
        dia_limite_pago: 25,
      }),
    ).toMatchObject({
      resultado: 'tarjeta_por_agregar',
      prellenado: { alias: 'azul', diaCorte: 5, diaLimitePago: 25 },
    });

    // Cambio de corte con cortes ya cerrados: no se vuelve a cerrar ningún periodo.
    p.reloj.fijar('2026-11-15');
    procesarApertura(p.ctx);
    expect(cortesCerrados(p, nu)).toEqual(['2026-10-28']);
    editarTarjeta(p.ctx, nu, { diaCorte: 5 });
    p.reloj.fijar('2026-12-06');
    procesarApertura(p.ctx);
    expect(cortesCerrados(p, nu)).toEqual(['2026-10-28', '2026-12-05']);
  });
});
