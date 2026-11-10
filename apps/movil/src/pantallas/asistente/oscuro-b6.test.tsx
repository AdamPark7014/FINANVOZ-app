import { screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { colores, coloresDinero, heroeDia } from '../../ui';
import { crearMotorFalso, navegacionFalsa, renderConSesion } from '../principal/__pruebas__/arnes';
import { conEscenario } from '../principal/__pruebas__/base';
import { PantallaCuentas } from '../principal/PantallaCuentas';
import { PantallaMovimientos } from '../principal/PantallaMovimientos';
import { PantallaAsistente } from './PantallaAsistente';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => 'dark',
}));

const o = colores.oscuro;

/** Estilo plano de un elemento (los `Pressable` ya entregan su estilo resuelto). */
function estilo(elemento: { props: { style?: unknown } }): Record<string, unknown> {
  const s = elemento.props.style;
  return (StyleSheet.flatten(
    typeof s === 'function' ? (s as (e: { pressed: boolean }) => unknown)({ pressed: false }) : s,
  ) ?? {}) as Record<string, unknown>;
}
const estiloDe = (testID: string) => estilo(screen.getByTestId(testID));

/** Todos los colores pintados (fondo, borde y letra). */
function coloresPintados(): string[] {
  const salida: string[] = [];
  const visitar = (n: unknown) => {
    if (!n || typeof n !== 'object') return;
    const nodo = n as { props?: { style?: unknown }; children?: unknown[] };
    if (nodo.props?.style) {
      const plano = estilo(nodo as { props: { style?: unknown } });
      for (const k of ['backgroundColor', 'borderColor', 'color'])
        if (typeof plano[k] === 'string') salida.push(plano[k] as string);
    }
    for (const h of nodo.children ?? []) visitar(h);
  };
  visitar(screen.toJSON());
  return salida;
}
const BLANCOS = /^(#fff|#ffffff|white|rgb\(255, ?255, ?255\))$/i;
/** Los blancos y grises del tema claro no aparecen en oscuro. */
const DEL_CLARO = new Set(
  [
    colores.claro.fondo,
    colores.claro.superficie,
    colores.claro.superficieAlterna,
    colores.claro.segmento,
  ].map((c) => c.toLowerCase()),
);
const ajenos = () => coloresPintados().filter((c) => BLANCOS.test(c) || DEL_CLARO.has(c.toLowerCase()));

describe('Dirección B en oscuro (tablero B6; el claro sigue siendo el de omisión)', () => {
  it('Premium · en reposo: la cifra sobre la placa, «Cómo lo calculé» en menta, «Puedes decirme» en filas y el micrófono menta', () => {
    const p = conEscenario('e4-01');
    renderConSesion(
      p.ctx,
      <PantallaAsistente navegacion={navegacionFalsa()} motor={crearMotorFalso().motor} />,
    );
    expect(estiloDe('pantalla-hoy').backgroundColor).toBe(o.fondo);
    expect(estiloDe('cabecera-dia').backgroundColor).toBe(heroeDia.oscuro.fondo);
    expect(estiloDe('hoy-puedes').color).toBe(heroeDia.oscuro.texto);
    expect(estilo(within(screen.getByTestId('boton-desglose')).getByText('Cómo lo calculé')).color).toBe(
      o.acentoTexto,
    );
    const chips = screen.getAllByTestId(/^chip-intencion-/);
    expect(chips.length).toBeGreaterThan(0);
    for (const chip of chips) {
      expect(estilo(chip).borderBottomColor).toBe(o.borde);
    }
    expect(estiloDe('boton-hablar').backgroundColor).toBe(o.microfono);
    expect(estilo(within(screen.getByTestId('boton-escribir')).getByText('Escribir')).color).toBe(o.texto);
    expect(ajenos()).toEqual([]);
    p.cerrar();
  });

  it('D7 · el inicio en oscuro: la barra de tu dinero y la pista con sus colores, sin blancos del claro', () => {
    const p = conEscenario('e4-01');
    renderConSesion(
      p.ctx,
      <PantallaAsistente navegacion={navegacionFalsa()} motor={crearMotorFalso().motor} />,
    );
    const d = coloresDinero.oscuro;
    expect(estiloDe('barra-dinero-barra-apartado').backgroundColor).toBe(d.apartado);
    expect(estiloDe('barra-dinero-barra-colchon').backgroundColor).toBe(d.colchon);
    expect(estiloDe('barra-dinero-barra-libre').backgroundColor).toBe(d.libre);
    expect(estiloDe('pista-quincena').borderTopColor).toBe(o.borde);
    expect(ajenos()).toEqual([]);
    p.cerrar();
  });

  it('B6/D7 · «Ya la pagué» con filo y letra menta sobre la tarjeta; «Todavía no», en letra menta', () => {
    const p = conEscenario('e5-10');
    p.reloj.fijar('2026-11-28');
    renderConSesion(
      p.ctx,
      <PantallaAsistente navegacion={navegacionFalsa()} motor={crearMotorFalso().motor} />,
    );
    const boton = screen.getByTestId('tarjeta-accion-0-ya-la-pague');
    expect(estilo(boton)).toMatchObject({ backgroundColor: o.superficie, borderColor: o.acento });
    for (const id of ['tarjeta-accion-0-ya-la-pague', 'tarjeta-accion-0-todavia-no']) {
      const [letra] = within(screen.getByTestId(id)).getAllByText(/./);
      expect(letra && estilo(letra).color).toBe(o.acentoTexto);
    }
    expect(ajenos()).toEqual([]);
    p.cerrar();
  });

  it('Movimientos (B4) y Cuentas (B5) en oscuro: la frase en la letra clara y las tarjetas sobre los verdes casi negros', () => {
    const p = conEscenario('e4-01');
    renderConSesion(p.ctx, <PantallaMovimientos alRegistrar={jest.fn()} />);
    expect(estiloDe('movimientos-titulo').color).toBe(o.texto);
    expect(ajenos()).toEqual([]);
    screen.unmount();

    renderConSesion(p.ctx, <PantallaCuentas alAbrirTarjeta={jest.fn()} alPagarTarjeta={jest.fn()} />);
    expect(estiloDe('cuentas-titulo').color).toBe(o.texto);
    expect(coloresPintados()).toContain(o.superficie);
    expect(ajenos()).toEqual([]);
    p.cerrar();
  });
});
