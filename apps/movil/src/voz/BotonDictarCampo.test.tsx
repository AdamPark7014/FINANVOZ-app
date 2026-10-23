import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { crearMotorFalso } from './__pruebas__/motor-falso';
import { BotonDictarCampo } from './BotonDictarCampo';
import { ProveedorDictado } from './ProveedorDictado';
import {
  ETIQUETA_ESCUCHANDO,
  MENSAJES_DICTADO_CAMPO,
  MENSAJES_DICTADO_FRASE,
  PISTA_MICROFONO_CAMPO,
  PISTA_MICROFONO_FRASE,
} from './textos';

afterEach(() => jest.restoreAllMocks());

async function tocar(id = 'monto-dictar') {
  await act(async () => {
    fireEvent(screen.getByTestId(id), 'pressIn');
  });
  fireEvent(screen.getByTestId(id), 'pressOut');
}

/**
 * El micrófono que `ProveedorDictado` inyecta en los campos de `ui/` (`CampoMonto`, «O dímelo»): `BotonMicrofono`
 * sobre `useMicrofono`. Lo que el campo hace con lo oído se prueba en `ui/componentes/CampoMonto.test.tsx`.
 */
describe('BotonDictarCampo', () => {
  it('toca, dicta «mil quinientos»: avisa lo que va oyendo, entrega la transcripción y apaga el aviso', async () => {
    const f = crearMotorFalso();
    const alOir = jest.fn();
    const alAviso = jest.fn();
    render(
      <BotonDictarCampo
        etiquetaCampo="Monto"
        alOir={alOir}
        alAviso={alAviso}
        motor={f.motor}
        testID="monto-dictar"
      />,
    );
    const mic = () => screen.getByTestId('monto-dictar');
    expect(mic()).toHaveProp('accessibilityLabel', 'Dictar en voz: Monto');
    expect(mic()).toHaveProp('accessibilityHint', PISTA_MICROFONO_CAMPO);
    await tocar();
    expect(mic()).toHaveProp('accessibilityLabel', ETIQUETA_ESCUCHANDO);
    expect(alAviso).toHaveBeenLastCalledWith({ texto: 'Te escucho…', escuchando: true, sinPermiso: false });
    f.emitir({ tipo: 'resultado', texto: 'mil', final: false });
    expect(alAviso).toHaveBeenLastCalledWith({ texto: '«mil»', escuchando: true, sinPermiso: false });
    f.emitir({ tipo: 'resultado', texto: 'mil quinientos', final: true });
    expect(alOir).toHaveBeenCalledTimes(1);
    expect(alOir).toHaveBeenCalledWith('mil quinientos');
    expect(alAviso).toHaveBeenLastCalledWith(null);
    expect(mic()).toHaveProp('accessibilityLabel', 'Dictar en voz: Monto');
  });

  it('sin permiso avisa con sinPermiso para que el campo ofrezca «Abrir Ajustes»', async () => {
    const f = crearMotorFalso({ permiso: false });
    const alAviso = jest.fn();
    render(
      <BotonDictarCampo
        etiquetaCampo="Monto"
        alOir={jest.fn()}
        alAviso={alAviso}
        motor={f.motor}
        testID="monto-dictar"
      />,
    );
    await tocar();
    expect(f.motor.iniciar).not.toHaveBeenCalled();
    expect(alAviso).toHaveBeenLastCalledWith({
      texto: MENSAJES_DICTADO_CAMPO.sin_permiso,
      escuchando: false,
      sinPermiso: true,
    });
  });

  it('en iPhone el aviso sin permiso nombra el micrófono y el reconocimiento de voz', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    const f = crearMotorFalso({ permiso: false });
    const alAviso = jest.fn();
    render(
      <BotonDictarCampo
        etiquetaCampo="Monto"
        alOir={jest.fn()}
        alAviso={alAviso}
        motor={f.motor}
        testID="monto-dictar"
      />,
    );
    await tocar();
    expect(alAviso).toHaveBeenLastCalledWith(
      expect.objectContaining({ texto: MENSAJES_DICTADO_CAMPO.sin_permiso_ios, sinPermiso: true }),
    );
  });

  it('«O dímelo» (dicta="frase"): pista y errores de un paso completo, no de una cifra', async () => {
    const f = crearMotorFalso();
    const alAviso = jest.fn();
    render(
      <BotonDictarCampo
        etiquetaCampo="este paso"
        dicta="frase"
        alOir={jest.fn()}
        alAviso={alAviso}
        motor={f.motor}
        testID="paso-dictar"
      />,
    );
    expect(screen.getByTestId('paso-dictar')).toHaveProp('accessibilityHint', PISTA_MICROFONO_FRASE);
    await tocar('paso-dictar');
    f.emitir({ tipo: 'error', codigo: 'no-speech' });
    expect(alAviso).toHaveBeenLastCalledWith({
      texto: MENSAJES_DICTADO_FRASE.sin_voz,
      escuchando: false,
      sinPermiso: false,
    });
    expect(MENSAJES_DICTADO_FRASE.sin_voz).not.toMatch(/cifra|gasto/);
  });

  it('sin reconocimiento en el teléfono no se muestra ni se suscribe al reconocedor', () => {
    const f = crearMotorFalso({ disponible: false });
    render(
      <BotonDictarCampo
        etiquetaCampo="Monto"
        alOir={jest.fn()}
        alAviso={jest.fn()}
        motor={f.motor}
        testID="monto-dictar"
      />,
    );
    expect(screen.queryByTestId('monto-dictar')).toBeNull();
    expect(f.motor.suscribir).not.toHaveBeenCalled();
  });

  it('con ProveedorDictado usa el reconocedor de la app: el segundo micrófono calla al primero', async () => {
    const f = crearMotorFalso();
    const oirA = jest.fn();
    const oirB = jest.fn();
    render(
      <ProveedorDictado motor={f.motor} leerMonto={() => null}>
        <BotonDictarCampo etiquetaCampo="A" alOir={oirA} alAviso={jest.fn()} testID="a" />
        <BotonDictarCampo etiquetaCampo="B" alOir={oirB} alAviso={jest.fn()} testID="b" />
      </ProveedorDictado>,
    );
    await tocar('a');
    await tocar('b');
    expect(f.motor.abortar).toHaveBeenCalledTimes(1);
    // Los restos del dictado abortado no le llegan al nuevo.
    f.emitir({ tipo: 'error', codigo: 'aborted' });
    f.emitir({ tipo: 'fin' });
    f.emitir({ tipo: 'inicio' });
    f.emitir({ tipo: 'resultado', texto: 'dos mil', final: true });
    expect(oirB).toHaveBeenCalledWith('dos mil');
    expect(oirA).not.toHaveBeenCalled();
  });
});
