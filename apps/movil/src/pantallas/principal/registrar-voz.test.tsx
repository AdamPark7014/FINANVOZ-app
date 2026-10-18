import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { ScrollView } from 'react-native';
import { listarMovimientos } from '../../servicios';
import { nubeFalsa } from '../../servicios/__pruebas__/nube';
import { crearMotorFalso, navegacionFalsa, renderConSesion } from './__pruebas__/arnes';
import { conEscenario } from './__pruebas__/base';
import { PantallaHoy } from './PantallaHoy';

/** Una frase que el nivel 0 no entiende y el proxy rechaza (400): "no te entendí". */
const RECHAZADA = 'una frase que el proxy rechaza';

let ahora = 1_000_000;
beforeEach(() => {
  ahora = 1_000_000;
  jest.spyOn(Date, 'now').mockImplementation(() => ahora);
});
afterEach(() => jest.restoreAllMocks());

const boton = () => screen.getByTestId('boton-hablar');
const activar = () =>
  act(async () => {
    fireEvent(boton(), 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
  });
const tocar = async () => {
  await act(async () => {
    fireEvent(boton(), 'pressIn');
  });
  ahora += 80;
  fireEvent(boton(), 'pressOut');
};

function montarHoy(nube: ReturnType<typeof nubeFalsa>['nube'] | null = null) {
  const p = conEscenario('e4-01');
  const { motor, emitir } = crearMotorFalso();
  renderConSesion(p.ctx, <PantallaHoy navegacion={navegacionFalsa()} motor={motor} />, nube);
  return { p, motor, emitir };
}

describe('Registrar con voz desde Hoy (P0/P1 de la auditoría UX)', () => {
  it('toca para hablar, toca para terminar: un toque corto no corta el dictado', async () => {
    const { p, motor, emitir } = montarHoy();
    expect(boton().props.accessibilityLabel).toBe('Toca para hablar');

    await tocar();
    expect(motor.iniciar).toHaveBeenCalledTimes(1);
    expect(motor.detener).not.toHaveBeenCalled();
    expect(boton().props.accessibilityLabel).toBe('Escuchando. Toca para terminar');
    expect(screen.getByText('Toca para terminar')).toBeTruthy();
    emitir({ tipo: 'resultado', texto: 'coca 25', final: false });
    expect(screen.getByTestId('transcripcion-en-vivo')).toHaveTextContent('coca 25');

    ahora += 2_000;
    await tocar();
    expect(motor.detener).toHaveBeenCalledTimes(1);
    emitir({ tipo: 'resultado', texto: 'coca 25 en efectivo', final: true });
    expect(within(screen.getByTestId('aviso')).getByText('Deshacer')).toBeTruthy();
    expect(listarMovimientos(p.ctx)[0]?.movimientos[0]?.origen).toBe('voz');
    expect(boton().props.accessibilityLabel).toBe('Toca para hablar');
  });

  it('TalkBack: el doble toque ("activar") empieza y otro doble toque termina', async () => {
    const { motor } = montarHoy();
    expect(boton().props.accessibilityActions).toEqual([{ name: 'activate' }]);
    expect(boton().props.accessibilityRole).toBe('button');

    await activar();
    expect(motor.iniciar).toHaveBeenCalledTimes(1);
    expect(boton().props.accessibilityLabel).toBe('Escuchando. Toca para terminar');
    expect(motor.detener).not.toHaveBeenCalled();

    ahora += 1_500;
    await activar();
    expect(motor.detener).toHaveBeenCalledTimes(1);
  });

  it('mantener presionado y soltar sigue sirviendo', async () => {
    const { motor } = montarHoy();
    await act(async () => {
      fireEvent(boton(), 'pressIn');
    });
    ahora += 900;
    fireEvent(boton(), 'pressOut');
    expect(motor.iniciar).toHaveBeenCalledTimes(1);
    expect(motor.detener).toHaveBeenCalledTimes(1);
  });

  it('si no entiende lo dictado, lo oído queda en "Escribir" para arreglarlo', async () => {
    const f = nubeFalsa({ [RECHAZADA]: { tipo: 'error', codigo: 'peticion_invalida', status: 400 } });
    const { p, emitir } = montarHoy(f.nube);
    await tocar();
    emitir({ tipo: 'resultado', texto: RECHAZADA, final: true });

    expect(
      await screen.findByText(
        `Esto oí: «${RECHAZADA}». ¿Lo arreglas? Corrígelo aquí abajo y toca Registrar.`,
      ),
    ).toBeTruthy();
    expect(screen.getByTestId('campo-registrar').props.value).toBe(RECHAZADA);

    fireEvent.changeText(screen.getByTestId('campo-registrar'), 'coca 25 en efectivo');
    fireEvent.press(screen.getByTestId('boton-enviar-registro'));
    expect(within(screen.getByTestId('aviso')).getByText('Deshacer')).toBeTruthy();
    expect(listarMovimientos(p.ctx)[0]?.movimientos[0]?.origen).toBe('texto');
  });

  it('lo escrito que no se entiende muestra "No te entendí" sin "Esto oí"', async () => {
    const f = nubeFalsa({ [RECHAZADA]: { tipo: 'error', codigo: 'peticion_invalida', status: 400 } });
    montarHoy(f.nube);
    fireEvent.press(screen.getByTestId('boton-escribir'));
    fireEvent.changeText(screen.getByTestId('campo-registrar'), RECHAZADA);
    fireEvent.press(screen.getByTestId('boton-enviar-registro'));
    expect(await screen.findByText('No te entendí. Prueba así: «tacos 80 en efectivo».')).toBeTruthy();
    expect(screen.queryByText(/^Esto oí/)).toBeNull();
  });

  it('"Hablar" y "Escribir" están fijos al pie, fuera del desplazamiento, y el aviso sube sobre ellos', () => {
    montarHoy();
    const pie = screen.getByTestId('hoy-pie-registrar');
    expect(within(pie).getByTestId('boton-hablar')).toBeTruthy();
    expect(within(pie).getByTestId('boton-escribir')).toBeTruthy();
    const [desplazable] = screen.UNSAFE_getAllByType(ScrollView);
    if (!desplazable) throw new Error('Hoy sin desplazamiento');
    expect(within(desplazable).getByTestId('hoy-puedes')).toBeTruthy();
    expect(within(desplazable).queryByTestId('boton-hablar')).toBeNull();

    fireEvent(pie, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 80 } } });
    fireEvent.press(screen.getByTestId('boton-escribir'));
    fireEvent.changeText(screen.getByTestId('campo-registrar'), 'coca 25 en efectivo');
    fireEvent.press(screen.getByTestId('boton-enviar-registro'));
    // 16 de margen + 80 del pie + 2 × 12 de su relleno.
    expect(screen.getByTestId('aviso')).toHaveStyle({ bottom: 16 + 80 + 24 });
  });
});
