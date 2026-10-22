import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { textoOidoMonto } from '../ui';
import { crearMotorFalso } from './__pruebas__/motor-falso';
import { BotonDictarCampo } from './BotonDictarCampo';
import { MENSAJES_DICTADO } from './estado';

/**
 * Micrófono de campo del hilo de la nube (PR #24). `CampoMonto` ya no lo monta (usa `BotonMicrofono` sobre
 * `useMicrofono`, probado en `ui/componentes/CampoMonto.test.tsx`); estas pruebas cubren solo la pieza suelta
 * mientras conviven las dos implementaciones (`docs/PLAN-MEJORA-2026-10.md` §5).
 */
describe('BotonDictarCampo', () => {
  it('toca, dicta «mil quinientos» y la transcripción final llega a alOir; el aviso se apaga al terminar', async () => {
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
    expect(screen.getByTestId('monto-dictar')).toHaveProp('accessibilityLabel', 'Dictar Monto');
    fireEvent(screen.getByTestId('monto-dictar'), 'pressIn');
    await act(async () => {});
    fireEvent(screen.getByTestId('monto-dictar'), 'pressOut');
    expect(alAviso).toHaveBeenLastCalledWith({ texto: 'Te escucho…', sinPermiso: false });
    f.emitir({ tipo: 'resultado', texto: 'mil quinientos', final: true });
    expect(alOir).toHaveBeenCalledWith('mil quinientos');
    expect(alAviso).toHaveBeenLastCalledWith(null);
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
    fireEvent(screen.getByTestId('monto-dictar'), 'pressIn');
    await act(async () => {});
    expect(alAviso).toHaveBeenLastCalledWith({ texto: MENSAJES_DICTADO.sin_permiso, sinPermiso: true });
  });

  it('sin reconocimiento en el teléfono no se muestra', () => {
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
  });

  it('textoOidoMonto dice qué oyó, qué puso y si fue aproximado', () => {
    expect(textoOidoMonto('mil quinientos', 150_000, false)).toBe('Oí «mil quinientos»: $1,500.');
    expect(textoOidoMonto('como 500', 50_000, true)).toMatch(/aproximado/);
    expect(textoOidoMonto('dos cincuenta', null, false)).toMatch(/No entendí el monto/);
  });
});
