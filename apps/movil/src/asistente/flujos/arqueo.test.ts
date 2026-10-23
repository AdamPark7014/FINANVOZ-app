import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { CUENTAS_SISTEMA, esquema } from '@cartera/datos';
import {
  calcularArqueo,
  moverEnPropuestaArqueo,
  prepararArqueo,
  resumenArqueo,
} from '../../servicios/arqueo';
import { registrarMovimiento } from '../../servicios/formulario';
import { agregarCuenta } from '../../servicios/onboarding';
import { registrarTextoLocal } from '../../servicios/registrar';
import { vector } from '../../servicios/__pruebas__/base';
import { flujoArqueo, type EstadoArqueo } from './arqueo';
import { cifraHoy } from './comun';
import { iniciarFlujo, siguientePregunta } from './index';
import { tomarPrellenado } from './prellenado';
import * as T from './textos';
import { baseVacia, chip, conEscenario, contestar, dicho, entendi, monto, paso } from './__pruebas__/base';

const HORA = 3_600_000;
const T0 = Date.UTC(2026, 9, 11, 16, 0);

interface VectorE7 {
  saldo_contable: number;
  efectivo_real: number;
  historial: { categoria: string; monto: number }[];
  esperado: { hueco: number; propuesta: { categoria: string; monto: number }[] };
}

/**
 * e4-01 (efectivo $640) con el historial en efectivo de E7-02 en los últimos 60 días (un ingreso previo lo compensa
 * para que el saldo siga en $640) y, si se pide, «Coca 25» dictada sin método hace más de 24 h.
 */
function preparar(conCoca = false) {
  const p = conEscenario('e4-01');
  p.reloj.fijarInstante(T0 - 30 * HORA);
  const efectivo = p.e.cuentas['efectivo'] as string;
  const v = vector<VectorE7>('E7-02');
  registrarMovimiento(p.ctx, {
    tipo: 'ingreso',
    categoria: 'otros_ingresos',
    destinoId: efectivo,
    monto: v.historial.reduce((s, h) => s + h.monto, 0),
    fecha: '2026-09-20',
  });
  v.historial.forEach((h, i) =>
    registrarMovimiento(p.ctx, {
      tipo: 'gasto',
      categoria: h.categoria,
      origenId: efectivo,
      monto: h.monto,
      fecha: `2026-09-${String(21 + i).padStart(2, '0')}`,
    }),
  );
  const coca = conCoca
    ? registrarMovimiento(
        p.ctx,
        {
          tipo: 'gasto',
          categoria: 'antojos',
          origenId: CUENTAS_SISTEMA.porAsignar,
          monto: 2_500,
          descripcion: 'Coca',
          fecha: '2026-10-10',
        },
        { origen: 'voz' },
      ).transaccionId
    : null;
  p.reloj.fijarInstante(T0);
  return { ...p, v, efectivo, coca };
}

describe('flujo arqueo (CA-O7 5)', () => {
  it('«traigo 300 en la cartera»: no pregunta cuánto, «Entendí» «Traes $300: faltan $340» con el reparto de E7-02 y confirma', async () => {
    const p = preparar();
    const r = registrarTextoLocal(p.ctx, 'traigo 300 en la cartera', 'voz');
    expect(r).toMatchObject({ resultado: 'arqueo', efectivoReal: 30_000 });
    const e = flujoArqueo.inicial(p.ctx, { desde: r, porVoz: true });
    expect(siguientePregunta(flujoArqueo, e)).toBeNull();

    const { propuesta } = entendi(flujoArqueo, p.ctx, e);
    expect(propuesta.titulo).toBe('Traes $300: faltan $340');
    expect(propuesta.efecto).toBe(T.EFECTO_REPARTO);
    const calculo = calcularArqueo(p.ctx, { efectivoReal: 30_000 });
    expect(calculo.propuesta.map(({ categoria, monto: m }) => ({ categoria, monto: m }))).toEqual(
      p.v.esperado.propuesta,
    );
    expect(propuesta.filas.map((f) => [f.clave, f.etiqueta, f.valor])).toEqual(
      calculo.propuesta.map((x) => [
        `reparto-${x.categoria}`,
        x.nombre,
        T.chipTraigo(x.monto).replace('Traigo ', ''),
      ]),
    );

    const antes = cifraHoy(p.ctx);
    const m = await flujoArqueo.guardar(p.ctx, e);
    expect(m.texto).toBe('Listo: tu efectivo quedó en $300.');
    // Faltaban $340: el día baja y el turno lo dice con las cifras de Hoy.
    expect(m.cambioDia).toBe(`Tu día pasa de ${antes ?? ''} a ${cifraHoy(p.ctx) ?? ''}.`);
    expect(m.cambioDia).not.toContain(`a ${antes ?? ''}.`);
    expect(p.ctx.libro.saldo(p.efectivo)).toBe(30_000);
    const fila = p.ctx.db.select().from(esquema.arqueo).get();
    expect(fila).toMatchObject({ saldoContable: 64_000, efectivoReal: 30_000, hueco: 34_000 });
    const ajuste = p.ctx.db
      .select()
      .from(esquema.transaccion)
      .where(eq(esquema.transaccion.id, fila?.transaccionId as string))
      .get();
    expect(ajuste).toMatchObject({ tipo: 'ajuste_arqueo', estimada: 1, origen: 'arqueo' });
    expect(p.ctx.libro.comprobarIntegridad()).toEqual([]);
  });

  it('desde el chip «Contar efectivo»: «¿Cuánto efectivo traes? Deberías traer $640.» y el chip «Traigo $640» cuadra', async () => {
    const p = preparar();
    const e0 = flujoArqueo.inicial(p.ctx, null);
    const q = siguientePregunta(flujoArqueo, e0);
    expect(q).toEqual({
      paso: 'efectivo',
      texto: '¿Cuánto efectivo traes? Deberías traer $640.',
      chips: [{ valor: '64000', etiqueta: 'Traigo $640' }],
      campo: 'monto',
      admiteCero: true,
    });
    const { estado } = contestar(flujoArqueo, e0, [chip('64000')]);
    expect(entendi(flujoArqueo, p.ctx, estado).propuesta.titulo).toBe('Traes $640: tu efectivo cuadra');
    const m = await flujoArqueo.guardar(p.ctx, estado);
    expect(m.texto).toBe(T.MENSAJE_CUADRA);
    expect(p.ctx.db.select().from(esquema.arqueo).get()).toMatchObject({ hueco: 0, transaccionId: null });
  });

  it('pregunta antes por los gastos sin método (E7-08): la coca marcada baja «Deberías traer» a $615', async () => {
    const p = preparar(true);
    const e0 = flujoArqueo.inicial(p.ctx, null);
    const { estado, preguntas } = contestar(flujoArqueo, e0, [chip('si'), dicho('traigo como trescientos')]);
    expect(preguntas.map((q) => q.texto)).toEqual([
      '¿Pagaste Coca $25 (sáb 10) en efectivo?',
      '¿Cuánto efectivo traes? Deberías traer $615.',
    ]);
    const { propuesta } = entendi(flujoArqueo, p.ctx, estado);
    expect(propuesta.titulo).toBe('Traes $300: faltan $315');
    expect(propuesta.pista).toBe('Dijiste «como $300»: si cuentas exacto, dímelo.');
    expect(propuesta.filas.find((f) => f.clave === 'marcados')?.valor).toBe('1 gasto de $25');
    await flujoArqueo.guardar(p.ctx, estado);
    expect(p.ctx.libro.saldo(p.efectivo)).toBe(30_000);
    expect(p.ctx.libro.saldo(CUENTAS_SISTEMA.porAsignar)).toBe(0);
  });

  it('«traigo 300» con un gasto sin método: solo pregunta por ese gasto («no» lo deja por asignar)', () => {
    const p = preparar(true);
    const e0 = flujoArqueo.inicial(p.ctx, registrarTextoLocal(p.ctx, 'traigo 300 en la cartera', 'voz'));
    const { estado, preguntas } = contestar(flujoArqueo, e0, [dicho('no')]);
    expect(preguntas.map((q) => q.paso)).toEqual(['por_asignar-1']);
    expect(estado).toMatchObject({ marcados: [], hueco: 34_000 });
  });

  it('un sobrante nunca se guarda sin decir de dónde salió (E7-09)', async () => {
    const p = preparar();
    const e0 = flujoArqueo.inicial(p.ctx, null);
    const conMonto = contestar(flujoArqueo, e0, [monto(70_000)]).estado;
    const q = siguientePregunta(flujoArqueo, conMonto);
    expect(q).toMatchObject({ paso: 'sobrante', texto: 'Traes $60 más de lo esperado. ¿De dónde salió?' });
    expect(q?.chips.map((c) => c.etiqueta)).toEqual([
      'Me dieron dinero',
      'Anoté algo de más',
      'No sé, solo corrígelo',
    ]);
    expect(paso(flujoArqueo, 'sobrante')?.aplicar(conMonto, dicho('de la nada'))).toEqual({
      error: T.ERROR_ELEGIR,
    });
    const { estado } = contestar(flujoArqueo, conMonto, [chip('no_se')]);
    const { propuesta, fila } = entendi(flujoArqueo, p.ctx, estado);
    expect(propuesta.titulo).toBe('Traes $700: sobran $60');
    expect(fila('de_donde').valor).toBe('No sé, solo corrígelo');
    await flujoArqueo.guardar(p.ctx, estado);
    expect(p.ctx.libro.saldo(p.efectivo)).toBe(70_000);
  });

  it('tocar una línea del reparto la pasa a otra categoría; el total sigue siendo el faltante', async () => {
    const p = preparar();
    const e = flujoArqueo.inicial(p.ctx, { desde: { resultado: 'arqueo', efectivoReal: 30_000 } });
    const { fila, acciones } = entendi(flujoArqueo, p.ctx, e);
    const varios = fila('reparto-varios_efectivo');
    expect(varios.opciones?.map((o) => o.valor)).toEqual(['comida_fuera', 'antojos', 'transporte']);
    varios.alCambiar?.('comida_fuera');
    const movido = acciones.actualizar?.mock.calls[0]?.[0] as EstadoArqueo;
    const despues = entendi(flujoArqueo, p.ctx, movido);
    expect(despues.propuesta.filas.map((f) => f.clave)).toEqual([
      'reparto-comida_fuera',
      'reparto-antojos',
      'reparto-transporte',
    ]);
    expect(despues.fila('reparto-comida_fuera').valor).toBe('$210.48');
    const r = await flujoArqueo.guardar(p.ctx, movido);
    expect(r.texto).toBe('Listo: tu efectivo quedó en $300.');
    const arqueo = p.ctx.db.select().from(esquema.arqueo).get();
    const asientos = p.ctx.libro.obtener(arqueo?.transaccionId as string)?.asientos ?? [];
    expect(asientos.filter((a) => a.monto > 0).map((a) => a.monto)).toEqual([21_048, 8_095, 4_857]);
  });

  it('con muchos gastos sin método pregunta por los primeros cinco; los demás quedan para «Cambiar»', () => {
    const p = preparar();
    p.reloj.fijarInstante(T0 - 30 * HORA);
    for (let i = 0; i < 6; i++) {
      registrarMovimiento(p.ctx, {
        tipo: 'gasto',
        categoria: 'antojos',
        origenId: CUENTAS_SISTEMA.porAsignar,
        monto: 1_000 + i,
        fecha: '2026-10-10',
      });
    }
    p.reloj.fijarInstante(T0);
    const e0 = flujoArqueo.inicial(p.ctx, null);
    const { estado, preguntas } = contestar(flujoArqueo, e0, [
      chip('no'),
      chip('no'),
      chip('si'),
      chip('no'),
      chip('no'),
      monto(64_000),
    ]);
    expect(preguntas.map((q) => q.paso)).toEqual([
      'por_asignar-1',
      'por_asignar-2',
      'por_asignar-3',
      'por_asignar-4',
      'por_asignar-5',
      'efectivo',
    ]);
    expect(preguntas[0]?.texto).toBe('¿Pagaste un gasto de $10 (sáb 10) en efectivo?');
    expect(estado.marcados).toHaveLength(1);
    const { fila } = entendi(flujoArqueo, p.ctx, estado);
    expect(fila('sin_revisar').valor).toBe('1 gasto sin método; revísalo en Cambiar');
  });

  it('lo que no es una cantidad es un error en la misma pregunta', () => {
    const p = preparar();
    const e0 = flujoArqueo.inicial(p.ctx, null);
    expect(paso(flujoArqueo, 'efectivo')?.aplicar(e0, dicho('ni idea'))).toEqual({ error: T.ERROR_MONTO });
    expect(paso(flujoArqueo, 'efectivo')?.aplicar(e0, dicho('ya no traigo nada'))).toMatchObject({
      efectivoReal: 0,
      hueco: 64_000,
    });
  });

  it('sin cuenta de efectivo no se puede empezar', () => {
    const p = baseVacia();
    agregarCuenta(p.ctx, { subtipo: 'debito', nombre: 'BBVA', saldo: 100_000 });
    expect(iniciarFlujo('arqueo', p.ctx, null)).toEqual({ noDisponible: T.SIN_EFECTIVO });
  });

  it('«Cambiar» abre la pantalla de arqueo de esa cuenta con lo dicho en memoria', () => {
    const p = preparar(true);
    const e0 = flujoArqueo.inicial(p.ctx, registrarTextoLocal(p.ctx, 'traigo 300 en la cartera', 'voz'));
    const { estado } = contestar(flujoArqueo, e0, [chip('si')]);
    expect(flujoArqueo.formularioLargo(estado)).toEqual({
      pathname: '/arqueo',
      params: { cuenta: p.efectivo },
    });
    expect(tomarPrellenado('arqueo')).toEqual({ efectivoReal: 30_000, marcados: [p.coca] });
  });

  it('servicios: `resumenArqueo` y `moverEnPropuestaArqueo` no cambian el total', () => {
    const p = preparar(true);
    const vista = prepararArqueo(p.ctx);
    expect(resumenArqueo(vista, [], null)).toEqual({ esperado: 64_000, hueco: null });
    expect(resumenArqueo(vista, [p.coca as string], 30_000)).toEqual({ esperado: 61_500, hueco: 31_500 });
    const propuesta = calcularArqueo(p.ctx, { efectivoReal: 30_000 }).propuesta;
    const movida = moverEnPropuestaArqueo(propuesta, 'antojos', 'transporte');
    expect(movida.reduce((s, x) => s + x.monto, 0)).toBe(34_000);
    expect(moverEnPropuestaArqueo(propuesta, 'antojos', 'no_existe')).toEqual(propuesta);
  });
});
