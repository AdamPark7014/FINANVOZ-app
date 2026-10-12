import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { CUENTAS_SISTEMA, esquema } from '@cartera/datos';
import { aceptarConsentimiento } from '../privacidad/consentimiento';
import { historialMovimiento } from './correcciones';
import { deshacer } from './deshacer';
import { obtenerHoy } from './hoy';
import { listarMovimientos } from './movimientos';
import { contextoNube } from './nube';
import { listarOcurrencias } from './ocurrencias';
import { agregarCuenta, agregarTarjetaCredito, configurarIngreso } from './onboarding';
import { programadosActivos } from './programados';
import { sincronizarPlan } from './plan';
import { leerAjuste } from './preferencias';
import {
  aplicarEleccion,
  contarEsperandoConexion,
  listarPorInterpretar,
  procesarPorInterpretar,
  registrarTexto,
  revisarPorInterpretar,
} from './registrar';
import { abrirPrueba, golden } from './__pruebas__/base';
import { nubeFalsa } from './__pruebas__/nube';
import { z } from 'zod';

const HOY = '2026-10-11';

const TACOS_Y_COCA = 'me eché unos tacos de 80 con la Nu y una coca de 25 en efectivo';
const TACOS_EN_EFECTIVO = 'no, los tacos fueron en efectivo';

/** Lo que devolvería el proxy para cada frase (mismas reglas que el golden set: X01, G04, C01). */
const RESPUESTAS: Record<string, unknown> = {
  [TACOS_Y_COCA]: {
    intencion: 'registrar',
    movimientos: [
      {
        tipo: 'gasto',
        monto: 8000,
        fecha: HOY,
        descripcion: 'tacos',
        categoria: 'comida_fuera',
        origen: { tipo: 'credito', alias: 'nu' },
      },
      {
        tipo: 'gasto',
        monto: 2500,
        fecha: HOY,
        descripcion: 'coca',
        categoria: 'antojos',
        origen: { tipo: 'efectivo' },
      },
    ],
  },
  [TACOS_EN_EFECTIVO]: {
    intencion: 'corregir',
    objetivo: { texto: 'tacos' },
    cambios: { origen: { tipo: 'efectivo' } },
  },
  'me pagaron 2,000': {
    intencion: 'registrar',
    movimientos: [{ tipo: 'ingreso', monto: 200_000, fecha: HOY, destino: { tipo: 'desconocido' } }],
  },
};
for (const id of ['K06', 'C04', 'C06']) RESPUESTAS[golden(id).texto] = golden(id).esperado;

function conCuentas(hoy = HOY) {
  const p = abrirPrueba(hoy);
  aceptarConsentimiento(p.ctx, { datosFinancieros: true });
  const efectivo = agregarCuenta(p.ctx, { subtipo: 'efectivo', nombre: 'Cartera', saldo: 64_000 });
  const bbva = agregarCuenta(p.ctx, { subtipo: 'debito', nombre: 'BBVA', saldo: 359_000, alias: ['nomina'] });
  const nu = agregarTarjetaCredito(p.ctx, {
    nombre: 'Nu',
    alias: ['morada'],
    diaCorte: 28,
    diaLimitePago: 18,
    limiteCredito: 1_500_000,
    modo: 'totalero',
    saldo: 200_000,
  }).cuentaId;
  const f = nubeFalsa({ ...RESPUESTAS });
  return { ...p, efectivo, bbva, nu, ...f };
}

describe('nivel 2 · nube', () => {
  it('CA-M3-02 · "tacos de 80 con la Nu y una coca de 25 en efectivo" registra 2 movimientos correctos', async () => {
    const p = conCuentas();
    const r = await registrarTexto(p.ctx, TACOS_Y_COCA, 'voz', { nube: p.nube });
    if (r.resultado !== 'registrado') throw new Error(r.resultado);
    expect(r.movimientos).toEqual([
      expect.objectContaining({ descripcion: 'tacos', monto: 8000, categoria: 'Comida fuera', cuenta: 'Nu' }),
      expect.objectContaining({ descripcion: 'coca', monto: 2500, categoria: 'Antojos', cuenta: 'Cartera' }),
    ]);
    expect(p.ctx.libro.saldo(p.nu)).toBe(-200_000 - 8_000);
    expect(p.ctx.libro.saldo(p.efectivo)).toBe(64_000 - 2_500);
    expect(p.ctx.libro.comprobarIntegridad()).toEqual([]);
    // Al proxy viaja el contexto mínimo: sin ids ni saldos (06 §4).
    const enviado = JSON.stringify(p.recibidas[0]?.contexto);
    expect(enviado).not.toMatch(/id-0|64000|200000|359000/);
    expect(p.recibidas[0]?.contexto).toMatchObject({ fecha_referencia: HOY, dia_semana: 'domingo' });
    // "Deshacer" anula los dos.
    deshacer(p.ctx, r.deshacer);
    expect(p.ctx.libro.saldo(p.nu)).toBe(-200_000);
    expect(p.ctx.libro.saldo(p.efectivo)).toBe(64_000);
  });

  it('CA-M3-03 · "no, los tacos fueron en efectivo" reemplaza el movimiento y el historial muestra el cambio', async () => {
    const p = conCuentas();
    await registrarTexto(p.ctx, TACOS_Y_COCA, 'voz', { nube: p.nube });
    const r = await registrarTexto(p.ctx, TACOS_EN_EFECTIVO, 'voz', { nube: p.nube });
    if (r.resultado !== 'corregido') throw new Error(r.resultado);
    expect(r.antes).toMatchObject({ descripcion: 'tacos', monto: 8000, cuenta: 'Nu' });
    expect(r.despues).toMatchObject({
      descripcion: 'tacos',
      monto: 8000,
      cuenta: 'Cartera',
      categoria: 'Comida fuera',
    });
    // La deuda de Nu vuelve a su valor y el efectivo baja $80.
    expect(p.ctx.libro.saldo(p.nu)).toBe(-200_000);
    expect(p.ctx.libro.saldo(p.efectivo)).toBe(64_000 - 2_500 - 8_000);
    expect(p.ctx.libro.comprobarIntegridad()).toEqual([]);

    // El libro no se editó: la original está anulada con su espejo y la nueva la reemplaza.
    const original = p.ctx.libro.obtener(r.antes.transaccionId);
    const nueva = p.ctx.libro.obtener(r.despues.transaccionId);
    expect(original?.reemplazaA).toBeNull();
    expect(nueva).toMatchObject({ reemplazaA: r.antes.transaccionId, origen: 'voz' });

    const movimientos = listarMovimientos(p.ctx).flatMap((d) => d.movimientos);
    expect(movimientos).toHaveLength(2);
    const tacos = movimientos.find((m) => m.descripcion === 'tacos');
    expect(tacos).toMatchObject({
      saleDe: ['Cartera'],
      insignias: ['corregido'],
      reemplazaA: r.antes.transaccionId,
    });
    expect(historialMovimiento(p.ctx, tacos?.id as string)).toEqual([
      expect.objectContaining({ transaccionId: r.antes.transaccionId, cuenta: 'Nu', monto: 8000 }),
    ]);

    // "Deshacer" regresa los tacos a la Nu (otra transacción nueva, nunca un UPDATE).
    deshacer(p.ctx, r.deshacer);
    expect(p.ctx.libro.saldo(p.nu)).toBe(-208_000);
    expect(p.ctx.libro.saldo(p.efectivo)).toBe(64_000 - 2_500);
    expect(p.ctx.libro.comprobarIntegridad()).toEqual([]);
  });

  it('CA-M3-08 · "la renta son 6,500 cada día primero" crea el programado mensual y sus ocurrencias', async () => {
    const p = conCuentas();
    const k06 = golden('K06');
    const r = await registrarTexto(p.ctx, k06.texto, 'voz', { nube: p.nube });
    if (r.resultado !== 'configurado') throw new Error(r.resultado);
    expect(r.compromiso).toMatchObject({ concepto: 'Vivienda', monto: 650_000, proxima: '2026-11-01' });
    const [renta] = programadosActivos(p.ctx);
    expect(renta).toMatchObject({
      tipo: 'egreso',
      monto: 650_000,
      regla: { tipo: 'mensual', dia: 1 },
      desde: HOY,
    });
    expect(listarOcurrencias(p.ctx, { programadoId: renta?.id as string }).map((o) => o.fecha)).toEqual([
      '2026-11-01',
      '2026-12-01',
      '2027-01-01',
    ]);
    // Deshacer lo desactiva y quita sus ocurrencias.
    deshacer(p.ctx, r.compromiso.deshacer);
    expect(programadosActivos(p.ctx)).toEqual([]);
  });

  it('CA-M3-08 · "me pagaron 2,000" sin destino queda en entradas por asignar y no sube el "hoy puedes"', async () => {
    const p = conCuentas();
    configurarIngreso(p.ctx, { monto: 800_000, regla: { tipo: 'quincenal_15_ultimo' } });
    const antes = obtenerHoy(p.ctx).libre;
    const r = await registrarTexto(p.ctx, 'me pagaron 2,000', 'voz', { nube: p.nube });
    if (r.resultado !== 'registrado') throw new Error(r.resultado);
    expect(r.movimientos[0]).toMatchObject({ tipo: 'ingreso', monto: 200_000, porAsignar: true });
    expect(p.ctx.libro.saldo(CUENTAS_SISTEMA.porAsignarEntradas)).toBe(200_000);
    expect(obtenerHoy(p.ctx).libre).toBe(antes);
  });

  it('anular por voz ("borra lo del cine") con Deshacer', async () => {
    const p = conCuentas();
    const cine = await registrarTexto(p.ctx, 'cine 150 en efectivo');
    expect(cine.resultado).toBe('registrado');
    const r = await registrarTexto(p.ctx, golden('C04').texto, 'voz', { nube: p.nube });
    if (r.resultado !== 'anulado') throw new Error(r.resultado);
    expect(r.movimiento).toMatchObject({ monto: 15_000, categoria: 'Entretenimiento' });
    expect(listarMovimientos(p.ctx)).toEqual([]);
    expect(p.ctx.libro.saldo(p.efectivo)).toBe(64_000);
    deshacer(p.ctx, r.deshacer);
    expect(p.ctx.libro.saldo(p.efectivo)).toBe(64_000 - 15_000);
    // Sin coincidencias: "No encontré ese movimiento".
    expect(await registrarTexto(p.ctx, golden('C04').texto, 'voz', { nube: p.nube })).toMatchObject({
      resultado: 'anulado',
    });
    expect(await registrarTexto(p.ctx, golden('C04').texto, 'voz', { nube: p.nube })).toEqual({
      resultado: 'no_encontrado',
      accion: 'anular',
    });
  });

  it('revisar duplicados por voz agrupa los movimientos iguales; elegir uno lo anula', async () => {
    const p = conCuentas();
    await registrarTexto(p.ctx, 'gasolina 500 en efectivo');
    await registrarTexto(p.ctx, 'gasolina 500 en efectivo');
    await registrarTexto(p.ctx, 'gasolina 300 en efectivo');
    const r = await registrarTexto(p.ctx, golden('C06').texto, 'voz', { nube: p.nube });
    if (r.resultado !== 'duplicados') throw new Error(r.resultado);
    expect(r.grupos).toHaveLength(1);
    expect(r.grupos[0]?.map((m) => m.monto)).toEqual([50_000, 50_000]);
    const elegido = r.grupos[0]?.[0]?.id as string;
    expect(aplicarEleccion(p.ctx, { accion: 'anular', transaccionId: elegido }, 'voz')).toMatchObject({
      resultado: 'anulado',
    });
    expect(p.ctx.libro.saldo(p.efectivo)).toBe(64_000 - 50_000 - 30_000);
  });

  it('varias coincidencias o más de 48 h: pide elegir; elegir aplica la corrección', async () => {
    const p = conCuentas();
    await registrarTexto(p.ctx, TACOS_Y_COCA, 'voz', { nube: p.nube });
    await registrarTexto(p.ctx, 'tacos 120 con la morada');
    const r = await registrarTexto(p.ctx, TACOS_EN_EFECTIVO, 'voz', { nube: p.nube });
    if (r.resultado !== 'elegir') throw new Error(r.resultado);
    expect(r.accion).toBe('corregir');
    expect(r.candidatos.map((m) => m.monto)).toEqual([12_000, 8_000]); // el más reciente primero
    expect(r.cambios).toEqual({ origenId: p.efectivo, aliasDicho: null });
    const elegido = aplicarEleccion(
      p.ctx,
      { accion: 'corregir', transaccionId: r.candidatos[1]?.id as string, cambios: r.cambios as never },
      'voz',
    );
    expect(elegido).toMatchObject({ resultado: 'corregido', despues: { cuenta: 'Cartera', monto: 8_000 } });

    // Una sola coincidencia de hace más de 48 h también pregunta.
    const viejo = conCuentas();
    await registrarTexto(viejo.ctx, 'tacos 80 con la morada');
    const instante = viejo.ctx.reloj.ahora();
    const tarde = {
      ...viejo.ctx,
      reloj: { hoy: () => '2026-10-14', ahora: () => instante + 49 * 3600 * 1000 },
    };
    expect(await registrarTexto(tarde, TACOS_EN_EFECTIVO, 'voz', { nube: viejo.nube })).toMatchObject({
      resultado: 'elegir',
      candidatos: [expect.objectContaining({ monto: 8_000 })],
    });
  });

  it('aprendizaje local: la cuenta elegida aprende el alias y la categoría corregida aprende el comercio', async () => {
    const p = conCuentas();
    await registrarTexto(p.ctx, 'tacos 80 con la morada');
    p.responder('no, fue con la azul', {
      intencion: 'corregir',
      objetivo: { ultimo: true },
      cambios: { origen: { tipo: 'debito', alias: 'azul' } },
    });
    const r = await registrarTexto(p.ctx, 'no, fue con la azul', 'voz', { nube: p.nube });
    if (r.resultado !== 'elegir') throw new Error(r.resultado);
    expect(r.faltaCuenta).toMatchObject({ motivo: 'no_encontrada', alias: 'azul' });
    aplicarEleccion(
      p.ctx,
      {
        accion: 'corregir',
        transaccionId: r.candidatos[0]?.id as string,
        cambios: { origenId: p.bbva, aliasDicho: 'azul' },
      },
      'voz',
    );
    expect(contextoNube(p.ctx, HOY).cuentas.find((c) => c.alias.includes('azul'))).toMatchObject({
      tipo: 'debito',
    });
    expect(p.ctx.libro.saldo(p.bbva)).toBe(359_000 - 8_000);

    // Categoría: "pastel" (sin categoría) se corrige a regalos; la siguiente vez ya llega como regalos.
    p.responder('un pastel de 300 en efectivo', {
      intencion: 'registrar',
      movimientos: [
        { tipo: 'gasto', monto: 30_000, fecha: HOY, descripcion: 'pastel', origen: { tipo: 'efectivo' } },
      ],
    });
    p.responder('el pastel era regalo', {
      intencion: 'corregir',
      objetivo: { texto: 'pastel' },
      cambios: { categoria: 'regalos' },
    });
    const pastel = await registrarTexto(p.ctx, 'un pastel de 300 en efectivo', 'voz', { nube: p.nube });
    expect(pastel).toMatchObject({ resultado: 'registrado', movimientos: [{ categoria: 'Otros gastos' }] });
    expect(await registrarTexto(p.ctx, 'el pastel era regalo', 'voz', { nube: p.nube })).toMatchObject({
      resultado: 'corregido',
      despues: { categoria: 'Regalos' },
    });
    const regla = p.ctx.db
      .select()
      .from(esquema.reglaComercio)
      .where(eq(esquema.reglaComercio.comercioNormalizado, 'PASTEL'))
      .get();
    expect(regla).toMatchObject({ fuente: 'aprendida', usos: 1 });
    expect(
      await registrarTexto(p.ctx, 'un pastel de 300 en efectivo', 'voz', { nube: p.nube }),
    ).toMatchObject({
      resultado: 'registrado',
      movimientos: [{ categoria: 'Regalos' }],
    });
  });

  it('"pasar a meses" sobre una compra registrada la convierte en plan (M4: E6.2, caso 6d)', async () => {
    const p = conCuentas();
    await registrarTexto(p.ctx, 'compré una tele de 4000 con la morada');
    p.responder('la tele fue a 12 meses', {
      intencion: 'corregir',
      objetivo: { texto: 'tele' },
      cambios: { msi: { meses: 12 } },
    });
    const r = await registrarTexto(p.ctx, 'la tele fue a 12 meses', 'voz', { nube: p.nube });
    if (r.resultado !== 'pasar_a_meses') throw new Error(r.resultado);
    expect(r.meses).toBe(12);
    expect(r.movimiento).toMatchObject({ tipo: 'compra_msi', monto: 400_000 });
    expect(
      leerAjuste(p.ctx, `pasar_a_meses:${r.movimiento.transaccionId}`, z.object({ meses: z.number() })),
    ).toBeNull();
    // La deuda revolvente vuelve a como estaba antes del cargo; el cargo vive en el plan.
    expect(p.ctx.libro.saldo(p.nu)).toBe(-200_000);
    deshacer(p.ctx, r.deshacer);
    expect(p.ctx.libro.saldo(p.nu)).toBe(-200_000 - 400_000);
  });

  it('consultas con plantilla, aclarar, fuera de alcance y lo que aún no se hace por voz', async () => {
    const p = conCuentas();
    sincronizarPlan(p.ctx, { plus: { vigenteHasta: null, enPrueba: false, renovara: true } });
    const casos: [string, unknown, unknown][] = [
      [
        'cuánto llevo este mes',
        { intencion: 'consultar', consulta: { tipo: 'gasto_total', desde: '2026-10-01', hasta: HOY } },
        { resultado: 'consulta', respuesta: { plantilla: 'gasto_total', texto: 'Este mes llevas $0.' } },
      ],
      [
        'cuánto debo de tarjetas',
        { intencion: 'consultar', consulta: { tipo: 'deuda_tarjetas' } },
        { resultado: 'consulta', respuesta: { plantilla: 'deuda_tarjetas' } },
      ],
      [
        'cuánto pago de suscripciones',
        { intencion: 'consultar', consulta: { tipo: 'suscripciones' } },
        { resultado: 'no_soportado', motivo: 'consulta' },
      ],
      [
        'unos tacos y una coca de 25',
        { intencion: 'aclarar', motivo: 'monto_faltante', pregunta: '¿Cuánto costaron los tacos?' },
        {
          resultado: 'aclarar',
          motivo: 'monto_faltante',
          opciones: [],
          texto: 'unos tacos y una coca de 25',
        },
      ],
      [
        'transfiéreme 500',
        { intencion: 'fuera_de_alcance', motivo: 'mueve_dinero' },
        { resultado: 'fuera_de_alcance', motivo: 'mueve_dinero' },
      ],
      [
        'traigo como 300',
        { intencion: 'arqueo', efectivo_real: 30_000, aproximado: true },
        { resultado: 'arqueo', efectivoReal: 30_000 },
      ],
      [
        'le presté 200 a juan',
        {
          intencion: 'registrar',
          movimientos: [{ tipo: 'prestamo_otorgado', monto: 20_000, fecha: HOY, contraparte: 'juan' }],
        },
        { resultado: 'no_soportado', motivo: 'tipo_movimiento' },
      ],
    ];
    for (const [texto, interpretacion, esperado] of casos) {
      p.responder(texto, interpretacion);
      expect(await registrarTexto(p.ctx, texto, 'voz', { nube: p.nube })).toMatchObject(esperado as object);
    }
    expect(listarMovimientos(p.ctx)).toEqual([]);
  });

  it('sin nube, sin red, con límite o con error la frase queda por interpretar; una respuesta inválida es "no te entendí"', async () => {
    const p = conCuentas();
    expect(await registrarTexto(p.ctx, TACOS_Y_COCA)).toMatchObject({
      resultado: 'por_interpretar',
      motivo: 'sin_nube',
    });
    p.desconectar();
    expect(await registrarTexto(p.ctx, TACOS_Y_COCA, 'voz', { nube: p.nube })).toMatchObject({
      motivo: 'sin_red',
    });
    expect(p.recibidas).toEqual([]); // sin red no se llama al proxy
    p.reconectar();
    p.fallar({ tipo: 'limite', codigo: 'limite_diario' });
    expect(await registrarTexto(p.ctx, TACOS_Y_COCA, 'voz', { nube: p.nube })).toMatchObject({
      motivo: 'limite',
    });
    p.fallar({ tipo: 'error', codigo: 'tiempo_agotado' });
    expect(await registrarTexto(p.ctx, TACOS_Y_COCA, 'voz', { nube: p.nube })).toMatchObject({
      motivo: 'error',
    });
    p.fallar({ tipo: 'sin_red' });
    expect(await registrarTexto(p.ctx, TACOS_Y_COCA, 'voz', { nube: p.nube })).toMatchObject({
      motivo: 'sin_red',
    });
    p.fallar({ tipo: 'error', codigo: 'respuesta_invalida', status: 200 });
    expect(await registrarTexto(p.ctx, TACOS_Y_COCA, 'voz', { nube: p.nube })).toEqual({
      resultado: 'no_entendi',
    });
    expect(contarEsperandoConexion(p.ctx)).toBe(5);
    expect(listarMovimientos(p.ctx)).toEqual([]);
  });
});

describe('cola "por interpretar"', () => {
  it('CA-M3-05 · las frases guardadas sin red se interpretan al reconectar, en orden', async () => {
    const p = conCuentas();
    p.desconectar();
    const frases = [TACOS_Y_COCA, TACOS_EN_EFECTIVO, golden('K06').texto];
    for (const f of frases) {
      expect(await registrarTexto(p.ctx, f, 'voz', { nube: p.nube })).toMatchObject({
        resultado: 'por_interpretar',
      });
    }
    expect(contarEsperandoConexion(p.ctx)).toBe(3);
    expect(listarMovimientos(p.ctx)).toEqual([]);

    // Se reconecta dos días después: cada frase se interpreta con la fecha en que se dijo.
    p.reloj.fijar('2026-10-13');
    p.reconectar();
    const [a, b] = await Promise.all([
      procesarPorInterpretar(p.ctx, p.nube),
      procesarPorInterpretar(p.ctx, p.nube),
    ]);
    expect(a).toEqual({ aplicadas: 3, porRevisar: 0, pendientes: 0 });
    expect(b).toEqual(a); // la misma corrida: nadie interpreta dos veces
    expect(p.recibidas.map((r) => r.texto)).toEqual(frases);
    expect(p.recibidas.map((r) => r.contexto.fecha_referencia)).toEqual([HOY, HOY, HOY]);

    // En orden: la corrección encontró los tacos que se registraron antes.
    expect(p.ctx.libro.saldo(p.nu)).toBe(-200_000);
    expect(p.ctx.libro.saldo(p.efectivo)).toBe(64_000 - 2_500 - 8_000);
    expect(programadosActivos(p.ctx)).toHaveLength(1);
    expect(listarPorInterpretar(p.ctx)).toEqual([]);
    expect(p.ctx.libro.comprobarIntegridad()).toEqual([]);

    // Idempotente: otra corrida no hace nada.
    expect(await procesarPorInterpretar(p.ctx, p.nube)).toEqual({
      aplicadas: 0,
      porRevisar: 0,
      pendientes: 0,
    });
    expect(p.recibidas).toHaveLength(3);
  });

  it('se detiene en el primer fallo de red sin saltarse el orden y sigue al reconectar', async () => {
    const p = conCuentas();
    p.desconectar();
    await registrarTexto(p.ctx, TACOS_Y_COCA, 'voz', { nube: p.nube });
    await registrarTexto(p.ctx, TACOS_EN_EFECTIVO, 'voz', { nube: p.nube });
    p.reconectar();
    p.fallar({ tipo: 'sin_red' });
    expect(await procesarPorInterpretar(p.ctx, p.nube)).toEqual({
      aplicadas: 0,
      porRevisar: 0,
      pendientes: 2,
    });
    p.fallar(null);
    expect(await procesarPorInterpretar(p.ctx, p.nube)).toEqual({
      aplicadas: 2,
      porRevisar: 0,
      pendientes: 0,
    });
    expect(p.ctx.libro.saldo(p.efectivo)).toBe(64_000 - 2_500 - 8_000);
  });

  it('lo que necesita a la persona queda "por revisar" y se revisa después', async () => {
    const p = conCuentas();
    p.desconectar();
    p.responder('ayer compré una tele de 6,000 con la morada', {
      intencion: 'registrar',
      movimientos: [
        {
          tipo: 'gasto',
          monto: 600_000,
          fecha: HOY,
          descripcion: 'tele',
          origen: { tipo: 'credito', alias: 'morada' },
        },
      ],
    });
    await registrarTexto(p.ctx, 'ayer compré una tele de 6,000 con la morada', 'voz', { nube: p.nube });
    p.reconectar();
    expect(await procesarPorInterpretar(p.ctx, p.nube)).toEqual({
      aplicadas: 0,
      porRevisar: 1,
      pendientes: 0,
    });
    const [frase] = listarPorInterpretar(p.ctx);
    expect(frase?.estado).toBe('revisar');
    expect(contarEsperandoConexion(p.ctx)).toBe(0);
    const r = await revisarPorInterpretar(p.ctx, frase?.id as string, p.nube);
    expect(r).toMatchObject({ resultado: 'confirmar', motivo: 'monto_alto' });
    expect(listarMovimientos(p.ctx)).toEqual([]);
  });
});
