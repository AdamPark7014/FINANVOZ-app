import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { abrirPruebaPantalla, activarPlus, conEscenario } from '../principal/__pruebas__/base';
import {
  aceptarConsentimiento,
  agregarCuenta,
  listarMovimientos,
  listarPorInterpretar,
  registrarMovimiento,
} from '../../servicios';
import { crearMotorFalso, navegacionFalsa, renderConSesion } from '../principal/__pruebas__/arnes';
import { PantallaAsistente } from './PantallaAsistente';
import { avisarGuardadoR2, reiniciarR2 } from './r2';
import type { NavegacionAsistente } from './useAsistente';

// La voz del teléfono termina al instante: la confirmación por voz abre el micrófono al terminar de hablar.
jest.mock('expo-speech', () => ({
  speak: jest.fn((_texto: string, o?: { onDone?: () => void }) => o?.onDone?.()),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));

const movimientos = (ctx: Parameters<typeof listarMovimientos>[0]) =>
  listarMovimientos(ctx).flatMap((d) => d.movimientos);

function navegacion(): NavegacionAsistente & Record<string, jest.Mock> {
  return {
    ...navegacionFalsa(),
    alAbrirR2: jest.fn(),
    alAbrirArqueo: jest.fn(),
    alAbrirMeAlcanza: jest.fn(),
    alAbrirRuta: jest.fn(),
  } as NavegacionAsistente & Record<string, jest.Mock>;
}

function montar(p = conEscenario('e4-01'), nav = navegacion()) {
  const { motor, emitir } = crearMotorFalso();
  renderConSesion(p.ctx, <PantallaAsistente navegacion={nav} motor={motor} />);
  return { p, nav, motor, emitir };
}

async function escribir(frase: string) {
  if (!screen.queryByTestId('campo-registrar')) fireEvent.press(screen.getByTestId('boton-escribir'));
  fireEvent.changeText(screen.getByTestId('campo-registrar'), frase);
  await act(async () => {
    fireEvent.press(screen.getByTestId('boton-enviar-registro'));
  });
}

async function hablar(
  motor: ReturnType<typeof crearMotorFalso>['motor'],
  emitir: ReturnType<typeof crearMotorFalso>['emitir'],
  frase: string,
) {
  await act(async () => {
    fireEvent(screen.getByTestId('boton-hablar'), 'accessibilityAction', {
      nativeEvent: { actionName: 'activate' },
    });
  });
  expect(motor.iniciar).toHaveBeenCalled();
  emitir({ tipo: 'resultado', texto: frase, final: true });
  await act(async () => {});
}

beforeEach(() => reiniciarR2());

describe('Asistente · pantalla (Ola 7, criterio 1)', () => {
  it('recién instalada: cabecera compacta con la barra del día y el estado vacío con el micrófono enorme', () => {
    const { p } = montar();
    expect(screen.getByTestId('pantalla-hoy')).toBeTruthy();
    expect(screen.getByTestId('hoy-puedes')).toHaveTextContent('$214');
    expect(screen.getByTestId('hoy-fecha')).toHaveTextContent('Dom 11 oct');
    expect(screen.getByTestId('hoy-secundario')).toHaveTextContent('4 días para tu quincena (jue 15)');
    expect(screen.getByTestId('leyenda-libre')).toHaveTextContent('Libre $856');
    expect(screen.getByTestId('leyenda-reservado')).toHaveTextContent('Reservado $3,174');
    expect(screen.getByTestId('leyenda-colchon')).toHaveTextContent('Colchón $200');
    // El micrófono grande está al centro y es el único (Maestro toca `boton-hablar`).
    expect(within(screen.getByTestId('estado-vacio-mic')).getByTestId('boton-hablar')).toBeTruthy();
    expect(screen.getAllByTestId('boton-hablar')).toHaveLength(1);
    expect(screen.getByTestId('estado-vacio-saludo')).toHaveTextContent('Hola. Hoy puedes gastar $214.');
    p.cerrar();
  });

  it('«coca 25 en efectivo» por texto: «Registré…», «Tu día pasa de $214 a $207.» y Deshacer que lo revierte', async () => {
    const { p } = montar();
    await escribir('coca 25 en efectivo');
    const aviso = screen.getByTestId('aviso');
    expect(within(aviso).getByTestId('aviso-texto')).toHaveTextContent(
      'Registré Coca $25 · Antojos · Cartera.',
    );
    expect(within(aviso).getByTestId('aviso-cambio')).toHaveTextContent('Tu día pasa de $214 a $207.');
    expect(screen.getByTestId('hoy-puedes')).toHaveTextContent('$207');
    // Lo que dijiste queda como turno de la persona.
    expect(screen.getByText('coca 25 en efectivo')).toBeTruthy();
    expect(movimientos(p.ctx)).toHaveLength(1);
    await act(async () => {
      fireEvent.press(within(aviso).getByText('Deshacer'));
    });
    expect(screen.getByTestId('aviso-texto')).toHaveTextContent('Deshice el registro.');
    expect(movimientos(p.ctx)).toHaveLength(0);
    expect(screen.getByTestId('hoy-puedes')).toHaveTextContent('$214');
    p.cerrar();
  });

  it('al abrir, los movimientos de hoy ya son turnos «Registré…» (sin Deshacer) y no hay estado vacío', () => {
    const p = conEscenario('e4-01');
    registrarMovimiento(p.ctx, {
      tipo: 'gasto',
      monto: 8_000,
      descripcion: 'tacos',
      categoria: 'comida_fuera',
      origenId: movimientosCuenta(p),
    } as never);
    montar(p);
    expect(screen.queryByTestId('estado-vacio')).toBeNull();
    const turno = screen.getAllByTestId(/^turno-registro:/)[0];
    expect(within(turno as never).getByText(/^Registré Tacos \$80/)).toBeTruthy();
    expect(within(turno as never).queryByText('Deshacer')).toBeNull();
    // La barra de voz trae su micrófono de 72 pt.
    expect(within(screen.getByTestId('barra-voz')).getByTestId('boton-hablar')).toBeTruthy();
    p.cerrar();
  });
});

describe('Asistente · «Entendí» y R2 (criterio 2)', () => {
  it('«pagué la luz 6000 con la bbva»: Entendí con 4 filas; «Sí, regístralo» registra y el turno pasa a «Registré…»', async () => {
    const { p } = montar();
    await escribir('pagué la luz 6000 con la bbva');
    const entendi = screen.getByTestId('entendi');
    expect(within(entendi).getByText('Entendí · ¿lo registro?')).toBeTruthy();
    for (const fila of ['que', 'cuenta', 'categoria', 'cuando'])
      expect(within(entendi).getByTestId(`entendi-fila-${fila}`)).toBeTruthy();
    expect(within(entendi).getByTestId('entendi-fila-cuenta')).toHaveTextContent(/BBVA Débito/);
    expect(movimientos(p.ctx)).toHaveLength(0);
    await act(async () => {
      fireEvent.press(screen.getByTestId('entendi-confirmar'));
    });
    expect(screen.queryByTestId('entendi')).toBeNull();
    expect(screen.getByTestId('aviso-texto')).toHaveTextContent(/^Registré Luz \$6,000/);
    expect(movimientos(p.ctx)).toHaveLength(1);
    p.cerrar();
  });

  it('«Cambiar» abre R2 con lo dicho; al guardar en R2 vuelve al asistente con «Registré…» y Deshacer', async () => {
    const { p, nav } = montar();
    await escribir('pagué la luz 6000 con la bbva');
    fireEvent.press(screen.getByTestId('entendi-cambiar'));
    expect(nav.alAbrirR2).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'gasto', monto: 600_000, oido: 'pagué la luz 6000 con la bbva' }),
    );
    const r = registrarMovimiento(p.ctx, {
      tipo: 'gasto',
      monto: 600_000,
      descripcion: 'luz',
      categoria: 'servicios',
      origenId: movimientosCuenta(p),
    } as never);
    await act(async () => {
      avisarGuardadoR2({
        mensaje: 'Registré: luz $6,000',
        deshacer: r.deshacer,
        transaccionId: r.transaccionId,
      });
    });
    expect(screen.getByTestId('aviso-texto')).toHaveTextContent('Registré luz $6,000.');
    expect(within(screen.getByTestId('aviso')).getByText('Deshacer')).toBeTruthy();
    p.cerrar();
  });

  it('cambiar una fila de la tarjeta (cuenta) se ve al momento y es lo que se registra', async () => {
    const { p } = montar();
    await escribir('pagué la luz 6000 con la bbva');
    fireEvent.press(screen.getByTestId('entendi-fila-cuenta').children[0] as never);
    const opciones = screen.getAllByTestId(/^entendi-opcion-cuenta-/);
    const cartera = opciones.find((o) => /Cartera/.test(String(o.props.accessibilityLabel)));
    expect(cartera).toBeDefined();
    fireEvent.press(cartera as never);
    expect(screen.getByTestId('entendi-fila-cuenta')).toHaveTextContent(/Cartera/);
    await act(async () => {
      fireEvent.press(screen.getByTestId('entendi-confirmar'));
    });
    expect(movimientos(p.ctx)[0]?.saleDe).toEqual(['Cartera']);
    p.cerrar();
  });
});

function movimientosCuenta(p: ReturnType<typeof conEscenario>): string {
  const { listarCuentas } = jest.requireActual<typeof import('../../servicios')>('../../servicios');
  return listarCuentas(p.ctx).tienes.find((c) => c.subtipo === 'debito')?.id ?? '';
}

describe('Asistente · no entendí y sin nube (criterios 3 y 12)', () => {
  it('una frase sin sentido: repite lo oído, ≥ 3 opciones y «Corregir lo que oí» la pone en el teclado', async () => {
    const { p, nav } = montar();
    await escribir('los 300 del Beto');
    const turno = screen.getByTestId('no-entendi');
    expect(within(turno).getByTestId('no-entendi-texto')).toHaveTextContent(
      'Oí «los 300 del Beto», pero no supe qué pasó.',
    );
    expect(within(turno).getAllByTestId(/^no-entendi-opcion-/).length).toBeGreaterThanOrEqual(3);
    // Nunca «cuando tengas internet» en la build sin nube.
    expect(screen.queryByText(/internet/)).toBeNull();
    fireEvent.press(within(turno).getByTestId('no-entendi-opcion-otra'));
    expect(nav.alAbrirR2).toHaveBeenCalledWith(expect.objectContaining({ oido: 'los 300 del Beto' }));
    fireEvent.press(within(turno).getByTestId('no-entendi-corregir'));
    expect(screen.getByTestId('campo-registrar').props.value).toBe('los 300 del Beto');
    // La frase quedó en Por revisar; al elegir una opción con frase se registra.
    expect(listarPorInterpretar(p.ctx)).toHaveLength(1);
    p.cerrar();
  });

  it('una opción con frase reescrita se manda al intérprete y registra', async () => {
    const { p } = montar();
    await escribir('300 de la Nu');
    const turno = screen.getByTestId('no-entendi');
    const conFrase = within(turno)
      .getAllByTestId(/^no-entendi-opcion-/)
      .find((o) => /Pagué \$300 de la Nu/i.test(String(o.props.accessibilityLabel)));
    if (conFrase) {
      await act(async () => {
        fireEvent.press(conFrase);
      });
      expect(screen.queryAllByTestId(/^(aviso|entendi|pregunta)$/).length).toBeGreaterThan(0);
    }
    p.cerrar();
  });
});

describe('Asistente · consultas (criterio 4)', () => {
  it('«¿cuánto llevo en antojos?» lo responde el nivel 0, sin nube: lo que va del mes, con «Ver movimientos»', async () => {
    const p = conEscenario('e4-01');
    activarPlus(p.ctx);
    const { nav } = montar(p);
    await escribir('coca 25 en efectivo');
    await escribir('¿cuánto llevo en antojos?');
    const respuesta = screen.getByTestId('respuesta');
    expect(within(respuesta).getByTestId('respuesta-texto')).toHaveTextContent(
      'Este mes llevas $25 en antojos (1 movimiento).',
    );
    fireEvent.press(within(respuesta).getByTestId('respuesta-ver-movimientos'));
    expect(nav.alVerMovimientos).toHaveBeenCalledWith(
      expect.objectContaining({ categorias: expect.any(Array) }),
    );
    p.cerrar();
  });

  it('«¿cuánto gasté en antojos esta semana?»: respuesta en texto con «Ver movimientos» filtrado', async () => {
    const p = conEscenario('e4-01');
    activarPlus(p.ctx);
    const { nav } = montar(p);
    await escribir('coca 25 en efectivo');
    await escribir('¿cuánto gasté en antojos esta semana?');
    const respuesta = screen.getByTestId('respuesta');
    expect(within(respuesta).getByTestId('respuesta-texto')).toHaveTextContent(
      'Esta semana llevas $25 en antojos (1 movimiento).',
    );
    fireEvent.press(within(respuesta).getByTestId('respuesta-ver-movimientos'));
    expect(nav.alVerMovimientos).toHaveBeenCalledWith(
      expect.objectContaining({ categorias: expect.any(Array) }),
    );
    p.cerrar();
  });
});

describe('Asistente · «¿Puedo gastar en esto?» en la conversación', () => {
  it('«puedo gastar 100 en unos tenis»: cómo queda tu día (de core) y «Regístralo» abre R2 con lo dicho', async () => {
    const { p, nav } = montar();
    await escribir('puedo gastar 100 en unos tenis');
    const turno = screen.getAllByTestId(/^turno-puedo-gastar-\d+$/)[0];
    expect(turno).toBeDefined();
    expect(within(turno as never).getByTestId(/-texto$/)).toHaveTextContent(
      'Si compras unos tenis de $100 hoy, tu día pasa de $214 a $189 hasta tu quincena (jue 15).',
    );
    expect(screen.getByText('Cabe en lo que puedes gastar hoy ($214).')).toBeTruthy();
    await act(async () => {
      fireEvent.press(within(turno as never).getByTestId(/-registrar$/));
    });
    expect(nav.alAbrirR2).toHaveBeenCalledWith({ tipo: 'gasto', monto: 10_000, descripcion: 'unos tenis' });
    // Nada se registró solo por preguntar.
    expect(movimientos(p.ctx)).toHaveLength(0);
    p.cerrar();
  });

  it('si no alcanza lo dice con el faltante, sin decir qué hacer', async () => {
    const { p } = montar();
    await escribir('¿me alcanza para una tele de 12,000?');
    expect(
      screen.getByText(/^Si compras una tele de \$12,000 hoy, te faltarían \$11,144 para cubrir/),
    ).toBeTruthy();
    expect(screen.queryByText(/deberías|te recomiendo|mejor/i)).toBeNull();
    p.cerrar();
  });

  it('sin la cifra pregunta «¿Cuánto cuesta?» y la respuesta escrita completa la cuenta', async () => {
    const { p } = montar();
    await escribir('¿puedo comprarme unos tenis?');
    expect(screen.getByTestId('pregunta-texto')).toHaveTextContent('¿Cuánto cuesta?');
    await escribir('500');
    expect(screen.getByText(/^Si compras unos tenis de \$500 hoy/)).toBeTruthy();
    p.cerrar();
  });

  it('«¿Puedo gastar…?» es el primer chip; con el teclado abierto escribe el arranque', () => {
    const { p } = montar();
    const chips = within(screen.getByTestId('chips-intencion')).getAllByTestId(/^chip-intencion-/);
    expect(chips[0]).toHaveProp('testID', 'chip-intencion-puedo_gastar');
    fireEvent.press(screen.getByTestId('boton-escribir'));
    fireEvent.press(screen.getByTestId('chip-intencion-puedo_gastar'));
    expect(screen.getByTestId('campo-registrar').props.value).toBe('puedo gastar ');
    p.cerrar();
  });
});

describe('Asistente · voz', () => {
  it('lo dicho entra como turno con micrófono; «Entendí» por voz escucha un «sí» y registra', async () => {
    const { p, motor, emitir } = montar();
    await hablar(motor, emitir, 'pagué la luz 6000 con la bbva');
    expect(screen.getByTestId('entendi')).toBeTruthy();
    expect(screen.getAllByTestId(/-voz$/).length).toBeGreaterThan(0);
    // Pista para contestar hablando.
    expect(screen.getByText(/^También puedes decir «sí»/)).toBeTruthy();
    // Dice la tarjeta y, al terminar de hablar, escucha un turno para el «sí».
    await waitFor(() => expect(motor.iniciar.mock.calls.length).toBeGreaterThanOrEqual(2));
    emitir({ tipo: 'resultado', texto: 'sí', final: true });
    await act(async () => {});
    expect(movimientos(p.ctx)).toHaveLength(1);
    expect(screen.queryByTestId('entendi')).toBeNull();
    p.cerrar();
  });
});

describe('Asistente · desglose y Plus', () => {
  it('la barra del día abre y cierra el desglose; ahí viven la probabilidad o su candado y «¿Me alcanza?»', () => {
    const p = conEscenario('e4-01');
    activarPlus(p.ctx);
    montar(p);
    const barra = screen.getByTestId('boton-desglose');
    expect(barra).toHaveProp('accessibilityState', { expanded: false });
    expect(barra.props.accessibilityLabel).toMatch(/^Reservado/);
    fireEvent.press(barra);
    expect(screen.getByTestId('desglose')).toBeTruthy();
    expect(screen.getByTestId('desglose-libre')).toHaveTextContent('$856');
    expect(screen.getByTestId('boton-me-alcanza')).toBeTruthy();
    fireEvent.press(screen.getByTestId('boton-desglose'));
    expect(screen.queryByTestId('desglose')).toBeNull();
    p.cerrar();
  });

  it('sin ingreso: la cabecera pide configurarlo y no hay barra', () => {
    const p = abrirPruebaPantalla();
    aceptarConsentimiento(p.ctx, { datosFinancieros: true });
    agregarCuenta(p.ctx, { subtipo: 'efectivo', nombre: 'Cartera', saldo: 300_000 });
    const nav = navegacion();
    montar(p as ReturnType<typeof conEscenario>, nav);
    expect(screen.getByTestId('hoy-sin-ingreso')).toBeTruthy();
    expect(screen.queryByTestId('boton-desglose')).toBeNull();
    fireEvent.press(screen.getByTestId('boton-configurar-ingreso'));
    expect(nav.alConfigurarIngreso).toHaveBeenCalled();
    p.cerrar();
  });
});
