import { act, fireEvent, screen } from '@testing-library/react-native';
import * as Speech from 'expo-speech';
import { AccessibilityInfo } from 'react-native';
import { fijarVozRespuesta } from '../../servicios';
import { crearMotorFalso, navegacionFalsa, renderConSesion } from './__pruebas__/arnes';
import { conEscenario } from './__pruebas__/base';
import { PantallaHoy } from './PantallaHoy';

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
    expect(texto).toMatch(/^Registré: Coca veinticinco pesos, .+\. Hoy puedes gastar .+ pesos\.$/);
    expect(texto).not.toMatch(/\$|\d/);
    expect(opciones).toEqual({ language: 'es-MX' });
  });

  it('no habla con el ajuste apagado ni con TalkBack encendido', async () => {
    await dictar('coca 25 en efectivo', (p) => fijarVozRespuesta(p.ctx, false));
    expect(Speech.speak).not.toHaveBeenCalled();

    lector = true;
    await dictar('coca 30 en efectivo');
    expect(Speech.speak).not.toHaveBeenCalled();
  });
});
