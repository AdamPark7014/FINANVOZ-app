import { describe, expect, it } from '@jest/globals';
import { fireEvent, screen } from '@testing-library/react-native';
import { abrirPruebaPantalla, conEscenario } from '../principal/__pruebas__/base';
import { renderConSesion } from '../principal/__pruebas__/arnes';
import { PantallaArqueo } from './PantallaArqueo';
import {
  ACCESIBILIDAD_CERRAR,
  etiquetaVacioSinEfectivo,
  ETIQUETA_GASTO_SIN_DESCRIPCION,
  ETIQUETA_MONTO_TRAES,
  ETIQUETA_OTRA_CANTIDAD,
  ETIQUETA_QUIEN_TE_PAGO,
  mensajeCuadra,
  mensajeSumaPropuesta,
  OPCIONES_SOBRANTE,
  PASO_MARCAR_TITULO,
  TEXTO_SIN_CUENTA_EFECTIVO,
  TITULO,
  textoDeberiasTraer,
  textoFaltante,
  textoSobrante,
} from './textos';

const textoDe = (testID: string) => {
  const hijos = screen.getByTestId(testID).props.children as unknown;
  return Array.isArray(hijos) ? hijos.join('') : String(hijos);
};

describe('copy del arqueo (es-MX)', () => {
  it('título y preguntas de formulario en tuteo', () => {
    expect(TITULO).toBe('Contar mi efectivo');
    expect(PASO_MARCAR_TITULO).toMatch(/\?$/);
    expect(ETIQUETA_MONTO_TRAES).toBe('¿Cuánto traes?');
    expect(ETIQUETA_QUIEN_TE_PAGO).toBe('¿Quién te pagó?');
    expect(ETIQUETA_OTRA_CANTIDAD).toBe('Otra cantidad');
    expect(ETIQUETA_GASTO_SIN_DESCRIPCION).toBe('Gasto');
    expect(TITULO).not.toMatch(/!/);
  });

  it('estado vacío y opciones de sobrante', () => {
    expect(TEXTO_SIN_CUENTA_EFECTIVO).toContain('Cuentas');
    expect(Object.values(OPCIONES_SOBRANTE)).toEqual([
      'Me dieron dinero',
      'Me pagaron lo que me debían',
      'Anoté algo de más',
      'No sé, solo corrígelo',
    ]);
  });

  it('mensajes dinámicos con montos formateados', () => {
    expect(textoDeberiasTraer(64_000)).toBe('Deberías traer $640 en efectivo. ¿Cuánto traes?');
    expect(textoFaltante(31_500)).toBe('Faltan $315. Lo repartí según tus gastos en efectivo:');
    expect(textoSobrante(6_000)).toBe('Traes $60 más de lo esperado. ¿De dónde salió?');
    expect(mensajeCuadra()).toBe('Listo: tu efectivo cuadra.');
    expect(mensajeSumaPropuesta(31_500, 30_000)).toBe(
      'Los montos deben sumar $315; ahora suman $300.',
    );
  });
});

describe('PantallaArqueo · vacío y errores', () => {
  it('sin cuenta de efectivo muestra el mensaje en arqueo-sin-efectivo', () => {
    const p = abrirPruebaPantalla();
    renderConSesion(p.ctx, <PantallaArqueo alCerrar={jest.fn()} />);
    expect(screen.getByTestId('arqueo-titulo')).toHaveProp('accessibilityRole', 'header');
    expect(textoDe('arqueo-sin-efectivo')).toBe(TEXTO_SIN_CUENTA_EFECTIVO);
    expect(screen.getByTestId('arqueo-sin-efectivo')).toHaveProp('accessibilityLiveRegion', 'polite');
    expect(screen.getByTestId('boton-cerrar-arqueo')).toHaveProp('accessibilityLabel', ACCESIBILIDAD_CERRAR);
    p.cerrar();
  });

  it('cuenta que no es efectivo usa el mismo vacío', () => {
    const p = conEscenario('e4-01');
    const bbva = p.e.cuentas['bbva'] as string;
    renderConSesion(p.ctx, <PantallaArqueo cuentaId={bbva} alCerrar={jest.fn()} />);
    expect(textoDe('arqueo-sin-efectivo')).toBe(TEXTO_SIN_CUENTA_EFECTIVO);
    p.cerrar();
  });

  it('propuesta que no suma el faltante muestra arqueo-error-propuesta', () => {
    const p = conEscenario('e4-01');
    renderConSesion(p.ctx, <PantallaArqueo alCerrar={jest.fn()} />);
    fireEvent.press(screen.getByTestId('arqueo-otra'));
    fireEvent.changeText(screen.getByTestId('arqueo-monto'), '300');
    fireEvent.press(screen.getByTestId('arqueo-calcular'));
    fireEvent.changeText(screen.getByTestId('arqueo-propuesta-varios_efectivo'), '200');
    fireEvent.press(screen.getByTestId('arqueo-confirmar'));
    expect(textoDe('arqueo-error-propuesta')).toMatch(/deben sumar \$340/);
    p.cerrar();
  });
});
