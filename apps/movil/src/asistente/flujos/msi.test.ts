import { describe, expect, it } from 'vitest';
import { deshacer } from '../../servicios/deshacer';
import { previsualizarCompraMsi } from '../../servicios/msi';
import { registrarTextoLocal, type ResultadoTexto } from '../../servicios/registrar';
import { planesVigentes } from '../../servicios/tarjetas';
import { golden } from '../../servicios/__pruebas__/base';
import { iniciarFlujo, siguientePregunta } from './index';
import { flujoMsi } from './msi';
import { tomarPrellenado } from './prellenado';
import * as T from './textos';
import { baseVacia, chip, conEscenario, contestar, dicho, entendi } from './__pruebas__/base';

type ConfirmarMsi = Extract<ResultadoTexto, { resultado: 'confirmar_msi' }>;

/** e5-10 (Oro, Nu y Azul) y «compré una tele de 12 mil a 12 meses sin intereses con la oro» (S01). */
function tele() {
  const p = conEscenario('e5-10');
  const r = registrarTextoLocal(p.ctx, golden('S01').texto, 'voz');
  if (r?.resultado !== 'confirmar_msi') throw new Error(String(r?.resultado));
  return { ...p, r, oro: p.e.cuentas['oro'] as string, azul: p.e.cuentas['azul'] as string };
}

/** La misma compra sin decir con cuál tarjeta: con tres, hay que elegir. */
function sinTarjeta(p: ReturnType<typeof tele>): ConfirmarMsi {
  const dicha = p.r.propuesta.entrada;
  const entrada = {
    monto: dicha.monto,
    meses: dicha.meses,
    ...(dicha.fecha ? { fecha: dicha.fecha } : {}),
    ...(dicha.categoria ? { categoria: dicha.categoria } : {}),
    ...(dicha.descripcion ? { descripcion: dicha.descripcion } : {}),
  };
  return {
    resultado: 'confirmar_msi',
    motivo: 'cuenta',
    propuesta: {
      entrada,
      faltaTarjeta: {
        motivo: 'ambigua',
        alias: null,
        candidatas: [
          { id: p.e.cuentas['oro'] as string, nombre: 'Banamex Oro ••8812' },
          { id: p.e.cuentas['nu'] as string, nombre: 'Nu ••4410' },
          { id: p.e.cuentas['azul'] as string, nombre: 'BBVA Azul ••1022' },
        ],
      },
    },
  };
}

describe('flujo compra a meses', () => {
  it('S01 con la tarjeta dicha: sin preguntas, «Entendí» con meses, mensualidad y tarjeta; guarda el plan con Deshacer', async () => {
    const p = tele();
    const e = flujoMsi.inicial(p.ctx, { desde: p.r, porVoz: true });
    expect(siguientePregunta(flujoMsi, e)).toBeNull();

    const { propuesta, fila } = entendi(flujoMsi, p.ctx, e);
    const cuotas = previsualizarCompraMsi(p.ctx, { tarjetaId: p.oro, monto: 1_200_000, meses: 12 });
    expect(propuesta).toMatchObject({ titulo: 'Entendí · ¿lo registro?', monto: 1_200_000 });
    expect(fila('meses').valor).toBe('12 meses');
    expect(fila('mensualidad').valor).toBe('$1,000');
    expect(fila('primer_pago').valor).toBe(T.fechaCorta(cuotas[0]?.limite as string));
    expect(fila('tarjeta').valor).toBe('Banamex Oro ••8812');

    const m = await flujoMsi.guardar(p.ctx, e);
    const [plan] = planesVigentes(p.ctx, { tarjetaId: p.oro });
    expect(plan).toMatchObject({ monto: 1_200_000, meses: 12, origenAlta: 'compra' });
    expect(p.ctx.libro.obtener(plan?.transaccionAltaId as string)?.origen).toBe('voz');
    expect(m.texto).toBe('Registré Tele $12,000 a 12 meses con tu Banamex Oro ••8812.');
    expect(m.detalle).toBe(T.detallePrimerPago(cuotas[0]?.limite as string));
    deshacer(p.ctx, m.deshacer as string);
    expect(planesVigentes(p.ctx, { tarjetaId: p.oro })).toEqual([]);
    expect(p.ctx.libro.comprobarIntegridad()).toEqual([]);
  });

  it('sin tarjeta dicha pregunta «¿Con cuál tarjeta fue?» con chips; también se contesta diciendo «la azul»', () => {
    const p = tele();
    const e0 = flujoMsi.inicial(p.ctx, sinTarjeta(p));
    const q = siguientePregunta(flujoMsi, e0);
    expect(q).toMatchObject({ paso: 'tarjeta', texto: T.PREGUNTA_TARJETA_MSI });
    expect(q?.chips.map((c) => c.etiqueta)).toEqual(['Banamex Oro ••8812', 'Nu ••4410', 'BBVA Azul ••1022']);
    const { estado } = contestar(flujoMsi, e0, [dicho('la azul')]);
    expect(estado.tarjetaId).toBe(p.azul);
    expect(siguientePregunta(flujoMsi, estado)).toBeNull();
  });

  it('una tarjeta que no está en la lista es un error en la misma pregunta', () => {
    const p = tele();
    const e0 = flujoMsi.inicial(p.ctx, sinTarjeta(p));
    const paso = flujoMsi.pasos[0];
    expect(paso?.aplicar(e0, chip('otra'))).toEqual({ error: T.ERROR_ELEGIR });
    expect(paso?.aplicar(e0, dicho('con la de mi abuela'))).toEqual({ error: T.ERROR_ELEGIR });
  });

  it('«no tengo una tarjeta «ora»»: el alias se aprende para la que elijas', async () => {
    const p = tele();
    const base = sinTarjeta(p);
    const r: ConfirmarMsi = {
      ...base,
      propuesta: {
        ...base.propuesta,
        faltaTarjeta: { motivo: 'no_encontrada', alias: 'dorada', candidatas: [] },
      },
    };
    const e0 = flujoMsi.inicial(p.ctx, r);
    expect(siguientePregunta(flujoMsi, e0)?.texto).toBe('No tengo una tarjeta «dorada». ¿Con cuál fue?');
    const { estado } = contestar(flujoMsi, e0, [chip(p.oro)]);
    await flujoMsi.guardar(p.ctx, estado);
    // La próxima vez «con la dorada» ya es la Oro.
    const otra = registrarTextoLocal(
      p.ctx,
      'compré una tele de 12 mil a 12 meses sin intereses con la dorada',
      'voz',
    );
    expect(otra).toMatchObject({ resultado: 'confirmar_msi', propuesta: { entrada: { tarjetaId: p.oro } } });
  });

  it('las filas de meses y tarjeta se tocan para cambiarlas y la mensualidad sale del calendario', () => {
    const p = tele();
    const e = flujoMsi.inicial(p.ctx, p.r);
    const { fila, acciones } = entendi(flujoMsi, p.ctx, e);
    expect(fila('meses').opciones?.map((o) => o.valor)).toEqual(['3', '6', '9', '12', '18', '24']);
    fila('meses').alCambiar?.('6');
    const seis = acciones.actualizar?.mock.calls[0]?.[0];
    expect(seis?.entrada.meses).toBe(6);
    expect(entendi(flujoMsi, p.ctx, seis as typeof e).fila('mensualidad').valor).toBe('$2,000');
    fila('tarjeta').alCambiar?.(p.azul);
    expect(acciones.actualizar?.mock.calls[1]?.[0]?.tarjetaId).toBe(p.azul);
  });

  it('una compra que no se reparte exacto dice la primera cuota y las demás', () => {
    expect(T.valorMensualidad(100_001, 100_000, 1)).toBe('$1,000.01 la primera, luego $1,000');
    expect(T.valorMensualidad(33_334, 33_333, 2)).toBe('$333.34 las primeras 2, luego $333.33');
  });

  it('«Cambiar algo» deja la propuesta con lo elegido para la confirmación larga', () => {
    const p = tele();
    const e0 = flujoMsi.inicial(p.ctx, sinTarjeta(p));
    const { estado } = contestar(flujoMsi, e0, [chip(p.azul)]);
    expect(flujoMsi.formularioLargo(estado)).toEqual({ pathname: '/registrar', params: { flujo: 'msi' } });
    expect(tomarPrellenado('msi')).toMatchObject({
      resultado: 'confirmar_msi',
      propuesta: { entrada: { tarjetaId: p.azul, monto: 1_200_000, meses: 12 }, faltaTarjeta: null },
    });
  });

  it('sin tarjetas no se puede empezar; sin una compra dicha, tampoco', () => {
    const vacia = baseVacia();
    expect(iniciarFlujo('msi', vacia.ctx, null)).toEqual({ noDisponible: T.SIN_TARJETAS_MSI });
    const p = tele();
    expect(() => flujoMsi.inicial(p.ctx, null)).toThrow(
      expect.objectContaining({ codigo: 'flujo_sin_origen' }),
    );
  });
});
