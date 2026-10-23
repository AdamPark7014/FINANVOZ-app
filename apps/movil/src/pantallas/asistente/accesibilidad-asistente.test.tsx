import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { anunciar } from '../../ui/anunciar';
import { OBJETIVO_TACTIL_MIN } from '../../ui';
import { crearMotorFalso, navegacionFalsa, renderConSesion } from '../principal/__pruebas__/arnes';
import { conEscenario } from '../principal/__pruebas__/base';
import { PantallaAsistente } from './PantallaAsistente';
import { textoAnunciable } from './Conversacion';

jest.mock('../../ui/anunciar', () => ({ anunciar: jest.fn(), useAnunciar: jest.fn() }));

const anunciado = anunciar as jest.Mock;

async function escribir(frase: string) {
  if (!screen.queryByTestId('campo-registrar')) fireEvent.press(screen.getByTestId('boton-escribir'));
  fireEvent.changeText(screen.getByTestId('campo-registrar'), frase);
  await act(async () => {
    fireEvent.press(screen.getByTestId('boton-enviar-registro'));
  });
}

beforeEach(() => anunciado.mockClear());

describe('Asistente · VoiceOver y TalkBack (criterio 9)', () => {
  it('cada turno nuevo del asistente se anuncia (con las cifras en palabras); los que ya estaban, no', async () => {
    const p = conEscenario('e4-01');
    renderConSesion(
      p.ctx,
      <PantallaAsistente navegacion={navegacionFalsa()} motor={crearMotorFalso().motor} />,
    );
    expect(anunciado).not.toHaveBeenCalled();
    await escribir('coca 25 en efectivo');
    const textos = anunciado.mock.calls.map((c) => String(c[0]));
    expect(textos.some((t) => /^Registré Coca veinticinco pesos/.test(t))).toBe(true);
    expect(
      textos.some((t) => /Tu día pasa de doscientos catorce pesos a doscientos siete pesos/.test(t)),
    ).toBe(true);
    // Deshacer cambia el turno: también se anuncia.
    anunciado.mockClear();
    await act(async () => {
      fireEvent.press(within(screen.getByTestId('aviso')).getByText('Deshacer'));
    });
    expect(anunciado).toHaveBeenCalledWith('Deshice el registro.');
    p.cerrar();
  });

  it('la tarjeta «Entendí» se anuncia con su título y sus filas', async () => {
    const p = conEscenario('e4-01');
    renderConSesion(
      p.ctx,
      <PantallaAsistente navegacion={navegacionFalsa()} motor={crearMotorFalso().motor} />,
    );
    await escribir('pagué la luz 6000 con la bbva');
    const texto = anunciado.mock.calls.map((c) => String(c[0])).find((t) => t.startsWith('Entendí'));
    expect(texto).toBe(
      'Entendí · ¿lo registro?. Qué: Luz. Cuenta: BBVA Débito ••5521. Categoría: Servicios. Cuándo: Hoy, dom 11 oct',
    );
    p.cerrar();
  });

  it('el micrófono tiene etiqueta, pista, acción «activar» y estado hablado al escuchar', async () => {
    const p = conEscenario('e4-01');
    renderConSesion(
      p.ctx,
      <PantallaAsistente navegacion={navegacionFalsa()} motor={crearMotorFalso().motor} />,
    );
    const mic = screen.getByTestId('boton-hablar');
    expect(mic.props.accessibilityLabel).toBe('Toca para hablar');
    expect(mic.props.accessibilityHint).toMatch(/Di tu gasto/);
    expect(mic.props.accessibilityActions).toEqual([{ name: 'activate' }]);
    await act(async () => {
      fireEvent(mic, 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
    });
    expect(screen.getByTestId('boton-hablar').props.accessibilityLabel).toBe(
      'Escuchando. Toca para terminar',
    );
    expect(screen.getByTestId('boton-hablar').props.accessibilityState).toEqual({ busy: true });
    expect(screen.getByTestId('hoja-escuchando')).toBeTruthy();
    p.cerrar();
  });

  it('objetivos táctiles ≥ 48: micrófono, teclado y chips de intención', () => {
    const p = conEscenario('e4-01');
    renderConSesion(
      p.ctx,
      <PantallaAsistente navegacion={navegacionFalsa()} motor={crearMotorFalso().motor} />,
    );
    const medida = (id: string) => {
      const nodo = screen.getByTestId(id);
      const estilo = StyleSheet.flatten(
        typeof nodo.props.style === 'function' ? nodo.props.style({ pressed: false }) : nodo.props.style,
      ) as { width?: number; height?: number; minHeight?: number };
      return Math.max(estilo.height ?? 0, estilo.minHeight ?? 0);
    };
    expect(medida('boton-hablar')).toBeGreaterThanOrEqual(OBJETIVO_TACTIL_MIN);
    expect(medida('boton-escribir')).toBeGreaterThanOrEqual(OBJETIVO_TACTIL_MIN);
    for (const chip of screen.getAllByTestId(/^chip-intencion-/))
      expect(medida(chip.props.testID as string)).toBeGreaterThanOrEqual(OBJETIVO_TACTIL_MIN);
    expect(screen.getByTestId('boton-escribir').props.accessibilityLabel).toBe('Escribir');
    p.cerrar();
  });

  it('textoAnunciable: lo que dice el lector de cada clase de turno', () => {
    expect(textoAnunciable({ id: 'p', de: 'persona', texto: 'hola', porVoz: true })).toBeNull();
    expect(
      textoAnunciable({
        id: 'r',
        de: 'asistente',
        clase: 'registro',
        texto: 'Registré Coca $25.',
        cambioDia: 'Tu día…',
      }),
    ).toBe('Registré Coca $25. Tu día…');
    expect(
      textoAnunciable({
        id: 'n',
        de: 'asistente',
        clase: 'no_entendi',
        oido: 'los 300',
        opciones: [],
        elegir: () => {},
        corregir: () => {},
      }),
    ).toBe('Oí «los 300», pero no supe qué pasó.');
  });
});
