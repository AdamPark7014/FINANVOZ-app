import { describe, expect, it } from 'vitest';
import {
  compararEscenarios,
  construirCuentaDividida,
  construirReembolso,
  distribuirMayorResiduo,
  ErrorDominio,
  generarEscenarios,
  sumarDias,
  type DiaHistorial,
  type Escenario,
  type PlainDate,
  type Programado,
  type Regla,
  type TarjetaRecomendable,
} from '@cartera/core';
import { CUENTAS_SISTEMA, idCategoria } from '@cartera/datos';
import { confirmarArqueo } from './arqueo';
import { ejecutarPorBloques, simularPorBloques } from './bloques';
import { anularMovimiento, registrarMovimiento } from './formulario';
import { historialSimulacion, inicioUso, marcarExtraordinaria } from './historial';
import { calcularLibre, obtenerHoy } from './hoy';
import {
  construirVistaMeAlcanza,
  loCompre,
  meAlcanza,
  nombreCortoTarjeta,
  TEXTO_SIN_TARJETA_PARA_MSI,
  type DatosVistaMeAlcanza,
} from './me-alcanza';
import { listarPlanesMsi, registrarCompraMsi } from './msi';
import { confirmarIngresoRecibido, listarOcurrencias, yaLaPague } from './ocurrencias';
import { crearPersona } from './personas';
import { borrarAjuste } from './preferencias';
import {
  leerProbabilidadHoy,
  MENSAJE_DATOS_INSUFICIENTES,
  obtenerCalibracion,
  obtenerProbabilidadHoy,
} from './probabilidad';
import { registrarTexto } from './registrar';
import { cargarEscenario, type EscenarioCargado } from './semilla';
import { abrirPrueba, escenario, vector, type Prueba } from './__pruebas__/base';
import { nubeFalsa } from './__pruebas__/nube';
import { procesarApertura } from './apertura';

/** En pruebas no hace falta ceder el hilo de verdad. */
const sinEspera = { ceder: () => Promise.resolve() };

interface TarjetaVector {
  id: string;
  nombre: string;
  modo: 'totalero' | 'plan';
  dia_corte: number;
  dias_para_pagar?: number;
  dia_limite_pago?: number;
  limite_credito: number;
  saldo_revolvente: number;
  msi_no_facturado: number;
}

function aTarjeta(t: TarjetaVector): TarjetaRecomendable {
  return {
    id: t.id,
    modo: t.modo,
    diaCorte: t.dia_corte,
    ...(t.dias_para_pagar !== undefined ? { diasParaPagar: t.dias_para_pagar } : {}),
    ...(t.dia_limite_pago !== undefined ? { diaLimitePago: t.dia_limite_pago } : {}),
    limiteCredito: t.limite_credito,
    saldoRevolvente: t.saldo_revolvente,
    msiNoFacturado: t.msi_no_facturado,
  };
}

const paraVista = (t: TarjetaVector) => ({ id: t.id, nombre: t.nombre, ciclo: aTarjeta(t) });

interface VectorE822 {
  entrada: {
    hoy: PlainDate;
    excedente_inicial: number;
    regla_ingreso: Regla;
    monto_ingreso: number;
    programados: Programado[];
    recibidas: PlainDate[];
    tarjetas: TarjetaVector[];
    historial: DiaHistorial[];
    escenarios: Escenario[];
    semilla: number;
  };
  esperado: Record<string, unknown>;
}

interface VectorE823 {
  id: string;
  precio: number;
  meses: number | null;
  fecha_compra: PlainDate | null;
  hoy: PlainDate;
  proximo_ingreso: PlainDate;
  tarjetas: TarjetaVector[];
  esperado: { escenarios: Escenario[]; nota: string | null };
}

/** e4-01 (hoy dom 11 oct; saldos del 10, primer día de uso el 11) con el reloj en `hoy`. */
function e401(): Prueba & { e: EscenarioCargado; efectivo: string; bbva: string; nu: string } {
  const p = abrirPrueba();
  const e = cargarEscenario(p.ctx, escenario('e4-01'));
  p.reloj.fijar(e.hoy);
  return {
    ...p,
    e,
    efectivo: e.cuentas['efectivo'] as string,
    bbva: e.cuentas['bbva'] as string,
    nu: e.cuentas['nu'] as string,
  };
}

/** Un gasto diario de $30 en efectivo en `[desde, hasta)`. */
function gastosDiarios(p: ReturnType<typeof e401>, desde: PlainDate, hasta: PlainDate, monto = 3_000) {
  for (let f = desde; f < hasta; f = sumarDias(f, 1)) {
    registrarMovimiento(p.ctx, {
      tipo: 'gasto',
      categoria: 'antojos',
      origenId: p.efectivo,
      monto,
      fecha: f,
    });
  }
}

describe('CA-M6-04 · constructor de historial sobre el libro', () => {
  it('excluye transferencias, pagos de tarjeta, MSI, coberturas, extraordinarias, anuladas y reversas; incluye días en 0', () => {
    const p = e401();
    expect(inicioUso(p.ctx)).toBe('2026-10-11');
    procesarApertura(p.ctx);
    const gasto = (fecha: PlainDate, monto: number, origenId = p.efectivo) =>
      registrarMovimiento(p.ctx, { tipo: 'gasto', categoria: 'antojos', origenId, monto, fecha });

    gasto('2026-10-12', 10_000); // cuenta
    registrarMovimiento(p.ctx, {
      tipo: 'transferencia',
      origenId: p.efectivo,
      destinoId: p.bbva,
      monto: 5_000,
      fecha: '2026-10-13',
    });
    p.reloj.fijar('2026-10-13');
    const tanda = listarOcurrencias(p.ctx).find((o) => o.concepto === 'tanda');
    if (!tanda) throw new Error('falta la tanda');
    yaLaPague(p.ctx, tanda); // cubre una ocurrencia: ya es compromiso
    registrarMovimiento(p.ctx, {
      tipo: 'pago_tarjeta',
      origenId: p.bbva,
      destinoId: p.nu,
      monto: 20_000,
      fecha: '2026-10-14',
    });
    p.reloj.fijar('2026-10-15');
    registrarCompraMsi(p.ctx, { tarjetaId: p.nu, monto: 300_000, meses: 3, categoria: 'tecnologia' });
    const extra = gasto('2026-10-16', 900_000, p.nu);
    marcarExtraordinaria(p.ctx, extra.transaccionId, true);
    marcarExtraordinaria(p.ctx, extra.transaccionId, true); // idempotente
    const anulado = gasto('2026-10-17', 7_000);
    anularMovimiento(p.ctx, anulado.transaccionId); // anulada + reversa
    const amigo = crearPersona(p.ctx, { nombre: 'Juan' });
    const dividida = construirCuentaDividida({
      categoria: idCategoria('comida_fuera'),
      personas: [amigo],
      pago: p.bbva,
      total: 120_000,
    });
    p.ctx.libro.registrar({
      tipo: dividida.tipo,
      fecha: '2026-10-19',
      origen: 'manual',
      claveIdempotencia: 'prueba:dividida',
      asientos: dividida.asientos,
    });
    gasto('2026-10-20', 5_000);
    const reembolso = construirReembolso({ destino: p.nu, contra: idCategoria('antojos'), monto: 3_000 });
    p.ctx.libro.registrar({
      tipo: reembolso.tipo,
      fecha: '2026-10-20',
      origen: 'manual',
      claveIdempotencia: 'prueba:reembolso',
      asientos: reembolso.asientos,
    });
    // Primer arqueo el 22: faltan $140 → se reparten en los 7 días que terminan el 22.
    p.reloj.fijar('2026-10-22');
    const arqueo = confirmarArqueo(p.ctx, { efectivoReal: 30_000 });
    expect(arqueo.calculo.hueco).toBe(14_000);

    p.reloj.fijar('2026-10-26');
    const h = historialSimulacion(p.ctx);
    const reparto = distribuirMayorResiduo(14_000, [1, 1, 1, 1, 1, 1, 1]);
    const arq = (f: PlainDate) => {
      const i = [
        '2026-10-16',
        '2026-10-17',
        '2026-10-18',
        '2026-10-19',
        '2026-10-20',
        '2026-10-21',
        '2026-10-22',
      ].indexOf(f);
      return i < 0 ? 0 : (reparto[i] as number);
    };
    const esperado: Record<PlainDate, number> = {
      '2026-10-11': 0,
      '2026-10-12': 10_000,
      '2026-10-13': 0,
      '2026-10-14': 0,
      '2026-10-15': 0,
      '2026-10-16': arq('2026-10-16'),
      '2026-10-17': arq('2026-10-17'),
      '2026-10-18': arq('2026-10-18'),
      '2026-10-19': 60_000 + arq('2026-10-19'),
      '2026-10-20': 5_000 - 3_000 + arq('2026-10-20'),
      '2026-10-21': arq('2026-10-21'),
      '2026-10-22': arq('2026-10-22'),
      '2026-10-23': 0,
      '2026-10-24': 0,
      '2026-10-25': 0,
    };
    expect(Object.fromEntries(h.historial.map((d) => [d.fecha, d.consumo]))).toEqual(esperado);
    expect(h.historial.map((d) => d.clase)).toEqual([
      'finde',
      'habil',
      'habil',
      'habil',
      'habil',
      'habil',
      'finde',
      'finde',
      'habil',
      'habil',
      'habil',
      'habil',
      'habil',
      'finde',
      'finde',
    ]);
    expect(h.hoyEsDiaDePago).toBe(false);

    // Desmarcar la extraordinaria la devuelve al historial.
    marcarExtraordinaria(p.ctx, extra.transaccionId, false);
    const con = historialSimulacion(p.ctx).historial.find((d) => d.fecha === '2026-10-16');
    expect(con?.consumo).toBe(900_000 + arq('2026-10-16'));
    expect(() => marcarExtraordinaria(p.ctx, 'no-existe', true)).toThrow(ErrorDominio);
    expect(p.ctx.libro.comprobarIntegridad()).toEqual([]);
  });

  it('el día de pago recibido usa la clase "pago"; sin datos el inicio de uso es hoy', () => {
    const vacio = abrirPrueba('2026-10-11');
    expect(inicioUso(vacio.ctx)).toBe('2026-10-11');
    const p = e401();
    p.reloj.fijar('2026-10-15');
    obtenerHoy(p.ctx);
    confirmarIngresoRecibido(p.ctx, {
      programadoId: p.e.ingresoId as string,
      fecha: '2026-10-15',
      destinoId: p.bbva,
    });
    expect(historialSimulacion(p.ctx).hoyEsDiaDePago).toBe(true);
    p.reloj.fijar('2026-10-16');
    expect(historialSimulacion(p.ctx).historial.find((d) => d.fecha === '2026-10-15')?.clase).toBe('pago');
  });
});

describe('CA-M6-05 · estados de datos de Hoy', () => {
  it('con 13 días: "Necesito 2 semanas…"; con 20: "estimación inicial"; con 42: sin etiqueta', async () => {
    const p = e401();
    gastosDiarios(p, '2026-10-11', '2026-11-25');
    p.reloj.fijar('2026-10-24');
    expect(historialSimulacion(p.ctx).historial).toHaveLength(13);
    const trece = await obtenerProbabilidadHoy(p.ctx, sinEspera);
    expect(trece).toEqual({
      estado: 'datos_insuficientes',
      diasHistorial: 13,
      mensaje: MENSAJE_DATOS_INSUFICIENTES,
    });
    expect(MENSAJE_DATOS_INSUFICIENTES).toBe('Necesito 2 semanas de tus gastos para estimar si llegas.');
    expect(leerProbabilidadHoy(p.ctx)).toEqual(trece);

    p.reloj.fijar('2026-10-31');
    const veinte = await obtenerProbabilidadHoy(p.ctx, sinEspera);
    if (veinte.estado !== 'ok') throw new Error('se esperaba probabilidad');
    expect(veinte.diasHistorial).toBe(20);
    expect(veinte.etiqueta).toBe('estimación inicial');
    expect(veinte.texto).toBe(`${veinte.porcentaje} de llegar sin tocar tu colchón`);

    p.reloj.fijar('2026-11-22');
    const normal = await obtenerProbabilidadHoy(p.ctx, sinEspera);
    expect(normal).toMatchObject({ estado: 'ok', diasHistorial: 42, etiqueta: null });
  });

  it('sin ingreso configurado no hay probabilidad', async () => {
    const p = abrirPrueba();
    const e = cargarEscenario(p.ctx, { ...(escenario('e4-01') as object), ingreso: undefined });
    p.reloj.fijar(e.hoy);
    expect(await obtenerProbabilidadHoy(p.ctx, sinEspera)).toEqual({ estado: 'sin_ingreso' });
    expect(leerProbabilidadHoy(p.ctx)).toEqual({ estado: 'sin_ingreso' });
  });
});

describe('CA-M6-06 · la probabilidad no cambia al volver a abrir Hoy el mismo día', () => {
  it('misma semilla del día y caché: el segundo cálculo es idéntico y no se repite', async () => {
    const p = e401();
    gastosDiarios(p, '2026-10-11', '2026-10-31');
    p.reloj.fijar('2026-10-31');
    expect(leerProbabilidadHoy(p.ctx)).toBeNull();
    const progreso: number[] = [];
    const primera = await obtenerProbabilidadHoy(p.ctx, {
      ...sinEspera,
      alProgreso: (h) => progreso.push(h),
    });
    if (primera.estado !== 'ok') throw new Error('se esperaba probabilidad');
    expect(primera.desdeCache).toBe(false);
    expect(primera.n).toBe(10_000);
    expect(progreso).toEqual([1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000]);

    obtenerHoy(p.ctx); // abrir Hoy no cambia nada
    const segunda = await obtenerProbabilidadHoy(p.ctx, {
      ...sinEspera,
      alProgreso: () => progreso.push(-1),
    });
    expect(segunda).toEqual({ ...primera, desdeCache: true });
    expect(progreso).not.toContain(-1);
    expect(leerProbabilidadHoy(p.ctx)).toEqual(segunda);

    // Sin caché, la semilla del día da exactamente lo mismo.
    borrarAjuste(p.ctx, 'probabilidad_hoy');
    expect(await obtenerProbabilidadHoy(p.ctx, sinEspera)).toEqual(primera);

    // Si el libro cambia, se recalcula con los datos nuevos.
    registrarMovimiento(p.ctx, { tipo: 'gasto', categoria: 'antojos', origenId: p.efectivo, monto: 50_000 });
    const trasGasto = await obtenerProbabilidadHoy(p.ctx, sinEspera);
    expect(trasGasto).toMatchObject({ desdeCache: false });
  });

  it('se puede cancelar y el cálculo por bloques da lo mismo que de una vez', async () => {
    const p = e401();
    gastosDiarios(p, '2026-10-11', '2026-10-31');
    p.reloj.fijar('2026-10-31');
    await expect(
      obtenerProbabilidadHoy(p.ctx, { ...sinEspera, senal: { aborted: true } }),
    ).rejects.toMatchObject({
      codigo: 'calculo_cancelado',
    });
    const v = vector<{ entrada: Parameters<typeof simularPorBloques>[0]; esperado: unknown }>('E8-03');
    let cesiones = 0;
    const r = await simularPorBloques(v.entrada, {
      tamanoBloque: 777,
      ceder: () => {
        cesiones++;
        return Promise.resolve();
      },
    });
    expect(r).toEqual(v.esperado);
    expect(cesiones).toBe(Math.ceil(10_000 / 777) - 1);
    // Con el setTimeout real también termina (y cede el hilo).
    expect(await simularPorBloques(v.entrada, { tamanoBloque: 5000 })).toEqual(v.esperado);
    await expect(
      ejecutarPorBloques(
        { total: 1, hechas: () => 0, avanzar: () => true, resultado: () => 1 },
        { tamanoBloque: 0 },
      ),
    ).rejects.toThrow(ErrorDominio);
  });
});

describe('CA-M6-07 · calibración con reloj inyectado', () => {
  it('guarda la predicción al iniciar el horizonte, el resultado al cerrarlo y calcula el Brier', async () => {
    const p = e401();
    const ingreso = p.e.ingresoId as string;
    gastosDiarios(p, '2026-10-11', '2026-11-14');
    for (const fecha of ['2026-10-15', '2026-10-30']) {
      p.reloj.fijar(fecha);
      obtenerHoy(p.ctx);
      confirmarIngresoRecibido(p.ctx, { programadoId: ingreso, fecha, destinoId: p.bbva });
    }
    p.reloj.fijar('2026-10-31');
    const inicio = await obtenerProbabilidadHoy(p.ctx, sinEspera);
    if (inicio.estado !== 'ok') throw new Error('se esperaba probabilidad');
    const c0 = obtenerCalibracion(p.ctx);
    expect(c0).toMatchObject({ cerradas: 0, abiertas: 1, brier: null, objetivo: 0.2 });
    expect(c0.predicciones).toEqual([
      {
        inicio: '2026-10-31',
        fin: '2026-11-13',
        probabilidadBp: Math.floor((2 * inicio.exitos * 10000 + inicio.n) / (2 * inicio.n)),
        resultado: null,
      },
    ]);

    // A media quincena se observa el excedente; la predicción no cambia.
    p.reloj.fijar('2026-11-05');
    await obtenerProbabilidadHoy(p.ctx, sinEspera);
    const libreObservado = calcularLibre(p.ctx).r.libre;
    expect(obtenerCalibracion(p.ctx).predicciones).toHaveLength(1);

    // Llega la quincena del 13: el horizonte se cierra con E_final = el último excedente observado.
    p.reloj.fijar('2026-11-13');
    obtenerHoy(p.ctx);
    confirmarIngresoRecibido(p.ctx, { programadoId: ingreso, fecha: '2026-11-13', destinoId: p.bbva });
    await obtenerProbabilidadHoy(p.ctx, sinEspera);
    const c1 = obtenerCalibracion(p.ctx);
    const resultado = libreObservado >= 0;
    const pPred = (c0.predicciones[0]?.probabilidadBp ?? 0) / 10000;
    expect(c1.cerradas).toBe(1);
    expect(c1.abiertas).toBe(1);
    expect(c1.predicciones[0]).toMatchObject({ fin: '2026-11-13', resultado });
    expect(c1.predicciones[1]).toMatchObject({ inicio: '2026-11-13', fin: '2026-11-30', resultado: null });
    expect(c1.brier).toBeCloseTo((pPred - (resultado ? 1 : 0)) ** 2, 12);
  });
});

describe('CA-M6-03 · vista de "¿Me alcanza?" con el resultado de E8-22', () => {
  it('muestra "< 1 %", "89 %", "79 %" y "90 %" y "Puedes. Lo más seguro: a 3 MSI con la Oro"', () => {
    const v = vector<VectorE822>('E8-22');
    const tarjetas = v.entrada.tarjetas.map(aTarjeta);
    const calculado = compararEscenarios({ ...v.entrada, tarjetas });
    if (calculado.estado !== 'ok') throw new Error('estado inesperado');
    // Se inyecta el resultado del vector (con los horizontes que usó el motor para "cómo lo calculé").
    const resultado = {
      ...(v.esperado as Omit<typeof calculado, 'horizontes' | 'estado'>),
      estado: 'ok' as const,
      horizontes: calculado.horizontes,
    };
    const datos: DatosVistaMeAlcanza = {
      consulta: { precio: 150_000, descripcion: 'unos tenis' },
      hoy: v.entrada.hoy,
      proximoIngreso: { fecha: '2026-10-15', concepto: 'quincena' },
      tarjetas: v.entrada.tarjetas.map(paraVista),
      generados: { nota: null, uso_bp: 400 },
      resultado,
      diasHistorial: v.entrada.historial.length,
      historialDesde: v.entrada.historial[0]?.fecha ?? null,
    };
    const vista = construirVistaMeAlcanza(datos);
    expect(vista.titulo).toBe('Unos tenis de $1,500');
    expect(vista.frase).toBe('Puedes. Lo más seguro: a 3 MSI con la Oro');
    expect(vista.fraseCompleta).toBe('Puedes. Lo más seguro: a 3 MSI con la Oro (89 %)');
    expect(vista.nivel).toBe('puedes');
    expect(vista.escenarios.map((e) => [e.etiqueta, e.porcentaje, e.detalle])).toEqual([
      ['Hoy, de contado', '< 1 %', 'Te quedas corto antes del jueves'],
      ['A 3 MSI con la Oro', '89 %', 'Comprometes $500 al mes hasta enero'],
      ['El jue 15, con tu quincena', '79 %', 'Lo pagas con tu quincena, sin deuda nueva'],
      ['Sin comprarlos', '90 %', null],
    ]);
    expect(vista.recomendado).toMatchObject({ tipo: 'msi', recomendado: true, porcentaje: '89 %' });
    expect(vista.escenarios.filter((e) => e.recomendado)).toHaveLength(1);
    expect(vista.notas).toEqual([]);
    expect(vista.etiqueta).toBeNull(); // 92 días de historial
    expect(vista.recordatorio).toEqual({ fecha: '2026-10-15', texto: 'Recuérdamelo el jueves' });
    expect(vista.comoLoCalcule).toMatchObject({
      desde: '2026-10-11',
      hasta: '2027-02-15',
      diasVentana: 127,
      simulaciones: 5000,
      diasHistorial: 92,
      excedenteInicial: 85_600,
    });
    expect(vista.comoLoCalcule.ingresos).toHaveLength(8);
    expect(vista.comoLoCalcule.lineas).toEqual([
      'Revisé 127 días, del 11 oct al 14 feb, para que todas las opciones incluyan sus pagos.',
      'Hice 5,000 simulaciones por opción con tus últimos 92 días de gastos.',
      'Supuse 8 ingresos de $6,500 y $23,912 en pagos fijos, tarjetas y meses.',
      'Todas las opciones usan los mismos días simulados: la diferencia se debe solo a la compra.',
    ]);
  });

  it('frases de "ajustado" y "no alcanza", y nombres cortos de tarjeta', () => {
    const v = vector<VectorE822>('E8-22');
    const tarjetas = v.entrada.tarjetas.map(aTarjeta);
    const base = {
      consulta: { precio: 150_000 },
      hoy: v.entrada.hoy,
      proximoIngreso: null,
      tarjetas: v.entrada.tarjetas.map(paraVista),
      generados: { nota: null, uso_bp: null },
      diasHistorial: 20,
      historialDesde: null,
    };
    const ajustado = compararEscenarios({ ...v.entrada, tarjetas, excedente_inicial: 40_000 });
    const pobre = compararEscenarios({ ...v.entrada, tarjetas, excedente_inicial: -500_000 });
    if (ajustado.estado !== 'ok' || pobre.estado !== 'ok') throw new Error('estado inesperado');
    const va = construirVistaMeAlcanza({ ...base, resultado: ajustado });
    const vp = construirVistaMeAlcanza({ ...base, resultado: pobre });
    expect(va.titulo).toBe('Una compra de $1,500');
    expect(va.etiqueta).toBe('estimación inicial');
    expect(va.escenarios.find((e) => e.tipo === 'base')?.etiqueta).toBe('Sin comprar');
    // Entre "puedes" (85,600 → 89 %) y "no alcanza" hay excedentes que dejan la mejor opción entre 50 y 79 %.
    const niveles = [80_000, 75_000, 70_000, 65_000, 60_000, 55_000, 50_000].map((e0) => {
      const r = compararEscenarios({ ...v.entrada, tarjetas, excedente_inicial: e0 });
      if (r.estado !== 'ok') throw new Error('estado inesperado');
      return construirVistaMeAlcanza({ ...base, resultado: r });
    });
    const justa = niveles.find((x) => x.nivel === 'ajustado');
    expect(justa?.frase.startsWith('Es posible, pero ajustado. Lo más seguro: ')).toBe(true);
    expect(vp.nivel).toBe('no_alcanza');
    expect(vp.frase.startsWith('No te alcanza sin tocar tu colchón. La opción menos riesgosa: ')).toBe(true);
    expect(vp.escenarios.find((e) => e.tipo === 'contado_hoy')?.detalle).toBe(
      'Te quedas corto antes de tu próximo ingreso',
    );
    expect(vp.recordatorio).toMatchObject({ fecha: '2026-10-15' });
    expect(vp.escenarios.find((e) => e.tipo === 'esperar')?.etiqueta).toBe('El jue 15');

    expect(nombreCortoTarjeta('Banamex Oro ••8812')).toBe('la Oro');
    expect(nombreCortoTarjeta('Nu ••4410')).toBe('la Nu');
    expect(nombreCortoTarjeta('BBVA Azul ••1022')).toBe('la Azul');
    expect(nombreCortoTarjeta('Costco')).toBe('la Costco');
  });
});

describe('CA-M6-08 · E8-23 en la vista: escenarios y notas con el texto de 02 §9', () => {
  const v22 = vector<VectorE822>('E8-22');
  const casos = ['E8-23a', 'E8-23b', 'E8-23c', 'E8-23d', 'E8-23e'].map((id) => vector<VectorE823>(id));
  const notasEsperadas: Record<string, string[]> = {
    'E8-23a': [],
    'E8-23b': ['Con la Oro quedarías en 44 % de uso.'],
    'E8-23c': [],
    'E8-23d': ['Con la Oro quedarías en 31 % de uso.'],
    'E8-23e': [TEXTO_SIN_TARJETA_PARA_MSI],
  };

  for (const c of casos) {
    it(`${c.id}: escenarios del vector y notas en pantalla`, () => {
      const tarjetas = c.tarjetas.map(aTarjeta);
      const g = generarEscenarios(
        c.precio,
        c.hoy,
        c.proximo_ingreso,
        tarjetas,
        c.meses ?? undefined,
        c.fecha_compra ?? undefined,
      );
      expect({ escenarios: g.escenarios, nota: g.nota }).toEqual(c.esperado);
      const resultado = compararEscenarios({ ...v22.entrada, tarjetas, escenarios: g.escenarios });
      if (resultado.estado !== 'ok') throw new Error('estado inesperado');
      const vista = construirVistaMeAlcanza({
        consulta: {
          precio: c.precio,
          ...(c.meses ? { meses: c.meses } : {}),
          ...(c.fecha_compra ? { fecha: c.fecha_compra } : {}),
        },
        hoy: c.hoy,
        proximoIngreso: { fecha: c.proximo_ingreso, concepto: 'quincena' },
        tarjetas: c.tarjetas.map(paraVista),
        generados: g,
        resultado,
        diasHistorial: 92,
        historialDesde: null,
      });
      expect(vista.escenarios.map((e) => e.tipo).sort()).toEqual(
        c.esperado.escenarios.map((e) => e.tipo).sort(),
      );
      expect(vista.notas.map((n) => n.texto)).toEqual(notasEsperadas[c.id]);
      expect(vista.notas.map((n) => n.tipo)).toEqual(c.esperado.nota ? [c.esperado.nota] : []);
    });
  }

  it('el texto de sin_tarjeta_para_msi es el de 02 §9', () => {
    expect(TEXTO_SIN_TARJETA_PARA_MSI).toBe(
      'No muestro meses: ninguna de tus tarjetas que pagas completa tiene crédito disponible para esta compra.',
    );
  });
});

describe('meAlcanza sobre el libro', () => {
  function conHistorial() {
    const p = e401();
    gastosDiarios(p, '2026-10-11', '2026-10-31');
    for (const fecha of ['2026-10-15', '2026-10-30']) {
      p.reloj.fijar(fecha);
      obtenerHoy(p.ctx);
      confirmarIngresoRecibido(p.ctx, { programadoId: p.e.ingresoId as string, fecha, destinoId: p.bbva });
    }
    p.reloj.fijar('2026-10-31');
    return p;
  }

  it('unos tenis de $1,500 con la Nu: cuatro escenarios con la semilla del día, deterministas', async () => {
    const p = conHistorial();
    const progreso: [number, number][] = [];
    const vista = await meAlcanza(
      p.ctx,
      { precio: 150_000, descripcion: 'unos tenis' },
      { ...sinEspera, tamanoBloque: 5000, alProgreso: (h, t) => progreso.push([h, t]) },
    );
    if (vista.estado !== 'ok') throw new Error('se esperaba resultado');
    expect(vista.titulo).toBe('Unos tenis de $1,500');
    expect(vista.escenarios.map((e) => e.tipo)).toEqual(['contado_hoy', 'msi', 'esperar', 'base']);
    expect(vista.escenarios[1]?.etiqueta).toBe('A 3 MSI con la Nu');
    expect(vista.escenarios[2]?.etiqueta).toBe('El vie 13, con tu quincena');
    expect(vista.etiqueta).toBe('estimación inicial');
    expect(vista.comoLoCalcule.diasHistorial).toBe(20);
    expect(progreso.at(-1)?.[0]).toBe(progreso.at(-1)?.[1]);
    expect(vista.frase).toMatch(
      /^(Puedes\. Lo más seguro|Es posible, pero ajustado\. Lo más seguro|No te alcanza sin tocar tu colchón\. La opción menos riesgosa): /,
    );
    // Mismo día, mismo libro: mismo resultado.
    expect(await meAlcanza(p.ctx, { precio: 150_000, descripcion: 'unos tenis' }, sinEspera)).toEqual(vista);
  });

  it('sin crédito disponible: sin escenario MSI y la nota sin_tarjeta_para_msi', async () => {
    const p = conHistorial();
    const vista = await meAlcanza(
      p.ctx,
      { precio: 2_000_000, descripcion: 'una moto', meses: 12 },
      sinEspera,
    );
    if (vista.estado !== 'ok') throw new Error('se esperaba resultado');
    expect(vista.escenarios.some((e) => e.tipo === 'msi')).toBe(false);
    expect(vista.notas).toEqual([{ tipo: 'sin_tarjeta_para_msi', texto: TEXTO_SIN_TARJETA_PARA_MSI }]);
    expect(vista.escenarios.find((e) => e.tipo === 'base')?.etiqueta).toBe('Sin comprarla');
  });

  it('con menos de 14 días pide 2 semanas; una consulta inválida es un error', async () => {
    const p = e401();
    expect(await meAlcanza(p.ctx, { precio: 150_000 }, sinEspera)).toEqual({
      estado: 'datos_insuficientes',
      titulo: 'Una compra de $1,500',
      diasHistorial: 0,
      mensaje: MENSAJE_DATOS_INSUFICIENTES,
    });
    await expect(meAlcanza(p.ctx, { precio: 0 }, sinEspera)).rejects.toMatchObject({
      codigo: 'consulta_invalida',
    });
  });

  it('"Lo compré": a meses crea el plan; de contado registra el gasto; "sin comprar" no registra nada', async () => {
    const p = conHistorial();
    const vista = await meAlcanza(p.ctx, { precio: 150_000, descripcion: 'unos tenis' }, sinEspera);
    if (vista.estado !== 'ok') throw new Error('se esperaba resultado');
    const msi = vista.escenarios.find((e) => e.tipo === 'msi')?.escenario;
    const contado = vista.escenarios.find((e) => e.tipo === 'contado_hoy')?.escenario;
    if (msi?.tipo !== 'msi' || contado?.tipo !== 'contado_hoy') throw new Error('faltan escenarios');

    const r = loCompre(p.ctx, { escenario: msi, descripcion: 'unos tenis' }, { categoria: 'ropa' });
    expect(r.tipo).toBe('msi');
    const planes = listarPlanesMsi(p.ctx, p.nu);
    expect(planes).toHaveLength(1);
    expect(planes[0]).toMatchObject({ monto: 150_000, meses: 3 });

    const saldoAntes = p.ctx.libro.saldo(p.efectivo);
    const g = loCompre(p.ctx, { escenario: contado }, { origenId: p.efectivo });
    expect(g.tipo).toBe('gasto');
    expect(p.ctx.libro.saldo(p.efectivo)).toBe(saldoAntes - 150_000);
    const sinMetodo = loCompre(p.ctx, {
      escenario: { tipo: 'esperar', precio: 10_000, fecha: '2026-11-13' },
    });
    expect(sinMetodo.tipo).toBe('gasto');
    expect(p.ctx.libro.saldo(CUENTAS_SISTEMA.porAsignar)).toBe(-10_000);
    expect(() => loCompre(p.ctx, { escenario: { tipo: 'base' } as never })).toThrow(ErrorDominio);
    expect(p.ctx.libro.comprobarIntegridad()).toEqual([]);
  });

  it('"¿me alcanza para…?" dictado: registrarTexto lleva la intención simular a "¿Me alcanza?"', async () => {
    const p = conHistorial();
    const frase = 'me alcanza para unos tenis de 1500 a 3 meses';
    const nube = nubeFalsa({
      [frase]: {
        intencion: 'simular',
        compra: { precio: 150_000, descripcion: 'unos tenis', meses: 3 },
      },
    });
    const r = await registrarTexto(p.ctx, frase, 'voz', { nube: nube.nube });
    expect(r).toEqual({
      resultado: 'me_alcanza',
      consulta: { precio: 150_000, descripcion: 'unos tenis', meses: 3 },
    });
    if (r.resultado !== 'me_alcanza') throw new Error('resultado inesperado');
    const vista = await meAlcanza(p.ctx, r.consulta, sinEspera);
    expect(vista).toMatchObject({ estado: 'ok', titulo: 'Unos tenis de $1,500' });
  });
});
