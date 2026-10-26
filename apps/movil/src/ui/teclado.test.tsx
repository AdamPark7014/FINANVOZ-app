import { fireEvent, render, screen } from '@testing-library/react-native';
import {
  InputAccessoryView,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
} from 'react-native';
import { Boton, CampoMonto, CampoTexto, Pantalla, Texto } from './index';

afterEach(() => jest.restoreAllMocks());

const enIphone = () => jest.replaceProperty(Platform, 'OS', 'ios');

function conPie() {
  return render(
    <Pantalla pie={<Boton etiqueta="Continuar" alPresionar={() => {}} testID="continuar" />}>
      <CampoMonto etiqueta="Monto" alCambiar={() => {}} testID="monto" />
    </Pantalla>,
  );
}

describe('Pantalla y el teclado', () => {
  it('Android (de borde a borde, sin adjustResize): el pie sube con el teclado; arrastrar lo cierra y los toques no se pierden', () => {
    conPie();
    const evitar = screen.UNSAFE_getByType(KeyboardAvoidingView);
    expect(evitar.props.behavior).toBe('padding');
    expect(evitar.findByType(ScrollView)).toBeTruthy();
    expect(evitar.findByProps({ testID: 'continuar' })).toBeTruthy();
    const scroll = screen.UNSAFE_getByType(ScrollView);
    expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
    expect(scroll.props.keyboardDismissMode).toBe('on-drag');
    expect(scroll.props.automaticallyAdjustKeyboardInsets).toBe(false);
  });

  it('iPhone con pie fijo: el pie sube con el teclado (KeyboardAvoidingView con padding)', () => {
    enIphone();
    conPie();
    const evitar = screen.UNSAFE_getByType(KeyboardAvoidingView);
    expect(evitar.props.behavior).toBe('padding');
    // El área desplazable y el botón del pie quedan dentro: los dos suben.
    expect(evitar.findByType(ScrollView)).toBeTruthy();
    expect(evitar.findByProps({ testID: 'continuar' })).toBeTruthy();
    const scroll = screen.UNSAFE_getByType(ScrollView);
    expect(scroll.props.keyboardDismissMode).toBe('interactive');
    expect(scroll.props.keyboardShouldPersistTaps).toBe('handled');
    // No se suman dos ajustes al teclado.
    expect(scroll.props.automaticallyAdjustKeyboardInsets).toBe(false);
  });

  it('Android sin pie: también se encoge con el teclado (no hay ajuste automático del desplazamiento)', () => {
    render(
      <Pantalla>
        <Texto>Ajustes</Texto>
      </Pantalla>,
    );
    expect(screen.UNSAFE_getByType(KeyboardAvoidingView).props.behavior).toBe('padding');
    expect(screen.UNSAFE_getByType(ScrollView).props.automaticallyAdjustKeyboardInsets).toBe(false);
  });

  it('iPhone sin pie: el desplazamiento se ajusta al teclado y lleva el campo a la vista', () => {
    enIphone();
    render(
      <Pantalla>
        <Texto>Ajustes</Texto>
      </Pantalla>,
    );
    expect(screen.UNSAFE_queryByType(KeyboardAvoidingView)).toBeNull();
    expect(screen.UNSAFE_getByType(ScrollView).props.automaticallyAdjustKeyboardInsets).toBe(true);
  });
});

describe('Barra "Listo" del teclado numérico', () => {
  it('iPhone: cada campo numérico trae su barra con id estable, y "Listo" cierra el teclado', () => {
    enIphone();
    const cerrar = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
    cerrar.mockClear();
    const { rerender } = render(
      <>
        <CampoMonto etiqueta="Monto" alCambiar={() => {}} testID="monto" />
        <CampoTexto etiqueta="Días" valor="" alCambiar={() => {}} teclado="number-pad" testID="dias" />
      </>,
    );
    const barras = screen.UNSAFE_getAllByType(InputAccessoryView);
    expect(barras).toHaveLength(2);
    const idMonto = screen.getByTestId('monto').props.inputAccessoryViewID as string;
    const idDias = screen.getByTestId('dias').props.inputAccessoryViewID as string;
    expect(idMonto).toEqual(expect.any(String));
    expect(idMonto).not.toBe(idDias);
    expect(barras.map((b) => b.props.nativeID)).toEqual([idMonto, idDias]);

    rerender(
      <>
        <CampoMonto etiqueta="Monto" alCambiar={() => {}} testID="monto" />
        <CampoTexto etiqueta="Días" valor="3" alCambiar={() => {}} teclado="number-pad" testID="dias" />
      </>,
    );
    expect(screen.getByTestId('monto').props.inputAccessoryViewID).toBe(idMonto);

    const listo = screen.getByTestId('monto-listo');
    expect(listo.props.accessibilityRole).toBe('button');
    expect(listo.props.accessibilityLabel).toBe('Listo');
    expect(listo.props.accessibilityHint).toBe('Cierra el teclado.');
    fireEvent.press(listo);
    expect(cerrar).toHaveBeenCalledTimes(1);
  });

  it('iPhone: el teclado normal ya trae su tecla de retorno, sin barra', () => {
    enIphone();
    render(<CampoTexto etiqueta="Notas" valor="" alCambiar={() => {}} testID="notas" />);
    expect(screen.UNSAFE_queryAllByType(InputAccessoryView)).toHaveLength(0);
    expect(screen.getByTestId('notas').props.inputAccessoryViewID).toBeUndefined();
  });

  it('Android: sin barra (el teclado trae su botón para cerrarlo)', () => {
    render(<CampoMonto etiqueta="Monto" alCambiar={() => {}} testID="monto" />);
    expect(screen.queryByTestId('monto-listo')).toBeNull();
    expect(screen.UNSAFE_getByType(TextInput).props.inputAccessoryViewID).toBeUndefined();
  });
});
