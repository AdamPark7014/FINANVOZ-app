import { describe, expect, it } from 'vitest';
import { consultaDeHerramienta } from '@cartera/nlu';
import { resolverPeriodos } from './explicar-periodos';
import { cargarEscenario } from './semilla';
import { abrirPrueba, escenario } from './__pruebas__/base';

/** Semilla `e4-01`: hoy domingo 2026-10-11; quincena el 15 y el último (último ingreso el 30 sep). */
function semilla() {
  const p = abrirPrueba();
  cargarEscenario(p.ctx, escenario('e4-01'));
  return p;
}

describe('periodos con nombre del modo explicar (06 §6)', () => {
  it('lo gastado: semana de lunes a hoy, quincena desde el último ingreso, mes y mes pasado completos', () => {
    const per = resolverPeriodos(semilla().ctx);
    expect(per.gasto('hoy')).toEqual({ desde: '2026-10-11', hasta: '2026-10-11' });
    expect(per.gasto('ayer')).toEqual({ desde: '2026-10-10', hasta: '2026-10-10' });
    expect(per.gasto('esta_semana')).toEqual({ desde: '2026-10-05', hasta: '2026-10-11' });
    expect(per.gasto('semana_pasada')).toEqual({ desde: '2026-09-28', hasta: '2026-10-04' });
    expect(per.gasto('esta_quincena')).toEqual({ desde: '2026-09-30', hasta: '2026-10-11' });
    expect(per.gasto('quincena_pasada')?.hasta).toBe('2026-09-29');
    expect(per.gasto('este_mes')).toEqual({ desde: '2026-10-01', hasta: '2026-10-11' });
    expect(per.gasto('mes_pasado')).toEqual({ desde: '2026-09-01', hasta: '2026-09-30' });
    expect(per.gasto('ultimos_30_dias')).toEqual({ desde: '2026-09-12', hasta: '2026-10-11' });
  });

  it('lo que viene: desde hoy; esta quincena hasta la víspera del próximo ingreso', () => {
    const per = resolverPeriodos(semilla().ctx);
    expect(per.pagos('esta_semana')).toEqual({ desde: '2026-10-11', hasta: '2026-10-11' });
    expect(per.pagos('esta_quincena')).toEqual({ desde: '2026-10-11', hasta: '2026-10-14' });
    expect(per.pagos('este_mes')).toEqual({ desde: '2026-10-11', hasta: '2026-10-31' });
    expect(per.pagos('proximos_7_dias')).toEqual({ desde: '2026-10-11', hasta: '2026-10-17' });
    expect(per.pagos('proximos_30_dias')).toEqual({ desde: '2026-10-11', hasta: '2026-11-09' });
  });

  it('comparaciones: lo que va contra el mismo tramo del periodo anterior', () => {
    const per = resolverPeriodos(semilla().ctx);
    expect(per.comparar('este_mes')).toEqual({
      actual: { desde: '2026-10-01', hasta: '2026-10-11' },
      anterior: { desde: '2026-09-01', hasta: '2026-09-11' },
    });
    expect(per.comparar('esta_semana')).toEqual({
      actual: { desde: '2026-10-05', hasta: '2026-10-11' },
      anterior: { desde: '2026-09-28', hasta: '2026-10-04' },
    });
    const q = per.comparar('esta_quincena');
    expect(q?.actual).toEqual({ desde: '2026-09-30', hasta: '2026-10-11' });
    expect(q && q.anterior.hasta <= '2026-09-29').toBe(true);
  });

  it('sin ingreso registrado no hay quincena: la herramienta responde con error', () => {
    const p = abrirPrueba();
    const per = resolverPeriodos(p.ctx);
    expect(per.gasto('esta_quincena')).toBeNull();
    expect(per.pagos('esta_quincena')).toBeNull();
    expect(per.comparar('esta_quincena')).toBeNull();
    expect(per.gasto('esta_semana')).not.toBeNull();
    expect(consultaDeHerramienta('gasto', { periodo: 'esta_quincena' }, per)).toBeNull();
  });
});
