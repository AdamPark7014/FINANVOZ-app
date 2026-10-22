import { fireEvent, screen } from '@testing-library/react-native';
import { aceptarConsentimiento } from '../../servicios';
import { listarCuentas } from '../../servicios/cuentas';
import { abrirPruebaPantalla } from '../principal/__pruebas__/base';
import { renderConSesion } from '../principal/__pruebas__/arnes';
import { PantallaCuentas } from '../principal';
import { FormularioPagoFijo } from '../pagos-fijos/FormularioPagoFijo';
import { FormularioCuenta } from './FormularioCuenta';
import { BTN_AGREGAR_CUENTA, BTN_AGREGAR_PAGO_FIJO } from './textos';

describe('Cuentas › Agregar (después del onboarding)', () => {
  it('«Agregar cuenta» y «Agregar pago fijo» solo aparecen con su destino y lo abren', () => {
    const p = abrirPruebaPantalla();
    aceptarConsentimiento(p.ctx, { datosFinancieros: true });
    const alAgregarCuenta = jest.fn();
    const alAgregarPagoFijo = jest.fn();
    renderConSesion(
      p.ctx,
      <PantallaCuentas
        alAbrirAjustes={jest.fn()}
        alAgregarCuenta={alAgregarCuenta}
        alAgregarPagoFijo={alAgregarPagoFijo}
      />,
    );
    expect(screen.getByTestId('boton-agregar-cuenta').props.accessibilityLabel).toBe(BTN_AGREGAR_CUENTA);
    expect(screen.getByTestId('boton-agregar-pago-fijo').props.accessibilityLabel).toBe(
      BTN_AGREGAR_PAGO_FIJO,
    );
    fireEvent.press(screen.getByTestId('boton-agregar-cuenta'));
    fireEvent.press(screen.getByTestId('boton-agregar-pago-fijo'));
    expect(alAgregarCuenta).toHaveBeenCalled();
    expect(alAgregarPagoFijo).toHaveBeenCalled();
    screen.unmount();
    renderConSesion(p.ctx, <PantallaCuentas alAbrirAjustes={jest.fn()} />);
    expect(screen.queryByTestId('boton-agregar-cuenta')).toBeNull();
    expect(screen.queryByTestId('boton-agregar-pago-fijo')).toBeNull();
    p.cerrar();
  });

  it('la cuenta nueva queda en Tienes con su saldo', () => {
    const p = abrirPruebaPantalla();
    aceptarConsentimiento(p.ctx, { datosFinancieros: true });
    const alGuardar = jest.fn();
    renderConSesion(
      p.ctx,
      <FormularioCuenta testID="cuenta-nueva" alGuardar={alGuardar} alCancelar={jest.fn()} />,
    );
    fireEvent.press(screen.getByTestId('cuenta-nueva-agregar'));
    expect(screen.getByTestId('error-formulario')).toBeTruthy();
    expect(alGuardar).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('cuenta-nueva-tipo-ahorro'));
    fireEvent.changeText(screen.getByTestId('cuenta-nueva-nombre'), 'Nu');
    fireEvent.changeText(screen.getByTestId('cuenta-nueva-saldo'), '2,500');
    fireEvent.press(screen.getByTestId('cuenta-nueva-agregar'));
    expect(alGuardar).toHaveBeenCalledTimes(1);
    const nu = listarCuentas(p.ctx).tienes.find((c) => c.nombre === 'Nu');
    expect(nu).toMatchObject({ subtipo: 'ahorro', saldo: 250_000 });
    p.cerrar();
  });

  it('el pago fijo nuevo aparece en Compromisos de Cuentas', () => {
    const p = abrirPruebaPantalla();
    aceptarConsentimiento(p.ctx, { datosFinancieros: true });
    const alAgregado = jest.fn();
    renderConSesion(p.ctx, <FormularioPagoFijo testID="pago-nuevo" alAgregado={alAgregado} />);
    fireEvent.press(screen.getByTestId('pago-nuevo-renta'));
    fireEvent.changeText(screen.getByTestId('pago-nuevo-dia'), '5');
    fireEvent.changeText(screen.getByTestId('pago-nuevo-monto'), '4,500');
    fireEvent.press(screen.getByTestId('pago-nuevo-agregar'));
    expect(alAgregado).toHaveBeenCalledWith(expect.objectContaining({ concepto: 'Renta', monto: 450_000 }));
    screen.unmount();
    renderConSesion(p.ctx, <PantallaCuentas alAbrirAjustes={jest.fn()} />);
    expect(screen.getByTestId('seccion-compromisos-lista')).toHaveTextContent(/renta/i);
    p.cerrar();
  });
});
