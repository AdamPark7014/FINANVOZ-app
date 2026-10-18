import { describe, expect, it } from 'vitest';
import { esquema } from '@cartera/datos';
import { eq } from 'drizzle-orm';
import type { PlainDate, Regla } from '@cartera/core';
import { aceptarConsentimiento } from '../privacidad/consentimiento';
import { deshacer } from './formulario';
import { calcularLibre, obtenerHoy } from './hoy';
import { listarOcurrencias } from './ocurrencias';
import { agregarCuenta, configurarIngreso } from './onboarding';
import { registrarTexto } from './registrar';
import {
  aportarTanda,
  archivarTanda,
  cobrarTanda,
  crearTanda,
  detalleTanda,
  editarTanda,
  listarTandas,
  proponerTanda,
  reglaDeFrecuencia,
  todaviaNoCobroTanda,
} from './tandas';
import { programadoPorId } from './programados';
import { abrirPrueba, golden, vector } from './__pruebas__/base';
import { nubeFalsa } from './__pruebas__/nube';

interface RondaVector {
  t: number;
  fecha: PlainDate;
  aportado: number;
  recibido: number;
  posicion: number;
  en_riesgo: number;
  por_aportar: number;
}

interface VectorE11 {
  aportacion: number;
  participantes: number;
  turno: number;
  regla: Regla;
  inicio: PlainDate;
  hoy?: PlainDate;
  esperado: unknown;
}

interface ExistenteVector {
  aportaciones_hechas: number;
  ya_cobro: boolean;
  saldo_inicial: number;
  ocurrencias_omitidas: PlainDate[];
  ocurrencias_pendientes: PlainDate[];
  fecha_cobro: PlainDate;
}

const entradaDe = (v: VectorE11) => ({
  nombre: 'Tanda de la oficina',
  aportacion: v.aportacion,
  participantes: v.participantes,
  turno: v.turno,
  regla: v.regla,
  inicio: v.inicio,
});

/** Base con consentimiento, BBVA con $10,000, efectivo con $1,000 y la quincena el día 1 de cada mes. */
function preparar(hoy: PlainDate) {
  const p = abrirPrueba(hoy);
  aceptarConsentimiento(p.ctx, { datosFinancieros: true });
  const bbva = agregarCuenta(p.ctx, { subtipo: 'debito', nombre: 'BBVA', saldo: 1_000_000 });
  const efectivo = agregarCuenta(p.ctx, { subtipo: 'efectivo', nombre: 'Cartera', saldo: 100_000 });
  const ingreso = configurarIngreso(p.ctx, {
    monto: 1_500_000,
    regla: { tipo: 'mensual', dia: 1 },
    cuentaId: bbva,
  });
  return { ...p, bbva, efectivo, ingreso };
}

function tiposDe(p: ReturnType<typeof preparar>, transaccionId: string) {
  const tx = p.ctx.db
    .select()
    .from(esquema.transaccion)
    .where(eq(esquema.transaccion.id, transaccionId))
    .get();
  return { tipo: tx?.tipo, asientos: p.ctx.libro.obtener(transaccionId)?.asientos ?? [] };
}

describe('tandas (M8, E11)', () => {
  it('CA-M8-03 · E11-01 con reloj del 16 oct: las 10 rondas del vector, la 4 marcada como cobro y 10 aportaciones', () => {
    const v = vector<VectorE11>('E11-01');
    const esperado = v.esperado as RondaVector[];
    const p = preparar('2026-10-16');

    const propuesta = proponerTanda(p.ctx, entradaDe(v));
    expect(propuesta.rondas).toEqual(esperado.map((r) => r.fecha));
    expect(propuesta.fechaCobro).toBe(esperado[v.turno - 1]?.fecha);
    expect(propuesta.cobro).toBe(v.aportacion * v.participantes);
    expect(propuesta.yaEmpezo).toBeNull();

    const { tandaId, programadoId, cuentaId } = crearTanda(p.ctx, entradaDe(v));
    const d = detalleTanda(p.ctx, tandaId);
    expect(d.rondas.map((r) => r.fecha)).toEqual(esperado.map((r) => r.fecha));
    expect(d.rondas.filter((r) => r.esCobro).map((r) => r.t)).toEqual([4]);
    expect(d.fechaCobro).toBe('2026-11-06');
    expect(d.rondas.map((r) => r.enRiesgo)).toEqual(esperado.map((r) => r.en_riesgo));
    expect(d.rondas.map((r) => r.porAportar)).toEqual(esperado.map((r) => r.por_aportar));

    const aportaciones = listarOcurrencias(p.ctx, { programadoId });
    expect(aportaciones).toHaveLength(10);
    expect(aportaciones.map((o) => o.fecha)).toEqual(esperado.map((r) => r.fecha));
    expect(aportaciones.every((o) => o.estado === 'pendiente' && o.monto === v.aportacion)).toBe(true);
    expect(aportaciones.every((o) => o.tipo === 'egreso' && o.categoriaCuentaId === cuentaId)).toBe(true);
    // Sin movimientos todavía: nada aportado ni en riesgo, y la cuenta de la tanda es contraparte:tanda.
    expect(d).toMatchObject({ aportado: 0, recibido: 0, posicion: 0, enRiesgo: 0, porAportar: 500_000 });
    const cuenta = p.ctx.db.select().from(esquema.cuenta).where(eq(esquema.cuenta.id, cuentaId)).get();
    expect(cuenta).toMatchObject({
      naturaleza: 'contraparte',
      subtipo: 'tanda',
      nombre: 'Tanda de la oficina',
    });
    expect(listarTandas(p.ctx).map((t) => t.id)).toEqual([tandaId]);
  });

  it('CA-M8-05 · el dinero en riesgo después de cada ronda coincide con en_riesgo de E11-01', () => {
    const v = vector<VectorE11>('E11-01');
    const esperado = v.esperado as RondaVector[];
    const p = preparar('2026-10-16');
    const { tandaId } = crearTanda(p.ctx, { ...entradaDe(v), cuentaId: p.bbva });
    for (const r of esperado) {
      p.reloj.fijar(r.fecha);
      aportarTanda(p.ctx, { tandaId, fecha: r.fecha });
      if (r.t === v.turno) cobrarTanda(p.ctx, { tandaId, cuentaId: p.bbva });
      const d = detalleTanda(p.ctx, tandaId);
      expect(
        {
          aportado: d.aportado,
          recibido: d.recibido,
          posicion: d.posicion,
          en_riesgo: d.enRiesgo,
          por_aportar: d.porAportar,
        },
        `ronda ${r.t}`,
      ).toEqual({
        aportado: r.aportado,
        recibido: r.recibido,
        posicion: r.posicion,
        en_riesgo: r.en_riesgo,
        por_aportar: r.por_aportar,
      });
      expect(d.aportacionesHechas).toBe(r.t);
      // El saldo de la cuenta de la tanda es la posición de E11.
      expect(p.ctx.libro.saldo(d.cuentaId)).toBe(r.posicion);
    }
    expect(detalleTanda(p.ctx, tandaId).rondas.every((r) => r.estado === 'cubierta')).toBe(true);
  });

  it('CA-M8-04 · Hoy aparta las aportaciones del horizonte; "Ya la di" registra aportacion_tanda y cubre; "Me tocó la tanda" es cobro_tanda sin ingreso y la tanda no entra en deudas_personas', () => {
    const v = vector<VectorE11>('E11-01');
    const p = preparar('2026-10-16');
    const { tandaId, programadoId, cuentaId } = crearTanda(p.ctx, entradaDe(v));

    // Horizonte hasta el 1 nov: se apartan las rondas del 16, 23 y 30 de octubre; la del 6 nov no.
    const antes = obtenerHoy(p.ctx);
    expect(antes.finEfectivo).toBe('2026-11-01');
    const apartadas = antes.reservadoDetalle.filter((r) => r.concepto === 'Tanda de la oficina');
    expect(apartadas.map((r) => [r.fecha, r.monto])).toEqual([
      ['2026-10-16', 50_000],
      ['2026-10-23', 50_000],
      ['2026-10-30', 50_000],
    ]);
    expect(antes.desglose.compromisos).toBe(150_000);

    // El día que toca: "¿Ya diste tu tanda?" (Ya la di · Todavía no), no la genérica "¿Ya pagaste…?".
    const tarjeta = antes.tarjetasAccion.find((t) => t.tipo === 'tanda_aportacion');
    expect(tarjeta).toMatchObject({
      tandaId,
      programadoId,
      fecha: '2026-10-16',
      cuando: 'hoy',
      pregunta: '¿Ya diste tu tanda?',
      opciones: ['ya_la_di', 'todavia_no'],
    });
    expect(antes.tarjetasAccion.some((t) => t.tipo === 'compromiso_vencido')).toBe(false);

    // Sin cuenta elegida, "Ya la di" pregunta de dónde salió.
    expect(() => aportarTanda(p.ctx, { tandaId, fecha: '2026-10-16' })).toThrow(/cuenta/);
    const dada = aportarTanda(p.ctx, { tandaId, fecha: '2026-10-16', cuentaId: p.efectivo });
    const aporte = tiposDe(p, dada.transaccionId);
    expect(aporte.tipo).toBe('aportacion_tanda');
    expect(aporte.asientos.map((a) => [a.cuentaId, a.monto]).sort()).toEqual(
      [
        [cuentaId, 50_000],
        [p.efectivo, -50_000],
      ].sort(),
    );
    const cubierta = listarOcurrencias(p.ctx, { programadoId }).find((o) => o.fecha === '2026-10-16');
    expect(cubierta).toMatchObject({ estado: 'cubierta', transaccionId: dada.transaccionId });
    const despues = obtenerHoy(p.ctx);
    expect(despues.desglose.compromisos).toBe(100_000);
    expect(despues.liquidez).toBe(antes.liquidez - 50_000);
    // Aportar no es gasto: el libre no cambia (sale de L y deja de apartarse).
    expect(despues.libre).toBe(antes.libre);
    expect(despues.tarjetasAccion.some((t) => t.tipo === 'tanda_aportacion')).toBe(false);

    // Deshacer devuelve la ronda a pendiente.
    deshacer(p.ctx, dada.deshacer);
    expect(listarOcurrencias(p.ctx, { programadoId }).find((o) => o.fecha === '2026-10-16')?.estado).toBe(
      'pendiente',
    );
    aportarTanda(p.ctx, { tandaId, fecha: '2026-10-16', cuentaId: p.efectivo });

    // Tu turno (6 nov): "Me tocó la tanda" registra cobro_tanda; no es ingreso ni mueve el horizonte.
    for (const fecha of ['2026-10-23', '2026-10-30'] as const) {
      p.reloj.fijar(fecha);
      aportarTanda(p.ctx, { tandaId, fecha, cuentaId: p.bbva });
    }
    p.reloj.fijar('2026-11-06');
    const enTurno = obtenerHoy(p.ctx);
    expect(enTurno.tarjetasAccion.find((t) => t.tipo === 'tanda_cobro')).toMatchObject({
      tandaId,
      fecha: '2026-11-06',
      monto: 500_000,
      pregunta: 'Hoy te toca cobrar tu tanda.',
      opciones: ['me_toco', 'todavia_no'],
    });
    todaviaNoCobroTanda(p.ctx, tandaId);
    expect(obtenerHoy(p.ctx).tarjetasAccion.some((t) => t.tipo === 'tanda_cobro')).toBe(false);

    const finAntes = obtenerHoy(p.ctx).finEfectivo;
    aportarTanda(p.ctx, { tandaId, fecha: '2026-11-06', cuentaId: p.bbva });
    const cobro = cobrarTanda(p.ctx, { tandaId, cuentaId: p.bbva });
    const c = tiposDe(p, cobro.transaccionId);
    expect(c.tipo).toBe('cobro_tanda');
    expect(c.asientos.map((a) => [a.cuentaId, a.monto]).sort()).toEqual(
      [
        [p.bbva, 500_000],
        [cuentaId, -500_000],
      ].sort(),
    );
    const conCobro = obtenerHoy(p.ctx);
    expect(conCobro.finEfectivo).toBe(finAntes);
    expect(listarOcurrencias(p.ctx, { programadoId: p.ingreso }).every((o) => o.estado === 'pendiente')).toBe(
      true,
    );
    expect(conCobro.tarjetasAccion.some((t) => t.tipo === 'tanda_cobro')).toBe(false);

    // Saldo negativo de la tanda (debes 6 aportaciones): no entra en deudas_personas; sus aportaciones ya son
    // compromisos.
    expect(p.ctx.libro.saldo(cuentaId)).toBe(-300_000);
    const libre = calcularLibre(p.ctx);
    expect(libre.deudas).toEqual([]);
    expect(libre.r.desglose.deudas_personas).toBe(0);
    expect(conCobro.reservadoDetalle.some((r) => r.tipo === 'persona')).toBe(false);
  });

  it('CA-M8-06 · E11-03 (empezó el 4 sep) con reloj del 11 oct: propone 6 hechas y "ya cobraste", saldo −$2,000, 6 omitidas y 4 pendientes; E4 aparta solo las del horizonte', () => {
    const v = vector<VectorE11>('E11-03');
    const e = v.esperado as ExistenteVector;
    const p = preparar(v.hoy as PlainDate);

    const propuesta = proponerTanda(p.ctx, entradaDe(v));
    expect(propuesta.yaEmpezo).toEqual({
      aportacionesHechas: e.aportaciones_hechas,
      yaCobraste: e.ya_cobro,
      saldoInicial: e.saldo_inicial,
      faltan: 4,
      porAportar: 200_000,
    });
    expect(propuesta.fechaCobro).toBe(e.fecha_cobro);

    const { tandaId, programadoId, cuentaId } = crearTanda(p.ctx, entradaDe(v));
    // Caso 23b: saldo_inicial capital:saldos_iniciales +2,000 / contraparte:tanda −2,000.
    expect(p.ctx.libro.saldo(cuentaId)).toBe(e.saldo_inicial);
    const inicial = p.ctx.db
      .select()
      .from(esquema.transaccion)
      .where(eq(esquema.transaccion.tipo, 'saldo_inicial'))
      .all()
      .filter((t) => p.ctx.libro.obtener(t.id)?.asientos.some((a) => a.cuentaId === cuentaId));
    expect(inicial).toHaveLength(1);

    const ocurrencias = listarOcurrencias(p.ctx, { programadoId });
    expect(ocurrencias.filter((o) => o.estado === 'omitida').map((o) => o.fecha)).toEqual(
      e.ocurrencias_omitidas,
    );
    expect(ocurrencias.filter((o) => o.estado === 'pendiente').map((o) => o.fecha)).toEqual(
      e.ocurrencias_pendientes,
    );
    expect(ocurrencias.map((o) => o.fecha)).toEqual([...e.ocurrencias_omitidas, ...e.ocurrencias_pendientes]);
    expect(e.ocurrencias_pendientes).toEqual(['2026-10-16', '2026-10-23', '2026-10-30', '2026-11-06']);

    // Detalle: "Llevas 6 aportaciones y ya cobraste: te faltan 4 ($2,000)".
    expect(detalleTanda(p.ctx, tandaId)).toMatchObject({
      aportacionesHechas: 6,
      cobrada: true,
      posicion: -200_000,
      enRiesgo: 0,
      porAportar: 200_000,
    });

    // Horizonte hasta el 1 nov: aparta 16, 23 y 30 de octubre; ni las omitidas ni la del 6 nov.
    const hoy = obtenerHoy(p.ctx);
    expect(hoy.finEfectivo).toBe('2026-11-01');
    expect(
      hoy.reservadoDetalle.filter((r) => r.concepto === 'Tanda de la oficina').map((r) => r.fecha),
    ).toEqual(['2026-10-16', '2026-10-23', '2026-10-30']);
    expect(hoy.desglose.deudas_personas).toBe(0);
    // Ya cobraste: no hay tarjeta de cobro ni de rondas vencidas.
    expect(hoy.tarjetasAccion.some((t) => t.tipo === 'tanda_cobro' || t.tipo === 'tanda_aportacion')).toBe(
      false,
    );
  });

  it('una tanda que ya empezó con la corrección de la persona: 5 hechas y sin cobrar deja la sexta vencida', () => {
    const v = vector<VectorE11>('E11-03');
    const p = preparar(v.hoy as PlainDate);
    const { tandaId, programadoId, cuentaId } = crearTanda(p.ctx, {
      ...entradaDe(v),
      aportacionesHechas: 5,
      yaCobraste: false,
    });
    expect(p.ctx.libro.saldo(cuentaId)).toBe(250_000);
    const ocurrencias = listarOcurrencias(p.ctx, { programadoId });
    expect(ocurrencias.filter((o) => o.estado === 'omitida')).toHaveLength(5);
    expect(ocurrencias.find((o) => o.fecha === '2026-10-09')?.estado).toBe('pendiente');
    const tarjetas = obtenerHoy(p.ctx).tarjetasAccion;
    expect(tarjetas[0]).toMatchObject({ tipo: 'tanda_aportacion', fecha: '2026-10-09', cuando: 'vencida' });
    // El turno (25 sep) ya pasó y no registró el cobro: pregunta "Me tocó la tanda".
    expect(tarjetas[1]).toMatchObject({
      tipo: 'tanda_cobro',
      pregunta: 'Te tocaba cobrar tu tanda el vie 25.',
    });
    expect(detalleTanda(p.ctx, tandaId)).toMatchObject({ enRiesgo: 250_000, cobrada: false });
  });

  it('archivar: activa=0, programado inactivo, pendientes omitidas; el detalle y el libro siguen', () => {
    const v = vector<VectorE11>('E11-01');
    const p = preparar('2026-10-16');
    const { tandaId, programadoId, cuentaId } = crearTanda(p.ctx, { ...entradaDe(v), cuentaId: p.bbva });
    aportarTanda(p.ctx, { tandaId, fecha: '2026-10-16', cuentaId: p.efectivo });
    const antes = obtenerHoy(p.ctx);
    expect(antes.desglose.compromisos).toBe(100_000);

    archivarTanda(p.ctx, tandaId);
    expect(listarTandas(p.ctx)).toEqual([]);
    expect(detalleTanda(p.ctx, tandaId)).toMatchObject({
      activa: false,
      aportado: 50_000,
      nombre: 'Tanda de la oficina',
    });
    expect(p.ctx.db.select().from(esquema.tanda).where(eq(esquema.tanda.id, tandaId)).get()?.activa).toBe(0);
    expect(programadoPorId(p.ctx, programadoId).activo).toBeFalsy();
    const dArchivada = detalleTanda(p.ctx, tandaId);
    expect(dArchivada.rondas.find((r) => r.fecha === '2026-10-16')?.estado).toBe('cubierta');
    expect(dArchivada.rondas.filter((r) => r.estado === 'pendiente')).toEqual([]);
    expect(dArchivada.rondas.filter((r) => r.estado === 'omitida').map((r) => r.fecha)).toEqual([
      '2026-10-23',
      '2026-10-30',
      '2026-11-06',
      '2026-11-13',
      '2026-11-20',
      '2026-11-27',
      '2026-12-04',
      '2026-12-11',
      '2026-12-18',
    ]);
    expect(obtenerHoy(p.ctx).desglose.compromisos).toBe(0);
    expect(p.ctx.libro.saldo(cuentaId)).toBe(50_000);
    expect(() => aportarTanda(p.ctx, { tandaId, fecha: '2026-10-23', cuentaId: p.bbva })).toThrow(/archivada/);
  });

  it('editar: cambia nombre y cuenta de aportación, no el monto', () => {
    const v = vector<VectorE11>('E11-01');
    const p = preparar('2026-10-16');
    const { tandaId, programadoId, cuentaId } = crearTanda(p.ctx, { ...entradaDe(v), cuentaId: p.bbva });
    editarTanda(p.ctx, tandaId, { nombre: 'Tanda del gym', cuentaId: p.efectivo });
    expect(detalleTanda(p.ctx, tandaId)).toMatchObject({
      nombre: 'Tanda del gym',
      aportacion: v.aportacion,
      cuentaOrigenId: p.efectivo,
    });
    expect(programadoPorId(p.ctx, programadoId)).toMatchObject({
      concepto: 'Tanda del gym',
      monto: v.aportacion,
      cuentaId: p.efectivo,
    });
    expect(p.ctx.db.select().from(esquema.cuenta).where(eq(esquema.cuenta.id, cuentaId)).get()?.nombre).toBe(
      'Tanda del gym',
    );
    archivarTanda(p.ctx, tandaId);
    expect(() => editarTanda(p.ctx, tandaId, { nombre: 'Otra' })).toThrow(/archivada/);
  });

  it('valida la entrada: turno dentro de los participantes, cuenta líquida y regla válida', () => {
    const v = vector<VectorE11>('E11-01');
    const p = preparar('2026-10-16');
    expect(() => crearTanda(p.ctx, { ...entradaDe(v), turno: 11 })).toThrow(/tanda/);
    expect(() => crearTanda(p.ctx, { ...entradaDe(v), participantes: 1, turno: 1 })).toThrow(/tanda/);
    expect(() =>
      crearTanda(p.ctx, { ...entradaDe(v), regla: { tipo: 'cada_rato' } as unknown as Regla }),
    ).toThrow();
    expect(listarTandas(p.ctx)).toEqual([]);
    expect(reglaDeFrecuencia('semanal', '2026-10-16')).toEqual({ tipo: 'semanal', dia_semana: 5 });
    expect(reglaDeFrecuencia('mensual', '2026-10-16')).toEqual({ tipo: 'mensual', dia: 16 });
    expect(reglaDeFrecuencia('catorcenal', '2026-10-16')).toEqual({
      tipo: 'catorcenal',
      ancla: '2026-10-16',
    });
    expect(reglaDeFrecuencia('quincenal', '2026-10-16')).toEqual({ tipo: 'quincenal_15_ultimo' });
  });
});

describe('tandas por voz', () => {
  it('TK01 · "entré a una tanda de 500 cada quincena, somos 10 y me toca el cuarto" propone la tanda sin guardar nada', async () => {
    const p = preparar('2026-10-11');
    const caso = golden('TK01');
    const f = nubeFalsa({ [caso.texto]: caso.esperado });
    const r = await registrarTexto(p.ctx, caso.texto, 'voz', { nube: f.nube });
    if (r.resultado !== 'tanda_por_crear') throw new Error(r.resultado);
    expect(r.propuesta).toMatchObject({
      aportacion: 50_000,
      participantes: 10,
      turno: 4,
      regla: { tipo: 'quincenal_15_ultimo' },
      // Sin primera fecha: la siguiente quincena desde la frase.
      inicio: '2026-10-15',
      cobro: 500_000,
      yaEmpezo: null,
    });
    expect(r.propuesta.rondas).toHaveLength(10);
    expect(r.propuesta.fechaCobro).toBe(r.propuesta.rondas[3]);
    expect(listarTandas(p.ctx)).toEqual([]);
  });

  it('TK02 · "ya me tocó la tanda, me dieron 5 mil en efectivo" con una tanda registra cobro_tanda (no ingreso)', async () => {
    const p = preparar('2026-10-11');
    const v = vector<VectorE11>('E11-03');
    const { cuentaId } = crearTanda(p.ctx, { ...entradaDe(v), aportacionesHechas: 3, yaCobraste: false });
    const caso = golden('TK02');
    const f = nubeFalsa({ [caso.texto]: caso.esperado });
    const r = await registrarTexto(p.ctx, caso.texto, 'voz', { nube: f.nube });
    if (r.resultado !== 'registrado_tanda') throw new Error(r.resultado);
    expect(r.tipo).toBe('cobro_tanda');
    expect(r.movimiento).toMatchObject({ monto: 500_000, cuenta: 'Cartera', tanda: 'Tanda de la oficina' });
    expect(tiposDe(p, r.movimiento.transaccionId).tipo).toBe('cobro_tanda');
    expect(p.ctx.libro.saldo(cuentaId)).toBe(150_000 - 500_000);
    expect(p.ctx.libro.saldo(p.efectivo)).toBe(100_000 + 500_000);
  });

  it('TK02 sin tandas no adivina: no lo registra', async () => {
    const p = preparar('2026-10-11');
    const caso = golden('TK02');
    const f = nubeFalsa({ [caso.texto]: caso.esperado });
    const r = await registrarTexto(p.ctx, caso.texto, 'voz', { nube: f.nube });
    expect(r).toEqual({ resultado: 'no_soportado', motivo: 'tipo_movimiento' });
  });

  it('TK02 con varias tandas abre confirmación en lugar de registrar directo', async () => {
    const p = preparar('2026-10-11');
    const v = vector<VectorE11>('E11-01');
    crearTanda(p.ctx, { ...entradaDe(v), nombre: 'Tanda A' });
    crearTanda(p.ctx, {
      ...entradaDe(v),
      nombre: 'Tanda B',
      inicio: '2026-11-01',
    });
    const caso = golden('TK02');
    const f = nubeFalsa({ [caso.texto]: caso.esperado });
    const r = await registrarTexto(p.ctx, caso.texto, 'voz', { nube: f.nube });
    expect(r).toMatchObject({
      resultado: 'confirmar_tanda',
      motivo: 'tanda',
      propuesta: {
        tipo: 'cobro_tanda',
        monto: 500_000,
        tandaId: null,
        tandas: [
          { nombre: 'Tanda A' },
          { nombre: 'Tanda B' },
        ],
        cuentaId: p.efectivo,
      },
    });
  });
});
