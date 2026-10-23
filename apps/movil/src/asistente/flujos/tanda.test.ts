import { describe, expect, it } from 'vitest';
import { interpretarPaso } from '@cartera/nlu';
import { contextoInterprete, registrarTextoLocal } from '../../servicios/registrar';
import { listarTandas, proponerTanda } from '../../servicios/tandas';
import { golden } from '../../servicios/__pruebas__/base';
import { siguientePregunta } from './index';
import { tomarPrellenado } from './prellenado';
import { entradaTanda, flujoTanda, type EstadoTanda } from './tanda';
import * as T from './textos';
import { chip, conEscenario, contestar, dicho, entendi, monto } from './__pruebas__/base';

const TK01 = 'entré a una tanda de 500 cada quincena, somos 10 y me toca el cuarto';

describe('flujo tanda', () => {
  it('TK01 por el lector del paso: solo pregunta la primera ronda (chips hoy, 15 y último) y la guarda', async () => {
    const p = conEscenario('e4-01');
    const l = interpretarPaso('tanda', TK01, contextoInterprete(p.ctx));
    const e0 = flujoTanda.inicial(p.ctx, l);
    const q = siguientePregunta(flujoTanda, e0);
    expect(q).toMatchObject({ paso: 'inicio', texto: T.PREGUNTA_INICIO, campo: 'fecha' });
    expect(q?.chips).toEqual([
      { valor: '2026-10-11', etiqueta: 'Hoy · 11 oct' },
      { valor: '2026-10-15', etiqueta: 'jue 15 oct' },
      { valor: '2026-10-31', etiqueta: 'sáb 31 oct' },
    ]);
    const { estado } = contestar(flujoTanda, e0, [chip('2026-10-15')]);
    const propuesta = proponerTanda(p.ctx, entradaTanda(estado));

    const { propuesta: tarjeta, fila } = entendi(flujoTanda, p.ctx, estado);
    expect(tarjeta).toMatchObject({ titulo: 'Entendí · ¿la agrego?', monto: 50_000 });
    expect(fila('aportacion').valor).toBe('$500 cada quincena');
    expect(fila('participantes').valor).toBe('10 personas');
    expect(fila('turno').valor).toBe('El 4');
    expect(fila('cobras').valor).toBe(T.valorCobras(500_000, propuesta.fechaCobro));
    expect(fila('inicio').valor).toBe('jue 15 oct');

    const m = await flujoTanda.guardar(p.ctx, estado);
    expect(m).toMatchObject({
      texto: 'Listo: agregué tu tanda.',
      detalle: T.detalleTanda(500_000, propuesta.fechaCobro),
    });
    expect(listarTandas(p.ctx)).toMatchObject([{ aportacion: 50_000, participantes: 10, turno: 4 }]);
    expect(p.ctx.libro.comprobarIntegridad()).toEqual([]);
  });

  it('desde `tanda_por_crear` de registrarTexto no pregunta nada: la propuesta ya trae la primera fecha', () => {
    const p = conEscenario('e4-01');
    const r = registrarTextoLocal(p.ctx, golden('TK01').texto, 'voz');
    expect(r).toMatchObject({ resultado: 'tanda_por_crear' });
    const e = flujoTanda.inicial(p.ctx, r);
    expect(e).toMatchObject({
      inicio: '2026-10-15',
      frecuencia: 'quincenal',
      regla: { tipo: 'quincenal_15_ultimo' },
    });
    expect(siguientePregunta(flujoTanda, e)).toBeNull();
  });

  it('desde el chip pregunta cuánto, cada cuándo, cuántos, turno y primera ronda, y entiende lo dicho', () => {
    const p = conEscenario('e4-01');
    const e0 = flujoTanda.inicial(p.ctx, null);
    const { estado, preguntas } = contestar(flujoTanda, e0, [
      dicho('quinientos'),
      dicho('cada semana'),
      dicho('somos ocho'),
      dicho('el tercero'),
      dicho('el 15'),
    ]);
    expect(preguntas.map((q) => q.paso)).toEqual([
      'aportacion',
      'frecuencia',
      'participantes',
      'turno',
      'inicio',
    ]);
    expect(estado).toMatchObject({
      aportacion: 50_000,
      frecuencia: 'semanal',
      participantes: 8,
      turno: 3,
      inicio: '2026-10-15',
    });
    expect(entradaTanda(estado).regla).toEqual({ tipo: 'semanal', dia_semana: 4 });
  });

  it('con pocos participantes el turno se elige con chips', () => {
    const p = conEscenario('e4-01');
    const e0 = flujoTanda.inicial(p.ctx, null);
    const { estado } = contestar(flujoTanda, e0, [monto(30_000), chip('mensual'), chip('4')]);
    expect(siguientePregunta(flujoTanda, estado)?.chips.map((c) => c.etiqueta)).toEqual([
      'El 1',
      'El 2',
      'El 3',
      'El 4',
    ]);
  });

  it('errores en la misma pregunta: participantes fuera de rango, turno mayor que los participantes, fecha que no se entiende', () => {
    const p = conEscenario('e4-01');
    const e0 = flujoTanda.inicial(p.ctx, null);
    const paso = (id: string) => flujoTanda.pasos.find((x) => x.id === id);
    expect(paso('participantes')?.aplicar(e0, dicho('1'))).toEqual({ error: T.ERROR_PARTICIPANTES });
    const diez = { ...e0, participantes: 10 } satisfies EstadoTanda;
    expect(paso('turno')?.aplicar(diez, chip('12'))).toEqual({ error: T.errorTurno(10) });
    expect(paso('inicio')?.aplicar(diez, dicho('cuando se junten'))).toEqual({ error: T.ERROR_FECHA });
    expect(paso('aportacion')?.aplicar(diez, dicho('no sé'))).toEqual({ error: T.ERROR_MONTO });
    expect(paso('frecuencia')?.aplicar(diez, dicho('a veces'))).toEqual({ error: T.ERROR_ELEGIR });
  });

  it('una tanda que ya empezó: «Entendí» propone las aportaciones de E11 y se corrigen tocando la fila', async () => {
    const p = conEscenario('e4-01');
    const e0 = flujoTanda.inicial(p.ctx, interpretarPaso('tanda', TK01, contextoInterprete(p.ctx)));
    const { estado } = contestar(flujoTanda, e0, [dicho('15/09/2026')]);
    const sugerida = proponerTanda(p.ctx, entradaTanda(estado)).yaEmpezo;
    expect(sugerida).not.toBeNull();
    const { fila, acciones } = entendi(flujoTanda, p.ctx, estado);
    expect(fila('llevas').valor).toBe(T.valorLlevas(sugerida?.aportacionesHechas ?? -1));
    expect(fila('ya_cobraste').valor).toBe(sugerida?.yaCobraste ? 'Sí' : 'Todavía no');
    fila('llevas').alCambiar?.('1');
    const corregida = acciones.actualizar?.mock.calls[0]?.[0] as EstadoTanda;
    expect(corregida.aportacionesHechas).toBe(1);
    await flujoTanda.guardar(p.ctx, corregida);
    // Una aportación de $500 ya dada (y el turno 4 sin cobrar): la tanda te debe $500 (saldo inicial, caso 23b).
    expect(listarTandas(p.ctx)).toMatchObject([{ aportacionesHechas: 1, posicion: 50_000, cobrada: false }]);
    expect(p.ctx.libro.comprobarIntegridad()).toEqual([]);
  });

  it('cambiar «Cada cuándo» en «Entendí» rehace la regla con la primera fecha', () => {
    const p = conEscenario('e4-01');
    const e = flujoTanda.inicial(p.ctx, registrarTextoLocal(p.ctx, golden('TK01').texto, 'voz'));
    const { fila, acciones } = entendi(flujoTanda, p.ctx, e);
    fila('frecuencia').alCambiar?.('mensual');
    const nuevo = acciones.actualizar?.mock.calls[0]?.[0] as EstadoTanda;
    expect(entradaTanda(nuevo).regla).toEqual({ tipo: 'mensual', dia: 15 });
  });

  it('«Cambiar algo» abre el formulario de tanda con la entrada en memoria', () => {
    const p = conEscenario('e4-01');
    const e = flujoTanda.inicial(p.ctx, registrarTextoLocal(p.ctx, golden('TK01').texto, 'voz'));
    expect(flujoTanda.formularioLargo(e)).toEqual({ pathname: '/registrar', params: { flujo: 'tanda' } });
    expect(tomarPrellenado('tanda')).toMatchObject({
      aportacion: 50_000,
      participantes: 10,
      turno: 4,
      inicio: '2026-10-15',
    });
  });
});
