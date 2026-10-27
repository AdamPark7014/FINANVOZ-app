import { fireEvent, screen } from '@testing-library/react-native';
import {
  aceptarConsentimiento,
  crearPersona,
  listarCuentas,
  registrarPrestamo,
  totalesCuentas,
} from '../../servicios';
import { cifraEnPalabras } from '../../ui';
import { auditar } from '../__pruebas__/accesibilidad';
import {
  BTN_AGREGAR_CUENTA,
  BTN_AGREGAR_PAGO_FIJO,
  BTN_VER_PAGOS_FIJOS,
  BTN_VER_PERSONAS,
  PISTA_ABRIR_COMPROMISO,
  PISTA_ABRIR_CUENTA,
  PISTA_ABRIR_EFECTIVO,
  PISTA_AGREGAR_CUENTA,
  PISTA_CTA_AGREGAR_CUENTA,
} from '../cuentas/textos';
import { abrirPruebaPantalla, conEscenario } from './__pruebas__/base';
import { renderConSesion } from './__pruebas__/arnes';
import { MenuAgregar } from '../cuentas/MenuAgregar';
import { PantallaCuentas } from './PantallaCuentas';
import { partesTotalesCuentas, PISTA_CONTAR_EFECTIVO } from './textos';

/** Todas las salidas de Cuentas conectadas, como en la pestaña real (`app/(tabs)/cuentas.tsx`). */
function navegacion() {
  return {
    alContarEfectivo: jest.fn(),
    alAgregarTarjeta: jest.fn(),
    alAbrirPersona: jest.fn(),
    alAgregarCuenta: jest.fn(),
    alAbrirCuenta: jest.fn(),
    alAgregarPagoFijo: jest.fn(),
    alAbrirPagoFijo: jest.fn(),
    alVerPagosFijos: jest.fn(),
    alVerPersonas: jest.fn(),
  };
}

describe('Cuentas después del onboarding (auditoría de botones)', () => {
  // Dirección B: «Agregar» vive en el dock de Cuentas (`MenuAgregar`); el vacío dice dónde está.
  it('Tienes: el vacío dice dónde está «Agregar» y el menú abre «Agregar cuenta»', () => {
    const p = abrirPruebaPantalla();
    aceptarConsentimiento(p.ctx, { datosFinancieros: true });
    const nav = navegacion();
    renderConSesion(p.ctx, <PantallaCuentas {...nav} />);
    expect(screen.getByTestId('cuentas-tienes-vacio')).toHaveProp(
      'accessibilityHint',
      PISTA_CTA_AGREGAR_CUENTA,
    );
    expect(screen.queryByTestId('boton-agregar-cuenta')).toBeNull();
    screen.unmount();
    renderConSesion(
      p.ctx,
      <MenuAgregar abajo={0} alCerrar={jest.fn()} alAgregarCuenta={nav.alAgregarCuenta} />,
    );
    const agregar = screen.getByTestId('boton-agregar-cuenta');
    expect(agregar.props.accessibilityLabel).toBe(BTN_AGREGAR_CUENTA);
    expect(agregar).toHaveProp('accessibilityHint', PISTA_AGREGAR_CUENTA);
    fireEvent.press(agregar);
    expect(nav.alAgregarCuenta).toHaveBeenCalledTimes(1);
    // Sin personas no hay lista que ver.
    expect(screen.queryByTestId('boton-ver-personas')).toBeNull();
    p.cerrar();
  });

  it('cada cuenta de débito se toca completa y abre su detalle; el lector oye nombre, tipo y saldo', () => {
    const p = conEscenario('e4-01');
    const bbva = p.e.cuentas.bbva as string;
    const nav = navegacion();
    renderConSesion(p.ctx, <PantallaCuentas {...nav} />);
    const fila = screen.getByTestId(`cuenta-${bbva}-abrir`);
    expect(fila).toHaveProp('accessibilityRole', 'button');
    expect(fila).toHaveProp('accessibilityHint', PISTA_ABRIR_CUENTA);
    const saldo = listarCuentas(p.ctx).tienes.find((c) => c.id === bbva)?.saldo ?? 0;
    expect(fila.props.accessibilityLabel).toBe(
      `BBVA Débito ••5521, Débito. En BBVA Débito ••5521 tienes ${cifraEnPalabras(saldo)}`,
    );
    fireEvent.press(fila);
    expect(nav.alAbrirCuenta).toHaveBeenCalledWith(bbva);
    p.cerrar();
  });

  it('el efectivo conserva «Contar mi efectivo» y suma «Ver» para llegar al detalle con el lector', () => {
    const p = conEscenario('e4-01');
    const efectivo = p.e.cuentas.efectivo as string;
    const nav = navegacion();
    renderConSesion(p.ctx, <PantallaCuentas {...nav} />);
    expect(screen.getByTestId(`cuenta-${efectivo}-accion`)).toHaveProp(
      'accessibilityHint',
      PISTA_CONTAR_EFECTIVO,
    );
    fireEvent.press(screen.getByTestId(`cuenta-${efectivo}-accion`));
    expect(nav.alContarEfectivo).toHaveBeenCalledWith(efectivo);
    const ver = screen.getByTestId(`cuenta-${efectivo}-ver`);
    expect(ver.props.accessibilityLabel).toBe('Ver Cartera');
    expect(ver).toHaveProp('accessibilityHint', PISTA_ABRIR_EFECTIVO);
    fireEvent.press(ver);
    expect(nav.alAbrirCuenta).toHaveBeenCalledWith(efectivo);
    p.cerrar();
  });

  it('Compromisos: cada pago abre su detalle y «Ver todos tus pagos fijos»; «Agregar pago fijo» va en el menú', () => {
    const p = conEscenario('e4-01');
    const nav = navegacion();
    renderConSesion(p.ctx, <PantallaCuentas {...nav} />);
    const internet = listarCuentas(p.ctx).compromisos.find((c) => c.concepto === 'internet');
    if (!internet) throw new Error('e4-01 sin compromiso internet');
    const fila = screen.getByTestId(`compromiso-${internet.programadoId}-abrir`);
    expect(fila).toHaveProp('accessibilityHint', PISTA_ABRIR_COMPROMISO);
    expect(fila.props.accessibilityLabel).toMatch(/^internet, mié 14\. Pago de internet el mié 14 /);
    fireEvent.press(fila);
    expect(nav.alAbrirPagoFijo).toHaveBeenCalledWith(internet.programadoId);
    expect(screen.getByTestId('boton-ver-pagos-fijos').props.accessibilityLabel).toBe(BTN_VER_PAGOS_FIJOS);
    fireEvent.press(screen.getByTestId('boton-ver-pagos-fijos'));
    expect(nav.alVerPagosFijos).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('boton-agregar-pago-fijo')).toBeNull();
    screen.unmount();
    renderConSesion(
      p.ctx,
      <MenuAgregar abajo={0} alCerrar={jest.fn()} alAgregarPagoFijo={nav.alAgregarPagoFijo} />,
    );
    expect(screen.getByTestId('boton-agregar-pago-fijo').props.accessibilityLabel).toBe(
      BTN_AGREGAR_PAGO_FIJO,
    );
    fireEvent.press(screen.getByTestId('boton-agregar-pago-fijo'));
    expect(nav.alAgregarPagoFijo).toHaveBeenCalledTimes(1);
    p.cerrar();
  });

  it('con personas aparece «Ver a todas las personas»', () => {
    const p = conEscenario('e4-01');
    const caro = crearPersona(p.ctx, { nombre: 'Caro' });
    registrarPrestamo(p.ctx, {
      tipo: 'prestamo_otorgado',
      personaId: caro,
      cuentaId: p.e.cuentas.bbva as string,
      monto: 40_000,
    });
    const nav = navegacion();
    renderConSesion(p.ctx, <PantallaCuentas {...nav} />);
    expect(screen.getByTestId('boton-ver-personas').props.accessibilityLabel).toBe(BTN_VER_PERSONAS);
    fireEvent.press(screen.getByTestId('boton-ver-personas'));
    expect(nav.alVerPersonas).toHaveBeenCalledTimes(1);
    p.cerrar();
  });

  it('B5 · arriba, una frase con lo que tienes y lo que debes (de los servicios) que el lector oye en pesos', () => {
    const p = conEscenario('e4-01');
    renderConSesion(p.ctx, <PantallaCuentas {...navegacion()} />);
    const t = totalesCuentas(listarCuentas(p.ctx));
    const titulo = screen.getByTestId('cuentas-titulo');
    expect(titulo).toHaveProp('accessibilityRole', 'header');
    expect(titulo).toHaveTextContent(partesTotalesCuentas(t).join(''));
    expect(titulo.props.accessibilityLabel).toContain(cifraEnPalabras(t.tienes));
    p.cerrar();
  });

  it('la frase de Cuentas: con deuda dice cuánto; sin deuda, «no debes nada»', () => {
    expect(partesTotalesCuentas({ tienes: 522_400, debes: 185_000 })).toEqual([
      'Tienes ',
      '$5,224',
      ' y debes ',
      '$1,850',
      '.',
    ]);
    expect(partesTotalesCuentas({ tienes: 522_400, debes: 0 }).join('')).toBe(
      'Tienes $5,224 y no debes nada.',
    );
  });

  it('con todo conectado pasa la auditoría de accesibilidad', () => {
    const p = conEscenario('e4-01');
    renderConSesion(p.ctx, <PantallaCuentas {...navegacion()} />);
    expect(auditar(screen.toJSON() as never)).toEqual([]);
    p.cerrar();
  });

  it('sin los callbacks nuevos se ve como antes (sin botones que no lleven a ningún lado)', () => {
    const p = conEscenario('e4-01');
    renderConSesion(p.ctx, <PantallaCuentas />);
    expect(screen.queryByTestId('boton-agregar-cuenta')).toBeNull();
    expect(screen.queryByTestId('boton-agregar-pago-fijo')).toBeNull();
    expect(screen.queryByTestId(`cuenta-${p.e.cuentas.bbva}-abrir`)).toBeNull();
    p.cerrar();
  });
});
