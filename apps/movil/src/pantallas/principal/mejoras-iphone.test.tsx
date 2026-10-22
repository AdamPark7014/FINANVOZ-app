import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { AccessibilityInfo, Platform, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import {
  aceptarConsentimiento,
  historialMovimiento,
  listarMovimientos,
  listarPorInterpretar,
  registrarMovimiento,
  registrarTexto,
} from '../../servicios';
import { ProveedorPlan } from '../../suscripciones/ProveedorPlan';
import { etiquetaHablada } from '../../ui';
import { abrirPruebaPantalla, conEscenario } from './__pruebas__/base';
import { crearMotorFalso, navegacionFalsa, renderConSesion } from './__pruebas__/arnes';
import { FormularioMovimiento } from './FormularioMovimiento';
import {
  BTN_GUARDAR_CAMBIOS,
  ERROR_FECHA_FUTURA,
  errorFechaFormato,
  MENSAJE_SIN_CAMBIOS,
} from './formularioMovimiento-textos';
import { PantallaHoy } from './PantallaHoy';
import { PantallaMovimientos } from './PantallaMovimientos';
import { ProveedorAvisos, useInformarAltoPestanas } from './ProveedorAvisos';
import {
  BTN_AJUSTES,
  BTN_AJUSTES_CUENTAS,
  BTN_CONFIGURAR_INGRESO_HOY,
  BTN_REGISTRAR_PRIMER_MOVIMIENTO,
  MENSAJE_ANULADO_MOVIMIENTO,
  MENSAJE_ERROR_GENERAL,
  RESPUESTAS_OCURRENCIA,
  TEXTO_MOVIMIENTOS_FILTRO_VACIO,
  TEXTO_MOVIMIENTOS_VACIO,
  TEXTO_POR_REVISAR,
} from './textos';

// Servicios reales, salvo los que una prueba hace fallar (p. ej. base de solo lectura): la pantalla no debe caerse.
const mockFallar = { todaviaNo: false, descartar: false };
jest.mock('../../servicios', () => {
  const real = jest.requireActual('../../servicios');
  return {
    ...real,
    todaviaNo: (...a: unknown[]) => {
      if (mockFallar.todaviaNo) throw new Error('base de solo lectura');
      return real.todaviaNo(...a);
    },
    descartarPorInterpretar: (...a: unknown[]) => {
      if (mockFallar.descartar) throw new Error('base de solo lectura');
      return real.descartarPorInterpretar(...a);
    },
  };
});

afterEach(() => {
  mockFallar.todaviaNo = false;
  mockFallar.descartar = false;
  jest.restoreAllMocks();
});

const AREA_IPHONE = { top: 47, left: 0, right: 0, bottom: 34 };

function Informa({ alto }: { alto: number | undefined }) {
  useInformarAltoPestanas(alto);
  return null;
}

describe('Aviso con Deshacer en iPhone (ProveedorAvisos)', () => {
  it('sin pestañas queda arriba del indicador de inicio (área segura)', () => {
    render(
      <SafeAreaInsetsContext.Provider value={AREA_IPHONE}>
        <ProveedorAvisos>
          <View />
        </ProveedorAvisos>
      </SafeAreaInsetsContext.Provider>,
    );
    expect(screen.getByTestId('avisos-contenedor')).toHaveStyle({ bottom: 34 });
  });

  it('sobre las pestañas usa el alto real de la barra (~83 en iPhone), no los 64 del token', () => {
    const { rerender } = render(
      <SafeAreaInsetsContext.Provider value={AREA_IPHONE}>
        <ProveedorAvisos sobrePestanas>
          <Informa alto={undefined} />
        </ProveedorAvisos>
      </SafeAreaInsetsContext.Provider>,
    );
    // Estimado como React Navigation: 49 + 34.
    expect(screen.getByTestId('avisos-contenedor')).toHaveStyle({ bottom: 83 });
    rerender(
      <SafeAreaInsetsContext.Provider value={AREA_IPHONE}>
        <ProveedorAvisos sobrePestanas>
          <Informa alto={90} />
        </ProveedorAvisos>
      </SafeAreaInsetsContext.Provider>,
    );
    expect(screen.getByTestId('avisos-contenedor')).toHaveStyle({ bottom: 90 });
  });
});

describe('VoiceOver (iOS): lo que TalkBack lee por la región viva también se anuncia', () => {
  it('el aviso "Registré…" del formulario se anuncia en iOS', () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    const anunciar = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    const p = conEscenario('e4-01');
    const efectivo = p.e.cuentas.efectivo as string;
    renderConSesion(p.ctx, <FormularioMovimiento />);
    fireEvent.changeText(screen.getByTestId('campo-monto'), '25');
    fireEvent.changeText(screen.getByTestId('campo-descripcion'), 'coca');
    fireEvent.press(screen.getByTestId('categoria-antojos'));
    fireEvent.press(screen.getByTestId(`origen-${efectivo}`));
    fireEvent.press(screen.getByTestId('boton-guardar-movimiento'));
    expect(anunciar).toHaveBeenCalledWith(etiquetaHablada('Registré: coca $25'));
    p.cerrar();
  });

  it('el error de una tarjeta de Hoy se anuncia en iOS; en Android no se repite', () => {
    const anunciar = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    const p = conEscenario('e4-01');
    p.reloj.fijar('2026-10-15');
    mockFallar.todaviaNo = true;
    const { unmount } = renderConSesion(
      p.ctx,
      <PantallaHoy navegacion={navegacionFalsa()} motor={crearMotorFalso().motor} />,
    );
    fireEvent.press(screen.getByTestId('tarjeta-accion-0-todavia-no'));
    expect(screen.getByText(MENSAJE_ERROR_GENERAL)).toBeTruthy();
    expect(anunciar).not.toHaveBeenCalledWith(MENSAJE_ERROR_GENERAL);
    unmount();

    jest.replaceProperty(Platform, 'OS', 'ios');
    renderConSesion(p.ctx, <PantallaHoy navegacion={navegacionFalsa()} motor={crearMotorFalso().motor} />);
    fireEvent.press(screen.getByTestId('tarjeta-accion-0-todavia-no'));
    expect(anunciar).toHaveBeenCalledWith(MENSAJE_ERROR_GENERAL);
    p.cerrar();
  });
});

describe('Botones que no deben tumbar la app', () => {
  it('"Todavía no" con el servicio fallando muestra el error y la tarjeta sigue ahí', () => {
    const p = conEscenario('e4-01');
    p.reloj.fijar('2026-10-15');
    mockFallar.todaviaNo = true;
    renderConSesion(p.ctx, <PantallaHoy navegacion={navegacionFalsa()} motor={crearMotorFalso().motor} />);
    const tarjeta = screen.getByTestId('tarjeta-accion-0');
    fireEvent.press(within(tarjeta).getByTestId('tarjeta-accion-0-todavia-no'));
    expect(within(tarjeta).getByText(MENSAJE_ERROR_GENERAL)).toBeTruthy();
    expect(within(tarjeta).getByText('¿Ya pagaste la tanda?')).toBeTruthy();
  });

  it('"Descartar" con el servicio fallando lo dice en el aviso y la frase sigue por revisar', async () => {
    const p = conEscenario('e4-01');
    await registrarTexto(p.ctx, 'ayer le pasé 200 a mi jefa', 'voz');
    const [frase] = listarPorInterpretar(p.ctx);
    renderConSesion(p.ctx, <PantallaMovimientos alRegistrar={jest.fn()} />);
    expect(screen.getByTestId('movimientos-por-revisar-intro')).toHaveTextContent(TEXTO_POR_REVISAR);
    mockFallar.descartar = true;
    fireEvent.press(screen.getByTestId(`descartar-${frase?.id}`));
    expect(within(screen.getByTestId('aviso')).getByText(MENSAJE_ERROR_GENERAL)).toBeTruthy();
    expect(screen.getByTestId(`por-revisar-${frase?.id}`)).toBeTruthy();
    p.cerrar();
  });
});

describe('Hoy más claro', () => {
  it('las respuestas de "¿Ya pagaste…?" son chips en fila con pista', () => {
    const p = conEscenario('e4-01');
    p.reloj.fijar('2026-10-15');
    renderConSesion(p.ctx, <PantallaHoy navegacion={navegacionFalsa()} motor={crearMotorFalso().motor} />);
    const r = RESPUESTAS_OCURRENCIA.compromiso;
    expect(screen.getByTestId('tarjeta-accion-0-ya-la-pague')).toHaveProp('accessibilityHint', r.si.pista);
    expect(screen.getByTestId('tarjeta-accion-0-todavia-no')).toHaveProp(
      'accessibilityHint',
      r.todaviaNo.pista,
    );
    expect(screen.getByTestId('tarjeta-accion-0-ya-no-aplica')).toHaveProp(
      'accessibilityHint',
      r.omitir.pista,
    );
    expect(screen.getByTestId('tarjeta-accion-0-respuestas')).toHaveStyle({
      flexDirection: 'row',
      flexWrap: 'wrap',
    });
  });

  it('Ajustes en la cabecera de Hoy, sin emoji; sin ingreso dice "Configurar mi ingreso"', () => {
    const p = conEscenario('e4-01');
    const alAbrirAjustes = jest.fn();
    renderConSesion(
      p.ctx,
      <PantallaHoy navegacion={{ ...navegacionFalsa(), alAbrirAjustes }} motor={crearMotorFalso().motor} />,
    );
    expect(BTN_AJUSTES_CUENTAS).toBe(BTN_AJUSTES);
    expect(BTN_AJUSTES).not.toMatch(/⚙/);
    fireEvent.press(screen.getByTestId('boton-ajustes-hoy'));
    expect(alAbrirAjustes).toHaveBeenCalled();
    p.cerrar();
  });

  it('sin ingreso, el botón dice "Configurar mi ingreso"; sin navegación a Ajustes no hay botón', () => {
    const p = abrirPruebaPantalla();
    aceptarConsentimiento(p.ctx, { datosFinancieros: true });
    renderConSesion(p.ctx, <PantallaHoy navegacion={navegacionFalsa()} motor={crearMotorFalso().motor} />);
    expect(screen.getByTestId('boton-configurar-ingreso')).toHaveTextContent(BTN_CONFIGURAR_INGRESO_HOY);
    expect(screen.queryByTestId('boton-ajustes-hoy')).toBeNull();
    p.cerrar();
  });

  it('en Gratis sin pantalla del plan (abrirPlan null) no hay candado ni "¿Me alcanza?"; con ella, sí', () => {
    const p = conEscenario('e4-01');
    const nav = { ...navegacionFalsa(), alAbrirMeAlcanza: jest.fn() };
    const { unmount } = renderConSesion(
      p.ctx,
      <PantallaHoy navegacion={nav} motor={crearMotorFalso().motor} />,
    );
    expect(screen.queryByTestId('candado-probabilidad')).toBeNull();
    expect(screen.queryByTestId('boton-me-alcanza')).toBeNull();
    unmount();

    renderConSesion(
      p.ctx,
      <ProveedorPlan compras={null} abrirPlan={jest.fn()}>
        <PantallaHoy navegacion={nav} motor={crearMotorFalso().motor} />
      </ProveedorPlan>,
    );
    expect(screen.getByTestId('candado-probabilidad')).toBeTruthy();
    expect(screen.getByTestId('boton-me-alcanza')).toBeTruthy();
    p.cerrar();
  });

  it('si la cifra de Hoy no cambia, el aviso no trae la segunda línea', () => {
    const p = conEscenario('e4-01');
    p.reloj.fijar('2026-10-15');
    renderConSesion(p.ctx, <PantallaHoy navegacion={navegacionFalsa()} motor={crearMotorFalso().motor} />);
    // Pagar el internet que ya estaba apartado no mueve "Hoy puedes".
    fireEvent.press(screen.getByTestId('tarjeta-accion-1-ya-la-pague'));
    expect(within(screen.getByTestId('aviso')).getByText('Registré: internet $674')).toBeTruthy();
    expect(screen.queryByText(/Tu día pasa de/)).toBeNull();
  });
});

describe('Movimientos', () => {
  it('vacío: invita a registrar con un botón; con filtro, sin botón', () => {
    const p = conEscenario('e4-01');
    const alRegistrar = jest.fn();
    const { unmount } = renderConSesion(p.ctx, <PantallaMovimientos alRegistrar={alRegistrar} />);
    expect(screen.getByTestId('movimientos-vacio')).toHaveTextContent(TEXTO_MOVIMIENTOS_VACIO);
    expect(TEXTO_MOVIMIENTOS_VACIO).not.toMatch(/Ve a Hoy/);
    expect(screen.getByTestId('boton-registrar-primer-movimiento')).toHaveTextContent(
      BTN_REGISTRAR_PRIMER_MOVIMIENTO,
    );
    fireEvent.press(screen.getByTestId('boton-registrar-primer-movimiento'));
    expect(alRegistrar).toHaveBeenCalled();
    unmount();

    renderConSesion(
      p.ctx,
      <PantallaMovimientos alRegistrar={alRegistrar} filtro={{ desde: '2099-01-01', hasta: '2099-01-02' }} />,
    );
    expect(screen.getByTestId('movimientos-vacio')).toHaveTextContent(TEXTO_MOVIMIENTOS_FILTRO_VACIO);
    expect(screen.queryByTestId('boton-registrar-primer-movimiento')).toBeNull();
    p.cerrar();
  });

  function conCoca() {
    const p = conEscenario('e4-01');
    const efectivo = p.e.cuentas.efectivo as string;
    registrarMovimiento(p.ctx, {
      tipo: 'gasto',
      categoria: 'antojos',
      origenId: efectivo,
      monto: 2_500,
      descripcion: 'coca',
    });
    const id = listarMovimientos(p.ctx)[0]?.movimientos[0]?.id as string;
    return { ...p, efectivo, id };
  }

  it('el detalle abierto se cierra con "Cerrar" o tocando su encabezado', () => {
    const p = conCoca();
    renderConSesion(p.ctx, <PantallaMovimientos alRegistrar={jest.fn()} />);
    fireEvent.press(screen.getByTestId(`movimiento-${p.id}`));
    expect(screen.getByTestId(`detalle-${p.id}`)).toBeTruthy();
    fireEvent.press(screen.getByTestId(`cerrar-detalle-${p.id}`));
    expect(screen.queryByTestId(`detalle-${p.id}`)).toBeNull();

    fireEvent.press(screen.getByTestId(`movimiento-${p.id}`));
    expect(screen.getByTestId(`encabezado-${p.id}`)).toHaveProp('accessibilityState', { expanded: true });
    fireEvent.press(screen.getByTestId(`encabezado-${p.id}`));
    expect(screen.queryByTestId(`detalle-${p.id}`)).toBeNull();
    p.cerrar();
  });

  it('dice "Borrar" (como la voz) y el aviso "Borré el movimiento."', () => {
    const p = conCoca();
    renderConSesion(p.ctx, <PantallaMovimientos alRegistrar={jest.fn()} />);
    fireEvent.press(screen.getByTestId(`movimiento-${p.id}`));
    expect(screen.getByTestId('boton-anular')).toHaveTextContent('Borrar');
    fireEvent.press(screen.getByTestId('boton-anular'));
    expect(screen.getByTestId('boton-confirmar-anular')).toHaveTextContent('Sí, borrar');
    fireEvent.press(screen.getByTestId('boton-confirmar-anular'));
    expect(MENSAJE_ANULADO_MOVIMIENTO).toBe('Borré el movimiento.');
    expect(screen.getByLabelText(MENSAJE_ANULADO_MOVIMIENTO)).toBeTruthy();
    expect(listarMovimientos(p.ctx)).toEqual([]);
    p.cerrar();
  });

  it('"Corregir" abre el formulario con sus datos y reemplaza el movimiento (libro inmutable)', () => {
    const p = conCoca();
    renderConSesion(p.ctx, <PantallaMovimientos alRegistrar={jest.fn()} />);
    fireEvent.press(screen.getByTestId(`movimiento-${p.id}`));
    fireEvent.press(screen.getByTestId('boton-corregir'));
    const formulario = screen.getByTestId('formulario-corregir');
    // Precargado: monto, descripción, categoría, cuenta y fecha (hoy).
    expect(within(formulario).getByTestId('campo-monto').props.value).toBe('25');
    expect(within(formulario).getByTestId('campo-descripcion').props.value).toBe('coca');
    expect(within(formulario).getByTestId('categoria-antojos').props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(within(formulario).getByTestId(`origen-${p.efectivo}`).props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(within(formulario).getByTestId('fecha-hoy').props.accessibilityState).toMatchObject({
      selected: true,
    });
    // Sin tipo: corregir no cambia qué pasó.
    expect(within(formulario).queryByTestId('tipo-ingreso')).toBeNull();

    // Guardar sin cambios lo dice y no toca el libro.
    fireEvent.press(within(formulario).getByText(BTN_GUARDAR_CAMBIOS));
    expect(within(formulario).getByText(MENSAJE_SIN_CAMBIOS)).toBeTruthy();

    fireEvent.changeText(within(formulario).getByTestId('campo-monto'), '30');
    fireEvent.press(within(formulario).getByTestId('fecha-ayer'));
    fireEvent.press(screen.getByTestId('boton-guardar-correccion'));

    expect(
      within(screen.getByTestId('aviso')).getByText(
        /^Corregí: Coca \$30 · Antojos · Cartera\. Antes: \$25, 11 oct/,
      ),
    ).toBeTruthy();
    expect(within(screen.getByTestId('aviso')).getByText('Deshacer')).toBeTruthy();
    const movimientos = listarMovimientos(p.ctx).flatMap((d) => d.movimientos);
    expect(movimientos).toHaveLength(1);
    const [nuevo] = movimientos;
    expect(nuevo?.id).not.toBe(p.id);
    expect(nuevo).toMatchObject({ monto: 3_000, fecha: '2026-10-10', reemplazaA: p.id });
    // La versión anterior sigue en el libro como historial (regla 2) y el detalle nuevo queda abierto.
    expect(historialMovimiento(p.ctx, nuevo?.id as string).map((v) => v.monto)).toEqual([2_500]);
    expect(screen.getByTestId(`historial-${nuevo?.id}`)).toBeTruthy();

    // Deshacer devuelve la versión original.
    fireEvent.press(within(screen.getByTestId('aviso')).getByText('Deshacer'));
    expect(listarMovimientos(p.ctx).flatMap((d) => d.movimientos)[0]).toMatchObject({ monto: 2_500 });
    p.cerrar();
  });

  it('"Cancelar" deja el movimiento como estaba', () => {
    const p = conCoca();
    renderConSesion(p.ctx, <PantallaMovimientos alRegistrar={jest.fn()} />);
    fireEvent.press(screen.getByTestId(`movimiento-${p.id}`));
    fireEvent.press(screen.getByTestId('boton-corregir'));
    fireEvent.changeText(screen.getByTestId('campo-monto'), '99');
    fireEvent.press(screen.getByTestId('boton-cancelar-correccion'));
    expect(screen.queryByTestId('formulario-corregir')).toBeNull();
    expect(screen.getByTestId('boton-corregir')).toBeTruthy();
    expect(listarMovimientos(p.ctx)[0]?.movimientos[0]).toMatchObject({ id: p.id, monto: 2_500 });
    p.cerrar();
  });
});

describe('Fecha en el formulario manual (Hoy · Ayer · Elegir)', () => {
  function llenarCoca(efectivo: string) {
    fireEvent.changeText(screen.getByTestId('campo-monto'), '25');
    fireEvent.changeText(screen.getByTestId('campo-descripcion'), 'coca');
    fireEvent.press(screen.getByTestId('categoria-antojos'));
    fireEvent.press(screen.getByTestId(`origen-${efectivo}`));
  }

  it('por omisión es hoy; "Ayer" lo registra con la fecha de ayer', () => {
    const p = conEscenario('e4-01');
    const efectivo = p.e.cuentas.efectivo as string;
    renderConSesion(p.ctx, <FormularioMovimiento />);
    expect(screen.getByTestId('fecha-hoy').props.accessibilityState).toMatchObject({ selected: true });
    llenarCoca(efectivo);
    fireEvent.press(screen.getByTestId('fecha-ayer'));
    fireEvent.press(screen.getByTestId('boton-guardar-movimiento'));
    expect(within(screen.getByTestId('aviso')).getByText('Registré: coca $25 · 10 oct')).toBeTruthy();
    expect(listarMovimientos(p.ctx)[0]?.movimientos[0]?.fecha).toBe('2026-10-10');
    p.cerrar();
  });

  it('"Elegir" ofrece los últimos 7 días y otra fecha validada', () => {
    const p = conEscenario('e4-01');
    const efectivo = p.e.cuentas.efectivo as string;
    renderConSesion(p.ctx, <FormularioMovimiento />);
    llenarCoca(efectivo);
    fireEvent.press(screen.getByTestId('fecha-elegir'));
    expect(screen.getByTestId('dia-2026-10-11')).toBeTruthy();
    expect(screen.getByTestId('dia-2026-10-05')).toBeTruthy();
    expect(screen.queryByTestId('dia-2026-10-04')).toBeNull();

    fireEvent.changeText(screen.getByTestId('campo-otra-fecha'), '11/10/2026');
    fireEvent.press(screen.getByTestId('boton-guardar-movimiento'));
    expect(screen.getAllByText(errorFechaFormato('2026-10-10')).length).toBeGreaterThan(0);
    fireEvent.changeText(screen.getByTestId('campo-otra-fecha'), '2026-10-12');
    expect(screen.getAllByText(ERROR_FECHA_FUTURA).length).toBeGreaterThan(0);
    expect(listarMovimientos(p.ctx)).toEqual([]);

    fireEvent.changeText(screen.getByTestId('campo-otra-fecha'), '2026-09-30');
    fireEvent.press(screen.getByTestId('boton-guardar-movimiento'));
    expect(listarMovimientos(p.ctx)[0]?.movimientos[0]?.fecha).toBe('2026-09-30');
    p.cerrar();
  });

  it('un día de los chips de "Elegir" se usa al guardar', async () => {
    const p = conEscenario('e4-01');
    const efectivo = p.e.cuentas.efectivo as string;
    renderConSesion(p.ctx, <FormularioMovimiento />);
    llenarCoca(efectivo);
    fireEvent.press(screen.getByTestId('fecha-elegir'));
    fireEvent.press(screen.getByTestId('dia-2026-10-07'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('boton-guardar-movimiento'));
    });
    await waitFor(() => expect(listarMovimientos(p.ctx)[0]?.movimientos[0]?.fecha).toBe('2026-10-07'));
    p.cerrar();
  });
});
