import { screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { enQueSeFue, listarCuentas, registrarMovimiento, totalesDelMes } from '../../servicios';
import { colores, coloresCategoria, coloresCuenta, formatearCentavos } from '../../ui';
import { auditar } from '../__pruebas__/accesibilidad';
import { renderConSesion } from './__pruebas__/arnes';
import { conEscenario } from './__pruebas__/base';
import { PantallaCuentas } from './PantallaCuentas';
import { PantallaMovimientos } from './PantallaMovimientos';

const estilo = (testID: string) =>
  (StyleSheet.flatten(screen.getByTestId(testID).props.style) ?? {}) as Record<string, unknown>;

describe('B+ · Movimientos (D5)', () => {
  it('«En qué se fue» por categoría con su color; suma lo que salió en el mes y lo que entró va en verde', () => {
    const p = conEscenario('e4-01');
    const efectivo = p.e.cuentas['efectivo'] as string;
    const bbva = p.e.cuentas['bbva'] as string;
    registrarMovimiento(p.ctx, {
      tipo: 'gasto',
      categoria: 'antojos',
      origenId: efectivo,
      monto: 2_500,
      fecha: '2026-10-11',
    });
    registrarMovimiento(p.ctx, {
      tipo: 'gasto',
      categoria: 'super',
      origenId: bbva,
      monto: 32_500,
      fecha: '2026-10-10',
    });
    registrarMovimiento(p.ctx, {
      tipo: 'gasto',
      categoria: 'comida_fuera',
      origenId: efectivo,
      monto: 18_000,
      fecha: '2026-10-10',
    });
    registrarMovimiento(p.ctx, {
      tipo: 'ingreso',
      categoria: 'otros_ingresos',
      destinoId: bbva,
      monto: 100_000,
      fecha: '2026-10-09',
    });
    renderConSesion(p.ctx, <PantallaMovimientos alRegistrar={jest.fn()} />);
    const datos = enQueSeFue(p.ctx);
    expect(datos.total).toBe(totalesDelMes(p.ctx).salieron);
    expect(screen.getByTestId('en-que-se-fue-super')).toHaveTextContent('Súper$325');
    expect(screen.getByTestId('en-que-se-fue-super').props.accessibilityLabel).toBe(
      'Súper: trescientos veinticinco pesos',
    );
    expect(estilo('en-que-se-fue-barra-super').backgroundColor).toBe(coloresCategoria.claro.super.barra);
    expect(estilo('en-que-se-fue-barra-comida_fuera').backgroundColor).toBe(
      coloresCategoria.claro.comidaFuera.barra,
    );
    // Lo que entró, en verde (D5).
    const titulo = screen.getByTestId('movimientos-titulo');
    const entraron = within(titulo).getByText(formatearCentavos(totalesDelMes(p.ctx).entraron));
    expect(StyleSheet.flatten(entraron.props.style)).toMatchObject({ color: colores.claro.acentoTexto });
    // Cada fila lleva el mosaico de su categoría.
    const [coca] = listarMovimientosDe(p);
    expect(estilo(`mosaico-${coca}`).backgroundColor).toBe(coloresCategoria.claro.antojos.mosaico);
    expect(auditar(screen.toJSON() as never)).toEqual([]);
    p.cerrar();
  });
});

function listarMovimientosDe(p: ReturnType<typeof conEscenario>): string[] {
  return screen
    .getAllByTestId(/^movimiento-fila-/)
    .map((n) => String(n.props.testID).replace('movimiento-fila-', ''))
    .filter((id) => id !== '' && p !== null);
}

describe('B+ · Cuentas (D6)', () => {
  it('las cuentas como tarjetas de color, el anillo de uso del crédito y «Lo que viene» con el ingreso', () => {
    const p = conEscenario('e4-01');
    const efectivo = p.e.cuentas['efectivo'] as string;
    const bbva = p.e.cuentas['bbva'] as string;
    const nu = p.e.cuentas['nu'] as string;
    renderConSesion(
      p.ctx,
      <PantallaCuentas
        alContarEfectivo={jest.fn()}
        alAbrirCuenta={jest.fn()}
        alAbrirTarjeta={jest.fn()}
        alPagarTarjeta={jest.fn()}
        alAbrirPagoFijo={jest.fn()}
      />,
    );
    const t = coloresCuenta.claro;
    expect(estilo(`cuenta-${efectivo}`).backgroundColor).toBe(t.efectivo.fondo);
    expect(estilo(`cuenta-${bbva}`).backgroundColor).toBe(t.debito.fondo);
    expect(estilo(`carrusel-${nu}`).backgroundColor).toBe(t.credito.fondo);
    expect(screen.getByTestId(`cuenta-${nu}-saldo`)).toHaveTextContent('$2,000');
    expect(screen.getByTestId('carrusel-paginas').props.accessibilityLabel).toBe('Cuenta 1 de 3');
    // El efectivo sin contar todavía lo dice; tocarlo es contarlo.
    expect(screen.getByTestId(`cuenta-${efectivo}`)).toHaveTextContent(/Toca para contarlo/);
    // La Nu con su anillo de uso.
    expect(
      within(screen.getByTestId(`tarjeta-credito-${nu}`)).getByTestId(`cuenta-${nu}-anillo-uso`),
    ).toHaveTextContent(/^\d+ %$/);
    // «Lo que viene»: los pagos con su día en un cuadro y la quincena en verde.
    const quincena = listarCuentas(p.ctx).loQueViene.find((x) => x.tipo === 'ingreso');
    if (!quincena) throw new Error('e4-01 sin quincena en lo que viene');
    const fila = screen.getByTestId(`ingreso-${quincena.programadoId}-${quincena.fecha}`);
    expect(fila).toHaveTextContent('JUE15Tu quincena+$6,500');
    expect(fila.props.accessibilityLabel).toBe('Tu quincena, jue 15: seis mil quinientos pesos');
    expect(auditar(screen.toJSON() as never)).toEqual([]);
    p.cerrar();
  });
});
