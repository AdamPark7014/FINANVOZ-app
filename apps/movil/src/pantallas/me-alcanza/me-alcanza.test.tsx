import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import {
  compararEscenarios,
  generarEscenarios,
  sumarDias,
  type DiaHistorial,
  type Escenario,
  type PlainDate,
  type Programado,
  type Regla,
  type TarjetaRecomendable,
} from '@cartera/core';
import {
  cargarEscenario,
  confirmarIngresoRecibido,
  construirVistaMeAlcanza,
  listarMovimientos,
  listarPlanesMsi,
  obtenerHoy,
  registrarMovimiento,
  TEXTO_SIN_TARJETA_PARA_MSI,
  type Contexto,
  type DatosVistaMeAlcanza,
  type NivelNube,
  type VistaMeAlcanza,
} from '../../servicios';
import { nubeFalsa } from '../../servicios/__pruebas__/nube';
import { etiquetaHablada } from '../../ui/formato';
import { ProveedorSesion } from '../../sesion/ProveedorSesion';
import {
  notificacionesEnMemoria,
  ProveedorNotificaciones,
  type Notificaciones,
} from '../avisos/notificaciones';
import { crearMotorFalso, navegacionFalsa } from '../principal/__pruebas__/arnes';
import {
  abrirPruebaPantalla,
  activarPlus,
  conEscenario,
  escenario,
  vector,
} from '../principal/__pruebas__/base';
import { PantallaHoy } from '../principal/PantallaHoy';
import { PantallaMovimientos } from '../principal/PantallaMovimientos';
import { ProveedorAvisos } from '../principal/ProveedorAvisos';
import { abrirMeAlcanza, tomarConsultaPendiente } from '.';
import { PantallaMeAlcanza, type CalcularMeAlcanza } from './PantallaMeAlcanza';
import {
  ACCESIBILIDAD_CERRAR,
  ACCESIBILIDAD_LISTO,
  AYUDA_DATOS_INSUFICIENTES,
  BTN_CALCULAR,
  BTN_COMO_LO_CALCULE,
  BTN_DESHACER,
  ERROR_CALCULO,
  ERROR_PRECIO,
  ETIQUETA_OPCION_RECOMENDADA,
  ETIQUETA_PROGRESO,
  SUFIJO_ACCESIBILIDAD_RECOMENDADA,
  etiquetaVacioDatosInsuficientes,
  MENSAJE_CANCELADO,
  MENSAJE_DATOS_INSUFICIENTES,
  MENSAJE_PERMISO_AVISOS,
  PISTA_CALCULAR,
  PISTA_CAMBIAR_DATOS_ME_ALCANZA,
  PISTA_CANCELAR,
  PISTA_HACER_OTRA_CUENTA,
  PISTA_LISTO,
  PISTA_MOSTRAR_COMO_LO_CALCULE,
  PISTA_OCULTAR_COMO_LO_CALCULE,
  PISTA_REINTENTAR_ME_ALCANZA,
  PREGUNTA_MSI,
  TEXTO_RECORDATORIO_PROGRAMADO,
  TITULO,
} from './textos';

/** En pruebas no hace falta ceder el hilo de verdad. */
const sinEspera = { ceder: () => Promise.resolve() };

const textoDe = (testID: string) => {
  const hijos = screen.getByTestId(testID).props.children as unknown;
  return Array.isArray(hijos) ? hijos.join('') : String(hijos);
};

/** Sesión real + aviso inferior + notificaciones en memoria (como la raíz y la ruta `/me-alcanza`). */
function montar(
  ctx: Contexto,
  ui: ReactNode,
  {
    nube = null,
    notificaciones = null,
  }: { nube?: NivelNube | null; notificaciones?: Notificaciones | null } = {},
) {
  return render(
    <ProveedorNotificaciones notificaciones={notificaciones}>
      <ProveedorSesion ctx={ctx} nube={nube}>
        <ProveedorAvisos>{ui}</ProveedorAvisos>
      </ProveedorSesion>
    </ProveedorNotificaciones>,
  );
}

// ——— Vectores E8-22 y E8-23 (como en `servicios/simulador.test.ts`) ———

interface TarjetaVector {
  id: string;
  nombre: string;
  modo: 'totalero' | 'plan';
  dia_corte: number;
  dias_para_pagar?: number;
  dia_limite_pago?: number;
  limite_credito: number;
  saldo_revolvente: number;
  msi_no_facturado: number;
}

interface VectorE822 {
  entrada: {
    hoy: PlainDate;
    excedente_inicial: number;
    regla_ingreso: Regla;
    monto_ingreso: number;
    programados: Programado[];
    recibidas: PlainDate[];
    tarjetas: TarjetaVector[];
    historial: DiaHistorial[];
    escenarios: Escenario[];
    semilla: number;
  };
  esperado: Record<string, unknown>;
}

interface VectorE823 {
  id: string;
  precio: number;
  meses: number | null;
  fecha_compra: PlainDate | null;
  hoy: PlainDate;
  proximo_ingreso: PlainDate;
  tarjetas: TarjetaVector[];
}

function aTarjeta(t: TarjetaVector): TarjetaRecomendable {
  return {
    id: t.id,
    modo: t.modo,
    diaCorte: t.dia_corte,
    ...(t.dias_para_pagar !== undefined ? { diasParaPagar: t.dias_para_pagar } : {}),
    ...(t.dia_limite_pago !== undefined ? { diaLimitePago: t.dia_limite_pago } : {}),
    limiteCredito: t.limite_credito,
    saldoRevolvente: t.saldo_revolvente,
    msiNoFacturado: t.msi_no_facturado,
  };
}
const paraVista = (t: TarjetaVector) => ({ id: t.id, nombre: t.nombre, ciclo: aTarjeta(t) });

/** La vista de "¿Me alcanza?" con el resultado de E8-22 inyectado (CA-M6-03). */
function vistaE822(): VistaMeAlcanza {
  const v = vector<VectorE822>('E8-22');
  const calculado = compararEscenarios({ ...v.entrada, tarjetas: v.entrada.tarjetas.map(aTarjeta) });
  if (calculado.estado !== 'ok') throw new Error('estado inesperado');
  const datos: DatosVistaMeAlcanza = {
    consulta: { precio: 150_000, descripcion: 'unos tenis' },
    hoy: v.entrada.hoy,
    proximoIngreso: { fecha: '2026-10-15', concepto: 'quincena' },
    tarjetas: v.entrada.tarjetas.map(paraVista),
    generados: { nota: null, uso_bp: 400 },
    resultado: {
      ...(v.esperado as Omit<typeof calculado, 'horizontes' | 'estado'>),
      estado: 'ok',
      horizontes: calculado.horizontes,
    },
    diasHistorial: v.entrada.historial.length,
    historialDesde: v.entrada.historial[0]?.fecha ?? null,
  };
  return construirVistaMeAlcanza(datos);
}

/** Un caso de E8-23 sobre el historial de E8-22, ya como vista. */
function vistaE823(id: string): VistaMeAlcanza {
  const v22 = vector<VectorE822>('E8-22');
  const c = vector<VectorE823>(id);
  const tarjetas = c.tarjetas.map(aTarjeta);
  const g = generarEscenarios(
    c.precio,
    c.hoy,
    c.proximo_ingreso,
    tarjetas,
    c.meses ?? undefined,
    c.fecha_compra ?? undefined,
  );
  const resultado = compararEscenarios({ ...v22.entrada, tarjetas, escenarios: g.escenarios });
  if (resultado.estado !== 'ok') throw new Error('estado inesperado');
  return construirVistaMeAlcanza({
    consulta: { precio: c.precio, ...(c.meses ? { meses: c.meses } : {}) },
    hoy: c.hoy,
    proximoIngreso: { fecha: c.proximo_ingreso, concepto: 'quincena' },
    tarjetas: c.tarjetas.map(paraVista),
    generados: g,
    resultado,
    diasHistorial: 92,
    historialDesde: null,
  });
}

const inyectar =
  (vista: VistaMeAlcanza): CalcularMeAlcanza =>
  async () =>
    vista;

// ——— Libro de prueba con historial ———

function e401() {
  const p = conEscenario('e4-01');
  const c = p.e.cuentas as Record<string, string>;
  return { ...p, efectivo: c.efectivo as string, bbva: c.bbva as string, nu: c.nu as string };
}

/** Un gasto diario de $30 en efectivo en `[desde, hasta)`. */
function gastosDiarios(p: ReturnType<typeof e401>, desde: PlainDate, hasta: PlainDate) {
  for (let f = desde; f < hasta; f = sumarDias(f, 1)) {
    registrarMovimiento(p.ctx, {
      tipo: 'gasto',
      categoria: 'antojos',
      origenId: p.efectivo,
      monto: 3_000,
      fecha: f,
    });
  }
}

/** e4-01 con 20 días de gastos y las quincenas del 15 y del 30 recibidas; hoy, 31 oct. */
function conHistorial() {
  const p = e401();
  gastosDiarios(p, '2026-10-11', '2026-10-31');
  for (const fecha of ['2026-10-15', '2026-10-30']) {
    p.reloj.fijar(fecha);
    obtenerHoy(p.ctx);
    confirmarIngresoRecibido(p.ctx, { programadoId: p.e.ingresoId as string, fecha, destinoId: p.bbva });
  }
  p.reloj.fijar('2026-10-31');
  return p;
}

describe('¿Me alcanza?', () => {
  it('el formulario vacío muestra título y chips con copy de textos.ts', () => {
    const p = e401();
    montar(p.ctx, <PantallaMeAlcanza calcular={jest.fn()} alCerrar={jest.fn()} />);
    expect(screen.getByRole('header', { name: TITULO })).toBeTruthy();
    expect(screen.getByLabelText(PREGUNTA_MSI)).toBeTruthy();
    expect(screen.getByTestId('me-alcanza-meses-6')).toBeTruthy();
    expect(screen.getByRole('button', { name: etiquetaHablada(BTN_CALCULAR) })).toBeTruthy();
  });

  it('CA-M6-03 · con el resultado de E8-22 muestra "< 1 %", "89 %", "79 %", "90 %" y la recomendación', async () => {
    const p = e401();
    montar(
      p.ctx,
      <PantallaMeAlcanza
        consultaInicial={{ precio: 150_000, descripcion: 'unos tenis' }}
        calcular={inyectar(vistaE822())}
        alCerrar={jest.fn()}
      />,
    );
    await screen.findByTestId('me-alcanza-resultado');
    expect(textoDe('me-alcanza-titulo')).toBe('Unos tenis de $1,500');
    expect(textoDe('me-alcanza-frase')).toBe('Puedes. Lo más seguro: a 3 MSI con la Oro');
    expect(textoDe('porcentaje-contado_hoy')).toBe('< 1 %');
    expect(textoDe('porcentaje-msi')).toBe('89 %');
    expect(textoDe('porcentaje-esperar')).toBe('79 %');
    expect(textoDe('porcentaje-base')).toBe('90 %');
    expect(textoDe('etiqueta-msi')).toBe('A 3 MSI con la Oro');
    expect(textoDe('etiqueta-esperar')).toBe('El jue 15, con tu quincena');
    expect(textoDe('etiqueta-base')).toBe('Sin comprarlos');
    expect(screen.getByLabelText(`A 3 MSI con la Oro: 89 %${SUFIJO_ACCESIBILIDAD_RECOMENDADA}`)).toBeTruthy();
    expect(screen.getByTestId('etiqueta-msi')).toHaveProp('importantForAccessibility', 'no');
    expect(screen.getByTestId('porcentaje-msi')).toHaveProp('importantForAccessibility', 'no');
    // La recomendada se marca con texto, no solo con color (`02 §15`).
    expect(screen.getByText(ETIQUETA_OPCION_RECOMENDADA)).toBeTruthy();
    expect(screen.getByTestId('recomendado-msi')).toBeTruthy();
    expect(screen.queryByTestId('recomendado-contado_hoy')).toBeNull();
    expect(screen.getByText('Te quedas corto antes del jueves')).toBeTruthy();
    expect(screen.getByText('Comprometes $500 al mes hasta enero')).toBeTruthy();
    // "Sin comprar" no se puede "comprar".
    expect(screen.getByTestId('lo-compre-msi')).toBeTruthy();
    expect(screen.getByTestId('lo-compre-contado_hoy')).toBeTruthy();
    expect(screen.getByRole('button', { name: BTN_COMO_LO_CALCULE })).toBeTruthy();
    expect(screen.getByTestId('boton-otra-cuenta')).toHaveProp('accessibilityHint', PISTA_HACER_OTRA_CUENTA);
    expect(screen.queryByTestId('lo-compre-base')).toBeNull();
    expect(screen.queryByTestId('me-alcanza-etiqueta')).toBeNull(); // 92 días de historial
    // Texto fijo de `08 §1`.
    expect(textoDe('me-alcanza-no-asesoria')).toMatch(
      /^Finanvoz no es una institución financiera ni asesor de inversiones\./,
    );

    // "Cómo lo calculé" se despliega con las líneas de servicios.
    expect(screen.queryByTestId('como-lo-calcule')).toBeNull();
    expect(screen.getByTestId('boton-como-lo-calcule')).toHaveProp(
      'accessibilityHint',
      PISTA_MOSTRAR_COMO_LO_CALCULE,
    );
    fireEvent.press(screen.getByTestId('boton-como-lo-calcule'));
    expect(screen.getByTestId('boton-como-lo-calcule')).toHaveProp(
      'accessibilityHint',
      PISTA_OCULTAR_COMO_LO_CALCULE,
    );
    const calculo = screen.getByTestId('como-lo-calcule');
    expect(
      within(calculo).getByText(
        'Revisé 127 días, del 11 oct al 14 feb, para que todas las opciones incluyan sus pagos.',
      ),
    ).toBeTruthy();
    expect(
      within(calculo).getByText('Hice 5,000 simulaciones por opción con tus últimos 92 días de gastos.'),
    ).toBeTruthy();
  });

  it('"Recuérdamelo el jueves" pide el permiso y programa un aviso local sin montos', async () => {
    const p = e401();
    const notificaciones = notificacionesEnMemoria('sin_preguntar');
    montar(
      p.ctx,
      <PantallaMeAlcanza
        consultaInicial={{ precio: 150_000, descripcion: 'unos tenis' }}
        calcular={inyectar(vistaE822())}
        alCerrar={jest.fn()}
      />,
      { notificaciones },
    );
    await screen.findByTestId('me-alcanza-resultado');
    fireEvent.press(screen.getByTestId('boton-recuerdamelo'));
    await screen.findByTestId('recordatorio-programado');
    expect(textoDe('recordatorio-programado')).toBe(TEXTO_RECORDATORIO_PROGRAMADO);
    expect(notificaciones.vecesPedido()).toBe(1);
    const lista = notificaciones.puerto.lista();
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ id: 'me-alcanza:2026-10-15', fecha: '2026-10-15', hora: '09:00' });
    expect(lista[0]?.cuerpo).toContain('unos tenis');
    expect(`${lista[0]?.titulo} ${lista[0]?.cuerpo}`).not.toMatch(/\$|\d{3}/);
    expect(screen.queryByTestId('boton-recuerdamelo')).toBeNull();
  });

  it('sin permiso de avisos explica qué hacer y no programa nada', async () => {
    const p = e401();
    const notificaciones = notificacionesEnMemoria('denegado');
    montar(
      p.ctx,
      <PantallaMeAlcanza
        consultaInicial={{ precio: 150_000 }}
        calcular={inyectar(vistaE822())}
        alCerrar={jest.fn()}
      />,
      { notificaciones },
    );
    fireEvent.press(await screen.findByTestId('boton-recuerdamelo'));
    expect(await screen.findByTestId('recordatorio-mensaje')).toBeTruthy();
    expect(textoDe('recordatorio-mensaje')).toBe(MENSAJE_PERMISO_AVISOS);
    expect(notificaciones.puerto.lista()).toHaveLength(0);
  });

  it('CA-M6-08 · las notas uso_alto y sin_tarjeta_para_msi salen en pantalla con el texto de 02 §9', async () => {
    const p = e401();
    const { unmount } = montar(
      p.ctx,
      <PantallaMeAlcanza
        consultaInicial={{ precio: 150_000 }}
        calcular={inyectar(vistaE823('E8-23b'))}
        alCerrar={jest.fn()}
      />,
    );
    await screen.findByTestId('me-alcanza-resultado');
    expect(textoDe('nota-uso_alto')).toBe('Con la Oro quedarías en 44 % de uso.');
    expect(screen.queryByTestId('nota-sin_tarjeta_para_msi')).toBeNull();
    unmount();

    montar(
      p.ctx,
      <PantallaMeAlcanza
        consultaInicial={{ precio: 150_000 }}
        calcular={inyectar(vistaE823('E8-23e'))}
        alCerrar={jest.fn()}
      />,
    );
    await screen.findByTestId('me-alcanza-resultado');
    expect(textoDe('nota-sin_tarjeta_para_msi')).toBe(TEXTO_SIN_TARJETA_PARA_MSI);
    expect(textoDe('nota-sin_tarjeta_para_msi')).toBe(
      'No muestro meses: ninguna de tus tarjetas que pagas completa tiene crédito disponible para esta compra.',
    );
    expect(screen.queryByTestId('escenario-msi')).toBeNull();
  });

  it('"Lo compré" a meses crea el plan sobre el libro real y "Deshacer" lo quita', async () => {
    const p = conHistorial();
    montar(
      p.ctx,
      <PantallaMeAlcanza
        consultaInicial={{ precio: 150_000, descripcion: 'unos tenis' }}
        bloques={{ ...sinEspera, tamanoBloque: 5000 }}
        alCerrar={jest.fn()}
      />,
    );
    await screen.findByTestId('me-alcanza-resultado', {}, { timeout: 20000 });
    expect(textoDe('etiqueta-msi')).toBe('A 3 MSI con la Nu');
    expect(textoDe('me-alcanza-etiqueta')).toBe('estimación inicial');

    fireEvent.press(screen.getByTestId('lo-compre-msi'));
    expect(listarPlanesMsi(p.ctx, p.nu)).toHaveLength(1);
    expect(listarPlanesMsi(p.ctx, p.nu)[0]).toMatchObject({ monto: 150_000, meses: 3 });
    expect(screen.getByTestId('comprado-msi')).toBeTruthy();
    // Una sola compra: las demás opciones ya no ofrecen "Lo compré".
    expect(screen.queryByTestId('lo-compre-contado_hoy')).toBeNull();
    const aviso = screen.getByTestId('aviso');
    expect(within(aviso).getByRole('text').props.accessibilityLabel).toMatch(/Unos tenis/);

    fireEvent.press(within(aviso).getByRole('button', { name: BTN_DESHACER }));
    expect(listarPlanesMsi(p.ctx, p.nu)).toHaveLength(0);
    expect(screen.getByTestId('lo-compre-msi')).toBeTruthy();

    // De contado: un gasto de hoy "por asignar"; "Deshacer" lo anula.
    const antes = listarMovimientos(p.ctx).flatMap((d) => d.movimientos).length;
    fireEvent.press(screen.getByTestId('lo-compre-contado_hoy'));
    expect(
      within(screen.getByTestId('aviso')).getByLabelText(
        etiquetaHablada('Registré: Unos tenis de $1,500 · por asignar'),
      ),
    ).toBeTruthy();
    expect(listarMovimientos(p.ctx).flatMap((d) => d.movimientos)).toHaveLength(antes + 1);
    fireEvent.press(within(screen.getByTestId('aviso')).getByRole('button', { name: BTN_DESHACER }));
    expect(listarMovimientos(p.ctx).flatMap((d) => d.movimientos)).toHaveLength(antes);
  });

  it('se puede cancelar mientras calcula y vuelve al formulario con los datos', async () => {
    const p = conHistorial();
    const pendientes: (() => void)[] = [];
    montar(
      p.ctx,
      <PantallaMeAlcanza
        consultaInicial={{ precio: 150_000, descripcion: 'unos tenis' }}
        bloques={{ ceder: () => new Promise<void>((r) => pendientes.push(r)) }}
        alCerrar={jest.fn()}
      />,
    );
    expect(screen.getByTestId('me-alcanza-calculando')).toBeTruthy();
    // Primer bloque hecho: el cálculo espera para ceder el hilo.
    await waitFor(() => expect(pendientes.length).toBeGreaterThan(0));
    await waitFor(() =>
      expect(screen.getByTestId('me-alcanza-progreso').props.accessibilityLabel).toBe(ETIQUETA_PROGRESO),
    );
    expect(screen.getByTestId('boton-cancelar-me-alcanza')).toHaveProp('accessibilityHint', PISTA_CANCELAR);
    fireEvent.press(screen.getByTestId('boton-cancelar-me-alcanza'));
    expect(textoDe('me-alcanza-aviso')).toBe(MENSAJE_CANCELADO);
    expect(screen.getByTestId('me-alcanza-aviso')).toHaveProp('accessibilityRole', 'alert');
    expect(screen.getByTestId('me-alcanza-formulario')).toBeTruthy();
    // Al soltar el bloque pendiente, el cálculo ve la cancelación y no pinta nada.
    await act(async () => {
      for (const r of pendientes.splice(0)) r();
    });
    expect(screen.queryByTestId('me-alcanza-resultado')).toBeNull();
    expect(screen.queryByTestId('me-alcanza-fallo')).toBeNull();
    expect(screen.getByTestId('me-alcanza-formulario')).toBeTruthy();
  });

  it('TalkBack en cabecera y acciones del formulario (`02 §19`)', () => {
    const p = e401();
    montar(p.ctx, <PantallaMeAlcanza alCerrar={jest.fn()} />);
    expect(screen.getByTestId('me-alcanza-encabezado')).toHaveProp('accessibilityRole', 'header');
    expect(screen.getByTestId('boton-cerrar-me-alcanza')).toHaveProp('accessibilityLabel', ACCESIBILIDAD_CERRAR);
    expect(screen.getByTestId('boton-calcular-me-alcanza')).toHaveProp('accessibilityHint', PISTA_CALCULAR);
  });

  it('el formulario valida el precio y calcula con lo escrito', async () => {
    const p = e401();
    const vista = vistaE822();
    const calcular = jest.fn<ReturnType<CalcularMeAlcanza>, Parameters<CalcularMeAlcanza>>(async () => vista);
    montar(p.ctx, <PantallaMeAlcanza calcular={calcular} alCerrar={jest.fn()} />);
    fireEvent.press(screen.getByTestId('boton-calcular-me-alcanza'));
    expect(textoDe('error-formulario')).toBe(ERROR_PRECIO);
    expect(calcular).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByTestId('me-alcanza-precio'), '1,500');
    fireEvent.changeText(screen.getByTestId('me-alcanza-descripcion'), 'unos tenis');
    fireEvent.press(screen.getByTestId('me-alcanza-meses-6'));
    fireEvent.press(screen.getByTestId('boton-calcular-me-alcanza'));
    await screen.findByTestId('me-alcanza-resultado');
    expect(calcular.mock.calls[0]?.[1]).toEqual({ precio: 150_000, descripcion: 'unos tenis', meses: 6 });
  });

  it('con menos de 2 semanas de gastos pide más datos', async () => {
    const p = e401();
    montar(
      p.ctx,
      <PantallaMeAlcanza consultaInicial={{ precio: 150_000 }} bloques={sinEspera} alCerrar={jest.fn()} />,
    );
    await screen.findByTestId('me-alcanza-datos-insuficientes');
    expect(textoDe('me-alcanza-mensaje')).toBe(MENSAJE_DATOS_INSUFICIENTES);
    expect(textoDe('me-alcanza-datos-ayuda')).toBe(AYUDA_DATOS_INSUFICIENTES);
    expect(screen.getByTestId('me-alcanza-datos-ayuda').props.accessibilityLabel).toBe(
      etiquetaVacioDatosInsuficientes(),
    );
    expect(screen.getByText('Una compra de $1,500')).toBeTruthy();
    expect(screen.getByTestId('boton-listo-datos-insuficientes')).toHaveProp(
      'accessibilityLabel',
      ACCESIBILIDAD_LISTO,
    );
    expect(screen.getByTestId('boton-listo-datos-insuficientes')).toHaveProp('accessibilityHint', PISTA_LISTO);
  });

  it('si el cálculo falla, muestra el error y permite reintentar', async () => {
    const p = e401();
    const calcular = jest.fn<ReturnType<CalcularMeAlcanza>, Parameters<CalcularMeAlcanza>>(async () => {
      throw new Error('fallo simulado');
    });
    montar(
      p.ctx,
      <PantallaMeAlcanza
        consultaInicial={{ precio: 150_000 }}
        calcular={calcular}
        bloques={sinEspera}
        alCerrar={jest.fn()}
      />,
    );
    await screen.findByTestId('me-alcanza-fallo');
    expect(textoDe('me-alcanza-error-calculo')).toBe(ERROR_CALCULO);
    expect(screen.getByTestId('boton-reintentar-me-alcanza')).toHaveProp(
      'accessibilityHint',
      PISTA_REINTENTAR_ME_ALCANZA,
    );
    expect(screen.getByTestId('boton-cambiar-datos-me-alcanza')).toHaveProp(
      'accessibilityHint',
      PISTA_CAMBIAR_DATOS_ME_ALCANZA,
    );
    fireEvent.press(screen.getByTestId('boton-reintentar-me-alcanza'));
    await waitFor(() => expect(calcular).toHaveBeenCalledTimes(2));
  });

  it('"¿me alcanza para unos tenis de 1500?" escrito en Hoy abre "¿Me alcanza?" con la consulta en memoria', async () => {
    const p = e401();
    const frase = '¿me alcanza para unos tenis de 1500?';
    const nube = nubeFalsa({
      [frase]: { intencion: 'simular', compra: { precio: 150_000, descripcion: 'unos tenis' } },
    });
    const alAbrirMeAlcanza = jest.fn();
    montar(
      p.ctx,
      <PantallaHoy navegacion={{ ...navegacionFalsa(), alAbrirMeAlcanza }} motor={crearMotorFalso().motor} />,
      { nube: nube.nube },
    );
    // El botón de Hoy abre el formulario vacío.
    fireEvent.press(screen.getByTestId('boton-me-alcanza'));
    expect(alAbrirMeAlcanza).toHaveBeenLastCalledWith();

    fireEvent.press(screen.getByTestId('boton-escribir'));
    fireEvent.changeText(screen.getByTestId('campo-registrar'), frase);
    fireEvent.press(screen.getByTestId('boton-enviar-registro'));
    await waitFor(() => expect(alAbrirMeAlcanza).toHaveBeenCalledTimes(2));
    const consulta = alAbrirMeAlcanza.mock.calls[1]?.[0];
    expect(consulta).toEqual({ precio: 150_000, descripcion: 'unos tenis' });

    // La ruta lleva solo `/me-alcanza`; el monto va en memoria y se toma una sola vez (regla 9).
    const push = jest.fn();
    abrirMeAlcanza({ push }, consulta);
    expect(push).toHaveBeenCalledWith('/me-alcanza');
    const tomada = tomarConsultaPendiente();
    expect(tomada).toEqual(consulta);
    expect(tomarConsultaPendiente()).toBeNull();
  });
});

describe('Hoy · probabilidad de llegar', () => {
  const hoy = () => <PantallaHoy navegacion={navegacionFalsa()} motor={crearMotorFalso().motor} />;

  it('CA-M6-05 · con 13 días dice "Necesito 2 semanas…"; con 20, la etiqueta "estimación inicial"', async () => {
    const p = e401();
    activarPlus(p.ctx); // la probabilidad es de Plus (M7)
    gastosDiarios(p, '2026-10-11', '2026-11-25');
    p.reloj.fijar('2026-10-24');
    const { unmount } = montar(p.ctx, hoy());
    // Se sabe sin calcular: se pinta de inmediato.
    expect(textoDe('probabilidad-mensaje')).toBe('Necesito 2 semanas de tus gastos para estimar si llegas.');
    expect(screen.queryByTestId('probabilidad-texto')).toBeNull();
    unmount();

    p.reloj.fijar('2026-10-31');
    const segunda = montar(p.ctx, hoy());
    // Sin caché se calcula por bloques en segundo plano con un indicador discreto.
    expect(screen.getByTestId('probabilidad-calculando')).toBeTruthy();
    expect(screen.getByTestId('hoy-puedes')).toBeTruthy();
    await screen.findByTestId('probabilidad-texto', {}, { timeout: 20000 });
    expect(textoDe('probabilidad-etiqueta')).toBe('estimación inicial');
    expect(textoDe('probabilidad-texto')).toMatch(/^(< 1|> 99|\d{1,2}) % de llegar sin tocar tu colchón$/);
    const texto = textoDe('probabilidad-texto');
    const etiqueta = textoDe('probabilidad-etiqueta');
    expect(screen.getByTestId('probabilidad-barra').props.accessibilityLabel).toBe(`${texto}. ${etiqueta}`);
    expect(screen.getByTestId('probabilidad-texto')).toHaveProp('importantForAccessibility', 'no');
    segunda.unmount();

    // CA-M6-06 en pantalla: al volver a abrir Hoy el mismo día sale lo mismo, al instante.
    montar(p.ctx, hoy());
    expect(screen.queryByTestId('probabilidad-calculando')).toBeNull();
    expect(textoDe('probabilidad-texto')).toBe(texto);
  });

  it('sin ingreso configurado no muestra probabilidad', () => {
    // e4-01 sin ingreso.
    const otra = conEscenarioSinIngreso();
    montar(otra.ctx, hoy());
    expect(screen.getByTestId('boton-configurar-ingreso')).toBeTruthy();
    expect(screen.queryByTestId('probabilidad-mensaje')).toBeNull();
    expect(screen.queryByTestId('probabilidad-calculando')).toBeNull();
    expect(screen.queryByTestId('probabilidad-texto')).toBeNull();
  });
});

function idMovimientoConDescripcion(p: ReturnType<typeof e401>, descripcion: string): string {
  const m = listarMovimientos(p.ctx)
    .flatMap((d) => d.movimientos)
    .find((x) => x.descripcion === descripcion);
  if (!m) throw new Error(`sin movimiento: ${descripcion}`);
  return m.id;
}

describe('Movimientos · "Fue algo extraordinario"', () => {
  it('lo saca de la estimación con "Deshacer"', () => {
    const p = e401();
    registrarMovimiento(p.ctx, {
      tipo: 'gasto',
      categoria: 'antojos',
      origenId: p.efectivo,
      monto: 250_000,
      fecha: '2026-10-11',
      descripcion: 'la boda',
    });
    const id = idMovimientoConDescripcion(p, 'la boda');
    montar(p.ctx, <PantallaMovimientos alRegistrar={jest.fn()} />);
    fireEvent.press(screen.getByTestId(`movimiento-${id}`));
    fireEvent.press(screen.getByTestId('boton-extraordinario'));
    const aviso = screen.getByTestId('aviso');
    expect(
      within(aviso).getByLabelText(
        etiquetaHablada('Listo: no lo uso para estimar tus gastos de cada día.'),
      ),
    ).toBeTruthy();
    fireEvent.press(within(aviso).getByRole('button', { name: BTN_DESHACER }));
    expect(screen.queryByTestId('aviso')).toBeNull();
  });

  it('ya marcado, lo dice y ofrece "Volver a contarlo"', () => {
    const p = e401();
    registrarMovimiento(p.ctx, {
      tipo: 'gasto',
      categoria: 'antojos',
      origenId: p.efectivo,
      monto: 250_000,
      fecha: '2026-10-11',
      descripcion: 'la boda',
    });
    const id = idMovimientoConDescripcion(p, 'la boda');
    montar(p.ctx, <PantallaMovimientos alRegistrar={jest.fn()} />);
    fireEvent.press(screen.getByTestId(`movimiento-${id}`));
    fireEvent.press(screen.getByTestId('boton-extraordinario'));
    expect(screen.getByTestId('nota-extraordinario')).toBeTruthy();
    expect(screen.queryByTestId('boton-extraordinario')).toBeNull();
    fireEvent.press(screen.getByTestId('boton-volver-a-contar'));
    expect(
      within(screen.getByTestId('aviso')).getByLabelText(
        etiquetaHablada('Listo: vuelvo a contarlo para estimar tus gastos de cada día.'),
      ),
    ).toBeTruthy();
    expect(screen.queryByTestId('nota-extraordinario')).toBeNull();
    expect(screen.getByTestId('boton-extraordinario')).toBeTruthy();
  });
});

function conEscenarioSinIngreso() {
  const p = abrirPruebaPantalla();
  const e = cargarEscenario(p.ctx, { ...(escenario('e4-01') as object), ingreso: undefined });
  p.reloj.fijar(e.hoy);
  return p;
}
