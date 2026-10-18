import { act, fireEvent, screen, within } from '@testing-library/react-native';
import type { PlainDate, Regla } from '@cartera/core';
import {
  aceptarConsentimiento,
  agregarCuenta,
  agregarPagoFijo,
  agregarTarjetaCredito,
  configurarIngreso,
  crearPersona,
  fijarColchon,
  listarMovimientos,
  obtenerHoy,
  registrarCuentaDividida,
  registrarMovimiento,
  registrarPrestamo,
} from '../../servicios';
import { formatearCentavos } from '../../ui';
import { cifraEnPalabras } from '../../ui/formato';
import { abrirPruebaPantalla, conEscenario, vector } from './__pruebas__/base';
import {
  TEXTO_CUENTAS_COMPROMISOS_VACIO,
  TEXTO_CUENTAS_DEBES_VACIO,
  TEXTO_CUENTAS_TIENES_VACIO,
  etiquetaVacioCuentasCompromisos,
  etiquetaVacioCuentasDebes,
  etiquetaVacioCuentasTienes,
  etiquetaVacioMovimientos,
  TEXTO_MOVIMIENTOS_FILTRO_VACIO,
  TEXTO_MOVIMIENTOS_VACIO,
  MENSAJE_ANULADO_MOVIMIENTO,
  SUBTITULO_SIN_INGRESO,
  TITULO_SIN_INGRESO,
  contextoSaldoCompromiso,
  contextoSaldoTarjeta,
  contextoSaldoTienes,
} from './textos';
import { crearMotorFalso, navegacionFalsa, renderConSesion } from './__pruebas__/arnes';
import { PantallaCuentas } from './PantallaCuentas';
import { PantallaHoy } from './PantallaHoy';
import { PantallaMovimientos } from './PantallaMovimientos';
import { PantallaRegistrar } from './PantallaRegistrar';

interface VectorE4 {
  entrada: {
    liquidez: number;
    colchon: number;
    compromisos: { concepto: string; fecha: PlainDate; monto: number }[];
    tarjetas: { modo: 'totalero' | 'plan'; saldo_revolvente: number }[];
    deudas_personas?: { contraparte: string; monto: number }[];
  };
  esperado: { libre: number; reservado: number; hoy_puedes_pesos_mostrados: number };
}
interface VectorE3 {
  hoy: PlainDate;
  regla: Regla;
  esperado: { fin: PlainDate };
}

const textoDe = (testID: string) => {
  const nodo = screen.getByTestId(testID);
  const hijos = nodo.props.children as unknown;
  return Array.isArray(hijos) ? hijos.join('') : String(hijos);
};

/** Hoy, Movimientos y Cuentas a la vez, como al cambiar de pestaña. */
function todas(ctx: Parameters<typeof renderConSesion>[0], motor = crearMotorFalso().motor) {
  return renderConSesion(
    ctx,
    <>
      <PantallaHoy navegacion={navegacionFalsa()} motor={motor} />
      <PantallaMovimientos alRegistrar={jest.fn()} />
      <PantallaCuentas alAbrirAjustes={jest.fn()} />
    </>,
  );
}

describe('Hoy', () => {
  it('CA-M2-03 · con la semilla e4-01 muestra $214, "4 días para tu quincena (jue 15)" y el desglose de E4-01', () => {
    const p = conEscenario('e4-01');
    const v = vector<VectorE4>('E4-01');
    renderConSesion(p.ctx, <PantallaHoy navegacion={navegacionFalsa()} motor={crearMotorFalso().motor} />);

    expect(textoDe('hoy-puedes')).toBe('$214');
    expect(textoDe('hoy-puedes')).toBe(`$${v.esperado.hoy_puedes_pesos_mostrados}`);
    expect(screen.getByTestId('hoy-puedes').props.accessibilityLabel).toBe(
      'Hoy puedes gastar doscientos catorce pesos',
    );
    expect(textoDe('hoy-secundario')).toBe('4 días para tu quincena (jue 15)');
    expect(textoDe('hoy-fecha')).toBe('Dom 11 oct');
    expect(screen.queryByTestId('desglose')).toBeNull();

    fireEvent.press(screen.getByTestId('boton-desglose'));
    expect(textoDe('desglose-liquidez')).toBe(formatearCentavos(v.entrada.liquidez));
    expect(textoDe('desglose-reservado')).toBe(formatearCentavos(-v.esperado.reservado));
    expect(textoDe('desglose-colchon')).toBe(formatearCentavos(-v.entrada.colchon));
    expect(textoDe('desglose-libre')).toBe(formatearCentavos(v.esperado.libre));
    expect(textoDe('desglose-libre')).toBe('$856');
    expect(screen.getByText('Reservado (Nu ••4410, tanda, internet)')).toBeTruthy();
    expect(screen.queryByTestId('tarjeta-accion-0')).toBeNull();
  });

  it('CA-M2-08 · el 15 oct sin depósito muestra "día de pago" con $456; "Sí, ya llegó" recalcula al 30 oct', () => {
    const v4 = vector<VectorE4>('E4-05');
    const v3 = vector<VectorE3>('E3-11');
    const p = abrirPruebaPantalla('2026-10-11');
    aceptarConsentimiento(p.ctx, { datosFinancieros: true });
    agregarCuenta(p.ctx, { subtipo: 'efectivo', nombre: 'Cartera', saldo: v4.entrada.liquidez });
    const bbva = agregarCuenta(p.ctx, { subtipo: 'debito', nombre: 'BBVA', saldo: 0 });
    for (const t of v4.entrada.tarjetas) {
      agregarTarjetaCredito(p.ctx, {
        nombre: 'Nu',
        diaCorte: 28,
        diaLimitePago: 18,
        limiteCredito: 1_500_000,
        modo: t.modo,
        saldo: t.saldo_revolvente,
      });
    }
    for (const c of v4.entrada.compromisos) {
      agregarPagoFijo(p.ctx, {
        concepto: c.concepto,
        monto: c.monto,
        regla: { tipo: 'unica', fecha: c.fecha },
      });
    }
    fijarColchon(p.ctx, v4.entrada.colchon);
    configurarIngreso(p.ctx, { monto: 650_000, regla: v3.regla, cuentaId: bbva });
    p.reloj.fijar(v3.hoy);

    renderConSesion(p.ctx, <PantallaHoy navegacion={navegacionFalsa()} motor={crearMotorFalso().motor} />);
    expect(textoDe('hoy-puedes')).toBe('$456');
    expect(textoDe('hoy-puedes')).toBe(`$${v4.esperado.hoy_puedes_pesos_mostrados}`);
    expect(screen.getByText('Hoy puedes gastar')).toBeTruthy();
    expect(textoDe('hoy-secundario')).toBe(
      'Hoy es día de pago. Mientras llega tu depósito reparto en 3 días; cuando llegue, recalculo.',
    );
    const tarjeta = screen.getByTestId('tarjeta-accion-0');
    expect(within(tarjeta).getByText('Hoy es día de pago. ¿Ya te llegó tu quincena?')).toBeTruthy();

    fireEvent.press(within(tarjeta).getByText('Sí, ya llegó'));
    expect(textoDe('hoy-secundario')).toBe('15 días para tu quincena (vie 30)');
    const hoy = obtenerHoy(p.ctx);
    expect(hoy.finEfectivo).toBe('2026-10-30');
    expect(textoDe('hoy-puedes')).toBe(formatearCentavos(hoy.hoyPuedesCentavos, 'pesos'));
    expect(screen.getByText('Deshacer')).toBeTruthy();
    expect(screen.queryByText('Sí, ya llegó')).toBeNull();
  });

  it('CA-M2-10 · "¿Ya pagaste…?": Todavía no sigue reservado; Ya la pagué registra y cubre', () => {
    const p = conEscenario('e4-01');
    const bbva = p.e.cuentas.bbva as string;
    p.reloj.fijar('2026-10-15');
    todas(p.ctx);
    const inicial = textoDe('hoy-puedes');
    expect(within(screen.getByTestId('tarjeta-accion-0')).getByText('¿Ya pagaste la tanda?')).toBeTruthy();
    expect(within(screen.getByTestId('tarjeta-accion-1')).getByText('¿Ya pagaste el internet?')).toBeTruthy();
    expect(within(screen.getByTestId('tarjeta-accion-1')).getByText('$674, vencía el mié 14')).toBeTruthy();
    for (const b of ['Ya la pagué', 'Todavía no', 'Ya no aplica']) {
      expect(within(screen.getByTestId('tarjeta-accion-0')).getByText(b)).toBeTruthy();
    }

    // Todavía no: se oculta hoy pero sigue reservado.
    fireEvent.press(screen.getByTestId('tarjeta-accion-0-todavia-no'));
    expect(screen.queryByText('¿Ya pagaste la tanda?')).toBeNull();
    expect(screen.getByText('Lo sigo apartando. Te pregunto mañana.')).toBeTruthy();
    expect(textoDe('hoy-puedes')).toBe(inicial);
    expect(obtenerHoy(p.ctx).desglose.compromisos).toBe(50_000 + 67_400);

    // Ya la pagué: el gasto sale de BBVA y el internet ya no se pregunta ni se reserva.
    expect(textoDe(`cuenta-${bbva}-saldo`)).toBe('$3,590');
    fireEvent.press(screen.getByTestId('tarjeta-accion-0-ya-la-pague'));
    expect(screen.getByText('Registré: internet $674')).toBeTruthy();
    expect(textoDe(`cuenta-${bbva}-saldo`)).toBe('$2,916');
    expect(screen.queryByText('¿Ya pagaste el internet?')).toBeNull();
    expect(textoDe('hoy-puedes')).toBe(inicial);
    expect(obtenerHoy(p.ctx).desglose.compromisos).toBe(50_000);

    // Deshacer devuelve el saldo y la pregunta.
    fireEvent.press(screen.getByText('Deshacer'));
    expect(textoDe(`cuenta-${bbva}-saldo`)).toBe('$3,590');
    expect(screen.getByText('¿Ya pagaste el internet?')).toBeTruthy();
  });

  it('CA-M2-10 · "Ya no aplica" omite el compromiso y E4 deja de reservarlo', () => {
    const p = conEscenario('e4-01');
    p.reloj.fijar('2026-10-15');
    todas(p.ctx);
    const antes = obtenerHoy(p.ctx);
    expect(screen.getAllByText('tanda').length).toBeGreaterThan(0); // en Compromisos
    fireEvent.press(screen.getByTestId('tarjeta-accion-0-ya-no-aplica'));
    expect(screen.queryByText('¿Ya pagaste la tanda?')).toBeNull();
    const despues = obtenerHoy(p.ctx);
    expect(despues.desglose.compromisos).toBe(antes.desglose.compromisos - 50_000);
    expect(despues.libre).toBe(antes.libre + 50_000);
    expect(textoDe('hoy-puedes')).toBe(formatearCentavos(despues.hoyPuedesCentavos, 'pesos'));
    expect(screen.queryAllByText('tanda')).toHaveLength(0);
  });

  it('libre negativo: "Hoy: $0" con lo que falta, sin inflar la cifra', () => {
    const p = conEscenario('e4-01');
    fijarColchon(p.ctx, 200_000);
    renderConSesion(p.ctx, <PantallaHoy navegacion={navegacionFalsa()} motor={crearMotorFalso().motor} />);
    const hoy = obtenerHoy(p.ctx);
    expect(textoDe('hoy-puedes')).toBe('$0');
    expect(textoDe('hoy-secundario')).toBe(
      `Te faltan ${formatearCentavos(hoy.faltante)} para cubrir lo que viene antes del jue 15.`,
    );
    expect(screen.getByText('Ver qué viene')).toBeTruthy();
  });

  it('sin ingreso configurado pide la frecuencia y lleva a configurarla', () => {
    const p = abrirPruebaPantalla();
    aceptarConsentimiento(p.ctx, { datosFinancieros: true });
    agregarCuenta(p.ctx, { subtipo: 'efectivo', nombre: 'Cartera', saldo: 300_000 });
    const nav = navegacionFalsa();
    renderConSesion(p.ctx, <PantallaHoy navegacion={nav} motor={crearMotorFalso().motor} />);
    expect(screen.getByTestId('hoy-sin-ingreso')).toBeTruthy();
    expect(screen.getByTestId('hoy-sin-ingreso-titulo')).toHaveTextContent(TITULO_SIN_INGRESO);
    expect(screen.getByTestId('hoy-sin-ingreso-subtitulo')).toHaveTextContent(SUBTITULO_SIN_INGRESO);
    fireEvent.press(screen.getByTestId('boton-configurar-ingreso'));
    expect(nav.alConfigurarIngreso).toHaveBeenCalled();
  });

  it('CA-M2-12 · el aviso de meses contados dos veces sale una sola vez', () => {
    const p = conEscenario('e4-01');
    agregarTarjetaCredito(p.ctx, {
      nombre: 'Oro',
      diaCorte: 5,
      diaLimitePago: 25,
      limiteCredito: 3_000_000,
      modo: 'totalero',
      saldo: 500_000,
      msiPrevios: [{ mensualidad: 100_000, restantes: 3 }],
      saldoIncluyeMsi: 'no_se',
    });
    const texto =
      'Puede que esté contando dos veces tus meses de la Oro. Compáralo con tu próximo estado de cuenta.';
    const primera = renderConSesion(
      p.ctx,
      <PantallaHoy navegacion={navegacionFalsa()} motor={crearMotorFalso().motor} />,
    );
    const aviso = screen.getByText(texto);
    expect(aviso.props.accessibilityRole).toBe('alert');
    expect(aviso.props.accessibilityLiveRegion).toBe('polite');
    expect(obtenerHoy(p.ctx).avisos).toEqual([]);
    fireEvent.press(screen.getByTestId('boton-aviso-entendido'));
    expect(screen.queryByText(texto)).toBeNull();
    primera.unmount();

    renderConSesion(p.ctx, <PantallaHoy navegacion={navegacionFalsa()} motor={crearMotorFalso().motor} />);
    expect(screen.queryByText(texto)).toBeNull();
  });
});

describe('Registrar', () => {
  it('CA-M2-02 · escribir "coca 25 en efectivo" registra, el efectivo baja $25 y Deshacer lo regresa', () => {
    const p = conEscenario('e4-01');
    const nav = navegacionFalsa();
    const efectivo = p.e.cuentas.efectivo as string;
    renderConSesion(
      p.ctx,
      <>
        <PantallaHoy navegacion={nav} motor={crearMotorFalso().motor} />
        <PantallaMovimientos alRegistrar={jest.fn()} />
        <PantallaCuentas alAbrirAjustes={jest.fn()} />
      </>,
    );
    expect(textoDe(`cuenta-${efectivo}-saldo`)).toBe('$640');
    expect(screen.getByTestId('movimientos-vacio')).toHaveTextContent(TEXTO_MOVIMIENTOS_VACIO);

    fireEvent.press(screen.getByTestId('boton-escribir'));
    fireEvent.changeText(screen.getByTestId('campo-registrar'), 'coca 25 en efectivo');
    fireEvent.press(screen.getByTestId('boton-enviar-registro'));

    const aviso = screen.getByTestId('aviso');
    expect(within(aviso).getByText(/^Registré: Coca \$25 · .+ · Cartera$/)).toBeTruthy();
    expect(within(aviso).getByText('Deshacer')).toBeTruthy();
    expect(textoDe(`cuenta-${efectivo}-saldo`)).toBe('$615');
    const [mov] = listarMovimientos(p.ctx)[0]?.movimientos ?? [];
    expect(textoDe(`monto-${mov?.id}`)).toBe('−$25');

    fireEvent.press(within(aviso).getByText(/^Registré: Coca \$25 · .+ · Cartera$/));
    expect(nav.alVerMovimiento).toHaveBeenCalledWith(mov?.id);

    fireEvent.press(within(aviso).getByText('Deshacer'));
    expect(screen.queryByTestId('aviso')).toBeNull();
    expect(textoDe(`cuenta-${efectivo}-saldo`)).toBe('$640');
    expect(screen.getByTestId('movimientos-vacio')).toBeTruthy();
  });

  it('CA-M2-02 · también dictado: al soltar se registra con Deshacer', async () => {
    const p = conEscenario('e4-01');
    const efectivo = p.e.cuentas.efectivo as string;
    const { motor, emitir } = crearMotorFalso();
    todas(p.ctx, motor);

    await act(async () => {
      fireEvent(screen.getByTestId('boton-hablar'), 'pressIn');
    });
    expect(motor.iniciar).toHaveBeenCalledWith(expect.objectContaining({ idioma: 'es-MX' }));
    emitir({ tipo: 'resultado', texto: 'coca 25', final: false });
    expect(textoDe('transcripcion-en-vivo')).toBe('coca 25');
    fireEvent(screen.getByTestId('boton-hablar'), 'pressOut');
    emitir({ tipo: 'resultado', texto: 'coca 25 en efectivo', final: true });

    expect(within(screen.getByTestId('aviso')).getByText('Deshacer')).toBeTruthy();
    expect(textoDe(`cuenta-${efectivo}-saldo`)).toBe('$615');
    expect(listarMovimientos(p.ctx)[0]?.movimientos[0]?.origen).toBe('voz');
  });

  it('lo que el nivel 0 no entiende queda por revisar y aparece en Movimientos', async () => {
    const p = conEscenario('e4-01');
    todas(p.ctx);
    fireEvent.press(screen.getByTestId('boton-escribir'));
    fireEvent.changeText(screen.getByTestId('campo-registrar'), 'ayer fui al súper con mi prima y pagó ella');
    fireEvent.press(screen.getByTestId('boton-enviar-registro'));
    await screen.findByTestId('mensaje-registro');
    expect(textoDe('mensaje-registro')).toMatch(/^Lo guardé; lo interpreto cuando tengas internet\./);
    expect(screen.getByText('«ayer fui al súper con mi prima y pagó ella»')).toBeTruthy();
    expect(screen.getByText('Tienes 1 frase por revisar.')).toBeTruthy();
  });

  it('con tarjeta ambigua pide elegirla con chips antes de guardar', () => {
    const p = conEscenario('e4-01');
    const nu = p.e.cuentas.nu as string;
    todas(p.ctx);
    fireEvent.press(screen.getByTestId('boton-escribir'));
    fireEvent.changeText(screen.getByTestId('campo-registrar'), 'tacos 80 con tarjeta');
    fireEvent.press(screen.getByTestId('boton-enviar-registro'));
    const tarjeta = screen.getByTestId('confirmacion-registro');
    expect(within(tarjeta).getByText('Confirma la cuenta.')).toBeTruthy();
    expect(within(tarjeta).getByText('¿De qué cuenta salió?')).toBeTruthy();
    expect(screen.getByTestId('boton-guardar-confirmacion').props.accessibilityState).toMatchObject({
      disabled: true,
    });
    expect(screen.queryByTestId('aviso')).toBeNull();

    const chipNu = within(tarjeta).getByTestId(`elegir-0-origenId-${nu}`);
    expect(chipNu.props.accessibilityLabel).toBe('Nu ••4410');
    expect(chipNu.props.accessibilityRole).toBe('radio');
    expect(screen.getByLabelText('¿De qué cuenta salió?')).toBeTruthy();

    fireEvent.press(chipNu);
    expect(chipNu.props.accessibilityState).toMatchObject({ selected: true });
    fireEvent.press(screen.getByTestId('boton-guardar-confirmacion'));
    expect(screen.queryByTestId('confirmacion-registro')).toBeNull();
    expect(
      within(screen.getByTestId('aviso')).getByText('Registré: Tacos $80 · Comida fuera · Nu ••4410'),
    ).toBeTruthy();
    expect(textoDe(`cuenta-${nu}-saldo`)).toBe('$2,080');
  });

  it('un monto mayor a $5,000 no se guarda hasta confirmarlo', () => {
    const p = conEscenario('e4-01');
    todas(p.ctx);
    fireEvent.press(screen.getByTestId('boton-escribir'));
    fireEvent.changeText(screen.getByTestId('campo-registrar'), 'renta 6000 en efectivo');
    fireEvent.press(screen.getByTestId('boton-enviar-registro'));
    expect(screen.getByText('Es un monto alto. Revísalo antes de guardar.')).toBeTruthy();
    expect(listarMovimientos(p.ctx)).toEqual([]);
    fireEvent.press(screen.getByTestId('boton-cancelar-confirmacion'));
    expect(screen.queryByTestId('confirmacion-registro')).toBeNull();
    expect(listarMovimientos(p.ctx)).toEqual([]);
  });

  it('el formulario registra un préstamo recibido con persona nueva', () => {
    const p = conEscenario('e4-01');
    const bbva = p.e.cuentas.bbva as string;
    const alCerrar = jest.fn();
    renderConSesion(
      p.ctx,
      <>
        <PantallaRegistrar alCerrar={alCerrar} motor={crearMotorFalso().motor} />
        <PantallaCuentas alAbrirAjustes={jest.fn()} />
      </>,
    );
    fireEvent.press(screen.getByTestId('tipo-prestamo_recibido'));
    fireEvent.changeText(screen.getByTestId('campo-monto'), '2,000');
    fireEvent.press(screen.getByTestId('boton-guardar-movimiento'));
    expect(screen.getByText('Elige a la persona.')).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('campo-nueva-persona'), 'Mi jefa');
    fireEvent.press(screen.getByTestId('boton-agregar-persona'));
    fireEvent.press(screen.getByTestId(`destino-${bbva}`));
    fireEvent.press(screen.getByTestId('boton-guardar-movimiento'));

    expect(alCerrar).toHaveBeenCalled();
    expect(screen.getByText('Registré: Me prestaron $2,000')).toBeTruthy();
    expect(textoDe(`cuenta-${bbva}-saldo`)).toBe('$5,590');
    expect(screen.getByText('Mi jefa')).toBeTruthy();
    expect(screen.getByText('Apartar lo que le debo')).toBeTruthy();
  });
});

describe('Cuentas', () => {
  it('sin cuentas muestra el copy vacío en Tienes, Debes y Compromisos', () => {
    const p = abrirPruebaPantalla();
    aceptarConsentimiento(p.ctx, { datosFinancieros: true });
    renderConSesion(p.ctx, <PantallaCuentas alAbrirAjustes={jest.fn()} />);
    expect(screen.getByTestId('cuentas-titulo')).toHaveProp('accessibilityRole', 'header');
    expect(screen.getByTestId('seccion-tienes-titulo')).toHaveProp('accessibilityRole', 'header');
    expect(screen.getByTestId('cuentas-tienes-vacio')).toHaveTextContent(TEXTO_CUENTAS_TIENES_VACIO);
    expect(screen.getByTestId('cuentas-tienes-vacio')).toHaveProp('accessibilityLiveRegion', 'polite');
    expect(screen.getByTestId('cuentas-tienes-vacio').props.accessibilityLabel).toBe(etiquetaVacioCuentasTienes());
    expect(screen.getByTestId('cuentas-debes-vacio')).toHaveTextContent(TEXTO_CUENTAS_DEBES_VACIO);
    expect(screen.getByTestId('cuentas-debes-vacio').props.accessibilityLabel).toBe(etiquetaVacioCuentasDebes());
    expect(screen.getByTestId('cuentas-compromisos-vacio')).toHaveTextContent(TEXTO_CUENTAS_COMPROMISOS_VACIO);
    expect(screen.getByTestId('cuentas-compromisos-vacio').props.accessibilityLabel).toBe(
      etiquetaVacioCuentasCompromisos(),
    );
    p.cerrar();
  });

  it('CA-M2-09 · con el préstamo de la jefa apartado Hoy sigue en $214; al apagar el interruptor sube', () => {
    const v = vector<VectorE4>('E4-09');
    const deuda = v.entrada.deudas_personas?.find((d) => d.contraparte === 'jefa');
    if (!deuda) throw new Error('E4-09 sin la deuda de la jefa');
    const p = conEscenario('e4-01');
    const jefa = crearPersona(p.ctx, { nombre: 'Mi jefa', alias: ['jefa'] });
    registrarPrestamo(p.ctx, {
      tipo: 'prestamo_recibido',
      personaId: jefa,
      cuentaId: p.e.cuentas.bbva as string,
      monto: deuda.monto,
    });
    todas(p.ctx);
    expect(textoDe('hoy-puedes')).toBe('$214');
    expect(textoDe(`cuenta-${jefa}-saldo`)).toBe(formatearCentavos(deuda.monto));
    const interruptor = screen.getByTestId(`apartar-${jefa}`);
    expect(interruptor.props.accessibilityState).toMatchObject({ checked: true });

    fireEvent.press(interruptor);
    expect(screen.getByTestId(`apartar-${jefa}`).props.accessibilityState).toMatchObject({ checked: false });
    const sinApartar = obtenerHoy(p.ctx);
    expect(sinApartar.libre).toBe(v.esperado.libre + deuda.monto);
    expect(textoDe('hoy-puedes')).toBe(formatearCentavos(sinApartar.hoyPuedesCentavos, 'pesos'));
    expect(sinApartar.hoyPuedesPesos).toBeGreaterThan(214);

    fireEvent.press(screen.getByTestId(`apartar-${jefa}`));
    expect(textoDe('hoy-puedes')).toBe('$214');
  });

  it('cada saldo trae accessibilityLabel con contexto y la cifra en palabras (02 §15)', () => {
    const p = conEscenario('e4-01');
    const bbvaId = p.e.cuentas.bbva as string;
    const bbva = listarCuentas(p.ctx).tienes.find((c) => c.id === bbvaId);
    if (!bbva) throw new Error('e4-01 sin BBVA en Tienes');
    renderConSesion(p.ctx, <PantallaCuentas alAbrirAjustes={jest.fn()} />);
    expect(screen.getByTestId(`cuenta-${bbvaId}-saldo`).props.accessibilityLabel).toBe(
      `${contextoSaldoTienes(bbva.nombre)} ${cifraEnPalabras(359_000)}`,
    );
    expect(screen.getByTestId(`cuenta-${p.e.cuentas.nu}-saldo`).props.accessibilityLabel).toBe(
      `${contextoSaldoTarjeta('Nu', false)} ${cifraEnPalabras(200_000)}`,
    );
    expect(screen.getByTestId('cuenta-internet-saldo').props.accessibilityLabel).toBe(
      `${contextoSaldoCompromiso('internet', 'mié 14')} ${cifraEnPalabras(500_00)}`,
    );
    p.cerrar();
  });

  it('muestra Tienes, Debes con la tarjeta y Compromisos; el engrane abre Ajustes', () => {
    const p = conEscenario('e4-01');
    const alAbrirAjustes = jest.fn();
    renderConSesion(p.ctx, <PantallaCuentas alAbrirAjustes={alAbrirAjustes} />);
    expect(textoDe(`cuenta-${p.e.cuentas.nu}-saldo`)).toBe('$2,000');
    expect(screen.getByText('internet')).toBeTruthy();
    expect(screen.getByText('mié 14')).toBeTruthy();
    fireEvent.press(screen.getByTestId('boton-ajustes'));
    expect(alAbrirAjustes).toHaveBeenCalled();
  });
});

describe('Movimientos', () => {
  it('sin movimientos muestra TEXTO_MOVIMIENTOS_VACIO; filtro vacío muestra TEXTO_MOVIMIENTOS_FILTRO_VACIO', () => {
    const p = abrirPruebaPantalla();
    aceptarConsentimiento(p.ctx, { datosFinancieros: true });
    renderConSesion(p.ctx, <PantallaMovimientos alRegistrar={jest.fn()} />);
    expect(screen.getByTestId('movimientos-vacio')).toHaveTextContent(TEXTO_MOVIMIENTOS_VACIO);
    expect(screen.getByTestId('movimientos-vacio').props.accessibilityLabel).toBe(
      etiquetaVacioMovimientos(false),
    );
    p.cerrar();

    const p2 = conEscenario('e4-01');
    renderConSesion(
      p2.ctx,
      <PantallaMovimientos
        alRegistrar={jest.fn()}
        filtro={{ desde: '2099-01-01', hasta: '2099-01-02' }}
      />,
    );
    expect(screen.getByTestId('movimientos-vacio')).toHaveTextContent(TEXTO_MOVIMIENTOS_FILTRO_VACIO);
    expect(screen.getByTestId('movimientos-vacio').props.accessibilityLabel).toBe(
      etiquetaVacioMovimientos(true),
    );
    p2.cerrar();
  });

  it('detalleInicial expande el movimiento al montar la pantalla', () => {
    const p = conEscenario('e4-01');
    const efectivo = p.e.cuentas.efectivo as string;
    registrarMovimiento(p.ctx, {
      tipo: 'gasto',
      categoria: 'antojos',
      origenId: efectivo,
      monto: 2_500,
      descripcion: 'coca',
    });
    const id = listarMovimientos(p.ctx)[0]?.movimientos[0]?.id;
    renderConSesion(
      p.ctx,
      <PantallaMovimientos alRegistrar={jest.fn()} detalleInicial={id ?? null} />,
    );
    expect(screen.getByTestId(`detalle-${id}`)).toBeTruthy();
  });

  it('tocar un movimiento muestra el detalle y Anular pide confirmación', () => {
    const p = conEscenario('e4-01');
    const efectivo = p.e.cuentas.efectivo as string;
    todas(p.ctx);
    fireEvent.press(screen.getByTestId('boton-escribir'));
    fireEvent.changeText(screen.getByTestId('campo-registrar'), 'coca 25 en efectivo');
    fireEvent.press(screen.getByTestId('boton-enviar-registro'));
    const id = listarMovimientos(p.ctx)[0]?.movimientos[0]?.id as string;

    fireEvent.press(screen.getByTestId(`movimiento-${id}`));
    const detalle = screen.getByTestId(`detalle-${id}`);
    expect(within(detalle).getByText('Salió de: Cartera')).toBeTruthy();
    expect(within(detalle).getByText('Registrado escribiendo · 11 oct')).toBeTruthy();
    fireEvent.press(within(detalle).getByTestId('boton-anular'));
    fireEvent.press(screen.getByTestId('boton-confirmar-anular'));
    expect(screen.getByText(MENSAJE_ANULADO_MOVIMIENTO)).toBeTruthy();
    expect(textoDe(`cuenta-${efectivo}-saldo`)).toBe('$640');
    expect(listarMovimientos(p.ctx)).toEqual([]);
  });

  it('detalle: "Ver …" abre la persona del movimiento', () => {
    const p = conEscenario('e4-01');
    const caro = crearPersona(p.ctx, { nombre: 'Caro' });
    const nu = p.e.cuentas.nu as string;
    registrarCuentaDividida(p.ctx, {
      total: 120_000,
      partes: 4,
      personaIds: [caro, caro, caro],
      origenId: nu,
      categoria: 'comida_fuera',
      descripcion: 'la cena',
    });
    const id = listarMovimientos(p.ctx)[0]?.movimientos[0]?.id as string;
    const alAbrirPersona = jest.fn();
    renderConSesion(
      p.ctx,
      <PantallaMovimientos alRegistrar={jest.fn()} alAbrirPersona={alAbrirPersona} />,
    );
    fireEvent.press(screen.getByTestId(`movimiento-${id}`));
    fireEvent.press(screen.getByTestId(`movimiento-persona-${id}-${caro}`));
    expect(alAbrirPersona).toHaveBeenCalledWith(caro);
    const [mov] = listarMovimientos(p.ctx)[0]?.movimientos ?? [];
    expect(mov?.personas).toEqual([{ id: caro, nombre: 'Caro' }]);
  });
});
