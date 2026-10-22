import { act, fireEvent, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Linking, Platform } from 'react-native';
import { listarMovimientos } from '../../servicios';
import { CampoMonto } from '../../ui';
import { MENSAJES_DICTADO, ProveedorDictado, type LectorMonto } from '../../voz';
import { crearMotorFalso, renderConSesion } from './__pruebas__/arnes';
import { conEscenario } from './__pruebas__/base';
import { PanelRegistrar } from './PanelRegistrar';

const leerMonto: LectorMonto = (texto) =>
  texto === 'ocho mil quinientos' ? { centavos: 850_000, aproximado: false } : null;

async function tocar(id: string) {
  await act(async () => {
    fireEvent(screen.getByTestId(id), 'pressIn');
  });
  fireEvent(screen.getByTestId(id), 'pressOut');
}

/** Registro por voz y un campo de dinero en la misma pantalla, con el reconocedor de la app. */
function montar() {
  const p = conEscenario('e4-01');
  const { motor, emitir } = crearMotorFalso();
  const alCambiar = jest.fn();
  renderConSesion(
    p.ctx,
    <ProveedorDictado motor={motor} leerMonto={leerMonto}>
      <PanelRegistrar />
      <CampoMonto etiqueta="Monto" alCambiar={alCambiar} testID="monto" />
    </ProveedorDictado>,
  );
  return { p, motor, emitir, alCambiar };
}

describe('Un micrófono a la vez (ProveedorDictado)', () => {
  it('el registro usa el reconocedor del proveedor y el campo lo calla: la cifra no se registra como gasto', async () => {
    const { p, motor, emitir, alCambiar } = montar();
    const antes = listarMovimientos(p.ctx).length;
    await tocar('boton-hablar');
    expect(motor.iniciar).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('boton-hablar').props.accessibilityLabel).toBe(
      'Escuchando. Toca para terminar',
    );

    await tocar('monto-microfono');
    expect(motor.abortar).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('boton-hablar').props.accessibilityLabel).toBe('Toca para hablar');

    emitir({ tipo: 'inicio' });
    emitir({ tipo: 'resultado', texto: 'ocho mil quinientos', final: true });
    expect(screen.getByTestId('monto').props.value).toBe('8,500');
    expect(alCambiar).toHaveBeenLastCalledWith(850_000);
    expect(listarMovimientos(p.ctx)).toHaveLength(antes);
    expect(screen.queryByTestId('aviso')).toBeNull();
  });

  it('y al revés: "Toca para hablar" calla al campo, que no recibe la frase', async () => {
    const { motor, emitir, alCambiar } = montar();
    await tocar('monto-microfono');
    await tocar('boton-hablar');
    expect(motor.abortar).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('monto-microfono').props.accessibilityLabel).toBe('Dictar en voz: Monto');

    emitir({ tipo: 'inicio' });
    emitir({ tipo: 'resultado', texto: 'coca 25 en efectivo', final: true });
    expect(alCambiar).not.toHaveBeenCalled();
    expect(screen.getByTestId('monto').props.value).toBe('');
    expect(screen.queryByTestId('monto-ayuda')).toBeNull();
  });
});

describe('Registrar con el micrófono negado', () => {
  afterEach(() => jest.restoreAllMocks());

  function montarSinPermiso() {
    const p = conEscenario('e4-01');
    const { motor } = crearMotorFalso({ permiso: false });
    renderConSesion(p.ctx, <PanelRegistrar motor={motor} />);
    return { motor };
  }

  it('dice cómo permitirlo y ofrece "Abrir Ajustes" (iOS no vuelve a preguntar)', async () => {
    const abrir = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    const { motor } = montarSinPermiso();
    expect(screen.queryByTestId('boton-abrir-ajustes-dictado')).toBeNull();
    await tocar('boton-hablar');
    expect(motor.iniciar).not.toHaveBeenCalled();
    expect(screen.getByText(MENSAJES_DICTADO.sin_permiso)).toBeTruthy();
    const ajustes = screen.getByTestId('boton-abrir-ajustes-dictado');
    expect(ajustes.props.accessibilityLabel).toBe('Abrir Ajustes');
    fireEvent.press(ajustes);
    expect(abrir).toHaveBeenCalledTimes(1);
  });

  it('iPhone: nombra micrófono y reconocimiento de voz, y VoiceOver lo oye', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    const anunciar = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    anunciar.mockClear();
    montarSinPermiso();
    await tocar('boton-hablar');
    expect(screen.getByText(MENSAJES_DICTADO.sin_permiso_ios)).toBeTruthy();
    expect(anunciar).toHaveBeenCalledWith(MENSAJES_DICTADO.sin_permiso_ios);
    expect(screen.getByTestId('boton-abrir-ajustes-dictado')).toBeTruthy();
  });
});
