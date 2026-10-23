import { listarMovimientos, registrarTextoLocal, type Contexto, type ResultadoTexto } from '../servicios';
import { obtenerColchon } from '../servicios/ajustes';
import { PIE_EXPLICAR } from '../servicios/explicar';
import { contextoInterprete } from '../servicios/registrar';
import { conEscenario } from '../pantallas/principal/__pruebas__/base';
import {
  MENSAJE_EXPLICAR_ERROR,
  MENSAJE_EXPLICAR_SIN_RED,
  MENSAJE_EXPLICAR_SOLO_PLUS,
  MENSAJE_GUARDADA,
  MENSAJE_NO_ENCONTRE,
  MENSAJE_NO_SOPORTADO,
  MENSAJE_SIN_DUPLICADOS,
  mensajeFueraDeAlcance,
} from '../pantallas/principal/textos';
import { MENSAJE_SIN_PAREJA } from '../pantallas/compartido/textos';
import {
  BTN_SI_REGISTRALO,
  MOTIVO_ELIGE_CUENTA,
  TEXTO_DESHICE,
  TEXTO_EXPLICANDO,
  TEXTO_FRASE_LARGA,
  TEXTO_NO_ENTENDI_VACIO,
} from '../pantallas/asistente/textos';
import type { TurnoConversacion } from './conversacion';
import type { OpcionReparacion } from './reparacion';
import type { FlujoConversacional } from './flujos';
import { leerConfirmacion } from './confirmacion-voz';
import {
  corregirEntendi,
  movimientoDeEntendi,
  prellenadoDe,
  textoDeAviso,
  textoRegistrado,
  turnoDeExplicacion,
  turnoNoEntendi,
  turnosDeFlujo,
  turnosDesdeResultado,
  type AccionesRegistro,
} from './registro';
import type { Turno } from './tipos';

const CAMBIO = 'Tu día pasa de $220 a $214.';

function falsas(extra: Partial<AccionesRegistro> = {}) {
  let n = 0;
  const agregados: TurnoConversacion[] = [];
  const reemplazados: TurnoConversacion[] = [];
  const o: AccionesRegistro & Record<string, unknown> = {
    porVoz: false,
    oido: 'los 300 del Beto',
    plan: 'gratis',
    nuevoId: (p) => `${p}-${++n}`,
    cambioDia: () => CAMBIO,
    deshacer: jest.fn(),
    agregar: jest.fn((...t: TurnoConversacion[]) => {
      agregados.push(...t);
    }),
    reemplazar: jest.fn((t: TurnoConversacion) => {
      reemplazados.push(t);
    }),
    mostrar: jest.fn(),
    enviar: jest.fn(),
    corregirOido: jest.fn(),
    abrirR2: jest.fn(),
    verMovimientos: jest.fn(),
    verMovimiento: jest.fn(),
    abrirMeAlcanza: jest.fn(),
    abrirArqueo: jest.fn(),
    abrirIngreso: jest.fn(),
    abrirRuta: jest.fn(),
    explicar: jest.fn(),
    // Sin los flujos de A-3: cada prueba decide si hay flujo.
    flujos: {},
    ...extra,
  };
  return { o, agregados, reemplazados };
}

const resumen = {
  transaccionId: 't1',
  tipo: 'gasto' as const,
  descripcion: 'coca',
  monto: 2_500,
  categoria: 'Antojos',
  cuenta: 'Efectivo',
  porAsignar: false,
  cobertura: null,
  preguntaLiquidar: null,
  avisoDeducible: false,
};
const transaccion = {
  transaccionId: 't9',
  tipo: 'gasto',
  fecha: '2026-10-11',
  descripcion: 'tacos',
  monto: 8_000,
  categoria: 'Comida fuera',
  cuenta: 'Cartera',
  porAsignar: false,
};

let p: ReturnType<typeof conEscenario>;
let ctx: Contexto;
beforeEach(() => {
  p = conEscenario('e4-01');
  ctx = p.ctx;
});
afterEach(() => p.cerrar());

type Clase = TurnoConversacion extends infer T ? (T extends { clase: infer C } ? C : 'persona') : never;
const clase = (t: TurnoConversacion | undefined): Clase | 'persona' | undefined =>
  t ? (t.de === 'persona' ? 'persona' : t.clase) : undefined;

/** Una fila por variante de `ResultadoTexto` (§3): qué turno sale. */
const TABLA: readonly [string, ResultadoTexto, Clase | 'nada', string | RegExp | null][] = [
  [
    'registrado',
    { resultado: 'registrado', deshacer: 't1', movimientos: [resumen] },
    'registro',
    'Registré Coca $25 · Antojos · Efectivo.',
  ],
  [
    'corregido',
    {
      resultado: 'corregido',
      antes: { ...transaccion, cuenta: 'Nu' },
      despues: transaccion,
      deshacer: 'r:t9:t8',
    } as ResultadoTexto,
    'registro',
    /^Corregí: Tacos \$80 · Comida fuera · Cartera\. Antes: Nu\.$/,
  ],
  [
    'anulado',
    { resultado: 'anulado', movimiento: transaccion, deshacer: 'c:t9' } as ResultadoTexto,
    'registro',
    'Borré: Tacos $80 · Comida fuera · Cartera.',
  ],
  [
    'pasar_a_meses',
    {
      resultado: 'pasar_a_meses',
      movimiento: { ...transaccion, descripcion: 'Tele' },
      meses: 12,
      planId: 'p',
      deshacer: 'm:a:b',
    } as ResultadoTexto,
    'registro',
    /tele va a 12 meses/,
  ],
  [
    'registrado_msi',
    {
      resultado: 'registrado_msi',
      deshacer: 'c1',
      compra: {
        transaccionId: 'c1',
        descripcion: 'tele',
        monto: 1_200_000,
        meses: 12,
        tarjeta: 'Nu ••4410',
        cuotas: [{ monto: 100_000 }],
      },
    } as unknown as ResultadoTexto,
    'registro',
    /^Registré Tele \$12,000 a 12 meses sin intereses · Nu ••4410/,
  ],
  [
    'registrado_division',
    {
      resultado: 'registrado_division',
      registro: { transaccionId: 'd1', reparto: { porCobrarTotal: 90_000 } },
      total: 120_000,
      descripcion: 'la cena',
      deshacer: 'd1',
    } as unknown as ResultadoTexto,
    'registro',
    'Registré la cena $1,200 · te deben $900.',
  ],
  [
    'registrado_tanda',
    {
      resultado: 'registrado_tanda',
      tipo: 'aportacion_tanda',
      movimiento: { transaccionId: 'k1', monto: 50_000, cuenta: 'BBVA', deshacer: 'k1' },
    } as unknown as ResultadoTexto,
    'registro',
    'Registré diste tu tanda $500 · BBVA.',
  ],
  [
    'configurado',
    {
      resultado: 'configurado',
      compromiso: {
        programadoId: 'x',
        concepto: 'Renta',
        monto: 650_000,
        proxima: '2026-11-01',
        deshacer: 'p:x',
      },
    } as ResultadoTexto,
    'registro',
    'Listo: Renta $6,500. El próximo es el 1 nov.',
  ],
  [
    'colchon_configurado',
    {
      resultado: 'colchon_configurado',
      monto: 300_000,
      anterior: 20_000,
      deshacer: 'k:20000',
    } as ResultadoTexto,
    'registro',
    /^Listo: tu colchón ahora es \$3,000/,
  ],
  [
    'tarjeta_configurada',
    {
      resultado: 'tarjeta_configurada',
      tarjeta: 'Nu ••4410',
      editada: { ciclo: { diaCorte: 28, diaLimitePago: 18 } },
      deshacer: null,
    } as unknown as ResultadoTexto,
    'registro',
    'Listo: tu Nu ••4410 corta el 28 y pagas el 18.',
  ],
  [
    'confirmar_msi',
    {
      resultado: 'confirmar_msi',
      motivo: 'cuenta',
      propuesta: { entrada: {}, faltaTarjeta: null },
    } as unknown as ResultadoTexto,
    'tarjeta',
    null,
  ],
  [
    'confirmar_division',
    { resultado: 'confirmar_division', propuesta: {} } as unknown as ResultadoTexto,
    'tarjeta',
    null,
  ],
  [
    'confirmar_compartido',
    { resultado: 'confirmar_compartido', propuesta: {} } as unknown as ResultadoTexto,
    'tarjeta',
    null,
  ],
  [
    'confirmar_tanda',
    { resultado: 'confirmar_tanda', motivo: 'tanda', propuesta: {} } as unknown as ResultadoTexto,
    'tarjeta',
    null,
  ],
  [
    'tarjeta_por_agregar',
    { resultado: 'tarjeta_por_agregar', prellenado: {}, candidatas: [] } as unknown as ResultadoTexto,
    'tarjeta',
    null,
  ],
  [
    'tanda_por_crear',
    { resultado: 'tanda_por_crear', propuesta: {} } as unknown as ResultadoTexto,
    'tarjeta',
    null,
  ],
  [
    'elegir',
    { resultado: 'elegir', accion: 'anular', candidatos: [] } as unknown as ResultadoTexto,
    'tarjeta',
    null,
  ],
  ['duplicados', { resultado: 'duplicados', grupos: [] } as unknown as ResultadoTexto, 'tarjeta', null],
  [
    'aclarar',
    {
      resultado: 'aclarar',
      motivo: 'tipo',
      pregunta: '¿Lo pagaste o te lo pagaron?',
      opciones: ['Lo pagué', 'Me pagaron'],
      texto: 'los 300 del Beto',
    } as unknown as ResultadoTexto,
    'pregunta',
    '¿Lo pagaste o te lo pagaron?',
  ],
  ['sin_pareja', { resultado: 'sin_pareja' }, 'aviso', MENSAJE_SIN_PAREJA],
  [
    'por_interpretar sin_nube',
    { resultado: 'por_interpretar', id: 'f1', motivo: 'sin_nube' },
    'no_entendi',
    null,
  ],
  [
    'por_interpretar sin_red',
    { resultado: 'por_interpretar', id: 'f1', motivo: 'sin_red' },
    'pregunta',
    MENSAJE_GUARDADA.sin_red,
  ],
  [
    'por_interpretar error',
    { resultado: 'por_interpretar', id: 'f1', motivo: 'error' },
    'pregunta',
    MENSAJE_GUARDADA.error,
  ],
  [
    'consulta',
    {
      resultado: 'consulta',
      respuesta: {
        plantilla: 'gasto_categoria',
        texto: 'Esta quincena llevas $1,240 en antojos (8 movimientos).',
        lineas: [],
        filtro: { categorias: ['antojos'] },
      },
    } as unknown as ResultadoTexto,
    'texto',
    'Esta quincena llevas $1,240 en antojos (8 movimientos).',
  ],
  ['explicar', { resultado: 'explicar', pregunta: '¿por qué bajó mi día?' }, 'texto', TEXTO_EXPLICANDO],
  [
    'me_alcanza',
    { resultado: 'me_alcanza', consulta: { precio: 150_000, descripcion: 'unos tenis' } },
    'aviso',
    /^Si compras unos tenis de \$1,500 hoy, te faltarían \$644 para cubrir lo que viene antes de tu quincena \(jue 15\)\.$/,
  ],
  ['arqueo', { resultado: 'arqueo', efectivoReal: 30_000 }, 'nada', null],
  ['no_encontrado', { resultado: 'no_encontrado', accion: 'anular' }, 'texto', MENSAJE_NO_ENCONTRE],
  [
    'no_encontrado duplicados',
    { resultado: 'no_encontrado', accion: 'duplicados' },
    'texto',
    MENSAJE_SIN_DUPLICADOS,
  ],
  ['no_entendi', { resultado: 'no_entendi' }, 'no_entendi', null],
  ['no_entendi texto_largo', { resultado: 'no_entendi', motivo: 'texto_largo' }, 'texto', TEXTO_FRASE_LARGA],
  [
    'no_soportado',
    { resultado: 'no_soportado', motivo: 'tipo_movimiento' },
    'texto',
    MENSAJE_NO_SOPORTADO.tipo_movimiento,
  ],
  [
    'fuera_de_alcance',
    { resultado: 'fuera_de_alcance', motivo: 'mueve_dinero' } as ResultadoTexto,
    'texto',
    mensajeFueraDeAlcance('mueve_dinero'),
  ],
];

function textoDe(t: TurnoConversacion | undefined): string | null {
  if (!t || t.de === 'persona') return t?.texto ?? null;
  switch (t.clase) {
    case 'registro':
    case 'pregunta':
    case 'aviso':
    case 'texto':
      return t.texto;
    case 'no_entendi':
      return t.oido;
    default:
      return null;
  }
}

describe('asistente/registro · turnosDesdeResultado cubre todas las variantes (§3)', () => {
  it.each(TABLA)('%s', (_n, r, esperada, texto) => {
    const { o } = falsas();
    const turnos = turnosDesdeResultado(ctx, r, o);
    if (esperada === 'nada') {
      expect(turnos).toEqual([]);
      return;
    }
    expect(clase(turnos[0])).toBe(esperada);
    if (texto instanceof RegExp) expect(textoDe(turnos[0])).toMatch(texto);
    else if (texto !== null) expect(textoDe(turnos[0])).toBe(texto);
  });

  it('confirmar y confirmar_ajuste salen como «Entendí» (se prueban con frases reales abajo)', () => {
    const { o } = falsas();
    const confirmar = registrarTextoLocal(ctx, 'pagué la luz 6000 con la bbva', 'texto');
    expect(confirmar?.resultado).toBe('confirmar');
    expect(clase(turnosDesdeResultado(ctx, confirmar, o)[0])).toBe('entendi');
  });

  it('null o un resultado desconocido → «No entendí» con lo oído', () => {
    const { o } = falsas();
    expect(clase(turnosDesdeResultado(ctx, null, o)[0])).toBe('no_entendi');
    const raro = { resultado: 'nuevo_en_el_futuro' } as unknown as ResultadoTexto;
    expect(turnosDesdeResultado(ctx, raro, o)[0]).toMatchObject({
      clase: 'no_entendi',
      oido: 'los 300 del Beto',
    });
  });
});

describe('asistente/registro · «Registré…» y Deshacer (criterio 1)', () => {
  it('registrado: texto de la maqueta, «Tu día pasa…», abrir el movimiento y Deshacer que lo dice', () => {
    const { o, reemplazados } = falsas();
    const [t] = turnosDesdeResultado(
      ctx,
      { resultado: 'registrado', deshacer: 't1', movimientos: [resumen] },
      o,
    );
    const turno = t as Extract<Turno, { clase: 'registro' }>;
    expect(turno.id).toBe('registro:t1');
    expect(turno.cambioDia).toBe(CAMBIO);
    turno.abrir?.();
    expect(o.verMovimiento).toHaveBeenCalledWith('t1');
    void turno.deshacer?.();
    expect(o.deshacer).toHaveBeenCalledWith('t1');
    expect(reemplazados[0]).toEqual({
      id: 'registro:t1',
      de: 'asistente',
      clase: 'registro',
      texto: TEXTO_DESHICE,
    });
  });

  it('con el libro real: «coca 25 en efectivo» y Deshacer revierte (asientos espejo)', () => {
    const r = registrarTextoLocal(ctx, 'coca 25 en efectivo', 'texto');
    expect(r?.resultado).toBe('registrado');
    const { o } = falsas({ deshacer: (token) => jest.requireActual('../servicios').deshacer(ctx, token) });
    const [t] = turnosDesdeResultado(ctx, r, o);
    expect(textoDe(t)).toBe('Registré Coca $25 · Antojos · Cartera.');
    expect(listarMovimientos(ctx).flatMap((d) => d.movimientos)).toHaveLength(1);
    void (t as Extract<Turno, { clase: 'registro' }>).deshacer?.();
    expect(listarMovimientos(ctx).flatMap((d) => d.movimientos)).toHaveLength(0);
  });

  it('un gasto de salud en efectivo agrega el aviso de deducciones', () => {
    const { o } = falsas();
    const turnos = turnosDesdeResultado(
      ctx,
      { resultado: 'registrado', deshacer: 't1', movimientos: [{ ...resumen, avisoDeducible: true }] },
      o,
    );
    expect(turnos).toHaveLength(2);
    expect(clase(turnos[1])).toBe('texto');
  });

  it('textoRegistrado y textoDeAviso: sin dos puntos y con punto final', () => {
    expect(textoRegistrado([resumen])).toBe('Registré Coca $25 · Antojos · Efectivo.');
    expect(textoDeAviso('Registré: Luz $450')).toBe('Registré Luz $450.');
    expect(textoDeAviso('Listo.')).toBe('Listo.');
  });
});

describe('asistente/registro · «Entendí» R1 (criterio 2)', () => {
  function entendiDe(frase: string, porVoz = false) {
    const r = registrarTextoLocal(ctx, frase, porVoz ? 'voz' : 'texto');
    const f = falsas({ porVoz, oido: frase });
    const turnos = turnosDesdeResultado(ctx, r, f.o);
    return { r, turnos, ...f };
  }

  it('«pagué la luz 6000 con la bbva» (monto alto): cifra, 4 filas, efecto y «Sí, regístralo»', () => {
    const { turnos } = entendiDe('pagué la luz 6000 con la bbva');
    const t = turnos[0] as Extract<Turno, { clase: 'entendi' }>;
    expect(t.propuesta.titulo).toBe('Entendí · ¿lo registro?');
    expect(t.propuesta.monto).toBe(600_000);
    expect(t.propuesta.filas.map((f) => f.clave)).toEqual(['que', 'cuenta', 'categoria', 'cuando']);
    expect(t.propuesta.filas.map((f) => f.valor)).toEqual([
      expect.stringMatching(/luz/i),
      'BBVA Débito ••5521',
      expect.any(String),
      'Hoy, dom 11 oct',
    ]);
    expect(t.propuesta.efecto).toMatch(/monto alto/);
    expect(t.propuesta.confirmar.etiqueta).toBe(BTN_SI_REGISTRALO);
    expect(t.propuesta.pista).toBeUndefined();
  });

  it('«Sí, regístralo» registra y muestra el resultado en lugar de la tarjeta', async () => {
    const { turnos, o } = entendiDe('pagué la luz 6000 con la bbva');
    const t = turnos[0] as Extract<Turno, { clase: 'entendi' }>;
    await t.propuesta.confirmar.accion();
    expect(o.mostrar).toHaveBeenCalledWith(expect.objectContaining({ resultado: 'registrado' }), t.id);
    expect(listarMovimientos(ctx).flatMap((d) => d.movimientos)).toHaveLength(1);
  });

  it('«Cambiar» abre R2 con lo dicho (tipo, monto, cuenta, categoría y lo oído)', () => {
    const { turnos, o } = entendiDe('pagué la luz 6000 con la bbva');
    const t = turnos[0] as Extract<Turno, { clase: 'entendi' }>;
    void t.propuesta.cambiar?.accion();
    expect(o.abrirR2).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 'gasto',
        monto: 600_000,
        cuentaId: expect.any(String),
        categoria: expect.any(String),
        oido: 'pagué la luz 6000 con la bbva',
      }),
    );
  });

  it('cambiar la cuenta en la fila vuelve a pintar la tarjeta con la nueva', () => {
    const { turnos, reemplazados } = entendiDe('pagué la luz 6000 con la bbva');
    const t = turnos[0] as Extract<Turno, { clase: 'entendi' }>;
    const cuenta = t.propuesta.filas.find((f) => f.clave === 'cuenta');
    const efectivo = cuenta?.opciones?.find((x) => x.etiqueta === 'Cartera');
    expect(efectivo).toBeDefined();
    cuenta?.alCambiar?.(efectivo?.valor ?? '');
    const nuevo = reemplazados[0] as Extract<Turno, { clase: 'entendi' }>;
    expect(nuevo.id).toBe(t.id);
    expect(nuevo.propuesta.filas.find((f) => f.clave === 'cuenta')?.valor).toBe('Cartera');
  });

  it('una propuesta que llega sin cuenta deja «Sí» inactivo con su motivo hasta elegirla en la fila', async () => {
    const r = registrarTextoLocal(ctx, 'pagué la luz 6000 con la bbva', 'texto');
    if (r?.resultado !== 'confirmar') throw new Error('se esperaba confirmar');
    const sinCuenta = {
      ...r,
      propuestas: r.propuestas.map((x) => ({
        ...x,
        faltan: [],
        entrada: { ...x.entrada, origenId: undefined },
      })),
    } as unknown as ResultadoTexto;
    const { o, reemplazados } = falsas({ oido: 'pagué la luz 6000' });
    const t = turnosDesdeResultado(ctx, sinCuenta, o)[0] as Extract<Turno, { clase: 'entendi' }>;
    expect(t.propuesta.confirmar).toMatchObject({
      deshabilitado: true,
      motivoDeshabilitado: MOTIVO_ELIGE_CUENTA,
    });
    const fila = t.propuesta.filas.find((f) => f.clave === 'cuenta');
    expect(fila?.valor).toBe('Elige una');
    const cartera = fila?.opciones?.find((x) => x.etiqueta === 'Cartera');
    fila?.alCambiar?.(cartera?.valor ?? '');
    const lista = reemplazados[0] as Extract<Turno, { clase: 'entendi' }>;
    expect(lista.propuesta.confirmar.deshabilitado).toBeUndefined();
    await lista.propuesta.confirmar.accion();
    expect(o.mostrar).toHaveBeenCalledWith(expect.objectContaining({ resultado: 'registrado' }), lista.id);
  });

  it('por voz trae la pista «También puedes decir “sí”…» con otra cuenta', () => {
    const { turnos } = entendiDe('pagué la luz 6000 con la bbva', true);
    const t = turnos[0] as Extract<Turno, { clase: 'entendi' }>;
    expect(t.propuesta.pista).toMatch(/^También puedes decir «sí» o «no, fue con .+»\.$/);
  });

  it('«no, fue en efectivo» y «eran 5000» (leídos por A-2) rehacen la tarjeta con la cuenta y el monto nuevos', () => {
    const { turnos } = entendiDe('pagué la luz 6000 con la bbva', true);
    const t = turnos[0] as Extract<Turno, { clase: 'entendi' }>;
    expect(movimientoDeEntendi(t.propuesta)).toBe('gasto');
    const contexto = {
      ...contextoInterprete(ctx),
      filas: ['monto', ...t.propuesta.filas.map((f) => f.clave)],
      movimiento: 'gasto' as const,
    };
    const cuenta = leerConfirmacion('no, fue en efectivo', contexto);
    expect(cuenta?.tipo).toBe('cambio');
    const conEfectivo = corregirEntendi(
      t.propuesta,
      cuenta?.tipo === 'cambio' ? cuenta.cambios : [],
    ) as Extract<Turno, { clase: 'entendi' }>;
    expect(conEfectivo.id).toBe(t.id);
    expect(conEfectivo.propuesta.filas.find((f) => f.clave === 'cuenta')?.valor).toBe('Cartera');
    const monto = leerConfirmacion('eran 5000', contexto);
    const conMonto = corregirEntendi(
      conEfectivo.propuesta,
      monto?.tipo === 'cambio' ? monto.cambios : [],
    ) as Extract<Turno, { clase: 'entendi' }>;
    expect(conMonto.propuesta.monto).toBe(500_000);
    expect(conMonto.propuesta.filas.find((f) => f.clave === 'cuenta')?.valor).toBe('Cartera');
  });

  it('un cambio que no aplica (o una tarjeta que no es de registro) no rehace nada', () => {
    const { turnos } = entendiDe('pagué la luz 6000 con la bbva');
    const t = turnos[0] as Extract<Turno, { clase: 'entendi' }>;
    expect(corregirEntendi(t.propuesta, [])).toBeNull();
    expect(
      corregirEntendi({ titulo: 'x', filas: [], confirmar: { etiqueta: 'Sí', accion: () => {} } }, [
        { fila: 'monto', monto: 100, aproximado: false },
      ]),
    ).toBeNull();
  });

  it('ingreso dicho (confirmar_ajuste): reutiliza «¿Cambio tu ingreso?» y «Cambiar mi ingreso»', () => {
    const r = registrarTextoLocal(ctx, 'me pagan 8 mil cada quincena', 'texto');
    expect(r?.resultado).toBe('confirmar_ajuste');
    const { o } = falsas();
    const t = turnosDesdeResultado(ctx, r, o)[0] as Extract<Turno, { clase: 'entendi' }>;
    expect(t.propuesta.titulo).toBe('Entendí · ¿cambio tu ingreso?');
    expect(t.propuesta.monto).toBe(800_000);
    expect(t.propuesta.confirmar.etiqueta).toBe('Cambiar mi ingreso');
    void t.propuesta.cambiar?.accion();
    expect(o.abrirIngreso).toHaveBeenCalled();
  });

  it('colchón propuesto: «Sí, guárdalo» lo aplica y el turno lo dice', async () => {
    const { o, reemplazados } = falsas();
    const r = {
      resultado: 'confirmar_ajuste',
      propuesta: { tipo: 'colchon', monto: 300_000, actual: 20_000 },
    } as ResultadoTexto;
    const t = turnosDesdeResultado(ctx, r, o)[0] as Extract<Turno, { clase: 'entendi' }>;
    expect(t.propuesta.filas[0]?.valor).toBe('Hoy apartas $200');
    await t.propuesta.confirmar.accion();
    expect(obtenerColchon(ctx)).toBe(300_000);
    expect(textoDe(reemplazados[0])).toMatch(/^Listo: tu colchón ahora es \$3,000/);
  });

  it('saldo dicho con varias cuentas posibles: primero pregunta cuál, luego «Entendí»', () => {
    const { o, agregados, reemplazados } = falsas();
    const r = {
      resultado: 'confirmar_ajuste',
      propuesta: {
        tipo: 'saldo_cuenta',
        monto: 420_000,
        cuentaId: null,
        saldoActual: null,
        faltaCuenta: {
          motivo: 'ambigua',
          alias: null,
          candidatas: [
            { id: 'a', nombre: 'BBVA' },
            { id: 'b', nombre: 'Nu débito' },
          ],
        },
      },
    } as unknown as ResultadoTexto;
    const t = turnosDesdeResultado(ctx, r, o)[0] as Extract<Turno, { clase: 'pregunta' }>;
    expect(t.texto).toBe('¿De qué cuenta?');
    expect(t.chips.map((c) => c.etiqueta)).toEqual(['BBVA', 'Nu débito']);
    t.responder({ tipo: 'chip', valor: 'b' });
    expect(clase(reemplazados[0])).toBe('texto');
    expect(agregados.map(clase)).toEqual(['persona', 'entendi']);
    expect(textoDe(agregados[0])).toBe('Nu débito');
  });

  it('prellenadoDe: ingreso lleva la cuenta a la que llegó', () => {
    expect(
      prellenadoDe({
        tipo: 'ingreso',
        monto: 100,
        categoria: 'sueldo',
        destinoId: 'bbva',
        descripcion: 'quincena',
      }),
    ).toEqual({
      tipo: 'ingreso',
      monto: 100,
      descripcion: 'quincena',
      cuentaId: 'bbva',
      categoria: 'sueldo',
    });
  });
});

describe('asistente/registro · no entendí y reparación (criterio 3, 12)', () => {
  it('≥ 3 opciones (de A-2) con «Otra cosa» al final y «Corregir lo que oí»', () => {
    const { o } = falsas();
    const t = turnoNoEntendi(ctx, o, 'los 300 del Beto', 'f1') as Extract<Turno, { clase: 'no_entendi' }>;
    const opciones = t.opciones as readonly OpcionReparacion[];
    expect(opciones.length).toBeGreaterThanOrEqual(3);
    expect(opciones.at(-1)?.tipo).toBe('otra');
    t.elegir('otra');
    expect(o.abrirR2).toHaveBeenLastCalledWith({ oido: 'los 300 del Beto', porInterpretarId: 'f1' });
    t.corregir();
    expect(o.corregirOido).toHaveBeenCalledWith('los 300 del Beto');
  });

  it('una opción con frase reescrita («le presté 300 a Beto») se manda tal cual al intérprete', () => {
    const { o } = falsas();
    const t = turnoNoEntendi(ctx, o, 'los 300 del Beto') as Extract<Turno, { clase: 'no_entendi' }>;
    const opciones = t.opciones as readonly OpcionReparacion[];
    const conFrase = opciones.find((x) => x.frase !== undefined);
    expect(conFrase).toBeDefined();
    t.elegir(conFrase?.valor ?? '');
    expect(o.enviar).toHaveBeenCalledWith(conFrase?.frase);
    expect(o.abrirR2).not.toHaveBeenCalled();
  });

  it('sin frase («pagué la tarjeta»): «Pagué una tarjeta» abre R2 como pago de tarjeta, no se manda como frase', () => {
    const { o } = falsas();
    const t = turnoNoEntendi(ctx, o, 'pagué la tarjeta') as Extract<Turno, { clase: 'no_entendi' }>;
    const opciones = t.opciones as readonly OpcionReparacion[];
    expect(opciones.map((x) => x.tipo)).toEqual(['pago_tarjeta', 'gasto', 'otra']);
    t.elegir('pago_tarjeta');
    expect(o.abrirR2).toHaveBeenLastCalledWith({ tipo: 'pago_tarjeta', oido: 'pagué la tarjeta' });
    t.elegir('gasto');
    expect(o.abrirR2).toHaveBeenLastCalledWith({ tipo: 'gasto', oido: 'pagué la tarjeta' });
    expect(o.enviar).not.toHaveBeenCalled();
  });

  it('sin nada oído no hay a qué reparar: texto honesto', () => {
    const { o } = falsas();
    expect(turnoNoEntendi(ctx, o, '  ')).toMatchObject({ clase: 'texto', texto: TEXTO_NO_ENTENDI_VACIO });
  });

  it('sin nube nunca promete «cuando tengas internet»: va a «No entendí» con la frase de Por revisar', () => {
    const { o } = falsas();
    const [t] = turnosDesdeResultado(ctx, { resultado: 'por_interpretar', id: 'f1', motivo: 'sin_nube' }, o);
    expect(t).toMatchObject({ clase: 'no_entendi', oido: 'los 300 del Beto' });
    expect(JSON.stringify(t)).not.toMatch(/internet/);
    (t as Extract<Turno, { clase: 'no_entendi' }>).elegir('otra');
    expect(o.abrirR2).toHaveBeenCalledWith({ oido: 'los 300 del Beto', porInterpretarId: 'f1' });
  });

  it('por interpretar con red caída: texto honesto y chips «Es un gasto», «Es un ingreso», «Escribirlo»', () => {
    const { o } = falsas();
    const t = turnosDesdeResultado(
      ctx,
      { resultado: 'por_interpretar', id: 'f1', motivo: 'sin_red' },
      o,
    )[0] as Extract<Turno, { clase: 'pregunta' }>;
    expect(t.chips.map((c) => c.etiqueta)).toEqual(['Es un gasto', 'Es un ingreso', 'Escribirlo']);
    t.responder({ tipo: 'chip', valor: 'gasto' });
    expect(o.abrirR2).toHaveBeenCalledWith({
      tipo: 'gasto',
      oido: 'los 300 del Beto',
      porInterpretarId: 'f1',
    });
    t.responder({ tipo: 'chip', valor: 'escribir' });
    expect(o.corregirOido).toHaveBeenCalledWith('los 300 del Beto');
  });

  it('aclarar: elegir una opción manda la frase con ella', () => {
    const { o } = falsas();
    const t = turnosDesdeResultado(
      ctx,
      {
        resultado: 'aclarar',
        motivo: 'tipo',
        pregunta: '¿Lo pagaste o te lo pagaron?',
        opciones: ['Lo pagué'],
        texto: 'los 300 del Beto',
      } as unknown as ResultadoTexto,
      o,
    )[0] as Extract<Turno, { clase: 'pregunta' }>;
    t.responder({ tipo: 'chip', valor: 'Lo pagué' });
    expect(o.enviar).toHaveBeenCalledWith('los 300 del Beto, Lo pagué');
  });
});

describe('asistente/registro · consultas, explicar y pantallas (criterio 4)', () => {
  it('consulta: «Ver movimientos» con el filtro de la respuesta; en Gratis (solo Plus) no', () => {
    const { o } = falsas();
    const filtro = { categorias: ['antojos'] };
    const respuesta = { plantilla: 'x', texto: 'Llevas $80.', lineas: [], filtro };
    const t = turnosDesdeResultado(
      ctx,
      { resultado: 'consulta', respuesta } as unknown as ResultadoTexto,
      o,
    )[0];
    (t as Extract<Turno, { clase: 'texto' }>).verMovimientos?.();
    expect(o.verMovimientos).toHaveBeenCalledWith(filtro);
    const plus = turnosDesdeResultado(
      ctx,
      { resultado: 'consulta', respuesta: { ...respuesta, soloPlus: true } } as unknown as ResultadoTexto,
      o,
    )[0];
    expect((plus as Extract<Turno, { clase: 'texto' }>).verMovimientos).toBeUndefined();
  });

  it('explicar: pide la respuesta y el turno espera «Revisando tus datos…»', () => {
    const { o } = falsas();
    const [t] = turnosDesdeResultado(ctx, { resultado: 'explicar', pregunta: '¿por qué?' }, o);
    expect(o.explicar).toHaveBeenCalledWith('¿por qué?', t?.id);
  });

  it('turnoDeExplicacion: cada respuesta del modo explicar', () => {
    const { o } = falsas();
    const filtro = {};
    expect(
      turnoDeExplicacion('e', { tipo: 'explicacion', texto: 'Bajó por la renta.', filtro, vueltas: 1 }, o),
    ).toMatchObject({
      texto: `Bajó por la renta.\n${PIE_EXPLICAR}`,
    });
    expect(turnoDeExplicacion('e', { tipo: 'solo_plus' }, o)).toMatchObject({
      texto: MENSAJE_EXPLICAR_SOLO_PLUS,
    });
    expect(turnoDeExplicacion('e', { tipo: 'sin_red' }, o)).toMatchObject({
      texto: MENSAJE_EXPLICAR_SIN_RED,
    });
    expect(turnoDeExplicacion('e', { tipo: 'error' }, o)).toMatchObject({ texto: MENSAJE_EXPLICAR_ERROR });
    expect(
      turnoDeExplicacion('e', { tipo: 'limite', codigo: 'limite_diario', mensaje: 'Ya no hoy.' } as never, o),
    ).toMatchObject({ texto: 'Ya no hoy.' });
  });

  it('me_alcanza se contesta en la conversación; con Plus pide las opciones y el turno dice que las calcula', () => {
    const calcular = jest.fn();
    const { o } = falsas({ calcularPuedoGastar: calcular });
    const consulta = { precio: 10_000, descripcion: 'unos tenis' };
    const [t] = turnosDesdeResultado(ctx, { resultado: 'me_alcanza', consulta }, o);
    expect(o.abrirMeAlcanza).not.toHaveBeenCalled();
    expect(t).toMatchObject({
      clase: 'aviso',
      origen: 'probabilidad',
      texto: 'Si compras unos tenis de $100 hoy, tu día pasa de $214 a $189 hasta tu quincena (jue 15).',
      detalle: 'Calculando cómo llegas con cada opción…',
    });
    expect(calcular).toHaveBeenCalledWith(consulta, t?.id);
  });

  it('arqueo sin flujo abre el arqueo con lo dicho', () => {
    const { o } = falsas();
    turnosDesdeResultado(ctx, { resultado: 'arqueo', efectivoReal: 30_000 }, o);
    expect(o.abrirArqueo).toHaveBeenCalledWith(30_000);
  });
});

describe('asistente/registro · flujos conversacionales (§6)', () => {
  interface E {
    readonly saldo: number | null;
    readonly completa: boolean | null;
  }
  const flujo: FlujoConversacional<E> = {
    id: 'tarjeta',
    inicial: () => ({ saldo: null, completa: null }),
    pasos: [
      {
        id: 'saldo',
        omitirSi: (e) => e.saldo !== null,
        pregunta: () => '¿Cuánto llevas hoy en la Nu?',
        campo: 'monto',
        admiteCero: true,
        aplicar: (e, r) => (r.tipo === 'monto' ? { ...e, saldo: r.centavos } : { error: 'Dime la cifra.' }),
      },
      {
        id: 'completa',
        omitirSi: (e) => e.completa !== null,
        pregunta: () => '¿La pagas completa cada mes?',
        chips: () => [
          { valor: 'si', etiqueta: 'Sí, completa' },
          { valor: 'no', etiqueta: 'No, una parte' },
        ],
        aplicar: (e, r) =>
          r.tipo === 'chip' ? { ...e, completa: r.valor === 'si' } : { error: 'Elige una.' },
      },
    ],
    entendi: (_c, e, a) => ({
      titulo: 'Entendí · ¿la agrego?',
      filas: [{ clave: 'saldo', etiqueta: 'Saldo', valor: String(e.saldo) }],
      confirmar: { etiqueta: 'Sí, agrégala', accion: a.guardar },
      cambiar: { etiqueta: 'Cambiar algo', accion: a.cambiar },
    }),
    guardar: async () => ({ texto: 'Listo: agregué tu Nu.', detalle: 'Corta el 28 y pagas el 18.' }),
    formularioLargo: () => '/tarjetas/nueva',
  };

  it('si el flujo no existe todavía, no hay turnos (la pantalla abre la ruta larga)', () => {
    const { o } = falsas();
    expect(turnosDeFlujo(ctx, 'tanda', null, o)).toBeNull();
  });

  it('pregunta lo que falta, muestra el error en la misma pregunta y termina en «Entendí»', async () => {
    const { o, agregados, reemplazados } = falsas({
      flujos: { tarjeta: flujo as unknown as FlujoConversacional<unknown> },
    });
    const [q1] = turnosDeFlujo(ctx, 'tarjeta', null, o) ?? [];
    const p1 = q1 as Extract<Turno, { clase: 'pregunta' }>;
    expect(p1).toMatchObject({ texto: '¿Cuánto llevas hoy en la Nu?', campo: 'monto', admiteCero: true });
    p1.responder({ tipo: 'texto', texto: 'mucho', porVoz: true });
    expect(reemplazados[0]).toMatchObject({ id: p1.id, clase: 'pregunta', ayuda: 'Dime la cifra.' });
    p1.responder({ tipo: 'monto', centavos: 320_000, aproximado: false });
    expect(agregados.map(clase)).toEqual(['persona', 'pregunta']);
    expect(textoDe(agregados[0])).toBe('$3,200');
    const p2 = agregados[1] as Extract<Turno, { clase: 'pregunta' }>;
    p2.responder({ tipo: 'chip', valor: 'si' });
    const entendi = agregados[3] as Extract<Turno, { clase: 'entendi' }>;
    expect(clase(entendi)).toBe('entendi');
    expect(textoDe(agregados[2])).toBe('Sí, completa');
    expect(entendi.propuesta.filas[0]?.valor).toBe('320000');
    entendi.propuesta.cambiar?.accion();
    expect(o.abrirRuta).toHaveBeenCalledWith('/tarjetas/nueva');
    await entendi.propuesta.confirmar.accion();
    expect(reemplazados.at(-1)).toMatchObject({
      id: entendi.id,
      clase: 'registro',
      texto: 'Listo: agregué tu Nu.',
      detalle: 'Corta el 28 y pagas el 18.',
    });
  });

  it('«Sí» de un flujo guarda y refresca las vistas (cabecera, Cuentas, Movimientos)', async () => {
    const refrescar = jest.fn();
    const { o, agregados } = falsas({
      flujos: { tarjeta: flujo as unknown as FlujoConversacional<unknown> },
      refrescar,
    });
    const [q1] = turnosDeFlujo(ctx, 'tarjeta', null, o) ?? [];
    (q1 as Extract<Turno, { clase: 'pregunta' }>).responder({
      tipo: 'monto',
      centavos: 0,
      aproximado: false,
    });
    (agregados[1] as Extract<Turno, { clase: 'pregunta' }>).responder({ tipo: 'chip', valor: 'si' });
    const entendi = agregados[3] as Extract<Turno, { clase: 'entendi' }>;
    expect(refrescar).not.toHaveBeenCalled();
    await entendi.propuesta.confirmar.accion();
    expect(refrescar).toHaveBeenCalledTimes(1);
  });

  it('con flujo, tarjeta_por_agregar pregunta en vez de abrir el formulario largo', () => {
    const { o } = falsas({ flujos: { tarjeta: flujo as unknown as FlujoConversacional<unknown> } });
    const r = {
      resultado: 'tarjeta_por_agregar',
      prellenado: {},
      candidatas: [],
    } as unknown as ResultadoTexto;
    expect(clase(turnosDesdeResultado(ctx, r, o)[0])).toBe('pregunta');
  });
});
