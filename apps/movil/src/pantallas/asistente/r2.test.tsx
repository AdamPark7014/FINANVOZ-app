import { act, fireEvent, screen } from '@testing-library/react-native';
import { listarCuentas, listarMovimientos } from '../../servicios';
import { renderConSesion } from '../principal/__pruebas__/arnes';
import { conEscenario } from '../principal/__pruebas__/base';
import { PantallaR2 } from './PantallaR2';
import { abrirR2, pedirAlAsistente, reiniciarR2, tomarPedidoAsistente, tomarPrellenadoR2 } from './r2';

beforeEach(() => reiniciarR2());

describe('R2 · formulario corto con lo dicho (criterio 2)', () => {
  it('abre con «Esto oí», el tipo, el monto, la cuenta y la categoría puestos; guardar avisa al asistente y cierra', async () => {
    const p = conEscenario('e4-01');
    const bbva = listarCuentas(p.ctx).tienes.find((c) => c.subtipo === 'debito')?.id ?? '';
    const alGuardado = jest.fn();
    const alCerrar = jest.fn();
    renderConSesion(
      p.ctx,
      <PantallaR2
        prellenado={{
          tipo: 'gasto',
          monto: 45_000,
          descripcion: 'luz',
          cuentaId: bbva,
          categoria: 'servicios',
          oido: 'pagué la luz 450 con la BBVA',
        }}
        alCerrar={alCerrar}
        alGuardado={alGuardado}
      />,
    );
    expect(screen.getByTestId('pantalla-registrar')).toBeTruthy();
    expect(screen.getByTestId('r2-esto-oi')).toHaveProp(
      'accessibilityLabel',
      'Esto oí: «pagué la luz 450 con la BBVA». Revisa y registra.',
    );
    expect(screen.getByTestId('r2-esto-oi')).toHaveTextContent(/Esto oí/);
    expect(screen.getByTestId('r2-esto-oi')).toHaveTextContent(/pagué la luz 450 con la BBVA/);
    expect(screen.getByTestId('r2-esto-oi')).toHaveTextContent(/Revisa y registra/);
    expect(screen.getByTestId('campo-descripcion').props.value).toBe('luz');
    expect(screen.getByTestId(`origen-${bbva}`).props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('categoria-servicios').props.accessibilityState).toMatchObject({
      selected: true,
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('boton-guardar-movimiento'));
    });
    const [m] = listarMovimientos(p.ctx).flatMap((d) => d.movimientos);
    expect(m).toMatchObject({ monto: 45_000, descripcion: 'luz' });
    expect(alGuardado).toHaveBeenCalledWith(
      expect.objectContaining({ transaccionId: m?.id, deshacer: expect.any(String) }),
    );
    expect(alCerrar).toHaveBeenCalledTimes(1);
    p.cerrar();
  });

  it('«Cerrar» no guarda nada', () => {
    const p = conEscenario('e4-01');
    const alCerrar = jest.fn();
    renderConSesion(p.ctx, <PantallaR2 prellenado={null} alCerrar={alCerrar} alGuardado={jest.fn()} />);
    expect(screen.queryByTestId('r2-esto-oi')).toBeNull();
    fireEvent.press(screen.getByTestId('boton-cerrar-registrar'));
    expect(alCerrar).toHaveBeenCalled();
    expect(listarMovimientos(p.ctx)).toEqual([]);
    p.cerrar();
  });

  it('lo dicho viaja en memoria (nunca en la ruta, regla 9) y se toma una sola vez', () => {
    const push = jest.fn();
    abrirR2({ push }, { tipo: 'gasto', monto: 8_000, oido: 'tacos 80' });
    expect(push).toHaveBeenCalledWith('/registrar');
    expect(tomarPrellenadoR2()).toEqual({ tipo: 'gasto', monto: 8_000, oido: 'tacos 80' });
    expect(tomarPrellenadoR2()).toBeNull();
    pedirAlAsistente({ tipo: 'revisar', frase: 'f1' });
    expect(tomarPedidoAsistente()).toEqual({ tipo: 'revisar', frase: 'f1' });
    expect(tomarPedidoAsistente()).toBeNull();
  });
});
