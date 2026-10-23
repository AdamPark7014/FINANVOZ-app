import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { configurarIngreso } from '../../servicios';
import { obtenerColchon } from '../../servicios/ajustes';
import { ingresoPrincipal } from '../../servicios/programados';
import { conEscenario } from './__pruebas__/base';
import { crearMotorFalso, navegacionFalsa, renderConSesion } from './__pruebas__/arnes';
import { PantallaHoy } from './PantallaHoy';
import { AYUDA_SALDO_DICHO, BTN_GUARDAR_INGRESO, BTN_GUARDAR_SALDO, mensajeColchonDicho } from './textos';

async function escribirEnHoy(frase: string) {
  if (!screen.queryByTestId('campo-registrar')) fireEvent.press(screen.getByTestId('boton-escribir'));
  fireEvent.changeText(screen.getByTestId('campo-registrar'), frase);
  await act(async () => {
    fireEvent.press(screen.getByTestId('boton-enviar-registro'));
  });
}

// Ola 7: ingreso y saldo dichos se confirman en la tarjeta «Entendí» del asistente (con los textos de antes).
describe('Asistente · colchón e ingreso dichos', () => {
  it('«quiero tener siempre 500 de colchón» lo aplica y lo dice con Deshacer', async () => {
    const p = conEscenario('e4-01');
    renderConSesion(p.ctx, <PantallaHoy navegacion={navegacionFalsa()} motor={crearMotorFalso().motor} />);
    await escribirEnHoy('quiero tener siempre 500 de colchón');
    expect(obtenerColchon(p.ctx)).toBe(50_000);
    expect(screen.getByTestId('aviso-texto')).toHaveTextContent(mensajeColchonDicho(50_000));
    expect(within(screen.getByTestId('aviso')).getByText('Deshacer')).toBeTruthy();
    p.cerrar();
  });

  it('«me pagan 8 mil cada mes el 30»: «Entendí · ¿cambio tu ingreso?» y solo cambia al tocar el botón', async () => {
    const p = conEscenario('e4-01');
    configurarIngreso(p.ctx, {
      concepto: 'quincena',
      monto: 600_000,
      regla: { tipo: 'quincenal_15_ultimo' },
    });
    renderConSesion(p.ctx, <PantallaHoy navegacion={navegacionFalsa()} motor={crearMotorFalso().motor} />);
    await escribirEnHoy('me pagan 8 mil cada mes el 30');
    const entendi = screen.getByTestId('entendi');
    expect(entendi).toHaveTextContent(/Entendí · ¿cambio tu ingreso\?/);
    expect(within(entendi).getByTestId('entendi-fila-antes')).toHaveTextContent(/6,000/);
    expect(within(entendi).getByTestId('entendi-monto')).toHaveTextContent('$8,000');
    expect(ingresoPrincipal(p.ctx)?.monto).toBe(600_000);
    expect(within(entendi).getByTestId('entendi-confirmar').props.accessibilityLabel).toBe(
      BTN_GUARDAR_INGRESO,
    );
    await act(async () => {
      fireEvent.press(screen.getByTestId('entendi-confirmar'));
    });
    expect(ingresoPrincipal(p.ctx)).toMatchObject({ monto: 800_000, regla: { tipo: 'mensual', dia: 30 } });
    expect(screen.queryByTestId('entendi')).toBeNull();
    expect(screen.getByTestId('aviso-texto')).toHaveTextContent(/^Listo: tu ingreso es \$8,000/);
    p.cerrar();
  });

  it('K04 «tengo 4,200 en BBVA»: lo que llevo contra lo que dices y ajusta solo al confirmar', async () => {
    const p = conEscenario('e4-01');
    renderConSesion(p.ctx, <PantallaHoy navegacion={navegacionFalsa()} motor={crearMotorFalso().motor} />);
    await escribirEnHoy('tengo 4,200 en BBVA');
    const entendi = screen.getByTestId('entendi');
    expect(within(entendi).getByTestId('entendi-fila-app')).toHaveTextContent(/3,590/);
    expect(within(entendi).getByTestId('entendi-monto')).toHaveTextContent('$4,200');
    expect(within(entendi).getByTestId('entendi-efecto')).toHaveTextContent(AYUDA_SALDO_DICHO);
    expect(within(entendi).getByTestId('entendi-confirmar').props.accessibilityLabel).toBe(BTN_GUARDAR_SALDO);
    await act(async () => {
      fireEvent.press(screen.getByTestId('entendi-confirmar'));
    });
    expect(screen.queryByTestId('entendi')).toBeNull();
    expect(screen.getByTestId('aviso-texto')).toHaveTextContent(/Registré la diferencia como un ajuste/);
    p.cerrar();
  });
});
