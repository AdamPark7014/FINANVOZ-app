import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Speech from 'expo-speech';
import { AccessibilityInfo } from 'react-native';
import { fijarVozRespuesta } from '../../servicios';
import { crearMotorFalso, navegacionFalsa, renderConSesion } from './__pruebas__/arnes';
import { conEscenario } from './__pruebas__/base';
import { PantallaHoy } from './PantallaHoy';
import { PantallaRegistrar } from './PantallaRegistrar';

jest.mock('expo-speech', () => ({ speak: jest.fn(), stop: jest.fn() }));

let ahora = 1_000_000;
let lector = false;
beforeEach(() => {
  ahora = 1_000_000;
  lector = false;
  jest.spyOn(Date, 'now').mockImplementation(() => ahora);
  jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockImplementation(() => Promise.resolve(lector));
  jest.mocked(Speech.speak).mockClear();
  jest.mocked(Speech.stop).mockClear();
});
afterEach(() => jest.restoreAllMocks());

async function dictar(frase: string, antes?: (p: ReturnType<typeof conEscenario>) => void) {
  const p = conEscenario('e4-01');
  antes?.(p);
  const { motor, emitir } = crearMotorFalso();
  renderConSesion(p.ctx, <PantallaHoy navegacion={navegacionFalsa()} motor={motor} />);
  const boton = screen.getByTestId('boton-hablar');
  await act(async () => {
    fireEvent(boton, 'pressIn');
  });
  ahora += 80;
  fireEvent(boton, 'pressOut');
  ahora += 2_000;
  await act(async () => {
    fireEvent(boton, 'pressIn');
  });
  ahora += 80;
  fireEvent(boton, 'pressOut');
  await act(async () => {
    emitir({ tipo: 'resultado', texto: frase, final: true });
  });
  return p;
}

describe('Finanvoz te contesta en voz', () => {
  it('tras dictar dice lo que registró y cuánto puedes gastar hoy, en es-MX', async () => {
    await dictar('coca 25 en efectivo');
    expect(Speech.stop).toHaveBeenCalled();
    expect(Speech.speak).toHaveBeenCalledTimes(1);
    const [texto, opciones] = jest.mocked(Speech.speak).mock.calls[0] ?? [];
    // La frase hablada corta de V-2 (`fraseHablada`): qué se registró y cuánto queda hoy, sin cifras escritas.
    expect(texto).toBe('Listo, coca de veinticinco con tu Cartera. Te quedan doscientos siete para hoy.');
    expect(texto).not.toMatch(/\$|\d/);
    // La voz (V-2) agrega ritmo, tono y avisos de fin: basta con que hable en es-MX.
    expect(opciones).toEqual(expect.objectContaining({ language: 'es-MX' }));
  });

  it('no habla con el ajuste apagado ni con TalkBack encendido', async () => {
    await dictar('coca 25 en efectivo', (p) => fijarVozRespuesta(p.ctx, false));
    expect(Speech.speak).not.toHaveBeenCalled();

    lector = true;
    await dictar('coca 30 en efectivo');
    expect(Speech.speak).not.toHaveBeenCalled();
  });
});

describe('Micrófono del widget', () => {
  it('Registrar abierta con dictarAlAbrir empieza a escuchar sin tocar nada', async () => {
    const p = conEscenario('e4-01');
    const { motor } = crearMotorFalso();
    renderConSesion(p.ctx, <PantallaRegistrar alCerrar={jest.fn()} motor={motor} dictarAlAbrir />);
    await waitFor(() => expect(motor.iniciar).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('boton-hablar').props.accessibilityLabel).toBe(
      'Escuchando. Toca para terminar',
    );
  });

  it('sin dictarAlAbrir no escucha solo', async () => {
    const p = conEscenario('e4-01');
    const { motor } = crearMotorFalso();
    renderConSesion(p.ctx, <PantallaRegistrar alCerrar={jest.fn()} motor={motor} />);
    await act(async () => {});
    expect(motor.iniciar).not.toHaveBeenCalled();
  });
});
