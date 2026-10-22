import { fireEvent, screen } from '@testing-library/react-native';
import type { PlainDate } from '@cartera/core';
import {
  cargarEscenario,
  confirmarIngresoRecibido,
  materializarOcurrencias,
  obtenerObservaciones,
  registrarMovimiento,
  type Observacion,
} from '../../servicios';
import { cifraEnPalabras, formatearCentavos } from '../../ui/formato';
import { auditar } from '../__pruebas__/accesibilidad';
import { abrirPruebaPantalla, conEscenario } from './__pruebas__/base';
import { crearMotorFalso, navegacionFalsa, renderConSesion } from './__pruebas__/arnes';
import {
  BTN_YA_LO_VI,
  contextoCifraObservacion,
  etiquetaObservacion,
  PISTA_VER_MOVIMIENTOS_OBSERVACION,
  PISTA_YA_LO_VI,
  textoObservacion,
  TITULO_OBSERVACIONES,
} from './observaciones-textos';
import { PantallaHoy } from './PantallaHoy';
import { BTN_VER_MOVIMIENTOS } from './textos';

const textoDe = (testID: string) => {
  const hijos = screen.getByTestId(testID).props.children as unknown;
  return Array.isArray(hijos) ? hijos.join('') : String(hijos);
};

/**
 * Libro con una quincena recibida (31 ago, 15 sep y 30 sep), hoy 11 oct, y gastos que producen tres
 * observaciones: dos cargos de Netflix hoy, ropa fuera de lo normal ayer y comida fuera arriba de la quincena
 * anterior (más el ritmo del periodo, con tan poco gastado de lo libre).
 */
function conObservaciones() {
  const p = abrirPruebaPantalla('2026-09-01');
  const e = cargarEscenario(p.ctx, {
    id: 'observaciones-pantalla',
    hoy: '2026-09-01',
    colchon: 20_000,
    ingreso: {
      concepto: 'quincena',
      monto: 650_000,
      regla: { tipo: 'quincenal_15_ultimo', ajuste: 'anterior' },
      cuenta: 'bbva',
      ultimo_recibido: '2026-08-31',
    },
    cuentas: [
      { clave: 'efectivo', subtipo: 'efectivo', nombre: 'Cartera', saldo: 500_000, alias: ['efectivo'] },
      { clave: 'bbva', subtipo: 'debito', nombre: 'BBVA', saldo: 2_000_000, alias: ['bbva'] },
    ],
  });
  p.reloj.fijar('2026-10-11');
  const efectivo = e.cuentas['efectivo'] as string;
  const bbva = e.cuentas['bbva'] as string;
  materializarOcurrencias(p.ctx);
  for (const fecha of ['2026-09-15', '2026-09-30'] as const) {
    confirmarIngresoRecibido(p.ctx, {
      programadoId: e.ingresoId as string,
      fecha,
      destinoId: bbva,
      fechaPago: fecha,
    });
  }
  const gasto = (fecha: PlainDate, monto: number, categoria: string, comercio?: string) =>
    registrarMovimiento(p.ctx, {
      tipo: 'gasto',
      fecha,
      monto,
      categoria,
      origenId: efectivo,
      ...(comercio ? { comercio } : {}),
    });
  gasto('2026-10-02', 40_000, 'comida_fuera');
  gasto('2026-10-05', 44_000, 'comida_fuera');
  gasto('2026-10-08', 40_000, 'comida_fuera');
  gasto('2026-09-16', 50_000, 'comida_fuera');
  gasto('2026-09-20', 48_000, 'comida_fuera');
  for (const [f, m] of [
    ['2026-09-02', 50_000],
    ['2026-09-05', 60_000],
    ['2026-09-08', 40_000],
    ['2026-09-12', 55_000],
    ['2026-09-20', 50_000],
    ['2026-09-25', 45_000],
  ] as const) {
    gasto(f, m, 'ropa');
  }
  gasto('2026-10-10', 185_000, 'ropa');
  gasto('2026-10-11', 24_900, 'suscripciones', 'Netflix');
  gasto('2026-10-11', 24_900, 'suscripciones', 'Netflix');
  return p;
}

describe('Hoy · Lo que veo (`02 §4.3`)', () => {
  it('con la semilla e4-01 (sin gastos) la sección no aparece', () => {
    const p = conEscenario('e4-01');
    renderConSesion(p.ctx, <PantallaHoy navegacion={navegacionFalsa()} motor={crearMotorFalso().motor} />);
    expect(screen.queryByTestId('observaciones')).toBeNull();
    expect(screen.queryByText(TITULO_OBSERVACIONES)).toBeNull();
    p.cerrar();
  });

  it('muestra a lo más dos observaciones con su cifra, su frase y TalkBack completo, después de las tarjetas de acción', () => {
    const p = conObservaciones();
    const esperadas = obtenerObservaciones(p.ctx);
    expect(esperadas.map((o) => o.tipo)).toEqual(['doble', 'inusual']);
    renderConSesion(p.ctx, <PantallaHoy navegacion={navegacionFalsa()} motor={crearMotorFalso().motor} />);

    expect(screen.getByTestId('observaciones-titulo')).toHaveTextContent(TITULO_OBSERVACIONES);
    expect(screen.getByTestId('observaciones-titulo')).toHaveProp('accessibilityRole', 'header');
    expect(screen.queryByTestId('observacion-2')).toBeNull();
    esperadas.forEach((o, i) => {
      expect(textoDe(`observacion-${i}-cifra`)).toBe(formatearCentavos(o.cifra));
      expect(screen.getByTestId(`observacion-${i}-cifra`)).toHaveProp(
        'accessibilityLabel',
        `${contextoCifraObservacion(o)} ${cifraEnPalabras(o.cifra)}`,
      );
      expect(textoDe(`observacion-${i}-texto`)).toBe(textoObservacion(o));
      expect(screen.getByTestId(`observacion-${i}-cuerpo`)).toHaveProp('accessible', true);
      expect(screen.getByTestId(`observacion-${i}-cuerpo`)).toHaveProp(
        'accessibilityLabel',
        etiquetaObservacion(o),
      );
      expect(screen.getByTestId(`observacion-${i}-ya-lo-vi`)).toHaveProp('accessibilityLabel', BTN_YA_LO_VI);
      expect(screen.getByTestId(`observacion-${i}-ya-lo-vi`)).toHaveProp('accessibilityHint', PISTA_YA_LO_VI);
      expect(screen.getByTestId(`observacion-${i}-ver-movimientos`)).toHaveProp(
        'accessibilityHint',
        PISTA_VER_MOVIMIENTOS_OBSERVACION,
      );
    });
    expect(textoDe('observacion-0-cifra')).toBe('$249');
    expect(textoDe('observacion-0-texto')).toBe('Hay dos cargos iguales de $249 en Netflix hoy.');
    expect(textoDe('observacion-1-texto')).toBe(
      'Los $1,850 en ropa de ayer fueron más de lo normal en esa categoría.',
    );
    // Sin hallazgos de accesibilidad (cifras en palabras, tocables con rol y nombre, nada truncado).
    expect(auditar(screen.toJSON())).toEqual([]);
    p.cerrar();
  });

  it('"Ver movimientos" abre Movimientos con el filtro de la observación', () => {
    const p = conObservaciones();
    const nav = navegacionFalsa();
    renderConSesion(p.ctx, <PantallaHoy navegacion={nav} motor={crearMotorFalso().motor} />);
    const [doble] = obtenerObservaciones(p.ctx) as [Observacion];
    fireEvent.press(screen.getByTestId('observacion-0-ver-movimientos'));
    expect(nav.alVerMovimientos).toHaveBeenCalledWith(doble.filtro);
    expect(doble.filtro).toEqual({ desde: '2026-10-11', hasta: '2026-10-11', soloGastos: true });
    expect(screen.getAllByText(BTN_VER_MOVIMIENTOS).length).toBeGreaterThanOrEqual(2);
    p.cerrar();
  });

  it('"Ya lo vi" oculta la observación en su periodo y deja pasar la siguiente', () => {
    const p = conObservaciones();
    renderConSesion(p.ctx, <PantallaHoy navegacion={navegacionFalsa()} motor={crearMotorFalso().motor} />);
    const antes = obtenerObservaciones(p.ctx);
    const segunda = antes[1] as Observacion;
    expect(textoDe('observacion-0-texto')).toBe('Hay dos cargos iguales de $249 en Netflix hoy.');

    fireEvent.press(screen.getByTestId('observacion-0-ya-lo-vi'));
    const despues = obtenerObservaciones(p.ctx);
    expect(despues.map((o) => o.tipo)).toEqual(['inusual', 'ritmo']);
    expect(despues[0]).toEqual(segunda);
    expect(screen.queryByText('Hay dos cargos iguales de $249 en Netflix hoy.')).toBeNull();
    expect(textoDe('observacion-0-texto')).toBe(textoObservacion(segunda));
    expect(textoDe('observacion-1-texto')).toBe(textoObservacion(despues[1] as Observacion));
    expect(screen.queryByTestId('observacion-2')).toBeNull();

    // Al volver a abrir Hoy sigue oculta.
    screen.unmount();
    renderConSesion(p.ctx, <PantallaHoy navegacion={navegacionFalsa()} motor={crearMotorFalso().motor} />);
    expect(screen.queryByText('Hay dos cargos iguales de $249 en Netflix hoy.')).toBeNull();
    expect(textoDe('observacion-0-texto')).toBe(textoObservacion(segunda));
    p.cerrar();
  });
});
