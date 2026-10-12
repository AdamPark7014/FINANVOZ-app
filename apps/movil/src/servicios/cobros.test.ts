import { describe, expect, it } from 'vitest';
import { ErrorDominio } from '@cartera/core';
import { puertoEnMemoria } from '../avisos/puerto';
import { aceptarConsentimiento } from '../privacidad/consentimiento';
import { fijarPreferenciasAvisos } from './avisos-tarjetas';
import {
  armarMensajeCobro,
  borrarDatosCobro,
  clabeValida,
  detallePersona,
  fijarRecordatorioCobro,
  formatearCelular,
  formatearClabe,
  guardarDatosCobro,
  leerDatosCobro,
  opcionesRecordatorioCobro,
  prepararCobro,
  recordatorioCobro,
  sincronizarRecordatoriosCobro,
} from './cobros';
import { registrarCuentaDividida } from './cuenta-dividida';
import { anularMovimiento } from './formulario';
import { agregarCuenta } from './onboarding';
import { crearPersona, registrarPrestamo } from './personas';
import { abrirPrueba } from './__pruebas__/base';

/** CLABE con dígito de control válido (la del ejemplo de `02 §17` con el control corregido). */
const CLABE = '012345678901234568';

function base(hoy = '2026-10-10') {
  const p = abrirPrueba(hoy);
  aceptarConsentimiento(p.ctx, { datosFinancieros: true });
  const bbva = agregarCuenta(p.ctx, { subtipo: 'debito', nombre: 'BBVA', saldo: 500_000 });
  const caro = crearPersona(p.ctx, { nombre: 'Caro' });
  const juan = crearPersona(p.ctx, { nombre: 'Juan Pérez' });
  const ana = crearPersona(p.ctx, { nombre: 'Ana' });
  return { ...p, bbva, caro, juan, ana };
}

function cena(p: ReturnType<typeof base>, descripcion?: string) {
  return registrarCuentaDividida(p.ctx, {
    total: 120_000,
    partes: 4,
    personaIds: [p.caro, p.juan, p.ana],
    origenId: p.bbva,
    categoria: 'comida_fuera',
    ...(descripcion ? { descripcion } : {}),
  });
}

describe('datos para cobrar', () => {
  it('dígito de control de la CLABE', () => {
    expect(clabeValida(CLABE)).toBe(true);
    expect(clabeValida('012345678901234567')).toBe(false);
    expect(clabeValida('01234567890123456')).toBe(false);
    expect(clabeValida('002010077777777771')).toBe(true);
  });

  it('se guardan sin espacios y solo en el teléfono; se validan', () => {
    const p = base();
    expect(leerDatosCobro(p.ctx)).toBeNull();
    expect(guardarDatosCobro(p.ctx, { celular: '22 1234 5678', clabe: '0123 4567 8901 2345 68' })).toEqual({
      celular: '2212345678',
      clabe: CLABE,
    });
    expect(leerDatosCobro(p.ctx)).toEqual({ celular: '2212345678', clabe: CLABE });
    const codigo = (f: () => unknown) => {
      try {
        f();
      } catch (e) {
        return e instanceof ErrorDominio ? e.codigo : 'otro';
      }
      return null;
    };
    expect(codigo(() => guardarDatosCobro(p.ctx, { celular: '', clabe: '' }))).toBe('datos_cobro_vacios');
    expect(codigo(() => guardarDatosCobro(p.ctx, { celular: '221234' }))).toBe('celular_invalido');
    expect(codigo(() => guardarDatosCobro(p.ctx, { clabe: '012345678901234567' }))).toBe('clabe_invalida');
    // Un error no borra lo que ya estaba.
    expect(leerDatosCobro(p.ctx)).toEqual({ celular: '2212345678', clabe: CLABE });
    guardarDatosCobro(p.ctx, { celular: '2212345678' });
    expect(leerDatosCobro(p.ctx)).toEqual({ celular: '2212345678', clabe: null });
    borrarDatosCobro(p.ctx);
    expect(leerDatosCobro(p.ctx)).toBeNull();
  });

  it('formato de lectura', () => {
    expect(formatearCelular('2212345678')).toBe('22 1234 5678');
    expect(formatearClabe(CLABE)).toBe('0123 4567 8901 2345 68');
  });
});

describe('CA-M8-02 · Cobrar', () => {
  it('sin datos para cobrar, primero los pide', () => {
    const p = base();
    cena(p, 'la cena');
    expect(prepararCobro(p.ctx, p.caro)).toEqual({ resultado: 'faltan_datos' });
  });

  it('arma el mensaje de 02 §17 con el monto, el concepto, la fecha y los datos', () => {
    const p = base();
    cena(p, 'la cena');
    guardarDatosCobro(p.ctx, { celular: '2212345678', clabe: CLABE });
    expect(prepararCobro(p.ctx, p.caro)).toEqual({
      resultado: 'mensaje',
      texto:
        'Hola Caro, te recuerdo los $300 de la cena del sáb 10 oct. Me los puedes mandar a mi celular ' +
        '22 1234 5678 (DiMo) o a mi CLABE 0123 4567 8901 2345 68. Gracias.',
    });
  });

  it('solo con el nombre de pila, solo con celular y sin descripción', () => {
    const p = base();
    cena(p);
    guardarDatosCobro(p.ctx, { celular: '2212345678' });
    expect(prepararCobro(p.ctx, p.juan)).toEqual({
      resultado: 'mensaje',
      texto:
        'Hola Juan, te recuerdo los $300 del sáb 10 oct. Me los puedes mandar a mi celular 22 1234 5678 ' +
        '(DiMo). Gracias.',
    });
  });

  it('si debe de varias cosas o ya pagó una parte, no inventa concepto', () => {
    const p = base();
    cena(p, 'la cena');
    guardarDatosCobro(p.ctx, { clabe: CLABE });
    registrarPrestamo(p.ctx, { tipo: 'cobro_prestamo', personaId: p.caro, cuentaId: p.bbva, monto: 10_050 });
    expect(prepararCobro(p.ctx, p.caro)).toEqual({
      resultado: 'mensaje',
      texto:
        'Hola Caro, te recuerdo los $199.50 que me debes. Me los puedes mandar a mi CLABE 0123 4567 8901 ' +
        '2345 68. Gracias.',
    });
  });

  it('un cargo anulado no cuenta; si ya no te debe, no hay nada que cobrar', () => {
    const p = base();
    const r = cena(p, 'la cena');
    guardarDatosCobro(p.ctx, { clabe: CLABE });
    anularMovimiento(p.ctx, r.transaccionId);
    expect(prepararCobro(p.ctx, p.caro)).toEqual({ resultado: 'sin_saldo' });
  });

  it('el mensaje solo se arma, no mueve dinero', () => {
    const p = base();
    cena(p, 'la cena');
    guardarDatosCobro(p.ctx, { celular: '2212345678' });
    prepararCobro(p.ctx, p.caro);
    expect(p.ctx.libro.saldo(p.caro)).toBe(30_000);
  });

  it('armarMensajeCobro es puro', () => {
    expect(
      armarMensajeCobro(
        { celular: null, clabe: CLABE },
        { nombre: '  Carolina  Pérez', saldo: 123_456 },
        { monto: 123_456, descripcion: 'las pizzas', fecha: '2026-10-07' },
      ),
    ).toBe(
      'Hola Carolina, te recuerdo los $1,234.56 de las pizzas del mié 7 oct. Me los puedes mandar a mi CLABE ' +
        '0123 4567 8901 2345 68. Gracias.',
    );
  });
});

describe('recordatorios de cobro', () => {
  it('opciones a partir de hoy', () => {
    const p = base();
    expect(opcionesRecordatorioCobro(p.ctx)).toEqual([
      { fecha: '2026-10-11', etiqueta: 'Mañana' },
      { fecha: '2026-10-13', etiqueta: 'En 3 días' },
      { fecha: '2026-10-17', etiqueta: 'En una semana' },
    ]);
  });

  it('se programan sin nombres ni montos y se cancelan cuando te pagan', async () => {
    const p = base();
    cena(p, 'la cena');
    const puerto = puertoEnMemoria();
    fijarRecordatorioCobro(p.ctx, p.caro, '2026-10-13');
    fijarRecordatorioCobro(p.ctx, p.juan, '2026-10-11');
    expect(recordatorioCobro(p.ctx, p.caro)).toBe('2026-10-13');
    await sincronizarRecordatoriosCobro(p.ctx, puerto, '10:00');
    expect(puerto.lista()).toEqual([
      {
        id: `cobro:${p.caro}`,
        fecha: '2026-10-13',
        hora: '09:00',
        titulo: 'Recordatorio de cobro',
        cuerpo: 'Hoy querías cobrar lo que te deben. Abre Finanvoz para mandar el mensaje.',
      },
      expect.objectContaining({ id: `cobro:${p.juan}`, fecha: '2026-10-11' }),
    ]);
    expect(JSON.stringify(puerto.lista())).not.toMatch(/Caro|Juan|300|\$/);

    // Caro paga: su aviso se cancela; el de Juan sigue.
    registrarPrestamo(p.ctx, { tipo: 'cobro_prestamo', personaId: p.caro, cuentaId: p.bbva, monto: 30_000 });
    const r = await sincronizarRecordatoriosCobro(p.ctx, puerto, '10:00');
    expect(r.canceladas).toEqual([`cobro:${p.caro}`]);
    expect(puerto.lista().map((n) => n.id)).toEqual([`cobro:${p.juan}`]);
    expect(recordatorioCobro(p.ctx, p.caro)).toBeNull();

    // Quitarlo a mano.
    fijarRecordatorioCobro(p.ctx, p.juan, null);
    await sincronizarRecordatoriosCobro(p.ctx, puerto, '10:00');
    expect(puerto.lista()).toEqual([]);
  });

  it('respeta la hora y el horario silencioso de Ajustes → Avisos', async () => {
    const p = base();
    cena(p);
    fijarPreferenciasAvisos(p.ctx, { hora: '23:00' });
    fijarRecordatorioCobro(p.ctx, p.caro, '2026-10-11');
    const puerto = puertoEnMemoria();
    await sincronizarRecordatoriosCobro(p.ctx, puerto, '10:00');
    expect(puerto.lista()).toEqual([expect.objectContaining({ fecha: '2026-10-12', hora: '08:00' })]);
  });

  it('uno por persona, en un día después de hoy y solo si te debe', () => {
    const p = base();
    cena(p);
    fijarRecordatorioCobro(p.ctx, p.caro, '2026-10-13');
    fijarRecordatorioCobro(p.ctx, p.caro, '2026-10-17');
    expect(recordatorioCobro(p.ctx, p.caro)).toBe('2026-10-17');
    expect(() => fijarRecordatorioCobro(p.ctx, p.caro, '2026-10-10')).toThrow(ErrorDominio);
    const pepe = crearPersona(p.ctx, { nombre: 'Pepe' });
    expect(() => fijarRecordatorioCobro(p.ctx, pepe, '2026-10-13')).toThrow(ErrorDominio);
    expect(() => fijarRecordatorioCobro(p.ctx, p.bbva, '2026-10-13')).toThrow(ErrorDominio);
  });

  it('un recordatorio que ya pasó deja de mostrarse', () => {
    const p = base();
    cena(p);
    fijarRecordatorioCobro(p.ctx, p.caro, '2026-10-11');
    p.reloj.fijar('2026-10-12');
    expect(recordatorioCobro(p.ctx, p.caro)).toBeNull();
  });
});

describe('detalle de una persona', () => {
  it('saldo, recordatorio y sus movimientos', () => {
    const p = base();
    cena(p, 'la cena');
    fijarRecordatorioCobro(p.ctx, p.caro, '2026-10-13');
    const d = detallePersona(p.ctx, p.caro);
    expect(d).toMatchObject({
      personaId: p.caro,
      nombre: 'Caro',
      saldo: 30_000,
      recordatorio: { fecha: '2026-10-13', etiqueta: 'mar 13 oct' },
    });
    expect(d.movimientos).toEqual([
      expect.objectContaining({ tipo: 'cuenta_dividida', descripcion: 'la cena' }),
    ]);
    expect(() => detallePersona(p.ctx, p.bbva)).toThrow(ErrorDominio);
  });
});
