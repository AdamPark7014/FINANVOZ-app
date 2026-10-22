import { describe, expect, it } from 'vitest';
import { CUENTAS_SISTEMA } from '@cartera/datos';
import { aceptarConsentimiento } from '../privacidad/consentimiento';
import { deshacer, registrarMovimiento } from './formulario';
import { listarMovimientos } from './movimientos';
import { agregarCuenta, agregarTarjetaCredito } from './onboarding';
import type { PlainDate, Regla } from '@cartera/core';
import { obtenerColchon } from './ajustes';
import { ingresoPrincipal, programadosActivos } from './programados';
import {
  confirmarAjuste,
  confirmarRegistro,
  confirmarTanda,
  contarPorInterpretar,
  descartarPorInterpretar,
  listarPorInterpretar,
  registrarTexto,
  registrarTextoLocal,
  TOPE_OPTIMISTA,
} from './registrar';
import { crearTanda } from './tandas';
import { abrirPrueba, golden, vector } from './__pruebas__/base';
import { nubeFalsa } from './__pruebas__/nube';

interface VectorE11 {
  aportacion: number;
  participantes: number;
  turno: number;
  regla: Regla;
  inicio: PlainDate;
}

function conCuentas() {
  const p = abrirPrueba();
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
  return { ...p, efectivo, bbva, nu };
}

describe('registrar por voz o texto', () => {
  it('CA-M2-02 · "coca 25 en efectivo" se registra sin red, el efectivo baja $25 y Deshacer lo regresa', async () => {
    const p = conCuentas();
    const antes = p.ctx.libro.saldo(p.efectivo);
    const r = await registrarTexto(p.ctx, 'coca 25 en efectivo', 'voz');
    if (r.resultado !== 'registrado') throw new Error(`se esperaba registro, llegó ${r.resultado}`);
    expect(p.ctx.libro.saldo(p.efectivo)).toBe(antes - 2_500);
    expect(r.movimientos).toEqual([
      {
        transaccionId: expect.any(String),
        tipo: 'gasto',
        descripcion: 'coca',
        monto: 2_500,
        categoria: 'Antojos',
        cuenta: 'Cartera',
        porAsignar: false,
        cobertura: null,
        preguntaLiquidar: null,
        avisoDeducible: false,
      },
    ]);
    const t = p.ctx.libro.obtener(r.movimientos[0]?.transaccionId as string);
    expect(t).toMatchObject({ tipo: 'gasto', origen: 'voz', fecha: '2026-10-11' });

    deshacer(p.ctx, r.deshacer);
    expect(p.ctx.libro.saldo(p.efectivo)).toBe(antes);
    expect(listarMovimientos(p.ctx)).toEqual([]);
    expect(p.ctx.libro.comprobarIntegridad()).toEqual([]);
  });

  it('sin método de pago queda "por asignar" (caso 13)', async () => {
    const p = conCuentas();
    const r = await registrarTexto(p.ctx, 'coca 25');
    if (r.resultado !== 'registrado') throw new Error(r.resultado);
    expect(r.movimientos[0]?.porAsignar).toBe(true);
    expect(p.ctx.libro.saldo(CUENTAS_SISTEMA.porAsignar)).toBe(-2_500);
    expect(listarMovimientos(p.ctx)[0]?.movimientos[0]?.insignias).toEqual(['por_asignar']);
  });

  it('con alias de tarjeta registra contra la tarjeta', async () => {
    const p = conCuentas();
    const r = await registrarTexto(p.ctx, 'tacos 80 con la morada');
    if (r.resultado !== 'registrado') throw new Error(r.resultado);
    expect(p.ctx.libro.saldo(p.nu)).toBe(-200_000 - 8_000);
  });

  it('lo que el nivel 0 no cubre queda "por interpretar" sin tocar el libro', async () => {
    const p = conCuentas();
    const r = await registrarTexto(p.ctx, 'ayer le pasé 200 a mi jefa', 'voz');
    expect(r).toMatchObject({ resultado: 'por_interpretar', motivo: 'sin_nube' });
    expect(listarMovimientos(p.ctx)).toEqual([]);
    expect(contarPorInterpretar(p.ctx)).toBe(1);
    const [frase] = listarPorInterpretar(p.ctx);
    expect(frase).toMatchObject({ texto: 'ayer le pasé 200 a mi jefa', origen: 'voz', fecha: '2026-10-11' });
    descartarPorInterpretar(p.ctx, frase?.id as string);
    expect(contarPorInterpretar(p.ctx)).toBe(0);
  });

  it('más de $5,000 pide confirmación; "Guardar" registra', async () => {
    const p = conCuentas();
    const r = await registrarTexto(p.ctx, 'compré una tele de 6000 en efectivo');
    if (r.resultado !== 'confirmar') throw new Error(r.resultado);
    expect(r.motivo).toBe('monto_alto');
    expect(listarMovimientos(p.ctx)).toEqual([]);
    const [propuesta] = r.propuestas;
    expect(propuesta?.entrada).toMatchObject({ tipo: 'gasto', monto: 600_000, origenId: p.efectivo });
    const guardado = confirmarRegistro(p.ctx, [propuesta?.entrada as never], 'texto');
    expect(guardado.movimientos[0]?.monto).toBe(600_000);
    expect(p.ctx.libro.saldo(p.efectivo)).toBe(64_000 - 600_000);
  });

  it('retiro con dos cuentas de débito pregunta cuál (chips con candidatas)', async () => {
    const p = conCuentas();
    agregarCuenta(p.ctx, { subtipo: 'debito', nombre: 'Banorte', saldo: 0 });
    const r = await registrarTexto(p.ctx, 'saqué 500 del cajero');
    if (r.resultado !== 'confirmar') throw new Error(r.resultado);
    expect(r.motivo).toBe('cuenta');
    expect(r.propuestas[0]?.faltan[0]).toMatchObject({ campo: 'origenId', motivo: 'ambigua' });
    expect(r.propuestas[0]?.faltan[0]?.candidatas.map((c) => c.nombre).sort()).toEqual(['BBVA', 'Banorte']);
  });

  it('"cuánto puedo gastar" es una consulta, no un registro', async () => {
    const p = conCuentas();
    expect(await registrarTexto(p.ctx, 'cuánto puedo gastar hoy')).toMatchObject({
      resultado: 'consulta',
      respuesta: { plantilla: 'hoy_puedes' },
    });
  });
});

describe('configurar desde Hoy con el nivel 0 (K01–K08, sin nube)', () => {
  it('K02 · el colchón se propone y solo se guarda con "Guardar"', async () => {
    const p = conCuentas();
    const r = await registrarTexto(p.ctx, golden('K02').texto, 'voz');
    if (r.resultado !== 'confirmar_ajuste') throw new Error(r.resultado);
    expect(r.propuesta).toEqual({ tipo: 'colchon', monto: 50_000, actual: 0 });
    expect(obtenerColchon(p.ctx)).toBe(0);
    expect(contarPorInterpretar(p.ctx)).toBe(0);
    expect(confirmarAjuste(p.ctx, r.propuesta, 'voz')).toEqual({
      tipo: 'colchon',
      monto: 50_000,
      anterior: 0,
    });
    expect(obtenerColchon(p.ctx)).toBe(50_000);
    // V03 · "treinta y un mil" (A0).
    const v03 = registrarTextoLocal(p.ctx, 'quiero treinta y un mil de colchón', 'voz');
    expect(v03).toMatchObject({
      resultado: 'confirmar_ajuste',
      propuesta: { monto: 3_100_000, actual: 50_000 },
    });
  });

  it('K03 y V01 · el ingreso se propone con su próximo pago y "Guardar" lo configura', async () => {
    const p = conCuentas();
    const r = await registrarTexto(p.ctx, 'me pagan 8 mil 500 cada quincena', 'voz');
    if (r.resultado !== 'confirmar_ajuste') throw new Error(r.resultado);
    expect(r.propuesta).toEqual({
      tipo: 'ingreso',
      concepto: 'quincena',
      monto: 850_000,
      regla: { tipo: 'quincenal_15_ultimo' },
      proximoPago: '2026-10-15',
      anterior: null,
    });
    expect(ingresoPrincipal(p.ctx)).toBeNull();
    confirmarAjuste(p.ctx, r.propuesta, 'voz');
    expect(ingresoPrincipal(p.ctx)).toMatchObject({ monto: 850_000, regla: { tipo: 'quincenal_15_ultimo' } });
    // Con un ingreso ya configurado, la propuesta dice cuál reemplaza.
    expect(registrarTextoLocal(p.ctx, golden('K03').texto, 'voz')).toMatchObject({
      resultado: 'confirmar_ajuste',
      propuesta: { tipo: 'ingreso', monto: 800_000, anterior: { concepto: 'quincena', monto: 850_000 } },
    });
  });

  it('K04 · el saldo de una cuenta se propone y "Guardar" registra la conciliación por la diferencia', async () => {
    const p = conCuentas();
    const r = await registrarTexto(p.ctx, golden('K04').texto, 'voz');
    if (r.resultado !== 'confirmar_ajuste') throw new Error(r.resultado);
    expect(r.propuesta).toEqual({
      tipo: 'saldo_cuenta',
      monto: 420_000,
      cuentaId: p.bbva,
      saldoActual: 359_000,
      faltaCuenta: null,
    });
    expect(p.ctx.libro.saldo(p.bbva)).toBe(359_000);
    const g = confirmarAjuste(p.ctx, r.propuesta, 'voz');
    if (g.tipo !== 'saldo_cuenta') throw new Error(g.tipo);
    expect(p.ctx.libro.saldo(p.bbva)).toBe(420_000);
    expect(p.ctx.libro.obtener(g.transaccionId as string)).toMatchObject({
      tipo: 'conciliacion',
      origen: 'voz',
    });
    expect(p.ctx.libro.comprobarIntegridad()).toEqual([]);
    // Mismo saldo: no registra nada.
    expect(confirmarAjuste(p.ctx, r.propuesta, 'voz')).toMatchObject({ transaccionId: null });
  });

  it('saldo con varias cuentas de débito y sin alias pide elegir; solo débito o billetera', () => {
    const p = conCuentas();
    const banorte = agregarCuenta(p.ctx, { subtipo: 'debito', nombre: 'Banorte', saldo: 0, alias: ['azul'] });
    // El nivel 0 no adivina la cuenta: "tengo 500 en la azul" sí la nombra.
    expect(registrarTextoLocal(p.ctx, 'tengo 500 en la azul', 'texto')).toMatchObject({
      resultado: 'confirmar_ajuste',
      propuesta: { tipo: 'saldo_cuenta', cuentaId: banorte, saldoActual: 0 },
    });
    // La nube puede mandar el saldo sin alias: con dos cuentas de débito, chips para elegir.
    const propuesta = {
      tipo: 'saldo_cuenta' as const,
      monto: 10_000,
      cuentaId: null,
      saldoActual: null,
      faltaCuenta: null,
    };
    expect(() => confirmarAjuste(p.ctx, propuesta, 'texto')).toThrow(
      expect.objectContaining({ codigo: 'cuenta_invalida' }),
    );
    expect(() => confirmarAjuste(p.ctx, propuesta, 'texto', { cuentaId: p.nu })).toThrow(
      expect.objectContaining({ codigo: 'cuenta_invalida' }),
    );
    expect(confirmarAjuste(p.ctx, propuesta, 'texto', { cuentaId: banorte })).toMatchObject({
      saldo: 10_000,
    });
    expect(p.ctx.libro.saldo(banorte)).toBe(10_000);
  });

  it('K06 · el compromiso se configura al instante con "Deshacer" y el concepto sin artículo', async () => {
    const p = conCuentas();
    const r = await registrarTexto(p.ctx, golden('K06').texto, 'voz');
    if (r.resultado !== 'configurado') throw new Error(r.resultado);
    expect(r.compromiso).toMatchObject({ concepto: 'Renta', monto: 650_000, proxima: '2026-11-01' });
    expect(programadosActivos(p.ctx)).toHaveLength(1);
    expect(contarPorInterpretar(p.ctx)).toBe(0);
    // K07 (fecha única) y K08 (anual) también se entienden sin nube.
    expect(registrarTextoLocal(p.ctx, golden('K07').texto, 'voz')).toMatchObject({
      resultado: 'configurado',
      compromiso: { concepto: 'Predial', monto: 300_000, proxima: '2026-11-03' },
    });
    expect(registrarTextoLocal(p.ctx, golden('K08').texto, 'voz')).toMatchObject({
      resultado: 'configurado',
      compromiso: { concepto: 'Seguro del coche', monto: 980_000 },
    });
  });

  it('K01 y V05 · el ciclo de la tarjeta se cambia al instante con "Deshacer"', () => {
    const p = conCuentas();
    expect(registrarTextoLocal(p.ctx, 'mi Nu corta el 25, pago el 15', 'voz')).toMatchObject({
      resultado: 'tarjeta_configurada',
      tarjeta: 'Nu',
      deshacer: expect.any(String),
    });
  });

  it('lo que el nivel 0 deja en null (V08, V09) sigue esperando a la nube', async () => {
    const p = conCuentas();
    for (const id of ['V08', 'V09']) {
      expect(await registrarTexto(p.ctx, golden(id).texto, 'voz'), id).toMatchObject({
        resultado: 'por_interpretar',
        motivo: 'sin_nube',
      });
    }
    expect(contarPorInterpretar(p.ctx)).toBe(2);
  });
});

describe('formulario de movimiento', () => {
  it('registra cada tipo que origina el usuario y valida el patrón de cuentas', () => {
    const p = conCuentas();
    registrarMovimiento(p.ctx, {
      tipo: 'ingreso',
      monto: 100_000,
      categoria: 'honorarios',
      destinoId: p.bbva,
    });
    registrarMovimiento(p.ctx, {
      tipo: 'transferencia',
      monto: 10_000,
      origenId: p.bbva,
      destinoId: p.efectivo,
    });
    registrarMovimiento(p.ctx, {
      tipo: 'retiro_efectivo',
      monto: 5_000,
      origenId: p.bbva,
      destinoId: p.efectivo,
    });
    registrarMovimiento(p.ctx, { tipo: 'pago_tarjeta', monto: 50_000, origenId: p.bbva, destinoId: p.nu });
    registrarMovimiento(p.ctx, {
      tipo: 'gasto',
      monto: 1_000,
      categoria: 'super',
      origenId: p.nu,
      comercio: 'OXXO',
    });
    expect(p.ctx.libro.saldo(p.bbva)).toBe(359_000 + 100_000 - 10_000 - 5_000 - 50_000);
    expect(p.ctx.libro.saldo(p.efectivo)).toBe(64_000 + 10_000 + 5_000);
    expect(p.ctx.libro.saldo(p.nu)).toBe(-200_000 + 50_000 - 1_000);
    // Un pago de tarjeta hacia una cuenta de débito no es un patrón válido.
    expect(() =>
      registrarMovimiento(p.ctx, {
        tipo: 'pago_tarjeta',
        monto: 1_000,
        origenId: p.efectivo,
        destinoId: p.bbva,
      }),
    ).toThrow(expect.objectContaining({ codigo: 'patron_invalido' }));
    expect(() =>
      registrarMovimiento(p.ctx, { tipo: 'gasto', monto: 1.5, categoria: 'super', origenId: p.efectivo }),
    ).toThrow(expect.objectContaining({ codigo: 'movimiento_invalido' }));
    const dias = listarMovimientos(p.ctx);
    expect(dias).toHaveLength(1);
    expect(dias[0]?.etiqueta).toBe('11 oct');
    expect(dias[0]?.movimientos.map((m) => m.tipo)).toEqual([
      'gasto',
      'pago_tarjeta',
      'retiro_efectivo',
      'transferencia',
      'ingreso',
    ]);
    expect(dias[0]?.movimientos[0]).toMatchObject({
      sentido: 'salida',
      saleDe: ['Nu'],
      categoria: 'Súper',
      monto: 1_000,
      comercio: 'OXXO',
    });
  });
});

describe('confirmar tanda por voz (TK02, pendiente 41)', () => {
  const entradaTanda = () => {
    const v = vector<VectorE11>('E11-01');
    return {
      nombre: 'Tanda vecinos',
      aportacion: v.aportacion,
      participantes: v.participantes,
      turno: v.turno,
      regla: v.regla,
      inicio: v.inicio,
    };
  };

  function conTanda(hoy: PlainDate = '2026-10-11') {
    const p = abrirPrueba(hoy);
    aceptarConsentimiento(p.ctx, { datosFinancieros: true });
    const efectivo = agregarCuenta(p.ctx, { subtipo: 'efectivo', nombre: 'Cartera', saldo: 100_000 });
    const bbva = agregarCuenta(p.ctx, { subtipo: 'debito', nombre: 'BBVA', saldo: 1_000_000 });
    const { tandaId } = crearTanda(p.ctx, entradaTanda());
    return { ...p, efectivo, bbva, tandaId };
  }

  it('monto mayor a $5,000 pide confirmación aunque haya una sola tanda', async () => {
    const p = conTanda();
    const texto = 'me tocó la tanda, me dieron seis mil en efectivo';
    const f = nubeFalsa({
      [texto]: {
        intencion: 'registrar',
        movimientos: [
          {
            tipo: 'cobro_tanda',
            monto: TOPE_OPTIMISTA + 100_000,
            fecha: '2026-10-11',
            destino: { tipo: 'efectivo' },
          },
        ],
      },
    });
    const r = await registrarTexto(p.ctx, texto, 'voz', { nube: f.nube });
    expect(r).toMatchObject({
      resultado: 'confirmar_tanda',
      motivo: 'monto_alto',
      propuesta: {
        tipo: 'cobro_tanda',
        monto: TOPE_OPTIMISTA + 100_000,
        tandaId: p.tandaId,
        cuentaId: p.efectivo,
      },
    });
  });

  it('confirmarTanda registra el cobro tras elegir tanda y cuenta', () => {
    const p = conTanda();
    const r = confirmarTanda(
      p.ctx,
      {
        tandaId: p.tandaId,
        cuentaId: p.efectivo,
        monto: 500_000,
        tipo: 'cobro_tanda',
        fecha: '2026-10-11',
      },
      'voz',
    );
    expect(r.resultado).toBe('registrado_tanda');
    expect(r.movimiento).toMatchObject({ monto: 500_000, cuenta: 'Cartera' });
    expect(p.ctx.libro.saldo(p.efectivo)).toBe(600_000);
  });
});
