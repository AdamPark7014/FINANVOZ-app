import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { auditar } from '../../pantallas/__pruebas__/accesibilidad';
import type { PropuestaEntendi } from '../entendi';
import { TarjetaEntendi } from './TarjetaEntendi';

/** R1 «Entendí» (Ola 7 §3): filas tocables, «Sí» con carga y error, y «Sí» inactivo mientras falta algo. */
function propuesta(cambios: Partial<PropuestaEntendi> = {}): PropuestaEntendi {
  return {
    titulo: 'Entendí',
    monto: 45_000,
    filas: [
      { clave: 'que', etiqueta: 'Qué', valor: 'Luz' },
      {
        clave: 'cuenta',
        etiqueta: 'Cuenta',
        valor: 'Elige una',
        opciones: [
          { valor: 'bbva', etiqueta: 'BBVA débito' },
          { valor: 'efectivo', etiqueta: 'Efectivo' },
        ],
        alCambiar: jest.fn(),
      },
    ],
    confirmar: { etiqueta: 'Sí, regístralo', accion: jest.fn() },
    cambiar: { etiqueta: 'Cambiar', accion: jest.fn() },
    ...cambios,
  };
}

describe('TarjetaEntendi', () => {
  it('«Sí» llama la acción una vez; las filas con opciones abren chips y avisan el cambio', async () => {
    const p = propuesta();
    render(<TarjetaEntendi propuesta={p} />);
    expect(screen.getByTestId('entendi-monto')).toHaveTextContent('$450');
    fireEvent.press(screen.getByLabelText('Cuenta: Elige una'));
    fireEvent.press(screen.getByTestId('entendi-opcion-cuenta-bbva'));
    expect(p.filas[1]?.alCambiar).toHaveBeenCalledWith('bbva');
    await act(async () => {
      fireEvent.press(screen.getByTestId('entendi-confirmar'));
    });
    expect(p.confirmar.accion).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('entendi-motivo')).toBeNull();
    expect(auditar(screen.toJSON() as never)).toEqual([]);
  });

  it('con `confirmar.deshabilitado` el botón se ve y se anuncia inactivo, dice por qué y no guarda', async () => {
    const accion = jest.fn();
    render(
      <TarjetaEntendi
        propuesta={propuesta({
          confirmar: {
            etiqueta: 'Sí, regístralo',
            accion,
            deshabilitado: true,
            motivoDeshabilitado: 'Elige la cuenta para poder registrarlo.',
          },
        })}
      />,
    );
    const si = screen.getByTestId('entendi-confirmar');
    expect(si).toHaveProp('accessibilityState', expect.objectContaining({ disabled: true }));
    expect(si).toHaveProp('accessibilityHint', 'Elige la cuenta para poder registrarlo.');
    expect(screen.getByTestId('entendi-motivo')).toHaveTextContent('Elige la cuenta para poder registrarlo.');
    await act(async () => {
      fireEvent.press(si);
    });
    expect(accion).not.toHaveBeenCalled();
    // «Cambiar» sigue disponible para llenar lo que falta en el formulario.
    expect(screen.getByTestId('entendi-cambiar')).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ disabled: false }),
    );
  });

  it('si guardar falla, el error se queda en la tarjeta y se puede reintentar', async () => {
    const accion = jest.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(undefined);
    render(<TarjetaEntendi propuesta={propuesta({ confirmar: { etiqueta: 'Sí', accion } })} />);
    await act(async () => {
      fireEvent.press(screen.getByTestId('entendi-confirmar'));
    });
    expect(screen.getByTestId('entendi-error')).toHaveTextContent('No pude guardarlo. Intenta otra vez.');
    await act(async () => {
      fireEvent.press(screen.getByTestId('entendi-confirmar'));
    });
    expect(accion).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('entendi-error')).toBeNull();
  });
});
