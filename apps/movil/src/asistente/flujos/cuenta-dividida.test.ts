import { describe, expect, it } from 'vitest';
import { listarCuentas } from '../../servicios/cuentas';
import { deshacer } from '../../servicios/deshacer';
import { agregarCuenta, agregarTarjetaCredito } from '../../servicios/onboarding';
import { crearPersona, listarPersonas } from '../../servicios/personas';
import { registrarTextoLocal, type ResultadoTexto } from '../../servicios/registrar';
import { golden } from '../../servicios/__pruebas__/base';
import { flujoCuentaDividida, type EstadoDivision } from './cuenta-dividida';
import { siguientePregunta } from './index';
import { tomarPrellenado } from './prellenado';
import * as T from './textos';
import { baseVacia, chip, contestar, dicho, entendi } from './__pruebas__/base';

type Division = Extract<ResultadoTexto, { resultado: 'confirmar_division' }>;

/** Como en `servicios/cuenta-dividida.test.ts`: BBVA, Nu y tres contactos (Caro con alias). */
function base() {
  const p = baseVacia();
  const bbva = agregarCuenta(p.ctx, { subtipo: 'debito', nombre: 'BBVA', saldo: 359_000 });
  const nu = agregarTarjetaCredito(p.ctx, {
    nombre: 'Nu',
    diaCorte: 28,
    diaLimitePago: 18,
    limiteCredito: 1_500_000,
    modo: 'totalero',
    saldo: 0,
  }).cuentaId;
  const caro = crearPersona(p.ctx, { nombre: 'Carolina Pérez', alias: ['Caro'] });
  const juan = crearPersona(p.ctx, { nombre: 'Juan' });
  const ana = crearPersona(p.ctx, { nombre: 'Ana' });
  return { ...p, bbva, nu, caro, juan, ana };
}

/** «pagué la cena de 1,200 entre 4 con la Nu» (D01). */
function d01(p: ReturnType<typeof base>): Division {
  const r = registrarTextoLocal(p.ctx, golden('D01').texto, 'voz');
  if (r?.resultado !== 'confirmar_division') throw new Error(String(r?.resultado));
  return r;
}

function conPropuesta(r: Division, cambios: Partial<Division['propuesta']>): Division {
  return { ...r, propuesta: { ...r.propuesta, ...cambios } };
}

describe('flujo cuenta dividida', () => {
  it('D01: pregunta con quién (chips o nombre dicho), «Entendí» con cada parte y guarda con Deshacer', async () => {
    const p = base();
    const e0 = flujoCuentaDividida.inicial(p.ctx, { desde: d01(p), porVoz: true });
    const { estado, preguntas } = contestar(flujoCuentaDividida, e0, [
      dicho('Caro'),
      chip(p.juan),
      dicho('ana'),
    ]);
    expect(preguntas.map((q) => q.texto)).toEqual([
      '¿Con quién fue? Faltan 3.',
      '¿Con quién fue? Faltan 2.',
      '¿Con quién más fue?',
    ]);
    // Ya elegida, Caro no vuelve a salir en los chips.
    expect(preguntas[1]?.chips.map((c) => c.etiqueta)).toEqual(['Ana', 'Juan']);
    expect(siguientePregunta(flujoCuentaDividida, estado)).toBeNull();

    const { propuesta, fila } = entendi(flujoCuentaDividida, p.ctx, estado);
    expect(propuesta).toMatchObject({ titulo: 'Entendí · ¿lo registro?', monto: 120_000 });
    expect(fila('partes').valor).toBe('4, contándote');
    expect(fila('tu_parte').valor).toBe('$300');
    expect(
      propuesta.filas.filter((f) => f.clave.startsWith('persona-')).map((f) => [f.etiqueta, f.valor]),
    ).toEqual([
      ['Carolina Pérez', 'te debe $300'],
      ['Juan', 'te debe $300'],
      ['Ana', 'te debe $300'],
    ]);
    expect(fila('origen').valor).toBe('Nu');

    const m = await flujoCuentaDividida.guardar(p.ctx, estado);
    expect(m.detalle).toBe('Te deben $900.');
    expect(m.texto).toMatch(/^Registré .+ \$1,200 entre 4\.$/);
    expect(listarCuentas(p.ctx).teDeben.map((x) => x.saldo)).toEqual([30_000, 30_000, 30_000]);
    expect(p.ctx.libro.saldo(p.nu)).toBe(-120_000);
    deshacer(p.ctx, m.deshacer as string);
    expect(listarCuentas(p.ctx).teDeben).toEqual([]);
    expect(p.ctx.libro.comprobarIntegridad()).toEqual([]);
  });

  it('un nombre que no es de ningún contacto se agrega al confirmar y la tarjeta lo dice', async () => {
    const p = base();
    const e0 = flujoCuentaDividida.inicial(p.ctx, conPropuesta(d01(p), { partes: 2 }));
    const { estado } = contestar(flujoCuentaDividida, e0, [dicho('Pepe')]);
    expect(entendi(flujoCuentaDividida, p.ctx, estado).fila('persona-1')).toMatchObject({
      etiqueta: 'Pepe',
      valor: 'te debe $600 · contacto nuevo',
    });
    await flujoCuentaDividida.guardar(p.ctx, estado);
    expect(listarPersonas(p.ctx).find((x) => x.nombre === 'Pepe')?.saldo).toBe(60_000);
  });

  it('sin decir entre cuántos, con nombres: tú y los nombrados (no pregunta las partes)', () => {
    const p = base();
    const e = flujoCuentaDividida.inicial(
      p.ctx,
      conPropuesta(d01(p), { partes: null, personaIds: [p.caro], sinResolver: ['Pepe'] }),
    );
    expect(e).toMatchObject({ partes: 3, personaIds: [p.caro], porAgregar: ['Pepe'] });
    expect(siguientePregunta(flujoCuentaDividida, e)).toBeNull();
  });

  it('sin partes ni nombres pregunta entre cuántos; menos de 2 es un error', () => {
    const p = base();
    const e0 = flujoCuentaDividida.inicial(p.ctx, conPropuesta(d01(p), { partes: null }));
    const q = siguientePregunta(flujoCuentaDividida, e0);
    expect(q).toMatchObject({ paso: 'partes', texto: T.PREGUNTA_PARTES });
    expect(q?.chips.map((c) => c.valor)).toEqual(['2', '3', '4', '5', '6']);
    expect(flujoCuentaDividida.pasos[0]?.aplicar(e0, dicho('1'))).toEqual({ error: T.errorPartes(2) });
    const { estado } = contestar(flujoCuentaDividida, e0, [dicho('éramos tres')]);
    expect(estado.partes).toBe(3);
  });

  it('sin método de pago reconocido pregunta con qué pagaste y aprende el alias', async () => {
    const p = base();
    const e0 = flujoCuentaDividida.inicial(
      p.ctx,
      conPropuesta(d01(p), {
        partes: 2,
        personaIds: [p.juan],
        origenId: null,
        faltaOrigen: { motivo: 'no_encontrada', alias: 'azulita', candidatas: [] },
      }),
    );
    const q = siguientePregunta(flujoCuentaDividida, e0);
    expect(q?.texto).toBe('No tengo una cuenta «azulita». ¿Con cuál pagaste?');
    expect(flujoCuentaDividida.pasos[1]?.aplicar(e0, dicho('con la de mi tía'))).toEqual({
      error: T.ERROR_ELEGIR,
    });
    const { estado } = contestar(flujoCuentaDividida, e0, [dicho('bbva')]);
    expect(estado.origenId).toBe(p.bbva);
    await flujoCuentaDividida.guardar(p.ctx, estado);
    expect(p.ctx.libro.saldo(p.bbva)).toBe(359_000 - 120_000);
    // La próxima vez «con la azulita» ya es la BBVA.
    expect(registrarTextoLocal(p.ctx, 'pagué la cena de 1,200 entre 4 con la azulita', 'voz')).toMatchObject({
      resultado: 'confirmar_division',
      propuesta: { origenId: p.bbva },
    });
  });

  it('un nombre de dos contactos se aclara: «¿Quién es «Ana»?»', () => {
    const p = base();
    const otraAna = crearPersona(p.ctx, { nombre: 'Ana López', alias: ['Ana'] });
    const e0 = flujoCuentaDividida.inicial(p.ctx, conPropuesta(d01(p), { partes: 2, sinResolver: ['Ana'] }));
    const q = siguientePregunta(flujoCuentaDividida, e0);
    expect(q).toMatchObject({ paso: 'quien-1', texto: '¿Quién es «Ana»?' });
    expect(q?.chips.map((c) => c.etiqueta)).toEqual(['Ana', 'Ana López', 'Otra persona: Ana']);
    const { estado } = contestar(flujoCuentaDividida, e0, [chip(otraAna)]);
    expect(estado).toMatchObject({ personaIds: [otraAna], porAclarar: [] });
    expect(siguientePregunta(flujoCuentaDividida, estado)).toBeNull();
  });

  it('subir las partes en «Entendí» vuelve a preguntar con quién', () => {
    const p = base();
    const e0 = flujoCuentaDividida.inicial(p.ctx, conPropuesta(d01(p), { partes: 2, personaIds: [p.caro] }));
    const { fila, acciones } = entendi(flujoCuentaDividida, p.ctx, e0);
    expect(fila('partes').opciones?.map((o) => o.valor)).toEqual(['2', '3', '4', '5', '6']);
    fila('partes').alCambiar?.('3');
    const nuevo = acciones.actualizar?.mock.calls[0]?.[0] as EstadoDivision;
    expect(siguientePregunta(flujoCuentaDividida, nuevo)).toMatchObject({
      paso: 'persona-2',
      texto: '¿Con quién más fue?',
    });
  });

  it('guardar sin todas las personas no escribe nada; «Cambiar algo» deja la propuesta para el formulario', async () => {
    const p = base();
    const e0 = flujoCuentaDividida.inicial(p.ctx, d01(p));
    await expect(flujoCuentaDividida.guardar(p.ctx, e0)).rejects.toMatchObject({
      codigo: 'movimiento_invalido',
    });
    expect(listarCuentas(p.ctx).teDeben).toEqual([]);
    const { estado } = contestar(flujoCuentaDividida, e0, [chip(p.caro)]);
    expect(flujoCuentaDividida.formularioLargo(estado)).toEqual({
      pathname: '/registrar',
      params: { flujo: 'cuenta_dividida' },
    });
    expect(tomarPrellenado('cuenta_dividida')).toMatchObject({
      total: 120_000,
      partes: 4,
      origenId: p.nu,
      personaIds: [p.caro],
      sinResolver: [],
    });
  });
});
