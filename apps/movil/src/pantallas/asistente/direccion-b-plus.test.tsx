import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { obtenerHoy, registrarMovimiento } from '../../servicios';
import { colores, coloresCategoria, coloresDinero, etiquetaHablada, formatearCentavos } from '../../ui';
import { auditar } from '../__pruebas__/accesibilidad';
import { conEscenario } from '../principal/__pruebas__/base';
import { crearMotorFalso, navegacionFalsa, renderConSesion } from '../principal/__pruebas__/arnes';
import { PantallaAsistente } from './PantallaAsistente';
import { reiniciarR2 } from './r2';
import { etiquetaDiaPista, lineasEventoPista, nombreCorto, textoDiasPista } from './textos';

jest.mock('expo-speech', () => ({
  speak: jest.fn((_texto: string, o?: { onDone?: () => void }) => o?.onDone?.()),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));

const fondo = (testID: string) =>
  (StyleSheet.flatten(screen.getByTestId(testID).props.style) as { backgroundColor?: string })
    .backgroundColor;

function montar(escenario = 'e4-01') {
  const p = conEscenario(escenario);
  const { motor } = crearMotorFalso();
  renderConSesion(
    p.ctx,
    <PantallaAsistente navegacion={{ ...navegacionFalsa(), alAbrirR2: jest.fn() }} motor={motor} />,
  );
  return p;
}

beforeEach(() => reiniciarR2());

describe('B+ · textos del inicio (D1)', () => {
  it('la pista: insignia, eventos y lo que oye el lector', () => {
    expect(textoDiasPista(4)).toBe('4 días');
    expect(textoDiasPista(1)).toBe('1 día');
    expect(textoDiasPista(0)).toBe('Hoy');
    expect(nombreCorto('Nu ••4410')).toBe('Nu');
    expect(lineasEventoPista({ tipo: 'egreso', concepto: 'internet', monto: 49_900 })).toEqual({
      concepto: 'Internet',
      cifra: '−$499',
    });
    expect(lineasEventoPista({ tipo: 'ingreso', concepto: 'quincena', monto: 1_300_000 })).toEqual({
      concepto: 'Quincena',
      cifra: '+$13,000',
    });
    expect(lineasEventoPista({ tipo: 'tarjeta', concepto: 'Nu ••4410', monto: 142_000 })).toEqual({
      concepto: 'Pagar Nu',
      cifra: null,
    });
    expect(etiquetaDiaPista({ hoy: true, diaSemana: 'lun', dia: 26, eventos: [] })).toBe(
      'Hoy, lunes 26: nada fijo.',
    );
    expect(
      etiquetaDiaPista({
        hoy: false,
        diaSemana: 'jue',
        dia: 29,
        eventos: [
          { tipo: 'egreso', concepto: 'tanda', monto: 50_000 },
          { tipo: 'tarjeta', concepto: 'Nu', monto: 142_000 },
        ],
      }),
    ).toBe('Jueves 29: tanda, menos quinientos pesos; pagar Nu, mil cuatrocientos veinte pesos.');
  });
});

describe('B+ · Inicio «Tablero vivo» (D1)', () => {
  it('orbe y saludo, la cifra con «al día», la barra de tu dinero y la pista a la quincena', () => {
    const p = montar();
    const v = obtenerHoy(p.ctx);
    expect(within(screen.getByTestId('cabecera-dia')).getByTestId('orbe')).toBeTruthy();
    expect(screen.getByTestId('hoy-puedes')).toHaveTextContent('$214');
    expect(screen.getByText('al día')).toBeTruthy();
    // Tu dinero: «De tus $X» y cada parte con su cifra (las de E4 en VistaHoy).
    expect(screen.getByTestId('barra-dinero-total')).toHaveTextContent(
      `De tus ${formatearCentavos(v.liquidez, 'pesos')}`,
    );
    expect(screen.getByTestId('barra-dinero-apartado')).toHaveTextContent(
      `Apartado${formatearCentavos(v.reservado, 'pesos')}`,
    );
    expect(screen.getByTestId('barra-dinero-colchon')).toHaveTextContent(
      `Colchón${formatearCentavos(v.colchon, 'pesos')}`,
    );
    expect(screen.getByTestId('barra-dinero-libre')).toHaveTextContent(
      `Libre${formatearCentavos(v.libre, 'pesos')}`,
    );
    expect(fondo('barra-dinero-barra-apartado')).toBe(coloresDinero.claro.apartado);
    expect(fondo('barra-dinero-barra-libre')).toBe(coloresDinero.claro.libre);
    // La pista: de hoy (dom 11) a la quincena (jue 15) con la tanda y el internet.
    expect(screen.getByTestId('pista-dias')).toHaveTextContent('4 días');
    expect(screen.getByTestId('pista-dia-2026-10-11').props.accessibilityLabel).toBe(
      'Hoy, domingo 11: nada fijo.',
    );
    expect(screen.getByTestId('pista-dia-2026-10-13')).toHaveTextContent('MAR13Tanda−$500');
    expect(screen.getByTestId('pista-dia-2026-10-15')).toHaveTextContent('JUE15Quincena+$6,500');
    // «Cómo lo calculé ›» sigue abriendo y cerrando el desglose (Maestro 02 y 09).
    fireEvent.press(screen.getByTestId('boton-desglose'));
    expect(screen.getByTestId('desglose')).toBeTruthy();
    fireEvent.press(screen.getByTestId('boton-desglose'));
    expect(screen.queryByTestId('desglose')).toBeNull();
    expect(auditar(screen.toJSON() as never)).toEqual([]);
    p.cerrar();
  });

  it('si lo apartado y el colchón no caben en lo que tienes, la barra pinta el faltante en rojo («Faltan $X»)', () => {
    const p = conEscenario('e4-01');
    // Un gasto de $1,000 deja lo libre en negativo (E4: «Te faltan…»).
    registrarMovimiento(p.ctx, {
      tipo: 'gasto',
      categoria: 'super',
      origenId: p.e.cuentas['bbva'] as string,
      monto: 100_000,
      fecha: '2026-10-11',
    });
    const v = obtenerHoy(p.ctx);
    expect(v.estado).toBe('libre_negativo');
    renderConSesion(
      p.ctx,
      <PantallaAsistente navegacion={navegacionFalsa()} motor={crearMotorFalso().motor} />,
    );
    expect(fondo('barra-dinero-barra-faltante')).toBe(colores.claro.faltante);
    expect(screen.queryByTestId('barra-dinero-libre')).toBeNull();
    expect(screen.getByTestId('barra-dinero-faltante')).toHaveTextContent(
      `Faltan${formatearCentavos(v.faltante)}`,
    );
    expect(screen.getByTestId('barra-dinero-colchon')).toHaveTextContent(
      `Colchón${formatearCentavos(v.colchon, 'pesos')}`,
    );
    expect(auditar(screen.toJSON() as never)).toEqual([]);
    p.cerrar();
  });

  it('lo pendiente de una tarjeta es una fila con su mosaico, qué pagar y «Ya la pagué» (vencida, sin prometer)', () => {
    const p = conEscenario('e5-10');
    p.reloj.fijar('2026-11-28');
    renderConSesion(
      p.ctx,
      <PantallaAsistente navegacion={navegacionFalsa()} motor={crearMotorFalso().motor} />,
    );
    const fila = screen.getByTestId('tarjeta-accion-0');
    expect(within(fila).getByTestId('tarjeta-accion-0-texto').props.accessibilityLabel).toMatch(
      /^La fecha límite de tu .+ fue el .+\. Pago para no generar intereses: .+ pesos\.$/,
    );
    expect(within(fila).getByTestId('tarjeta-accion-0-ya-la-pague')).toBeTruthy();
    expect(auditar(screen.toJSON() as never)).toEqual([]);
    p.cerrar();
  });
});

describe('B+ · «Te escucho» (D2)', () => {
  let ahora = 1_000_000;
  beforeEach(() => {
    ahora = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => ahora);
  });
  afterEach(() => jest.restoreAllMocks());

  function conVolumen() {
    const falso = crearMotorFalso();
    let alNivel: ((n: number) => void) | null = null;
    const motor = {
      ...falso.motor,
      suscribirVolumen: jest.fn((f: (n: number) => void) => {
        alNivel = f;
        return () => {
          alNivel = null;
        };
      }),
    };
    return { ...falso, motor, nivel: (n: number) => act(() => alNivel?.(n)) };
  }

  function montarEscucha() {
    const p = conEscenario('e4-01');
    const m = conVolumen();
    renderConSesion(p.ctx, <PantallaAsistente navegacion={navegacionFalsa()} motor={m.motor} />);
    return { p, ...m };
  }

  const toque = (x: number, y: number) => ({ nativeEvent: { pageX: x, pageY: y } });

  it('mantener: pantalla pino con la frase en vivo, «Voy entendiendo» del nivel 0 y la onda; soltar registra', async () => {
    const { p, emitir, motor } = montarEscucha();
    await act(async () => {
      fireEvent(screen.getByTestId('boton-hablar'), 'pressIn', toque(200, 800));
    });
    expect(screen.getByTestId('hoja-escuchando')).toBeTruthy();
    expect(screen.getByTestId('orbe-escucha')).toBeTruthy();
    expect(screen.getByTestId('pista-escucha')).toHaveTextContent(
      'Suelta para registrar · desliza para cancelar',
    );
    emitir({ tipo: 'resultado', texto: 'coca de 25 en efec', final: false });
    expect(screen.getByTestId('transcripcion-en-vivo')).toHaveTextContent('coca de 25 en efec');
    expect(screen.getByTestId('entendido-monto')).toHaveTextContent('$25');
    expect(screen.getByTestId('entendido-categoria')).toHaveTextContent('Antojos');
    expect(screen.getByTestId('entendido-cuenta')).toHaveTextContent('Cartera …');
    expect(screen.getByTestId('voy-entendiendo').props.accessibilityLabel).toBe(
      'Voy entendiendo: veinticinco pesos, Antojos, quizá Cartera.',
    );
    expect(motor.suscribirVolumen).toHaveBeenCalled();
    expect(screen.getByTestId('onda-voz')).toBeTruthy();
    expect(auditar(screen.toJSON() as never)).toEqual([]);
    // Soltar (después de mantener) termina y registra; la pantalla pino se va.
    ahora += 1_500;
    await act(async () => {
      fireEvent(screen.getByTestId('boton-hablar'), 'pressOut', toque(205, 790));
    });
    expect(motor.detener).toHaveBeenCalledTimes(1);
    emitir({ tipo: 'resultado', texto: 'coca 25 en efectivo', final: true });
    expect(screen.queryByTestId('hoja-escuchando')).toBeNull();
    expect(screen.getByTestId('aviso')).toBeTruthy();
    p.cerrar();
  });

  it('deslizar lejos del micrófono cancela sin registrar; la X también', async () => {
    const { p, emitir, motor } = montarEscucha();
    await act(async () => {
      fireEvent(screen.getByTestId('boton-hablar'), 'pressIn', toque(200, 800));
    });
    emitir({ tipo: 'resultado', texto: 'coca 25', final: false });
    ahora += 1_200;
    await act(async () => {
      fireEvent(screen.getByTestId('boton-hablar'), 'pressOut', toque(200, 600));
    });
    expect(motor.abortar).toHaveBeenCalledTimes(1);
    expect(motor.detener).not.toHaveBeenCalled();
    expect(screen.queryByTestId('hoja-escuchando')).toBeNull();
    expect(screen.queryByTestId('aviso')).toBeNull();

    // Toque corto: sigue escuchando y la pista cambia; la X cancela.
    ahora += 2_000;
    await act(async () => {
      fireEvent(screen.getByTestId('boton-hablar'), 'pressIn', toque(200, 800));
    });
    ahora += 100;
    await act(async () => {
      fireEvent(screen.getByTestId('boton-hablar'), 'pressOut', toque(200, 800));
    });
    expect(screen.getByTestId('pista-escucha')).toHaveTextContent(
      'Toca el micrófono para terminar · la X cancela',
    );
    fireEvent.press(screen.getByTestId('boton-cancelar-escucha'));
    expect(motor.abortar).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('hoja-escuchando')).toBeNull();
    p.cerrar();
  });

  it('el volumen mueve la onda cuando el reconocedor lo da (sin texto ni audio)', async () => {
    const { p, nivel } = montarEscucha();
    await act(async () => {
      fireEvent(screen.getByTestId('boton-hablar'), 'pressIn', toque(200, 800));
    });
    nivel(0.8);
    expect(screen.getByTestId('onda-voz')).toBeTruthy();
    p.cerrar();
  });
});

describe('B+ · Registro (D3) y «¿Me alcanza?» (D4)', () => {
  async function escribir(frase: string) {
    if (!screen.queryByTestId('campo-registrar')) fireEvent.press(screen.getByTestId('boton-escribir'));
    fireEvent.changeText(screen.getByTestId('campo-registrar'), frase);
    await act(async () => {
      fireEvent.press(screen.getByTestId('boton-enviar-registro'));
    });
  }

  it('D3: orbe y «Listo», mosaico, «Tu día $X → $Y» con su barra, el «−$Z» de la píldora y la racha', async () => {
    const p = conEscenario('e4-01');
    // Dos días seguidos anotando antes de hoy: con el de hoy son tres y la racha se dice.
    for (const fecha of ['2026-10-09', '2026-10-10'] as const) {
      registrarMovimiento(p.ctx, {
        tipo: 'gasto',
        categoria: 'antojos',
        origenId: p.e.cuentas['efectivo'] as string,
        monto: 1_000,
        fecha,
      });
    }
    const hoyAntes = obtenerHoy(p.ctx);
    const antes = formatearCentavos(hoyAntes.hoyPuedesCentavos, 'pesos');
    renderConSesion(
      p.ctx,
      <PantallaAsistente
        navegacion={{ ...navegacionFalsa(), alAbrirR2: jest.fn() }}
        motor={crearMotorFalso().motor}
      />,
    );
    jest.useFakeTimers();
    try {
      await escribir('coca 25 en efectivo');
      const despues = formatearCentavos(obtenerHoy(p.ctx).hoyPuedesCentavos, 'pesos');
      expect(screen.getByTestId('aviso-orbe')).toBeTruthy();
      expect(fondo('aviso-mosaico')).toBe(coloresCategoria.claro.antojos.mosaico);
      expect(screen.getByTestId('aviso-cambio')).toHaveProp(
        'accessibilityLabel',
        etiquetaHablada(`Tu día pasa de ${antes} a ${despues}.`),
      );
      expect(screen.getByTestId('aviso-barra-dia')).toBeTruthy();
      // La cifra nueva cuenta hasta su valor.
      await act(async () => {
        jest.advanceTimersByTime(2_000);
      });
      expect(screen.getByTestId('aviso-cambio-despues')).toHaveTextContent(despues);
      // El «−$7» es lo que bajó la cifra del día (no el gasto): de la frase de arriba, en pesos enteros.
      const pesos = (t: string) => Number(t.replace(/[$,]/g, ''));
      expect(screen.getByTestId('pildora-delta')).toHaveTextContent(`−$${pesos(antes) - pesos(despues)}`);
      expect(screen.getByTestId('aviso-racha')).toHaveTextContent('3 días seguidos anotando todo');
      expect(auditar(screen.toJSON() as never)).toEqual([]);
    } finally {
      jest.useRealTimers();
    }
    p.cerrar();
  });

  it('D4: veredicto con orbe, las dos opciones lado a lado y «Cómo lo calculé» como barra apilada', async () => {
    const p = montar();
    await escribir('¿me alcanza para unos tenis de 100?');
    const turno = screen.getAllByTestId(/^turno-puedo-gastar-\d+$/)[0] as never;
    expect(within(turno).getByTestId(/-texto$/)).toHaveTextContent(
      'Sí te alcanza.Si los compras hoy, tu día baja a $189.',
    );
    expect(within(turno).getByTestId(/-orbe$/)).toBeTruthy();
    const opciones = within(turno).getByTestId(/-opciones$/);
    expect(StyleSheet.flatten(opciones.props.style)).toMatchObject({ flexDirection: 'row' });
    expect(within(turno).getByTestId(/-opcion-contado$/)).toHaveTextContent(/\$189/);
    expect(within(turno).getByTestId(/-opcion-esperar$/)).toHaveTextContent(/\$214/);
    // Apartado + colchón + la compra + libre = lo que tienes (E4 con la compra restada).
    const v = obtenerHoy(p.ctx);
    expect(within(turno).getByTestId('calculo-liquidez')).toHaveTextContent(
      `Tienes ${formatearCentavos(v.liquidez, 'pesos')}`,
    );
    expect(within(turno).getByTestId('calculo-compra')).toHaveTextContent('Unos tenis$100');
    expect(within(turno).getByTestId('calculo-libre')).toHaveTextContent('Libre$756');
    expect(within(turno).getByTestId(/-division$/)).toHaveTextContent('$756 libres ÷ 4 días = $189 al día');
    expect(auditar(screen.toJSON() as never)).toEqual([]);
    p.cerrar();
  });
});
