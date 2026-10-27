import { act, renderHook } from '@testing-library/react-native';
import type {
  MovimientoVista,
  Observacion,
  TarjetaAccion,
  VistaHoy,
  VistaProbabilidadHoy,
} from '../servicios';
import { obtenerHoy } from '../servicios';
import { conEscenario } from '../pantallas/principal/__pruebas__/base';
import { TEXTO_AVISO_RIESGO_HOY } from '../pantallas/principal/textos';
import {
  chipQueNombra,
  combinarTurnos,
  derivarTurnosDelDia,
  idTurnoRegistro,
  indiceTarjetaAccion,
  preguntaAbierta,
  reducirSesion,
  respuestaDeTexto,
  TEXTO_EFECTIVO_MENOS_PRECISO,
  textoMovimientoDelDia,
  textoTarjetaAccion,
  useConversacion,
  type AccionesDia,
  type TurnoConversacion,
} from './conversacion';
import type { Turno } from './tipos';

const HOY = '2026-10-11';

function movimiento(parcial: Partial<MovimientoVista> & Pick<MovimientoVista, 'id'>): MovimientoVista {
  return {
    fecha: HOY,
    tipo: 'gasto',
    descripcion: 'coca',
    comercio: null,
    origen: 'texto',
    registradaEn: 1,
    monto: 2_500,
    sentido: 'salida',
    saleDe: ['Efectivo'],
    llegaA: [],
    personas: [],
    categoria: 'Antojos',
    categoriaSlug: 'antojos',
    porRevisar: false,
    extraordinaria: false,
    insignias: [],
    reemplazaA: null,
    ...parcial,
  };
}

const OBSERVACIONES: Observacion[] = [
  {
    tipo: 'comparativa',
    clave: 'comparativa:comida_fuera:2026-09-30',
    cifra: 124_000,
    filtro: { desde: '2026-09-30', hasta: HOY, categorias: ['comida_fuera'] },
    relevancia: 4,
    categoria: 'comida_fuera',
    nombreCategoria: 'comida fuera',
    actual: 124_000,
    anterior: 98_000,
    periodo: { inicio: '2026-09-30', concepto: 'quincena' },
  },
  {
    tipo: 'suscripciones',
    clave: 'suscripciones:2026-10',
    cifra: 34_800,
    filtro: null,
    relevancia: 1,
    mes: '2026-10',
    total: 34_800,
    cantidad: 2,
  } as unknown as Observacion,
  {
    tipo: 'suscripciones',
    clave: 'suscripciones:2026-09',
    cifra: 1,
    filtro: null,
    relevancia: 1,
    mes: '2026-09',
    total: 1,
    cantidad: 1,
  } as unknown as Observacion,
];

function acciones(): AccionesDia & { [k: string]: jest.Mock } {
  return {
    verMovimientos: jest.fn(),
    verMovimiento: jest.fn(),
    ocultarObservacion: jest.fn(),
    abrirArqueo: jest.fn(),
    verDesglose: jest.fn(),
  };
}

function vistaDe(parcial: Partial<VistaHoy> = {}): VistaHoy {
  const p = conEscenario('e4-01');
  const v = obtenerHoy(p.ctx);
  p.cerrar();
  return { ...v, tarjetasAccion: [], efectivoMenosPreciso: false, ...parcial };
}

const sinFunciones = (turnos: readonly unknown[]) => JSON.parse(JSON.stringify(turnos)) as unknown;

describe('asistente/conversacion · turnos del día (§3)', () => {
  it('un «Registré…» por movimiento de hoy, del más antiguo al más reciente, que abre el movimiento', () => {
    const a = acciones();
    const vista = vistaDe();
    const turnos = derivarTurnosDelDia(
      {
        movimientosHoy: [
          movimiento({
            id: 't2',
            descripcion: 'tacos',
            monto: 8_000,
            categoria: 'Comida fuera',
            registradaEn: 2,
          }),
          movimiento({ id: 't1' }),
          movimiento({ id: 'viejo', fecha: '2026-10-10' }),
        ],
        observaciones: [],
        probabilidad: null,
        tarjetaDelDia: null,
        acciones: a,
      },
      vista,
    );
    const registros = turnos.filter((t) => t.de === 'asistente' && t.clase === 'registro');
    expect(registros.map((t) => t.id)).toEqual(['registro:t1', 'registro:t2']);
    const primero = registros[0] as Extract<Turno, { clase: 'registro' }>;
    expect(primero.texto).toBe('Registré Coca $25 · Antojos · Efectivo.');
    expect(primero.deshacer).toBeUndefined();
    primero.abrir?.();
    expect(a.verMovimiento).toHaveBeenCalledWith('t1');
  });

  it('es determinista: el mismo libro y el mismo día dan los mismos turnos', () => {
    const vista = vistaDe({ efectivoMenosPreciso: true });
    const ctx = {
      movimientosHoy: [movimiento({ id: 't1' })],
      observaciones: OBSERVACIONES,
      probabilidad: null,
      tarjetaDelDia: 'Usa tu Nu: su corte fue ayer.',
      acciones: acciones(),
    };
    expect(sinFunciones(derivarTurnosDelDia(ctx, vista))).toEqual(
      sinFunciones(derivarTurnosDelDia(ctx, vista)),
    );
  });

  it('«Lo que veo»: dos como máximo, con «Ver movimientos» (si hay filtro) y «Ya lo vi»', () => {
    const a = acciones();
    const turnos = derivarTurnosDelDia(
      {
        movimientosHoy: [],
        observaciones: OBSERVACIONES,
        probabilidad: null,
        tarjetaDelDia: null,
        acciones: a,
      },
      vistaDe(),
    );
    const vistas = turnos.filter(
      (t) => t.de === 'asistente' && t.clase === 'aviso' && t.origen === 'observacion',
    );
    expect(vistas.map((t) => t.id)).toEqual(['observacion-0', 'observacion-1']);
    const [primera, segunda] = vistas as Extract<Turno, { clase: 'aviso' }>[];
    expect(primera?.texto).toBe(
      'Llevas $1,240 en comida fuera; a estas alturas de tu quincena anterior llevabas $980.',
    );
    expect(primera?.acciones.map((x) => x.testID)).toEqual([
      'observacion-0-ver-movimientos',
      'observacion-0-ya-lo-vi',
    ]);
    expect(segunda?.acciones.map((x) => x.testID)).toEqual(['observacion-1-ya-lo-vi']);
    void primera?.acciones[0]?.accion();
    expect(a.verMovimientos).toHaveBeenCalledWith(OBSERVACIONES[0]?.filtro);
    void primera?.acciones[1]?.accion();
    expect(a.ocultarObservacion).toHaveBeenCalledWith('comparativa:comida_fuera:2026-09-30');
  });

  it('el aviso de riesgo sale solo si la probabilidad ya dice riesgo (Plus) y lleva «Ver qué viene»', () => {
    const a = acciones();
    const base = { movimientosHoy: [], observaciones: [], tarjetaDelDia: null, acciones: a };
    const ok = { estado: 'ok', riesgo: false } as unknown as VistaProbabilidadHoy;
    const riesgo = { estado: 'ok', riesgo: true } as unknown as VistaProbabilidadHoy;
    expect(
      derivarTurnosDelDia({ ...base, probabilidad: null }, vistaDe()).some((t) => t.id === 'riesgo'),
    ).toBe(false);
    expect(derivarTurnosDelDia({ ...base, probabilidad: ok }, vistaDe()).some((t) => t.id === 'riesgo')).toBe(
      false,
    );
    const turno = derivarTurnosDelDia({ ...base, probabilidad: riesgo }, vistaDe()).find(
      (t) => t.id === 'riesgo',
    );
    expect(turno).toMatchObject({ clase: 'aviso', origen: 'riesgo', texto: TEXTO_AVISO_RIESGO_HOY });
    void (turno as Extract<Turno, { clase: 'aviso' }>).acciones[0]?.accion();
    expect(a.verDesglose).toHaveBeenCalled();
  });

  it('efectivo sin contar en una semana: aviso con «Contar efectivo» que abre el arqueo', () => {
    const a = acciones();
    const turnos = derivarTurnosDelDia(
      { movimientosHoy: [], observaciones: [], probabilidad: null, tarjetaDelDia: null, acciones: a },
      vistaDe({ efectivoMenosPreciso: true }),
    );
    const t = turnos.find((x) => x.id === 'efectivo-menos-preciso') as Extract<Turno, { clase: 'aviso' }>;
    expect(t.texto).toBe(TEXTO_EFECTIVO_MENOS_PRECISO);
    expect(t.acciones[0]?.testID).toBe('boton-contar-efectivo');
    void t.acciones[0]?.accion();
    expect(a.abrirArqueo).toHaveBeenCalled();
  });

  it('las tarjetas de acción van primero, una por turno, con su frase', () => {
    const tarjetas = [
      { tipo: 'por_interpretar', cantidad: 2 },
      { tipo: 'capturas_por_revisar', cantidad: 1 },
    ] as TarjetaAccion[];
    const turnos = derivarTurnosDelDia(
      {
        movimientosHoy: [movimiento({ id: 't1' })],
        observaciones: [],
        probabilidad: null,
        tarjetaDelDia: null,
        acciones: acciones(),
      },
      vistaDe({ tarjetasAccion: tarjetas }),
    );
    expect(turnos.slice(0, 2).map((t) => t.id)).toEqual(['tarjeta-accion-0', 'tarjeta-accion-1']);
    expect(turnos[0]).toMatchObject({ origen: 'tarjeta_accion', texto: 'Tienes 2 frases por revisar.' });
    expect(indiceTarjetaAccion('tarjeta-accion-1')).toBe(1);
    expect(indiceTarjetaAccion('observacion-0')).toBeNull();
    expect(textoTarjetaAccion({ tipo: 'por_asignar', monto: 15_000 } as TarjetaAccion)).toBe(
      'Tienes $150 en gastos sin cuenta.',
    );
  });

  it('la tarjeta del día (Plus) es un turno más', () => {
    const turnos = derivarTurnosDelDia(
      {
        movimientosHoy: [],
        observaciones: [],
        probabilidad: null,
        tarjetaDelDia: 'Paga con tu Nu: cortó ayer.',
        acciones: acciones(),
      },
      vistaDe(),
    );
    expect(turnos.find((t) => t.id === 'tarjeta-del-dia')).toMatchObject({
      texto: 'Paga con tu Nu: cortó ayer.',
    });
  });

  it('textoMovimientoDelDia: ingreso a su cuenta y gasto por asignar', () => {
    expect(
      textoMovimientoDelDia(
        movimiento({
          id: 'i',
          tipo: 'ingreso',
          descripcion: 'quincena',
          monto: 650_000,
          sentido: 'entrada',
          saleDe: [],
          llegaA: ['BBVA débito'],
          categoria: 'Sueldo',
        }),
      ),
    ).toBe('Registré Quincena $6,500 · Sueldo · BBVA débito.');
    expect(textoMovimientoDelDia(movimiento({ id: 'x', insignias: ['por_asignar'] }))).toBe(
      'Registré Coca $25 · Antojos · por asignar.',
    );
  });
});

describe('asistente/conversacion · sesión', () => {
  const persona = (id: string): TurnoConversacion => ({ id, de: 'persona', texto: id, porVoz: false });
  const texto = (id: string, t = id): TurnoConversacion => ({
    id,
    de: 'asistente',
    clase: 'texto',
    texto: t,
  });

  it('reducirSesion: agregar, reemplazar en su lugar, resolver y limpiar', () => {
    let s = reducirSesion([], { tipo: 'agregar', turnos: [persona('a'), texto('b')] });
    s = reducirSesion(s, { tipo: 'agregar', turnos: [texto('c')] });
    expect(s.map((t) => t.id)).toEqual(['a', 'b', 'c']);
    s = reducirSesion(s, { tipo: 'reemplazar', turno: texto('b', 'nuevo') });
    expect(s[1]).toMatchObject({ id: 'b', texto: 'nuevo' });
    s = reducirSesion(s, { tipo: 'agregar', turnos: [texto('a', 'otra vez')] });
    expect(s.map((t) => t.id)).toEqual(['a', 'b', 'c']);
    expect(reducirSesion(s, { tipo: 'reemplazar', turno: texto('z') })).toBe(s);
    s = reducirSesion(s, { tipo: 'resolver', id: 'b' });
    expect(s.map((t) => t.id)).toEqual(['a', 'c']);
    expect(reducirSesion(s, { tipo: 'limpiar' })).toEqual([]);
  });

  it('combinarTurnos: el día primero y la sesión al final; lo que ya cuenta la sesión no se repite', () => {
    const derivados: TurnoConversacion[] = [
      texto('tarjeta-accion-0'),
      { id: idTurnoRegistro(['t1']), de: 'asistente', clase: 'registro', texto: 'Registré Coca $25.' },
      { id: idTurnoRegistro(['t2']), de: 'asistente', clase: 'registro', texto: 'Registré Tacos $80.' },
      { id: idTurnoRegistro(['t3']), de: 'asistente', clase: 'registro', texto: 'Registré Luz $450.' },
    ];
    const sesion: TurnoConversacion[] = [
      persona('p1'),
      { id: idTurnoRegistro(['t1', 't2']), de: 'asistente', clase: 'registro', texto: 'Registré dos.' },
    ];
    expect(combinarTurnos(derivados, sesion).map((t) => t.id)).toEqual([
      'tarjeta-accion-0',
      'registro:t3',
      'p1',
      'registro:t1,t2',
    ]);
  });

  it('preguntaAbierta: solo si lo último que dijo el asistente es una pregunta', () => {
    const pregunta: TurnoConversacion = {
      id: 'q',
      de: 'asistente',
      clase: 'pregunta',
      texto: '¿Con qué cuenta pagaste?',
      chips: [],
      responder: () => {},
    };
    expect(preguntaAbierta([texto('a'), pregunta, persona('p')])?.id).toBe('q');
    expect(preguntaAbierta([pregunta, texto('b')])).toBeNull();
    expect(preguntaAbierta([])).toBeNull();
  });

  it('chipQueNombra: igual, contenido o sin acentos', () => {
    const chips = [
      { valor: 'nu', etiqueta: 'Nu ••4410' },
      { valor: 'bbva', etiqueta: 'BBVA débito' },
      { valor: 'ef', etiqueta: 'Efectivo' },
    ];
    expect(chipQueNombra(chips, 'efectivo')?.valor).toBe('ef');
    expect(chipQueNombra(chips, 'con la bbva debito')?.valor).toBe('bbva');
    expect(chipQueNombra(chips, 'BBVA')?.valor).toBe('bbva');
    expect(chipQueNombra(chips, 'la oro')).toBeNull();
    expect(chipQueNombra(chips, '  ')).toBeNull();
  });

  it('respuestaDeTexto: chip si lo nombra, monto si la pregunta es de dinero, si no el texto', () => {
    const chips = [{ valor: 'si', etiqueta: 'Sí, completa' }];
    expect(respuestaDeTexto({ chips, campo: 'monto' }, 'sí, completa', true)).toEqual({
      tipo: 'chip',
      valor: 'si',
    });
    expect(respuestaDeTexto({ chips: [], campo: 'monto' }, '3,200', true)).toEqual({
      tipo: 'monto',
      centavos: 320_000,
      aproximado: false,
    });
    expect(respuestaDeTexto({ chips: [] }, 'el 28', false)).toEqual({
      tipo: 'texto',
      texto: 'el 28',
      porVoz: false,
    });
  });

  it('useConversacion: agrega turnos de la sesión con ids sin reloj ni azar y los limpia', () => {
    const derivados: TurnoConversacion[] = [texto('dia')];
    const { result } = renderHook(() => useConversacion(derivados));
    expect(result.current.nuevoId('persona')).toBe('persona-1');
    expect(result.current.nuevoId('persona')).toBe('persona-2');
    act(() => result.current.agregar(persona('p'), texto('r')));
    expect(result.current.turnos.map((t) => t.id)).toEqual(['dia', 'p', 'r']);
    act(() => result.current.resolver('r'));
    expect(result.current.sesion.map((t) => t.id)).toEqual(['p']);
    act(() => result.current.limpiarSesion());
    expect(result.current.turnos.map((t) => t.id)).toEqual(['dia']);
  });
});
