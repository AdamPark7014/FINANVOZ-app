import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { CUENTAS_SISTEMA, esquema } from '@cartera/datos';
import {
  arqueoPendiente,
  calcularArqueo,
  confirmarArqueo,
  efectivoMenosPreciso,
  posponerArqueo,
  prepararArqueo,
} from './arqueo';
import { registrarMovimiento } from './formulario';
import { obtenerHoy } from './hoy';
import { cargarEscenario } from './semilla';
import { abrirPrueba, escenario, vector } from './__pruebas__/base';

const HORA = 3_600_000;
const T0 = Date.UTC(2026, 9, 11, 16, 0);

interface VectorE7 {
  saldo_contable: number;
  efectivo_real: number;
  historial: { categoria: string; monto: number }[];
  marcados: number[];
  esperado: { reasignado: number; hueco: number; propuesta: { categoria: string; monto: number }[] };
}

/**
 * e4-01 (efectivo $640) con el historial en efectivo de E7-08 en los últimos 60 días (un ingreso previo lo
 * compensa para que el saldo siga en $640) y "Coca 25" dictada sin método hace más de 24 h.
 */
function preparar() {
  const p = abrirPrueba();
  const e = cargarEscenario(p.ctx, escenario('e4-01'));
  p.reloj.fijar(e.hoy);
  p.reloj.fijarInstante(T0 - 30 * HORA);
  const efectivo = e.cuentas['efectivo'] as string;
  const v = vector<VectorE7>('E7-08');
  const total = v.historial.reduce((s, h) => s + h.monto, 0);
  registrarMovimiento(p.ctx, {
    tipo: 'ingreso',
    categoria: 'otros_ingresos',
    destinoId: efectivo,
    monto: total,
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
  const coca = registrarMovimiento(
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
  );
  p.reloj.fijarInstante(T0);
  return { ...p, e, v, efectivo, coca: coca.transaccionId };
}

describe('arqueo (CA-M5-05)', () => {
  it('saldo $640, coca de $25 marcada y respuesta $300: esperado $615, propuesta de E7-08 y efectivo en $300', () => {
    const p = preparar();
    expect(p.v.saldo_contable).toBe(64_000);
    const vista = prepararArqueo(p.ctx);
    expect(vista).toMatchObject({ cuentaId: p.efectivo, saldo: 64_000 });
    expect(vista.porAsignar).toEqual([
      { transaccionId: p.coca, descripcion: 'Coca', monto: 2_500, fecha: '2026-10-10', etiqueta: 'sáb 10' },
    ]);

    const calculo = calcularArqueo(p.ctx, { efectivoReal: p.v.efectivo_real, marcados: [p.coca] });
    expect(calculo).toMatchObject({
      saldo: 64_000,
      reasignado: p.v.esperado.reasignado,
      esperado: 61_500,
      hueco: p.v.esperado.hueco,
      accion: 'proponer_gastos_estimados',
    });
    expect(calculo.propuesta.map(({ categoria, monto }) => ({ categoria, monto }))).toEqual(
      p.v.esperado.propuesta,
    );

    const r = confirmarArqueo(p.ctx, { efectivoReal: 30_000, marcados: [p.coca] });
    expect(p.ctx.libro.saldo(p.efectivo)).toBe(30_000);
    expect(p.ctx.libro.saldo(CUENTAS_SISTEMA.porAsignar)).toBe(0);
    const ajuste = p.ctx.db
      .select()
      .from(esquema.transaccion)
      .where(eq(esquema.transaccion.id, r.transaccionId as string))
      .get();
    expect(ajuste).toMatchObject({ tipo: 'ajuste_arqueo', estimada: 1, origen: 'arqueo' });
    const fila = p.ctx.db.select().from(esquema.arqueo).get();
    expect(fila).toMatchObject({
      saldoContable: 64_000,
      reasignado: 2_500,
      efectivoReal: 30_000,
      hueco: 31_500,
    });
    // La coca quedó en efectivo con lo dictado (una sola vez).
    const coca = p.ctx.db
      .select()
      .from(esquema.transaccion)
      .where(eq(esquema.transaccion.reemplazaA, p.coca))
      .get();
    expect(coca).toMatchObject({ descripcion: 'Coca', origen: 'voz' });
    expect(p.ctx.libro.comprobarIntegridad()).toEqual([]);
  });

  it('una propuesta editada debe sumar el faltante', () => {
    const p = preparar();
    expect(() =>
      confirmarArqueo(p.ctx, {
        efectivoReal: 30_000,
        marcados: [p.coca],
        propuesta: [{ categoria: 'antojos', monto: 100 }],
      }),
    ).toThrow(expect.objectContaining({ codigo: 'propuesta_invalida' }));
    confirmarArqueo(p.ctx, {
      efectivoReal: 30_000,
      marcados: [p.coca],
      propuesta: [{ categoria: 'antojos', monto: 31_500 }],
    });
    expect(p.ctx.libro.saldo(p.efectivo)).toBe(30_000);
  });

  it('un sobrante nunca se registra sin respuesta (E7-09)', () => {
    const p = preparar();
    expect(calcularArqueo(p.ctx, { efectivoReal: 70_000 })).toMatchObject({
      hueco: -6_000,
      accion: 'aclarar_sobrante',
    });
    expect(() => confirmarArqueo(p.ctx, { efectivoReal: 70_000 })).toThrow(
      expect.objectContaining({ codigo: 'falta_respuesta' }),
    );
    expect(p.ctx.libro.saldo(p.efectivo)).toBe(64_000);
    confirmarArqueo(p.ctx, { efectivoReal: 70_000, sobrante: { tipo: 'no_se' } });
    expect(p.ctx.libro.saldo(p.efectivo)).toBe(70_000);
  });

  it('disparadores: 48 h después de un retiro, "Ahora no" hasta mañana, y sin arqueo pendiente tras hacerlo', () => {
    const p = abrirPrueba();
    const e = cargarEscenario(p.ctx, escenario('e4-01'));
    p.reloj.fijar(e.hoy);
    p.reloj.fijarInstante(T0);
    expect(arqueoPendiente(p.ctx)).toBeNull();
    registrarMovimiento(p.ctx, {
      tipo: 'retiro_efectivo',
      origenId: e.cuentas['bbva'] as string,
      destinoId: e.cuentas['efectivo'] as string,
      monto: 50_000,
    });
    p.reloj.fijarInstante(T0 + 47 * HORA);
    expect(arqueoPendiente(p.ctx)).toBeNull();
    p.reloj.fijarInstante(T0 + 48 * HORA + 1_000);
    expect(arqueoPendiente(p.ctx)).toMatchObject({ motivo: 'retiro', saldo: 114_000, conPorAsignar: false });
    expect(obtenerHoy(p.ctx).tarjetasAccion[0]).toMatchObject({ tipo: 'arqueo', saldo: 114_000 });
    posponerArqueo(p.ctx);
    expect(arqueoPendiente(p.ctx)).toBeNull();
    p.reloj.fijar('2026-10-12');
    expect(arqueoPendiente(p.ctx)).not.toBeNull();
    confirmarArqueo(p.ctx, { efectivoReal: 114_000 });
    expect(arqueoPendiente(p.ctx)).toBeNull();
  });

  it('insignia "menos preciso" con efectivo sin arqueo por más de 7 días', () => {
    const p = abrirPrueba();
    const e = cargarEscenario(p.ctx, escenario('e4-01'));
    p.reloj.fijar(e.hoy);
    expect(efectivoMenosPreciso(p.ctx)).toBe(false);
    p.reloj.fijar('2026-10-18');
    expect(efectivoMenosPreciso(p.ctx)).toBe(true);
    expect(obtenerHoy(p.ctx).efectivoMenosPreciso).toBe(true);
  });
});
