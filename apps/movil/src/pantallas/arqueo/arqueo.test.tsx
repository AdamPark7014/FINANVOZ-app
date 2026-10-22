import { fireEvent, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Platform } from 'react-native';
import { CUENTAS_SISTEMA } from '@cartera/datos';
import { registrarMovimiento } from '../../servicios';
import { abrirPruebaPantalla, conEscenario } from '../principal/__pruebas__/base';
import { renderConSesion } from '../principal/__pruebas__/arnes';
import { PantallaArqueo } from './PantallaArqueo';
import {
  ACCESIBILIDAD_ABRIR,
  ACCESIBILIDAD_CERRAR,
  ACCESIBILIDAD_LISTO,
  AHORA_NO,
  AYUDA_POR_ASIGNAR,
  CONFIRMAR,
  CONTINUAR,
  MENSAJE_POSPONER,
  textoResumenMarcados,
  textoResumenTraes,
  etiquetaVacioSinEfectivo,
  ETIQUETA_GASTO_SIN_DESCRIPCION,
  ETIQUETA_MONTO_TRAES,
  ETIQUETA_OTRA_CANTIDAD,
  ETIQUETA_QUIEN_TE_PAGO,
  mensajeCuadra,
  mensajeSumaPropuesta,
  OPCIONES_SOBRANTE,
  PISTA_CALCULAR,
  PISTA_CERRAR,
  PISTA_CASILLA_GASTO,
  PISTA_CONFIRMAR,
  PISTA_CONTINUAR,
  PISTA_LISTO,
  PISTA_MONTO_TRAES,
  PISTA_PASO_MARCAR,
  PISTA_TARJETA_CONTEO_LISTO,
  ETIQUETA_TARJETA_CONTEO_LISTO,
  etiquetaChipExacto,
  PASO_MARCAR_AYUDA,
  PASO_MARCAR_TITULO,
  TEXTO_SIN_CUENTA_EFECTIVO,
  TITULO,
  etiquetaContarEnCuenta,
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
    expect(etiquetaContarEnCuenta('Cartera')).toBe('Contar mi efectivo en Cartera');
    expect(PASO_MARCAR_TITULO).toMatch(/\?$/);
    expect(ETIQUETA_MONTO_TRAES).toBe('¿Cuánto traes?');
    expect(ETIQUETA_QUIEN_TE_PAGO).toBe('¿Quién te pagó?');
    expect(ETIQUETA_OTRA_CANTIDAD).toBe('Otra cantidad');
    expect(ETIQUETA_GASTO_SIN_DESCRIPCION).toBe('Gasto');
    expect(TITULO).not.toMatch(/!/);
  });

  it('tarjeta de Hoy y posponer', () => {
    expect(AHORA_NO).toBe('Ahora no');
    expect(MENSAJE_POSPONER).toBe('Va. Te pregunto mañana.');
    expect(AYUDA_POR_ASIGNAR).toMatch(/gastos/);
    expect(ACCESIBILIDAD_ABRIR).toBe('Abrir conteo de efectivo');
    expect(ACCESIBILIDAD_CERRAR).toBe('Cerrar conteo de efectivo');
    expect(ACCESIBILIDAD_LISTO).toMatch(/cerrar/);
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

  it('chip exacto habla el monto en palabras', () => {
    expect(etiquetaChipExacto(64_000)).toBe('Llevo seiscientos cuarenta pesos');
    expect(PISTA_CONFIRMAR).toBe('Guarda el conteo y los ajustes');
  });

  it('mensajes dinámicos con montos formateados', () => {
    expect(textoDeberiasTraer(64_000)).toBe('Deberías traer $640 en efectivo. ¿Cuánto traes?');
    expect(textoFaltante(31_500)).toBe('Faltan $315. Lo repartí según tus gastos en efectivo:');
    expect(textoSobrante(6_000)).toBe('Traes $60 más de lo esperado. ¿De dónde salió?');
    expect(mensajeCuadra()).toBe('Listo: tu efectivo cuadra.');
    expect(mensajeSumaPropuesta(31_500, 30_000)).toBe('Los montos deben sumar $315; ahora suman $300.');
  });
});

describe('PantallaArqueo · vacío y errores', () => {
  it('sin cuenta de efectivo muestra el mensaje en arqueo-sin-efectivo', () => {
    const p = abrirPruebaPantalla();
    renderConSesion(p.ctx, <PantallaArqueo alCerrar={jest.fn()} />);
    expect(screen.getByTestId('arqueo-titulo')).toHaveProp('accessibilityRole', 'header');
    expect(textoDe('arqueo-sin-efectivo')).toBe(TEXTO_SIN_CUENTA_EFECTIVO);
    expect(screen.getByTestId('arqueo-sin-efectivo')).toHaveProp('accessibilityLiveRegion', 'polite');
    expect(screen.getByTestId('arqueo-sin-efectivo').props.accessibilityLabel).toBe(
      etiquetaVacioSinEfectivo(),
    );
    expect(screen.getByTestId('boton-cerrar-arqueo')).toHaveProp('accessibilityLabel', ACCESIBILIDAD_CERRAR);
    expect(screen.getByTestId('boton-cerrar-arqueo')).toHaveProp('accessibilityHint', PISTA_CERRAR);
    p.cerrar();
  });

  it('cuenta que no es efectivo usa el mismo vacío', () => {
    const p = conEscenario('e4-01');
    const bbva = p.e.cuentas['bbva'] as string;
    renderConSesion(p.ctx, <PantallaArqueo cuentaId={bbva} alCerrar={jest.fn()} />);
    expect(textoDe('arqueo-sin-efectivo')).toBe(TEXTO_SIN_CUENTA_EFECTIVO);
    expect(screen.getByTestId('arqueo-sin-efectivo').props.accessibilityLabel).toBe(
      etiquetaVacioSinEfectivo(),
    );
    p.cerrar();
  });

  it('TalkBack en Listo tras cuadrar el conteo (`02 §15`)', () => {
    const p = conEscenario('e4-01');
    const alCerrar = jest.fn();
    renderConSesion(p.ctx, <PantallaArqueo alCerrar={alCerrar} />);
    const continuar = screen.queryByTestId('arqueo-continuar');
    if (continuar) fireEvent.press(continuar);
    // El chip solo elige; "Confirmar" guarda (nada se guarda hasta Confirmar).
    fireEvent.press(screen.getByTestId('arqueo-exacto'));
    expect(screen.queryByTestId('arqueo-hecho')).toBeNull();
    expect(screen.getByTestId('arqueo-calcular').props.accessibilityLabel).toBe(CONFIRMAR);
    fireEvent.press(screen.getByTestId('arqueo-calcular'));
    expect(screen.getByTestId('arqueo-mensaje-hecho')).toHaveProp('importantForAccessibility', 'yes');
    expect(screen.getByTestId('arqueo-mensaje-hecho')).toHaveProp('accessibilityLiveRegion', 'polite');
    expect(screen.getByTestId('arqueo-mensaje-hecho')).toHaveProp('accessibilityRole', 'alert');
    expect(screen.getByTestId('arqueo-hecho')).toHaveProp(
      'accessibilityLabel',
      ETIQUETA_TARJETA_CONTEO_LISTO,
    );
    expect(screen.getByTestId('arqueo-hecho')).toHaveProp('accessibilityHint', PISTA_TARJETA_CONTEO_LISTO);
    expect(textoDe('arqueo-mensaje-hecho')).toBe(mensajeCuadra());
    expect(screen.getByTestId('arqueo-listo')).toHaveProp('accessibilityLabel', ACCESIBILIDAD_LISTO);
    expect(screen.getByTestId('arqueo-listo')).toHaveProp('accessibilityHint', PISTA_LISTO);
    fireEvent.press(screen.getByTestId('arqueo-listo'));
    expect(alCerrar).toHaveBeenCalled();
    p.cerrar();
  });

  it('propuesta que no suma el faltante muestra arqueo-error-propuesta', () => {
    const p = conEscenario('e4-01');
    renderConSesion(p.ctx, <PantallaArqueo alCerrar={jest.fn()} />);
    fireEvent.press(screen.getByTestId('arqueo-otra'));
    expect(screen.getByTestId('arqueo-monto')).toHaveProp('accessibilityHint', PISTA_MONTO_TRAES);
    expect(screen.getByTestId('arqueo-calcular')).toHaveProp('accessibilityHint', PISTA_CALCULAR);
    fireEvent.changeText(screen.getByTestId('arqueo-monto'), '300');
    fireEvent.press(screen.getByTestId('arqueo-calcular'));
    fireEvent.changeText(screen.getByTestId('arqueo-propuesta-varios_efectivo'), '200');
    expect(screen.getByTestId('arqueo-confirmar')).toHaveProp('accessibilityHint', PISTA_CONFIRMAR);
    fireEvent.press(screen.getByTestId('arqueo-confirmar'));
    expect(textoDe('arqueo-error-propuesta')).toMatch(/deben sumar \$340/);
    expect(screen.getByTestId('arqueo-error-propuesta')).toHaveProp('accessibilityLiveRegion', 'polite');
    expect(screen.getByTestId('arqueo-error-propuesta')).toHaveProp('accessibilityRole', 'alert');
    p.cerrar();
  });

  it('TalkBack pistas en paso marcar y continuar', () => {
    const p = conEscenario('e4-01');
    renderConSesion(p.ctx, <PantallaArqueo alCerrar={jest.fn()} />);
    const continuar = screen.queryByTestId('arqueo-continuar');
    if (continuar) {
      expect(continuar).toHaveProp('accessibilityHint', PISTA_CONTINUAR);
      const casilla = screen.queryAllByRole('checkbox')[0];
      if (casilla) {
        expect(casilla).toHaveProp('accessibilityHint', PISTA_CASILLA_GASTO);
      }
      expect(screen.getByText(PASO_MARCAR_AYUDA)).toHaveProp('accessibilityHint', PISTA_PASO_MARCAR);
    }
    p.cerrar();
  });
});

describe('PantallaArqueo · nada se guarda hasta Confirmar y "Cambiar" entre pasos (auditoría B-3 · 4 y 8)', () => {
  /** e4-01 con una Coca de $25 por asignar de hace 30 h (paso 1 del arqueo). */
  function conPorAsignar() {
    const p = conEscenario('e4-01');
    const INICIO = Date.UTC(2026, 9, 11, 16, 0);
    p.reloj.fijarInstante(INICIO - 30 * 3_600_000);
    const coca = registrarMovimiento(
      p.ctx,
      {
        tipo: 'gasto',
        categoria: 'antojos',
        origenId: CUENTAS_SISTEMA.porAsignar,
        monto: 2_500,
        descripcion: 'Coca',
        fecha: '2026-10-10',
      },
      { origen: 'voz' },
    );
    p.reloj.fijarInstante(INICIO);
    return { ...p, coca: coca.transaccionId };
  }

  it('el sobrante se elige con chips y se guarda con "Confirmar"', () => {
    const p = conEscenario('e4-01');
    renderConSesion(p.ctx, <PantallaArqueo alCerrar={jest.fn()} />);
    fireEvent.press(screen.getByTestId('arqueo-otra'));
    fireEvent.changeText(screen.getByTestId('arqueo-monto'), '700');
    expect(screen.getByTestId('arqueo-calcular').props.accessibilityLabel).toBe(CONTINUAR);
    fireEvent.press(screen.getByTestId('arqueo-calcular'));
    expect(screen.queryByTestId('arqueo-sobrante-confirmar')).toBeNull();
    fireEvent.press(screen.getByTestId('arqueo-sobrante-no_se'));
    expect(screen.queryByTestId('arqueo-hecho')).toBeNull();
    expect(screen.getByTestId('arqueo-sobrante-no_se').props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(screen.getByTestId('arqueo-sobrante-confirmar')).toHaveProp('accessibilityHint', PISTA_CONFIRMAR);
    fireEvent.press(screen.getByTestId('arqueo-sobrante-confirmar'));
    expect(screen.getByTestId('arqueo-hecho')).toBeTruthy();
    p.cerrar();
  });

  it('"Cambiar" en el resultado vuelve a la cantidad con lo que escribiste', () => {
    const p = conEscenario('e4-01');
    renderConSesion(p.ctx, <PantallaArqueo alCerrar={jest.fn()} />);
    fireEvent.press(screen.getByTestId('arqueo-otra'));
    fireEvent.changeText(screen.getByTestId('arqueo-monto'), '300');
    fireEvent.press(screen.getByTestId('arqueo-calcular'));
    expect(screen.getByTestId('arqueo-faltante')).toBeTruthy();
    expect(textoDe('arqueo-cambiar-cantidad-texto')).toBe(textoResumenTraes(30_000));
    fireEvent.press(screen.getByTestId('arqueo-cambiar-cantidad'));
    expect(screen.queryByTestId('arqueo-faltante')).toBeNull();
    expect(screen.getByTestId('arqueo-monto').props.value).toBe('300');
    fireEvent.changeText(screen.getByTestId('arqueo-monto'), '700');
    fireEvent.press(screen.getByTestId('arqueo-calcular'));
    expect(screen.getByTestId('arqueo-sobrante')).toBeTruthy();
    p.cerrar();
  });

  it('"Cambiar" en la cantidad vuelve a los gastos marcados sin perderlos', () => {
    const p = conPorAsignar();
    renderConSesion(p.ctx, <PantallaArqueo alCerrar={jest.fn()} />);
    fireEvent.press(screen.getByTestId(`arqueo-marcar-${p.coca}`));
    fireEvent.press(screen.getByTestId('arqueo-continuar'));
    expect(textoDe('arqueo-cambiar-marcar-texto')).toBe(textoResumenMarcados(1));
    fireEvent.press(screen.getByTestId('arqueo-cambiar-marcar'));
    expect(screen.getByTestId(`arqueo-marcar-${p.coca}`).props.accessibilityState).toMatchObject({
      checked: true,
    });
    fireEvent.press(screen.getByTestId(`arqueo-marcar-${p.coca}`));
    fireEvent.press(screen.getByTestId('arqueo-continuar'));
    expect(textoDe('arqueo-cambiar-marcar-texto')).toBe(textoResumenMarcados(0));
    p.cerrar();
  });

  it('el pie respeta el área segura de abajo (barra de inicio del iPhone)', () => {
    const p = conEscenario('e4-01');
    renderConSesion(p.ctx, <PantallaArqueo alCerrar={jest.fn()} />);
    // SafeAreaView entrega los bordes como `{ top: 'additive', bottom: 'additive', … }`.
    const bordes = screen.getByTestId('pantalla-arqueo').props.edges as Record<string, string> | string[];
    expect(Array.isArray(bordes) ? bordes : Object.keys(bordes)).toEqual(
      expect.arrayContaining(['top', 'bottom']),
    );
    p.cerrar();
  });

  it('iPhone: VoiceOver anuncia el resultado al confirmar', () => {
    const plataforma = jest.replaceProperty(Platform, 'OS', 'ios');
    const anunciar = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    try {
      const p = conEscenario('e4-01');
      renderConSesion(p.ctx, <PantallaArqueo alCerrar={jest.fn()} />);
      const continuar = screen.queryByTestId('arqueo-continuar');
      if (continuar) fireEvent.press(continuar);
      fireEvent.press(screen.getByTestId('arqueo-exacto'));
      fireEvent.press(screen.getByTestId('arqueo-calcular'));
      expect(anunciar).toHaveBeenCalledWith(mensajeCuadra());
      p.cerrar();
    } finally {
      anunciar.mockRestore();
      plataforma.restore();
    }
  });
});
