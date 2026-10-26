import { act, fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { colores } from '../../ui';
import { crearMotorFalso, navegacionFalsa, renderConSesion } from '../principal/__pruebas__/arnes';
import { conEscenario } from '../principal/__pruebas__/base';
import { PantallaAsistente } from './PantallaAsistente';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => 'dark',
}));

/** Todos los colores de fondo y de borde pintados en la pantalla. */
function coloresPintados(): string[] {
  const salida: string[] = [];
  const visitar = (n: unknown) => {
    if (!n || typeof n !== 'object') return;
    const nodo = n as { props?: { style?: unknown }; children?: unknown[] };
    const estilo = nodo.props?.style;
    if (estilo) {
      const plano = StyleSheet.flatten(
        typeof estilo === 'function'
          ? (estilo as (e: { pressed: boolean }) => unknown)({ pressed: false })
          : estilo,
      ) as Record<string, unknown> | undefined;
      for (const k of ['backgroundColor', 'borderColor', 'color'])
        if (typeof plano?.[k] === 'string') salida.push(plano[k] as string);
    }
    for (const h of nodo.children ?? []) visitar(h);
  };
  visitar(screen.toJSON());
  return salida;
}

const BLANCOS = /^(#fff|#ffffff|white|rgb\(255, ?255, ?255\))$/i;

describe('Asistente en modo oscuro (criterio 11)', () => {
  it('fondo raíz y superficies con los tokens oscuros; nada de blanco puro, tampoco con turnos y desglose', async () => {
    const p = conEscenario('e4-01');
    renderConSesion(
      p.ctx,
      <PantallaAsistente navegacion={navegacionFalsa()} motor={crearMotorFalso().motor} />,
    );
    const raiz = StyleSheet.flatten(screen.getByTestId('pantalla-hoy').props.style) as {
      backgroundColor?: string;
    };
    expect(raiz.backgroundColor).toBe(colores.oscuro.fondo);
    expect(coloresPintados().filter((c) => BLANCOS.test(c))).toEqual([]);

    fireEvent.press(screen.getByTestId('boton-escribir'));
    fireEvent.changeText(screen.getByTestId('campo-registrar'), 'coca 25 en efectivo');
    await act(async () => {
      fireEvent.press(screen.getByTestId('boton-enviar-registro'));
    });
    // Al mandar, el campo se cierra para que se vea la respuesta: se vuelve a abrir para la segunda frase.
    fireEvent.press(screen.getByTestId('boton-escribir'));
    fireEvent.changeText(screen.getByTestId('campo-registrar'), 'pagué la luz 6000 con la bbva');
    await act(async () => {
      fireEvent.press(screen.getByTestId('boton-enviar-registro'));
    });
    fireEvent.press(screen.getByTestId('boton-desglose'));
    const pintados = coloresPintados();
    expect(pintados).toContain(colores.oscuro.superficie);
    expect(pintados.filter((c) => BLANCOS.test(c))).toEqual([]);
    p.cerrar();
  });
});
