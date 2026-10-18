import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { esquema } from '@cartera/datos';
import { procesarApertura } from './apertura';
import { listarCuentas } from './cuentas';
import { registrarMovimiento } from './formulario';
import { obtenerHoy } from './hoy';
import { listarOcurrencias } from './ocurrencias';
import { sincronizarPlan } from './plan';
import { programadoPorId } from './programados';
import { registrarTexto } from './registrar';
import { cargarEscenario } from './semilla';
import {
  aceptarAumentoSuscripcion,
  convertirEnCompromiso,
  fijarNombreSuscripcion,
  listarAumentosSuscripcionPendientes,
  listarSuscripciones,
  mantenerMontoSuscripcion,
  marcarNoEsSuscripcion,
  procesarSuscripciones,
  procesarSuscripcionesDelDia,
  yaLaCancele,
} from './suscripciones';
import { abrirPrueba, escenario, golden, vector } from './__pruebas__/base';
import { nubeFalsa } from './__pruebas__/nube';
import { registrarGastosE14, type GastoVectorE14 } from './__pruebas__/suscripciones';

interface VectorE14 {
  hoy: string;
  catalogo: string[];
  gastos: GastoVectorE14[];
  resumen_activas: { cantidad: number; costo_anual: number; mensual: number };
}

/**
 * Libro equivalente a E14-01 sobre la semilla e4-01 (hoy dom 11 oct, quincena el jue 15): los gastos del vector
 * desde el efectivo y el catálogo del vector (vacío). `catalogo: 'semilla'` usa el de `07 §6`.
 */
function libroE14({
  plus = true,
  catalogo = 'vector',
}: { plus?: boolean; catalogo?: 'vector' | 'semilla' } = {}) {
  const v = vector<VectorE14>('E14-01');
  const p = abrirPrueba(v.hoy);
  cargarEscenario(p.ctx, escenario('e4-01'));
  if (plus) sincronizarPlan(p.ctx, { plus: { vigenteHasta: null, enPrueba: false, renovara: true } });
  const efectivo = listarCuentas(p.ctx).tienes.find((c) => c.nombre === 'Cartera')?.id as string;
  registrarGastosE14(p.ctx, v.gastos, efectivo);
  const ctx = catalogo === 'vector' ? { ...p.ctx, catalogoSuscripciones: v.catalogo } : p.ctx;
  return { ...p, ctx, v, efectivo };
}

const filas = (p: ReturnType<typeof libroE14>) => p.ctx.db.select().from(esquema.suscripcion).all();

describe('Suscripciones (M10, 02 §20, CA-M10-01)', () => {
  it('CA-M10-01 · con un libro equivalente a E14-01 muestra las 5 activas, el resumen y Disney Plus aparte', () => {
    const p = libroE14();
    const s = listarSuscripciones(p.ctx);
    expect(s.cantidad).toBe(p.v.resumen_activas.cantidad);
    expect(s.costoAnual).toBe(p.v.resumen_activas.costo_anual);
    expect(s.mensual).toBe(p.v.resumen_activas.mensual);
    expect(s.textoResumen).toBe('Pagas unos $1,626 al mes en 5 suscripciones ($19,514 al año)');
    expect(s.activas.map((x) => [x.nombre, x.textoMonto, x.textoAntes, x.textoProximo])).toEqual([
      ['Estudio Yoga', '$150 cada semana', null, 'próximo vie 16 oct'],
      ['Smart Fit', '$599 al mes', null, 'próximo 1 nov'],
      ['Netflix', '$219 al mes', null, 'próximo 14 oct'],
      ['Spotify', '$129 al mes', 'antes $115', 'próximo 5 nov'],
      ['Dominio Web', '$350 al año', null, 'próximo 8 oct 2027'],
    ]);
    expect(s.inactivas.map((x) => x.nombre)).toEqual(['Disney Plus']);
    expect(s.textoInactivas).toBe('Ya no se cobran: Disney Plus (último cargo 20 jul)');
    // OXXO no es suscripción; ICLOUD no llega a 3 cargos sin catálogo.
    expect(
      filas(p)
        .map((f) => f.comercioNormalizado)
        .sort(),
    ).toEqual(['DISNEY PLUS', 'DOMINIO WEB', 'ESTUDIO YOGA', 'NETFLIX', 'SMART FIT', 'SPOTIFY']);
  });

  it('con el catálogo semilla de 07 §6 (ICLOUD) bastan 2 cargos mensuales, como E14-02', () => {
    const p = libroE14({ catalogo: 'semilla' });
    const s = listarSuscripciones(p.ctx);
    expect(s.activas.map((x) => x.nombre)).toContain('Icloud');
    expect(s.cantidad).toBe(6);
  });

  it('Q12 del golden set responde con esa lista', async () => {
    const p = libroE14();
    const f = nubeFalsa({ [golden('Q12').texto]: golden('Q12').esperado });
    const r = await registrarTexto(p.ctx, golden('Q12').texto, 'voz', { nube: f.nube });
    if (r.resultado !== 'consulta') throw new Error(r.resultado);
    expect(r.respuesta.plantilla).toBe('suscripciones');
    expect(r.respuesta.texto).toBe('Pagas unos $1,626 al mes en 5 suscripciones.');
    expect(r.respuesta.lineas).toEqual([
      { etiqueta: 'Estudio Yoga · próximo vie 16 oct', valor: '$150 cada semana' },
      { etiqueta: 'Smart Fit · próximo 1 nov', valor: '$599 al mes' },
      { etiqueta: 'Netflix · próximo 14 oct', valor: '$219 al mes' },
      { etiqueta: 'Spotify · próximo 5 nov', valor: '$129 al mes (antes $115)' },
      { etiqueta: 'Dominio Web · próximo 8 oct 2027', valor: '$350 al año' },
    ]);
  });

  it('Q12 en Gratis es de Plus (01 §11): no calcula nada', async () => {
    const p = libroE14({ plus: false });
    const f = nubeFalsa({ [golden('Q12').texto]: golden('Q12').esperado });
    const r = await registrarTexto(p.ctx, golden('Q12').texto, 'voz', { nube: f.nube });
    if (r.resultado !== 'consulta') throw new Error(r.resultado);
    expect(r.respuesta).toMatchObject({ plantilla: 'suscripciones', soloPlus: true, lineas: [] });
    expect(r.respuesta.texto).not.toMatch(/\$/);
  });

  it('la tarea diaria corre E14 una vez por día y guarda las detectadas', () => {
    const p = libroE14();
    procesarApertura(p.ctx);
    expect(filas(p)).toHaveLength(6);
    expect(new Set(filas(p).map((f) => f.estado))).toEqual(new Set(['detectada']));
    expect(procesarSuscripcionesDelDia(p.ctx)).toBe(false);
    p.reloj.fijar('2026-10-12');
    expect(procesarSuscripcionesDelDia(p.ctx)).toBe(true);
  });

  it('Convertir en compromiso: Netflix entra al horizonte, E4 la aparta y el cargo real la cubre (E3.5)', () => {
    const p = libroE14();
    const antes = obtenerHoy(p.ctx).reservado;
    const { programadoId } = convertirEnCompromiso(p.ctx, 'NETFLIX');
    const prog = programadoPorId(p.ctx, programadoId);
    expect(prog).toMatchObject({ tipo: 'egreso', concepto: 'Netflix', monto: 21_900, desde: '2026-09-15' });
    expect(prog.regla).toEqual({ tipo: 'mensual', dia: 14 });
    const hoy = obtenerHoy(p.ctx);
    expect(hoy.reservado - antes).toBe(21_900);
    expect(hoy.reservadoDetalle).toContainEqual(
      expect.objectContaining({ concepto: 'Netflix', monto: 21_900, fecha: '2026-10-14' }),
    );
    const s = listarSuscripciones(p.ctx).activas.find((x) => x.comercio === 'NETFLIX');
    expect(s).toMatchObject({ compromiso: true, programadoId });
    expect(() => convertirEnCompromiso(p.ctx, 'NETFLIX')).toThrow(
      expect.objectContaining({ codigo: 'suscripcion_ya_compromiso' }),
    );

    p.reloj.fijar('2026-10-14');
    const r = registrarMovimiento(p.ctx, {
      tipo: 'gasto',
      monto: 21_900,
      comercio: 'NETFLIX.COM',
      categoria: 'suscripciones',
      origenId: p.efectivo,
    });
    expect(r.cobertura).toMatchObject({ decision: 'cubierta', programadoId, fecha: '2026-10-14' });
    expect(listarOcurrencias(p.ctx, { programadoId }).find((o) => o.fecha === '2026-10-14')?.estado).toBe(
      'cubierta',
    );
    expect(obtenerHoy(p.ctx).reservadoDetalle.some((c) => c.concepto === 'Netflix')).toBe(false);
  });

  it('el próximo cargo fuera del horizonte no se aparta todavía (Estudio Yoga, vie 16 oct)', () => {
    const p = libroE14();
    const antes = obtenerHoy(p.ctx).reservado;
    const { programadoId } = convertirEnCompromiso(p.ctx, 'ESTUDIO YOGA');
    expect(programadoPorId(p.ctx, programadoId).regla).toEqual({ tipo: 'semanal', dia_semana: 5 });
    expect(obtenerHoy(p.ctx).reservado).toBe(antes);
    expect(listarOcurrencias(p.ctx, { programadoId })[0]?.fecha).toBe('2026-10-16');
  });

  it('una que ya no se cobra no se convierte', () => {
    const p = libroE14();
    expect(() => convertirEnCompromiso(p.ctx, 'DISNEY PLUS')).toThrow(
      expect.objectContaining({ codigo: 'suscripcion_inactiva' }),
    );
    expect(() => convertirEnCompromiso(p.ctx, 'OXXO PUEBLA')).toThrow(
      expect.objectContaining({ codigo: 'suscripcion_inexistente' }),
    );
  });

  it('"Ya la cancelé" la oculta y reaparece si vuelve a cobrarse; "No es suscripción" la oculta siempre', () => {
    const p = libroE14();
    yaLaCancele(p.ctx, 'SMART FIT');
    marcarNoEsSuscripcion(p.ctx, 'DOMINIO WEB');
    let s = listarSuscripciones(p.ctx);
    expect(s.activas.map((x) => x.comercio)).toEqual(['ESTUDIO YOGA', 'NETFLIX', 'SPOTIFY']);
    expect(s.textoResumen).toBe('Pagas unos $998 al mes en 3 suscripciones ($11,976 al año)');

    p.reloj.fijar('2026-11-01');
    registrarMovimiento(p.ctx, {
      tipo: 'gasto',
      monto: 59_900,
      comercio: 'SMART FIT',
      categoria: 'suscripciones',
      origenId: p.efectivo,
    });
    s = listarSuscripciones(p.ctx);
    expect(s.activas.map((x) => x.comercio)).toContain('SMART FIT');
    expect(s.activas.map((x) => x.comercio)).not.toContain('DOMINIO WEB');
    const fila = p.ctx.db
      .select()
      .from(esquema.suscripcion)
      .where(eq(esquema.suscripcion.comercioNormalizado, 'SMART FIT'))
      .get();
    expect(fila).toMatchObject({ estado: 'detectada', ultimoCargo: '2026-11-01' });
  });

  it('"Ya la cancelé" en un compromiso desactiva el programado y deja de apartarlo', () => {
    const p = libroE14();
    const antes = obtenerHoy(p.ctx).reservado;
    const { programadoId } = convertirEnCompromiso(p.ctx, 'NETFLIX');
    expect(obtenerHoy(p.ctx).reservado - antes).toBe(21_900);
    yaLaCancele(p.ctx, 'NETFLIX');
    expect(programadoPorId(p.ctx, programadoId).activo).toBe(false);
    expect(obtenerHoy(p.ctx).reservado).toBe(antes);
    expect(listarSuscripciones(p.ctx).activas.some((x) => x.comercio === 'NETFLIX')).toBe(false);
  });

  it('el nombre visible se guarda en ajuste y actualiza el concepto del compromiso', () => {
    const p = libroE14();
    fijarNombreSuscripcion(p.ctx, 'DOMINIO WEB', 'Dominio web');
    expect(listarSuscripciones(p.ctx).activas.find((x) => x.comercio === 'DOMINIO WEB')?.nombre).toBe(
      'Dominio web',
    );
    const { programadoId } = convertirEnCompromiso(p.ctx, 'NETFLIX');
    fijarNombreSuscripcion(p.ctx, 'NETFLIX', 'Disney+');
    expect(programadoPorId(p.ctx, programadoId).concepto).toBe('Disney+');
    expect(listarSuscripciones(p.ctx).activas.find((x) => x.comercio === 'NETFLIX')?.nombre).toBe('Disney+');
  });

  it('aumento de precio en compromiso pregunta en Hoy antes de reservar el monto nuevo', () => {
    const p = libroE14();
    const { programadoId } = convertirEnCompromiso(p.ctx, 'NETFLIX');
    expect(programadoPorId(p.ctx, programadoId).monto).toBe(21_900);
    for (const fecha of ['2026-11-14', '2026-12-14', '2027-01-14', '2027-02-14'] as const) {
      p.reloj.fijar(fecha);
      registrarMovimiento(p.ctx, {
        tipo: 'gasto',
        monto: 31_900,
        comercio: 'NETFLIX',
        categoria: 'suscripciones',
        origenId: p.efectivo,
      });
    }
    procesarSuscripciones(p.ctx);
    expect(programadoPorId(p.ctx, programadoId).monto).toBe(21_900);
    expect(listarAumentosSuscripcionPendientes(p.ctx)).toEqual([
      expect.objectContaining({ comercio: 'NETFLIX', montoNuevo: 31_900, montoReservado: 21_900 }),
    ]);
    aceptarAumentoSuscripcion(p.ctx, 'NETFLIX');
    expect(programadoPorId(p.ctx, programadoId).monto).toBe(31_900);
    expect(listarAumentosSuscripcionPendientes(p.ctx)).toEqual([]);
    expect(obtenerHoy(p.ctx).reservadoDetalle).toContainEqual(
      expect.objectContaining({ concepto: 'Netflix', monto: 31_900 }),
    );
  });

  it('"No" en un aumento pendiente sigue reservando el monto anterior', () => {
    const p = libroE14();
    const { programadoId } = convertirEnCompromiso(p.ctx, 'NETFLIX');
    for (const fecha of ['2026-11-14', '2026-12-14', '2027-01-14', '2027-02-14'] as const) {
      p.reloj.fijar(fecha);
      registrarMovimiento(p.ctx, {
        tipo: 'gasto',
        monto: 31_900,
        comercio: 'NETFLIX',
        categoria: 'suscripciones',
        origenId: p.efectivo,
      });
    }
    procesarSuscripciones(p.ctx);
    mantenerMontoSuscripcion(p.ctx, 'NETFLIX');
    expect(programadoPorId(p.ctx, programadoId).monto).toBe(21_900);
    expect(listarAumentosSuscripcionPendientes(p.ctx)).toEqual([]);
  });

  it('sin gastos con comercio no hay resumen', () => {
    const p = abrirPrueba();
    cargarEscenario(p.ctx, escenario('e4-01'));
    expect(listarSuscripciones(p.ctx)).toMatchObject({
      activas: [],
      inactivas: [],
      cantidad: 0,
      textoResumen: null,
      textoInactivas: null,
    });
  });
});
