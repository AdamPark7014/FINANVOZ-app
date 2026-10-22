import { fireEvent, screen } from '@testing-library/react-native';
import { aceptarConsentimiento, agregarEfectivo, configurarIngreso } from '../../servicios';
import { obtenerColchon } from '../../servicios/ajustes';
import { ingresoPrincipal } from '../../servicios/programados';
import { abrirPruebaPantalla, conEscenario } from './__pruebas__/base';
import { crearMotorFalso, navegacionFalsa, renderConSesion } from './__pruebas__/arnes';
import { PantallaHoy } from './PantallaHoy';
import { listarMovimientos } from '../../servicios/movimientos';
import {
  BTN_GUARDAR_INGRESO,
  mensajeColchonDicho,
  TEXTO_PRIMER_USO,
  TITULO_CONFIRMAR_INGRESO,
} from './textos';

function escribirEnHoy(frase: string) {
  fireEvent.press(screen.getByTestId('boton-escribir'));
  fireEvent.changeText(screen.getByTestId('campo-registrar'), frase);
  fireEvent.press(screen.getByTestId('boton-enviar-registro'));
}

describe('Hoy · colchón e ingreso dichos', () => {
  it('«quiero tener siempre 500 de colchón» lo aplica y avisa', () => {
    const p = conEscenario('e4-01');
    renderConSesion(p.ctx, <PantallaHoy navegacion={navegacionFalsa()} motor={crearMotorFalso().motor} />);
    escribirEnHoy('quiero tener siempre 500 de colchón');
    expect(obtenerColchon(p.ctx)).toBe(50_000);
    expect(screen.getByText(mensajeColchonDicho(50_000))).toBeTruthy();
    p.cerrar();
  });

  it('«me pagan 8 mil cada mes el 30» pide confirmar y solo cambia al tocar el botón', () => {
    const p = conEscenario('e4-01');
    configurarIngreso(p.ctx, {
      concepto: 'quincena',
      monto: 600_000,
      regla: { tipo: 'quincenal_15_ultimo' },
    });
    renderConSesion(p.ctx, <PantallaHoy navegacion={navegacionFalsa()} motor={crearMotorFalso().motor} />);
    escribirEnHoy('me pagan 8 mil cada mes el 30');
    expect(screen.getByTestId('confirmacion-ingreso')).toHaveTextContent(
      new RegExp(TITULO_CONFIRMAR_INGRESO.replace('?', '\\?')),
    );
    expect(screen.getByTestId('confirmacion-ingreso-antes')).toHaveTextContent(/6,000/);
    expect(screen.getByTestId('confirmacion-ingreso-despues')).toHaveTextContent(/8,000/);
    expect(ingresoPrincipal(p.ctx)?.monto).toBe(600_000);
    expect(screen.getByTestId('boton-guardar-ingreso').props.accessibilityLabel).toBe(BTN_GUARDAR_INGRESO);
    fireEvent.press(screen.getByTestId('boton-guardar-ingreso'));
    expect(ingresoPrincipal(p.ctx)).toMatchObject({ monto: 800_000, regla: { tipo: 'mensual', dia: 30 } });
    expect(screen.queryByTestId('confirmacion-ingreso')).toBeNull();
    p.cerrar();
  });
});

describe('Hoy · primer uso y cifra destacada', () => {
  it('sin movimientos enseña a dictar el primero y desaparece al registrar uno', () => {
    const p = abrirPruebaPantalla();
    aceptarConsentimiento(p.ctx, { datosFinancieros: true });
    agregarEfectivo(p.ctx, 50_000);
    configurarIngreso(p.ctx, {
      concepto: 'quincena',
      monto: 600_000,
      regla: { tipo: 'quincenal_15_ultimo' },
    });
    renderConSesion(p.ctx, <PantallaHoy navegacion={navegacionFalsa()} motor={crearMotorFalso().motor} />);
    expect(screen.getByTestId('hoy-primer-uso-texto')).toHaveTextContent(TEXTO_PRIMER_USO);
    escribirEnHoy('coca 25 en efectivo');
    expect(listarMovimientos(p.ctx)).toHaveLength(1);
    expect(screen.queryByTestId('hoy-primer-uso')).toBeNull();
    p.cerrar();
  });

  it('tocar el bloque de la cifra abre y cierra el desglose', () => {
    const p = conEscenario('e4-01');
    renderConSesion(p.ctx, <PantallaHoy navegacion={navegacionFalsa()} motor={crearMotorFalso().motor} />);
    expect(screen.queryByTestId('desglose')).toBeNull();
    fireEvent.press(screen.getByTestId('hoy-cifra'));
    expect(screen.getByTestId('desglose-libre')).toBeTruthy();
    expect(screen.getByTestId('boton-desglose')).toHaveProp('accessibilityState', { expanded: true });
    fireEvent.press(screen.getByTestId('hoy-cifra'));
    expect(screen.queryByTestId('desglose')).toBeNull();
    p.cerrar();
  });
});
