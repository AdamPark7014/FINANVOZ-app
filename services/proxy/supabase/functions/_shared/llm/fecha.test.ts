// Fecha de hoy del modo explicar: periodos resueltos sin que el modelo cuente días.
import { describe, expect, it } from 'vitest';
import { contextoFecha, fechaCivil } from './fecha.ts';
import type { AdaptadorTurno, LlamadaTurno } from './proveedores.ts';
import { turno } from './turno.ts';

describe('contextoFecha', () => {
  it('jueves 2026-10-22: ayer, lunes de la semana, mes, mes pasado y próximos 7 días', () => {
    expect(contextoFecha('2026-10-22')).toBe(
      'Hoy es jueves 2026-10-22 (hora del centro de México). Ayer: 2026-10-21. ' +
        'Esta semana: del lunes 2026-10-19 a hoy. Este mes: del 2026-10-01 a hoy. ' +
        'Mes pasado: del 2026-09-01 al 2026-09-30. Próximos 7 días: de hoy al 2026-10-28.',
    );
  });

  it('cruza años y bisiestos; el lunes es su propio inicio de semana', () => {
    const enero = contextoFecha('2027-01-01') ?? '';
    expect(enero).toContain('Hoy es viernes 2027-01-01');
    expect(enero).toContain('Ayer: 2026-12-31.');
    expect(enero).toContain('del lunes 2026-12-28 a hoy');
    expect(enero).toContain('Mes pasado: del 2026-12-01 al 2026-12-31.');
    expect(contextoFecha('2028-03-01')).toContain('Mes pasado: del 2028-02-01 al 2028-02-29.');
    expect(contextoFecha('2026-10-19')).toContain('Hoy es lunes 2026-10-19');
    expect(contextoFecha('2026-10-19')).toContain('del lunes 2026-10-19 a hoy');
  });

  it('una fecha inválida no da contexto', () => {
    expect(contextoFecha('2026-02-30')).toBeNull();
    expect(contextoFecha('hoy')).toBeNull();
  });

  it('fechaCivil usa la hora del centro de México (UTC−6)', () => {
    expect(fechaCivil(Date.UTC(2026, 9, 23, 5, 59))).toBe('2026-10-22');
    expect(fechaCivil(Date.UTC(2026, 9, 23, 6, 0))).toBe('2026-10-23');
  });
});

describe('turno con fecha', () => {
  it('el adaptador recibe la línea de hoy; sin `hoy` no recibe nada', async () => {
    const vistas: (string | undefined)[] = [];
    const adaptador: AdaptadorTurno = {
      nombre: 'anthropic',
      modelo: 'claude-haiku-5-5',
      async llamar(l: LlamadaTurno) {
        vistas.push(l.fecha);
        return { salida: { tipo: 'respuesta', texto: 'ok' }, tokens_entrada: 1, tokens_salida: 1 };
      },
    };
    const solicitud = {
      mensajes: [{ rol: 'usuario' as const, texto: '¿cuánto gasté ayer?' }],
      herramientas: [{ nombre: 'gasto', descripcion: 'Gasto.', parametros: { type: 'object' } }],
    };
    await turno(solicitud, { adaptadores: [adaptador], ahora: () => 0, hoy: () => '2026-10-22' });
    await turno(solicitud, { adaptadores: [adaptador], ahora: () => 0 });
    expect(vistas[0]).toContain('Hoy es jueves 2026-10-22');
    expect(vistas[1]).toBeUndefined();
  });
});
