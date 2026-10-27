import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { conEscenario } from '../principal/__pruebas__/base';
import { crearMotorFalso, navegacionFalsa, renderConSesion } from '../principal/__pruebas__/arnes';
import { auditar } from '../__pruebas__/accesibilidad';
import { PantallaAsistente } from './PantallaAsistente';
import { pedirAlAsistente, reiniciarR2 } from './r2';
import {
  BTN_ME_ALCANZA,
  ETIQUETA_CERRAR_TECLADO,
  ETIQUETA_TECLADO,
  PREFIJO_ME_ALCANZA_ESCRITO,
} from './textos';

jest.mock('expo-speech', () => ({
  speak: jest.fn((_texto: string, o?: { onDone?: () => void }) => o?.onDone?.()),
  stop: jest.fn(),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));

function montar() {
  const p = conEscenario('e4-01');
  const { motor, emitir } = crearMotorFalso();
  renderConSesion(p.ctx, <PantallaAsistente navegacion={navegacionFalsa()} motor={motor} />);
  return { p, motor, emitir };
}

beforeEach(() => reiniciarR2());

/** Dock de voz del asistente (dirección B, `02 §2`): «Escribir», el micrófono y «¿Me alcanza?». */
describe('Asistente · dock de voz', () => {
  it('trae «Escribir», el micrófono y «¿Me alcanza?» con nombre para el lector y sin hallazgos', () => {
    const { p } = montar();
    const dock = screen.getByTestId('dock-voz');
    const escribir = within(dock).getByTestId('boton-escribir');
    expect(escribir.props.accessibilityLabel).toBe(ETIQUETA_TECLADO);
    expect(escribir.props.accessibilityState).toMatchObject({ expanded: false });
    expect(within(dock).getByTestId('boton-hablar')).toBeTruthy();
    expect(within(dock).getByTestId('dock-me-alcanza').props.accessibilityLabel).toBe(BTN_ME_ALCANZA);
    expect(auditar(screen.toJSON() as never)).toEqual([]);
    fireEvent.press(escribir);
    expect(screen.getByTestId('boton-escribir').props.accessibilityLabel).toBe(ETIQUETA_CERRAR_TECLADO);
    expect(screen.getByTestId('campo-registrar')).toBeTruthy();
    p.cerrar();
  });

  it('«¿Me alcanza?» escucha con «me alcanza para…» y contesta en la conversación', async () => {
    const { p, motor, emitir } = montar();
    await act(async () => {
      fireEvent.press(screen.getByTestId('dock-me-alcanza'));
    });
    expect(motor.iniciar).toHaveBeenCalled();
    emitir({ tipo: 'resultado', texto: 'unos tenis de 500', final: true });
    await act(async () => {});
    expect(screen.getByText(/me alcanza para unos tenis de 500/i)).toBeTruthy();
    p.cerrar();
  });

  it('con el campo abierto, «¿Me alcanza?» deja escrito el arranque de la pregunta', () => {
    const { p } = montar();
    fireEvent.press(screen.getByTestId('boton-escribir'));
    fireEvent.press(screen.getByTestId('dock-me-alcanza'));
    expect(screen.getByTestId('campo-registrar').props.value).toBe(PREFIJO_ME_ALCANZA_ESCRITO);
    p.cerrar();
  });

  it('«Escribir» desde Movimientos o Cuentas llega como pedido y abre el campo', async () => {
    const { p } = montar();
    expect(screen.queryByTestId('campo-registrar')).toBeNull();
    await act(async () => {
      pedirAlAsistente({ tipo: 'escribir' });
    });
    expect(screen.getByTestId('campo-registrar')).toBeTruthy();
    p.cerrar();
  });
});
