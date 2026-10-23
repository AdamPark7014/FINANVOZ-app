import { describe, expect, it } from 'vitest';
import { interpretarPaso } from '@cartera/nlu';
import { agregarCuenta } from '../../servicios/onboarding';
import { configurarCicloPorVoz } from '../../servicios/config-tarjetas';
import { contextoInterprete } from '../../servicios/registrar';
import { planesVigentes, tarjetasActivas } from '../../servicios/tarjetas';
import { siguientePregunta } from './index';
import { tomarPrellenado } from './prellenado';
import { flujoTarjeta, type EstadoTarjeta } from './tarjeta';
import * as T from './textos';
import { baseVacia, chip, contestar, dicho, entendi, monto } from './__pruebas__/base';

function base() {
  const p = baseVacia();
  const bbva = agregarCuenta(p.ctx, { subtipo: 'debito', nombre: 'BBVA', saldo: 359_000 });
  return { ...p, bbva };
}

const lectura = (p: ReturnType<typeof base>, frase: string) =>
  interpretarPaso('tarjeta', frase, contextoInterprete(p.ctx));

describe('flujo tarjeta (CA-O7 6)', () => {
  it('«tengo una Nu que corta el 28 y pago el 18»: dos preguntas, «Entendí · ¿la agrego?» y la tarjeta queda creada', async () => {
    const p = base();
    const e0 = flujoTarjeta.inicial(p.ctx, lectura(p, 'tengo una Nu que corta el 28 y pago el 18'));
    const { estado, preguntas } = contestar(flujoTarjeta, e0, [
      dicho('tres mil doscientos'),
      chip('totalero'),
    ]);
    expect(preguntas.map((q) => q.paso)).toEqual(['saldo', 'modo']);
    expect(preguntas[0]).toMatchObject({
      texto: '¿Cuánto debes hoy en la Nu?',
      ayuda: T.AYUDA_SALDO_TARJETA,
      campo: 'monto',
      admiteCero: true,
    });
    expect(preguntas[1]?.chips.map((c) => c.etiqueta)).toEqual(['Sí, completa', 'No, una parte']);
    expect(siguientePregunta(flujoTarjeta, estado)).toBeNull();

    const { propuesta } = entendi(flujoTarjeta, p.ctx, estado);
    expect(propuesta.titulo).toBe('Entendí · ¿la agrego?');
    expect(propuesta.filas.map((f) => [f.etiqueta, f.valor])).toEqual([
      ['Tarjeta', 'Nu · crédito'],
      ['Ciclo', 'corta el 28 · pagas el 18'],
      ['Debes hoy', '$3,200'],
      ['Cómo la pagas', 'La pagas completa'],
    ]);
    expect(propuesta.confirmar.etiqueta).toBe('Sí, agrégala');
    expect(propuesta.cambiar?.etiqueta).toBe('Cambiar algo');

    const m = await flujoTarjeta.guardar(p.ctx, estado);
    expect(m.texto).toBe('Listo: agregué tu Nu.');
    const [nu] = tarjetasActivas(p.ctx);
    expect(nu).toMatchObject({
      nombre: 'Nu',
      institucion: 'nu_mx',
      modo: 'totalero',
      ciclo: { diaCorte: 28, diaLimitePago: 18 },
      saldoRevolvente: 320_000,
      // Sin límite dicho: lo que debe hoy (no se inventa crédito disponible).
      limiteCredito: 320_000,
    });
    expect(p.ctx.libro.saldo(nu?.cuentaId as string)).toBe(-320_000);
    expect(p.ctx.libro.comprobarIntegridad()).toEqual([]);
  });

  it('desde el chip «Agregar tarjeta» pregunta todo en orden: nombre, corte, día de pago, saldo y modo', () => {
    const p = base();
    const e0 = flujoTarjeta.inicial(p.ctx, null);
    const { estado, preguntas } = contestar(flujoTarjeta, e0, [
      chip('Banamex'),
      dicho('el 10'),
      dicho('me dan 20 días'),
      dicho('no debo nada'),
      dicho('no, pago el mínimo'),
    ]);
    expect(preguntas.map((q) => q.paso)).toEqual(['nombre', 'corte', 'pago', 'saldo', 'modo']);
    expect(preguntas[1]?.texto).toBe('¿Qué día corta la Banamex?');
    expect(estado).toMatchObject({
      nombre: 'Banamex',
      diaCorte: 10,
      diasParaPagar: 20,
      diaLimitePago: null,
      saldo: 0,
      modo: 'plan',
    });
    const { propuesta } = entendi(flujoTarjeta, p.ctx, estado);
    expect(propuesta.filas.find((f) => f.clave === 'ciclo')?.valor).toBe(
      'corta el 10 · pagas 20 días después',
    );
  });

  it('omite lo que ya trae la frase: con límite y saldo solo pregunta si la pagas completa', async () => {
    const p = base();
    const e0 = flujoTarjeta.inicial(
      p.ctx,
      lectura(p, 'mi BBVA corta el 5, pago el 25, mi límite es de 30 mil y debo como 4 mil 200'),
    );
    const { estado, preguntas } = contestar(flujoTarjeta, e0, [dicho('sí')]);
    expect(preguntas.map((q) => q.paso)).toEqual(['modo']);
    const { fila } = entendi(flujoTarjeta, p.ctx, estado);
    expect(fila('saldo').valor).toBe('como $4,200');
    expect(fila('limite').valor).toBe('$30,000');
    await flujoTarjeta.guardar(p.ctx, estado);
    expect(tarjetasActivas(p.ctx)[0]).toMatchObject({
      nombre: 'BBVA',
      limiteCredito: 3_000_000,
      saldoRevolvente: 420_000,
    });
  });

  it('desde `tarjeta_por_agregar` (registrarTexto, K01): el alias dicho es el nombre y solo falta el saldo y el modo', () => {
    const p = base();
    // Lo que devuelve «mi nu corta el 28 y pago el 18» cuando todavía no hay ninguna Nu.
    const r = configurarCicloPorVoz(p.ctx, {
      tipo: 'tarjeta_ciclo',
      alias: 'nu',
      dia_corte: 28,
      dia_limite_pago: 18,
    });
    expect(r).toMatchObject({ resultado: 'tarjeta_por_agregar' });
    const e0 = flujoTarjeta.inicial(p.ctx, { desde: r, porVoz: true });
    expect(e0).toMatchObject({ nombre: 'Nu', alias: 'nu', diaCorte: 28, diaLimitePago: 18 });
    expect(siguientePregunta(flujoTarjeta, e0)?.paso).toBe('saldo');
  });

  it('un error se queda en la misma pregunta y no cambia el estado', () => {
    const p = base();
    const e0 = flujoTarjeta.inicial(p.ctx, null);
    // A «¿Cómo se llama?» contestar el ciclo sin el nombre no avanza (el paso no se vuelve a preguntar).
    expect(flujoTarjeta.pasos[0]?.aplicar(e0, dicho('corta el 5 y pago el 25'))).toEqual({
      error: T.ERROR_NOMBRE_TARJETA,
    });
    const conNombre = flujoTarjeta.pasos
      .find((x) => x.id === 'nombre')
      ?.aplicar(e0, dicho('Stori')) as EstadoTarjeta;
    const corte = flujoTarjeta.pasos.find((x) => x.id === 'corte');
    expect(corte?.aplicar(conNombre, dicho('el 45'))).toEqual({ error: T.ERROR_CORTE });
    const saldo = flujoTarjeta.pasos.find((x) => x.id === 'saldo');
    expect(saldo?.aplicar(conNombre, dicho('no me acuerdo'))).toEqual({ error: T.ERROR_MONTO });
    expect(saldo?.aplicar(conNombre, monto(-5))).toEqual({ error: T.ERROR_MONTO });
    const modo = flujoTarjeta.pasos.find((x) => x.id === 'modo');
    expect(modo?.aplicar(conNombre, dicho('quién sabe'))).toEqual({ error: T.ERROR_ELEGIR });
    expect(conNombre.nombre).toBe('Stori');
  });

  it('con meses que ya tenías pregunta si el saldo los incluye y guarda el plan', async () => {
    const p = base();
    const e0 = flujoTarjeta.inicial(p.ctx, 'tengo una compra a meses de 500 al mes y me faltan 6');
    const { estado, preguntas } = contestar(flujoTarjeta, e0, [
      dicho('Stori'),
      chip('12'),
      dicho('el 2'),
      monto(800_000),
      chip('plan'),
      chip('si'),
    ]);
    expect(preguntas.map((q) => q.paso)).toEqual(['nombre', 'corte', 'pago', 'saldo', 'modo', 'incluye_msi']);
    const { fila } = entendi(flujoTarjeta, p.ctx, estado);
    expect(fila('meses').valor).toBe('1 compra a meses');
    expect(fila('incluye').valor).toBe('Sí, ya lo incluye');
    await flujoTarjeta.guardar(p.ctx, estado);
    const [t] = tarjetasActivas(p.ctx);
    expect(planesVigentes(p.ctx, { tarjetaId: t?.cuentaId as string })).toHaveLength(1);
    // «Sí, ya lo incluye»: los $3,000 de meses salen de la deuda revolvente.
    expect(t?.saldoRevolvente).toBe(500_000);
  });

  it('la fila «Cómo la pagas» se toca para cambiarla; sin `actualizar` solo se lee', () => {
    const p = base();
    const e0 = flujoTarjeta.inicial(p.ctx, lectura(p, 'tengo una Nu que corta el 28 y pago el 18'));
    const { estado } = contestar(flujoTarjeta, e0, [monto(0), chip('totalero')]);
    const { fila, acciones } = entendi(flujoTarjeta, p.ctx, estado);
    expect(fila('modo').opciones?.map((o) => o.etiqueta)).toEqual(['La pagas completa', 'Pagas una parte']);
    fila('modo').alCambiar?.('plan');
    expect(acciones.actualizar).toHaveBeenCalledWith(expect.objectContaining({ modo: 'plan' }));
    expect(entendi(flujoTarjeta, p.ctx, estado, false).fila('modo').opciones).toBeUndefined();
  });

  it('«Cambiar algo» abre el formulario de tarjeta nueva con lo dicho en memoria, no en la ruta', () => {
    const p = base();
    const e0 = flujoTarjeta.inicial(p.ctx, lectura(p, 'tengo una Nu que corta el 28 y pago el 18'));
    const { estado } = contestar(flujoTarjeta, e0, [monto(320_000), chip('totalero')]);
    expect(flujoTarjeta.formularioLargo(estado)).toEqual({
      pathname: '/tarjetas/nueva',
      params: { desde: 'asistente' },
    });
    expect(tomarPrellenado('tarjeta')).toMatchObject({
      alias: 'Nu',
      diaCorte: 28,
      diaLimitePago: 18,
      diasParaPagar: null,
      saldo: 320_000,
      modo: 'totalero',
    });
    expect(tomarPrellenado('tarjeta')).toBeNull();
  });

  it('guardar con datos incompletos no escribe nada', async () => {
    const p = base();
    const e0 = flujoTarjeta.inicial(p.ctx, lectura(p, 'tengo una Nu que corta el 28 y pago el 18'));
    await expect(flujoTarjeta.guardar(p.ctx, e0)).rejects.toMatchObject({ codigo: 'tarjeta_invalida' });
    expect(tarjetasActivas(p.ctx)).toEqual([]);
  });
});
