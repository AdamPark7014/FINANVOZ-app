import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import type { PlainDate } from '@cartera/core';
import {
  agregarCuenta,
  agregarPagoFijo,
  detalleTarjeta,
  listarOcurrencias,
  listarMovimientos,
  listarPagosPlaneados,
  listarPlanesMsi,
  listarTarjetas,
  obtenerHoy,
  registrarCompraMsi,
  registrarMovimiento,
  type Contexto,
  type NivelNube,
} from '../../servicios';
import { nubeFalsa } from '../../servicios/__pruebas__/nube';
import { ProveedorSesion } from '../../sesion/ProveedorSesion';
import { formatearCentavos } from '../../ui';
import { SeccionAvisos } from '../ajustes/SeccionAvisos';
import { reiniciarInvitacionAvisos } from '../avisos/InvitacionAvisos';
import {
  notificacionesEnMemoria,
  ProveedorNotificaciones,
  SincronizarAvisosTarjetas,
  type Notificaciones,
} from '../avisos/notificaciones';
import { crearMotorFalso, navegacionFalsa } from '../principal/__pruebas__/arnes';
import { activarPlus, conEscenario, golden, vector } from '../principal/__pruebas__/base';
import { PantallaCuentas } from '../principal/PantallaCuentas';
import { PantallaHoy } from '../principal/PantallaHoy';
import { PantallaMovimientos } from '../principal/PantallaMovimientos';
import { ProveedorAvisos } from '../principal/ProveedorAvisos';
import { PantallaTarjeta } from './PantallaTarjeta';
import {
  AYUDA_SALDO_A_FAVOR,
  BTN_AGREGAR_PAGO_PLANEADO,
  PISTA_VOLVER,
  ERROR_ORIGEN_PAGO,
  mensajePagoPlaneadoApartado,
  ACCESIBILIDAD_TARJETA_NO_ENCONTRADA,
  TEXTO_TARJETA_NO_ENCONTRADA,
  TITULO_CONFIRMAR_MSI,
  VACIO_MSI_TARJETA,
  VACIO_MOVIMIENTOS_TARJETA,
} from './textos';

const textoDe = (testID: string) => {
  const hijos = screen.getByTestId(testID).props.children as unknown;
  return Array.isArray(hijos) ? hijos.join('') : String(hijos);
};

/** Sesión real + aviso inferior + notificaciones en memoria (como la raíz y las pestañas). */
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

const hoy = () => <PantallaHoy navegacion={navegacionFalsa()} motor={crearMotorFalso().motor} />;

function e510() {
  const p = conEscenario('e5-10');
  const c = p.e.cuentas as Record<string, string>;
  return { ...p, oro: c.oro as string, nu: c.nu as string, efectivo: c.efectivo as string };
}

beforeEach(() => reiniciarInvitacionAvisos());

describe('Hoy', () => {
  it('CA-M4-03 · con la semilla e5-10 la tarjeta del día es "Banamex Oro ••8812" con 50 días', () => {
    const p = e510();
    activarPlus(p.ctx); // la tarjeta del día es de Plus (M7)
    montar(p.ctx, hoy());
    expect(textoDe('tarjeta-del-dia-texto')).toBe(
      'Si compras hoy, usa la Banamex Oro ••8812: tienes 50 días para pagar.',
    );
    expect(textoDe('tarjeta-del-dia-texto')).toBe(obtenerHoy(p.ctx).tarjetaDelDia?.texto);
  });

  it('con una sola tarjeta no hay tarjeta del día', () => {
    const p = conEscenario('e4-01');
    montar(p.ctx, hoy());
    expect(screen.queryByTestId('tarjeta-del-dia')).toBeNull();
  });

  it('pago de tarjeta que vence: "Todavía no" la pospone y "Ya la pagué" registra el pago con Deshacer', () => {
    const p = e510();
    p.reloj.fijar('2026-11-28');
    const vista = obtenerHoy(p.ctx);
    const [primera, segunda] = vista.tarjetasAccion;
    if (primera?.tipo !== 'pago_tarjeta' || segunda?.tipo !== 'pago_tarjeta') throw new Error('sin pagos');
    montar(p.ctx, hoy());
    const tarjeta0 = screen.getByTestId('tarjeta-accion-0');
    expect(within(tarjeta0).getByText(primera.texto)).toBeTruthy();
    expect(
      within(tarjeta0).getByText(`Paga ${formatearCentavos(primera.pngi)} para no generar intereses.`),
    ).toBeTruthy();

    fireEvent.press(screen.getByTestId('tarjeta-accion-0-todavia-no'));
    expect(screen.queryByText(primera.texto)).toBeNull();
    expect(screen.getByText('Lo sigo apartando. Te pregunto mañana.')).toBeTruthy();

    // Ahora la segunda tarjeta queda arriba: "Ya la pagué" pregunta la cuenta y registra el PNGI.
    expect(within(screen.getByTestId('tarjeta-accion-0')).getByText(segunda.texto)).toBeTruthy();
    fireEvent.press(screen.getByTestId('tarjeta-accion-0-ya-la-pague'));
    fireEvent.press(screen.getByTestId(`tarjeta-accion-0-pago-origen-${p.efectivo}`));
    fireEvent.press(screen.getByTestId('tarjeta-accion-0-pago-guardar'));
    const aviso = screen.getByTestId('aviso');
    expect(within(aviso).getByText(/^Registré: pago a tu .+ \$[\d,]+$/)).toBeTruthy();
    expect(screen.queryByText(segunda.texto)).toBeNull();
    expect(listarTarjetas(p.ctx).find((t) => t.id === segunda.tarjetaId)?.pngi).toBe(0);

    fireEvent.press(within(aviso).getByText('Deshacer'));
    expect(listarTarjetas(p.ctx).find((t) => t.id === segunda.tarjetaId)?.pngi).toBe(segunda.pngi);
  });
});

describe('Hoy · cobertura', () => {
  it('CA-M4-11 · un pago fijo con monto distinto pregunta "¿Este pago fue…?"; "Sí" lo cubre (E3-34)', () => {
    interface VectorCobertura {
      ocurrencia: { fecha: PlainDate; monto: number; categoria: string; variable: boolean };
      movimiento: { fecha: PlainDate; monto: number; categoria: string };
    }
    const v = vector<VectorCobertura>('E3-34');
    const p = e510();
    const bbva = agregarCuenta(p.ctx, { subtipo: 'debito', nombre: 'BBVA', saldo: 2_000_000 });
    const programadoId = agregarPagoFijo(p.ctx, {
      concepto: v.ocurrencia.categoria,
      monto: v.ocurrencia.monto,
      regla: { tipo: 'unica', fecha: v.ocurrencia.fecha },
      categoria: v.ocurrencia.categoria,
      variable: v.ocurrencia.variable,
    });
    obtenerHoy(p.ctx); // materializa
    registrarMovimiento(p.ctx, {
      tipo: 'gasto',
      monto: v.movimiento.monto,
      fecha: v.movimiento.fecha,
      categoria: v.movimiento.categoria,
      origenId: bbva,
    });
    const i = obtenerHoy(p.ctx).tarjetasAccion.findIndex((t) => t.tipo === 'confirmar_cobertura');
    expect(i).toBeGreaterThanOrEqual(0);
    montar(p.ctx, hoy());
    const tarjeta = screen.getByTestId(`tarjeta-accion-${i}`);
    expect(within(tarjeta).getByText('¿Este pago fue la vivienda?')).toBeTruthy();
    expect(within(tarjeta).getByText(/^Pagaste \$4,700; esperaba \$4,500 el .+\.$/)).toBeTruthy();
    fireEvent.press(within(tarjeta).getByTestId(`tarjeta-accion-${i}-si`));
    expect(screen.queryByText('¿Este pago fue la vivienda?')).toBeNull();
    expect(listarOcurrencias(p.ctx, { programadoId })[0]?.estado).toBe('cubierta');
  });
});

describe('Registrar', () => {
  it('CA-M4-06 · "compré una tele de 12 mil a 12 meses…" por texto: confirmación, plan con 12 meses visible en la tarjeta', async () => {
    const caso = golden('S01');
    const p = e510();
    activarPlus(p.ctx); // el compromiso de 12 meses es de Plus (M7)
    const f = nubeFalsa({ [caso.texto]: caso.esperado });
    montar(
      p.ctx,
      <>
        {hoy()}
        <PantallaTarjeta tarjetaId={p.oro} alVolver={jest.fn()} />
      </>,
      { nube: f.nube },
    );
    expect(
      within(screen.getByTestId('tarjeta-meses')).getByText('No tienes compras a meses en esta tarjeta.'),
    ).toBeTruthy();
    expect(screen.queryByTestId('compromiso-12-meses')).toBeNull();

    fireEvent.press(screen.getByTestId('boton-escribir'));
    fireEvent.changeText(screen.getByTestId('campo-registrar'), caso.texto);
    fireEvent.press(screen.getByTestId('boton-enviar-registro'));
    const tarjeta = await screen.findByTestId('confirmacion-msi');
    expect(within(tarjeta).getByText(TITULO_CONFIRMAR_MSI.monto_alto)).toBeTruthy();
    expect(within(tarjeta).getByText('Compra a 12 meses sin intereses')).toBeTruthy();
    expect(listarMovimientos(p.ctx)).toEqual([]);

    fireEvent.press(within(tarjeta).getByTestId('msi-categoria-hogar'));
    fireEvent.changeText(within(tarjeta).getByTestId('msi-descripcion'), 'tele');
    fireEvent.press(screen.getByTestId('boton-guardar-msi'));

    const aviso = screen.getByTestId('aviso');
    expect(
      within(aviso).getByText(
        'Registré: Tele $12,000 a 12 meses sin intereses · Banamex Oro ••8812\n12 meses de $1,000',
      ),
    ).toBeTruthy();
    expect(within(aviso).getByText('Deshacer')).toBeTruthy();

    // El plan en el detalle de la tarjeta: cuota, 12 cuotas restantes y los 12 meses de compromiso.
    const [plan] = listarPlanesMsi(p.ctx, p.oro);
    if (!plan) throw new Error('sin plan');
    expect(within(screen.getByTestId(`plan-${plan.id}`)).getByText('tele')).toBeTruthy();
    expect(textoDe(`plan-${plan.id}-cuotas`)).toBe('$1,000 al mes · faltan 12 de 12');
    const compromiso = screen.getByTestId('compromiso-12-meses');
    const meses = detalleTarjeta(p.ctx, p.oro).compromiso12Meses;
    expect(meses).toHaveLength(12);
    for (const m of meses) {
      expect(within(compromiso).getByTestId(`compromiso-${m.mes}`)).toBeTruthy();
      expect(textoDe(`compromiso-${m.mes}-monto`)).toBe(formatearCentavos(m.monto));
    }
    expect(textoDe('compromiso-2026-11-monto')).toBe('$1,000');
    expect(textoDe('tarjeta-deuda-meses')).toBe('De eso, $12,000 son meses sin intereses.');
    // El gasto completo una sola vez, en Hogar.
    expect(listarMovimientos(p.ctx).flatMap((d) => d.movimientos)).toEqual([
      expect.objectContaining({ tipo: 'compra_msi', monto: 1_200_000, categoria: 'Hogar' }),
    ]);

    // Deshacer: la compra y su plan desaparecen.
    fireEvent.press(within(aviso).getByText('Deshacer'));
    expect(screen.getByText('No tienes compras a meses en esta tarjeta.')).toBeTruthy();
    expect(screen.queryByTestId('compromiso-12-meses')).toBeNull();
  });

  it('CA-M4-06 · también dictado: al soltar llega la misma confirmación', async () => {
    const caso = golden('S01');
    const p = e510();
    const f = nubeFalsa({ [caso.texto]: caso.esperado });
    const { motor, emitir } = crearMotorFalso();
    montar(p.ctx, <PantallaHoy navegacion={navegacionFalsa()} motor={motor} />, { nube: f.nube });
    await act(async () => {
      fireEvent(screen.getByTestId('boton-hablar'), 'pressIn');
    });
    fireEvent(screen.getByTestId('boton-hablar'), 'pressOut');
    emitir({ tipo: 'resultado', texto: caso.texto, final: true });
    expect(await screen.findByTestId('confirmacion-msi')).toBeTruthy();
  });

  it('"mi Nu corta el 28 y pago el 18" cambia el ciclo con Deshacer; una tarjeta que no existe abre el formulario prellenado', async () => {
    const k01 = golden('K01');
    const k05 = golden('K05');
    const p = conEscenario('e4-01');
    const nu = p.e.cuentas.nu as string;
    const f = nubeFalsa({ [k01.texto]: k01.esperado, [k05.texto]: k05.esperado });
    montar(p.ctx, hoy(), { nube: f.nube });
    fireEvent.press(screen.getByTestId('boton-escribir'));
    fireEvent.changeText(screen.getByTestId('campo-registrar'), k01.texto);
    fireEvent.press(screen.getByTestId('boton-enviar-registro'));
    expect(await screen.findByText(/^Listo: tu Nu ••4410 corta el 28 y pagas el 18\.$/)).toBeTruthy();
    expect(detalleTarjeta(p.ctx, nu).ciclo).toEqual({ diaCorte: 28, diaLimitePago: 18 });

    fireEvent.changeText(screen.getByTestId('campo-registrar'), k05.texto);
    fireEvent.press(screen.getByTestId('boton-enviar-registro'));
    const tarjeta = await screen.findByTestId('tarjeta-por-agregar');
    expect(within(tarjeta).getByText('No tengo una tarjeta «oro». ¿La agrego?')).toBeTruthy();
    expect(screen.getByTestId('tarjeta-nombre').props.value).toBe('Oro');
    expect(screen.getByTestId('tarjeta-corte').props.value).toBe('10');
    expect(screen.getByTestId('tarjeta-limite-pago').props.value).toBe('20');
    expect(screen.getByTestId('tarjeta-modo-limite-dias').props.accessibilityState).toMatchObject({
      selected: true,
    });
    // Sin saldo no se agrega.
    fireEvent.changeText(screen.getByTestId('tarjeta-limite-credito'), '30,000');
    fireEvent.press(screen.getByTestId('tarjeta-completa-si'));
    fireEvent.press(screen.getByTestId('tarjeta-guardar'));
    expect(
      screen.getByText('Escribe cuánto debes hoy. Si no lo tienes a la mano, agrégala después.'),
    ).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('tarjeta-saldo'), '1,200');
    fireEvent.press(screen.getByTestId('tarjeta-guardar'));
    expect(screen.queryByTestId('tarjeta-por-agregar')).toBeNull();
    expect(screen.getByText('Listo: agregué tu tarjeta.')).toBeTruthy();
    expect(listarTarjetas(p.ctx).find((t) => t.nombre === 'Oro')).toMatchObject({ saldoRevolvente: 120_000 });
  });
});

describe('Tarjetas', () => {
  it('TalkBack: volver regresa a Cuentas', () => {
    const p = conEscenario('e4-01');
    montar(p.ctx, <PantallaTarjeta tarjetaId={p.e.cuentas.nu as string} alVolver={jest.fn()} />);
    expect(screen.getByTestId('tarjeta-volver')).toHaveProp('accessibilityHint', PISTA_VOLVER);
  });

  it('tarjeta inexistente: volver usa la misma pista TalkBack', () => {
    const p = conEscenario('e4-01');
    montar(p.ctx, <PantallaTarjeta tarjetaId="contraparte:tarjeta:inexistente" alVolver={jest.fn()} />);
    expect(screen.getByTestId('tarjeta-no-encontrada')).toHaveTextContent(TEXTO_TARJETA_NO_ENCONTRADA);
    expect(screen.getByTestId('tarjeta-no-encontrada')).toHaveProp(
      'accessibilityLabel',
      ACCESIBILIDAD_TARJETA_NO_ENCONTRADA,
    );
    expect(screen.getByTestId('tarjeta-volver')).toHaveProp('accessibilityHint', PISTA_VOLVER);
  });

  it('sin MSI ni movimientos muestra el copy vacío de textos.ts', () => {
    const p = conEscenario('e4-01');
    const nu = p.e.cuentas.nu as string;
    montar(p.ctx, <PantallaTarjeta tarjetaId={nu} alVolver={jest.fn()} />);
    expect(screen.getByTestId('tarjeta-meses-vacio')).toHaveTextContent(VACIO_MSI_TARJETA);
    expect(screen.getByTestId('tarjeta-movimientos-vacio')).toHaveTextContent(VACIO_MOVIMIENTOS_TARJETA);
    expect(screen.getByTestId('tarjeta-nombre')).toHaveProp('accessibilityRole', 'header');
  });

  it('resumen expone filas Dato con etiqueta accesible', () => {
    const p = e510();
    const t = listarTarjetas(p.ctx).find((x) => x.id === p.oro);
    montar(p.ctx, <PantallaTarjeta tarjetaId={p.oro} alVolver={jest.fn()} />);
    expect(screen.getByLabelText(`Fecha límite: ${t?.etiquetaFechaLimite}`)).toBeTruthy();
  });

  it('Cuentas lleva al detalle y muestra uso, fecha límite y próximo corte', () => {
    const p = e510();
    const alAbrirTarjeta = jest.fn();
    montar(p.ctx, <PantallaCuentas alAbrirAjustes={jest.fn()} alAbrirTarjeta={alAbrirTarjeta} />);
    const t = listarTarjetas(p.ctx).find((x) => x.id === p.oro);
    expect(textoDe(`cuenta-${p.oro}-limite-pago`)).toBe(
      `Fecha límite: ${t?.etiquetaFechaLimite} · próximo corte: ${t?.etiquetaProximoCorte}`,
    );
    fireEvent.press(screen.getByTestId(`cuenta-${p.oro}`));
    expect(alAbrirTarjeta).toHaveBeenCalledWith(p.oro);

    montar(p.ctx, <PantallaTarjeta tarjetaId={p.oro} alVolver={jest.fn()} />);
    expect(textoDe('tarjeta-deuda')).toBe('$1,200');
    expect(textoDe('tarjeta-fecha-limite')).toBe(t?.etiquetaFechaLimite);
    expect(textoDe('tarjeta-proximo-corte')).toBe(t?.etiquetaProximoCorte);
    expect(textoDe('tarjeta-disponible')).toBe('$28,800');
    expect(textoDe('tarjeta-uso')).toBe('Usas 4 % de tu límite de $30,000. La marca es el 30 %.');
    expect(screen.getByTestId('tarjeta-sin-corte')).toBeTruthy();
  });

  it('Pagar desde el detalle (cuenta de origen) y Deshacer devuelve la deuda', () => {
    const p = e510();
    montar(p.ctx, <PantallaTarjeta tarjetaId={p.oro} alVolver={jest.fn()} />);
    fireEvent.press(screen.getByTestId('tarjeta-pagar'));
    expect(screen.getByTestId('pagar-monto').props.value).toBe('1,200');
    fireEvent.press(screen.getByTestId('pagar-guardar'));
    expect(screen.getByText(ERROR_ORIGEN_PAGO)).toBeTruthy();
    fireEvent.press(screen.getByTestId(`pagar-origen-${p.efectivo}`));
    fireEvent.press(screen.getByTestId('pagar-guardar'));
    const aviso = screen.getByTestId('aviso');
    expect(within(aviso).getByText('Registré: pago a tu Banamex Oro ••8812 $1,200')).toBeTruthy();
    expect(textoDe('tarjeta-deuda')).toBe('$0');
    fireEvent.press(within(aviso).getByText('Deshacer'));
    expect(textoDe('tarjeta-deuda')).toBe('$1,200');
  });

  it('CA-M4-10 · un pago que deja saldo a favor con meses pregunta si fue para liquidarlos; "Sí, la tele" los liquida', () => {
    const p = e510();
    const bbva = agregarCuenta(p.ctx, { subtipo: 'debito', nombre: 'BBVA', saldo: 2_000_000 });
    const tele = registrarCompraMsi(p.ctx, {
      tarjetaId: p.oro,
      monto: 600_000,
      meses: 6,
      categoria: 'hogar',
      descripcion: 'la tele',
    });
    montar(
      p.ctx,
      <>
        {hoy()}
        <PantallaTarjeta tarjetaId={p.oro} alVolver={jest.fn()} />
      </>,
    );
    const antes = obtenerHoy(p.ctx).hoyPuedesCentavos;
    fireEvent.press(screen.getByTestId('tarjeta-pagar'));
    fireEvent.changeText(screen.getByTestId('pagar-monto'), '7,000');
    fireEvent.press(screen.getByTestId(`pagar-origen-${bbva}`));
    fireEvent.press(screen.getByTestId('pagar-guardar'));

    // Saldo a favor visible pero nunca como dinero para gastar (E4-07).
    const aFavor = screen.getByTestId('tarjeta-saldo-a-favor');
    expect(within(aFavor).getByText('$5,800')).toBeTruthy();
    expect(
      within(aFavor).getByText(
        'No se suma a tu dinero libre: se usa en tus próximas compras con esta tarjeta.',
      ),
    ).toBeTruthy();
    expect(obtenerHoy(p.ctx).hoyPuedesCentavos).toBeLessThanOrEqual(antes);
    expect(textoDe('hoy-puedes')).toBe(formatearCentavos(obtenerHoy(p.ctx).hoyPuedesCentavos, 'pesos'));

    // La pregunta sale en Hoy (tarjeta de acción) y en el detalle.
    const pregunta = screen.getByTestId('tarjeta-accion-0');
    expect(within(pregunta).getByText('¿Este pago fue para liquidar tus meses?')).toBeTruthy();
    expect(screen.getByTestId('tarjeta-pregunta-liquidar')).toBeTruthy();
    expect(within(pregunta).getByText('Sí, la tele')).toBeTruthy();
    expect(within(pregunta).getByText('No')).toBeTruthy();

    fireEvent.press(within(pregunta).getByTestId(`tarjeta-accion-0-si-${tele.planId}`));
    expect(listarPlanesMsi(p.ctx, p.oro)[0]).toMatchObject({ estado: 'liquidado', cuotasRestantes: 0 });
    expect(screen.queryByText('¿Este pago fue para liquidar tus meses?')).toBeNull();
    expect(textoDe(`plan-${tele.planId}-estado`)).toBe('Ya lo terminaste de pagar');
    expect(screen.queryByTestId('compromiso-12-meses')).toBeNull();
    expect(screen.getByText('Listo: liquidaste la tele ($6,000).')).toBeTruthy();
    expect(obtenerHoy(p.ctx).hoyPuedesCentavos).toBeLessThanOrEqual(antes);
  });

  it('Liquidar meses desde el detalle pide confirmación', () => {
    const p = e510();
    const tele = registrarCompraMsi(p.ctx, {
      tarjetaId: p.oro,
      monto: 600_000,
      meses: 6,
      descripcion: 'tele',
    });
    montar(p.ctx, <PantallaTarjeta tarjetaId={p.oro} alVolver={jest.fn()} />);
    fireEvent.press(screen.getByTestId(`plan-${tele.planId}-liquidar`));
    expect(
      screen.getByText('¿Liquidar tele? Lo que falta, $6,000, pasa a tu próximo pago de la tarjeta.'),
    ).toBeTruthy();
    fireEvent.press(screen.getByTestId(`plan-${tele.planId}-confirmar-liquidar`));
    expect(textoDe(`plan-${tele.planId}-estado`)).toBe('Ya lo terminaste de pagar');
    fireEvent.press(within(screen.getByTestId('aviso')).getByText('Deshacer'));
    expect(textoDe(`plan-${tele.planId}-cuotas`)).toBe('$1,000 al mes · faltan 6 de 6');
  });

  it('Editar tarjeta: el ciclo nuevo se guarda con Deshacer; en modo plan se manejan pagos planeados', () => {
    const p = e510();
    montar(p.ctx, <PantallaTarjeta tarjetaId={p.oro} alVolver={jest.fn()} />);
    expect(screen.getByText('Corta el 10 y tienes 20 días para pagar.')).toBeTruthy();
    fireEvent.press(screen.getByTestId('tarjeta-editar'));
    expect(screen.getByTestId('editar-corte').props.value).toBe('10');
    fireEvent.changeText(screen.getByTestId('editar-corte'), '15');
    fireEvent.press(screen.getByTestId('editar-guardar'));
    expect(screen.getByText('Corta el 15 y tienes 20 días para pagar.')).toBeTruthy();
    expect(detalleTarjeta(p.ctx, p.oro).ciclo).toEqual({ diaCorte: 15, diasParaPagar: 20 });
    const aviso = screen.getByTestId('aviso');
    expect(within(aviso).getByText('Guardé los cambios de tu Banamex Oro ••8812.')).toBeTruthy();
    fireEvent.press(within(aviso).getByText('Deshacer'));
    expect(screen.getByText('Corta el 10 y tienes 20 días para pagar.')).toBeTruthy();

    // Modo plan: aparece "Pagos planeados".
    expect(screen.queryByTestId('tarjeta-pagos-planeados')).toBeNull();
    fireEvent.press(screen.getByTestId('tarjeta-editar'));
    fireEvent.press(screen.getByTestId('editar-modo-plan'));
    fireEvent.press(screen.getByTestId('editar-guardar'));
    expect(screen.getByText('Sin pagos planeados aparto lo que debes completo.')).toBeTruthy();
    fireEvent.press(screen.getByTestId('pago-planeado-agregar'));
    fireEvent.changeText(screen.getByTestId('pago-planeado-monto'), '500');
    fireEvent.press(screen.getByTestId('pago-planeado-guardar'));
    const [pago] = listarPagosPlaneados(p.ctx, p.oro);
    if (!pago) throw new Error('sin pago planeado');
    expect(pago).toMatchObject({ monto: 50_000, regla: { tipo: 'quincenal_15_ultimo' } });
    expect(screen.getByText('Aparto solo los pagos que vencen antes de tu próximo ingreso.')).toBeTruthy();
    fireEvent.press(screen.getByTestId(`pago-planeado-${pago.programadoId}-quitar`));
    expect(listarPagosPlaneados(p.ctx, p.oro)).toEqual([]);
  });

  it('CA-M4-09 · "Pasar a meses" desde el detalle de una compra con tarjeta, con Deshacer', () => {
    const p = e510();
    registrarMovimiento(p.ctx, {
      tipo: 'gasto',
      monto: 1_200_000,
      categoria: 'hogar',
      descripcion: 'refri',
      origenId: p.oro,
    });
    registrarMovimiento(p.ctx, { tipo: 'gasto', monto: 2_500, categoria: 'antojos', origenId: p.efectivo });
    montar(p.ctx, <PantallaMovimientos alRegistrar={jest.fn()} />);
    const movs = listarMovimientos(p.ctx).flatMap((d) => d.movimientos);
    const refri = movs.find((m) => m.descripcion === 'refri');
    const coca = movs.find((m) => m.descripcion !== 'refri');
    if (!refri || !coca) throw new Error('faltan movimientos');

    // En efectivo no se ofrece.
    fireEvent.press(screen.getByTestId(`movimiento-${coca.id}`));
    expect(within(screen.getByTestId(`detalle-${coca.id}`)).queryByText('Pasar a meses')).toBeNull();

    fireEvent.press(screen.getByTestId(`movimiento-${refri.id}`));
    fireEvent.press(within(screen.getByTestId(`detalle-${refri.id}`)).getByTestId('boton-pasar-a-meses'));
    fireEvent.press(screen.getByTestId('meses-12'));
    fireEvent.press(screen.getByTestId('boton-confirmar-meses'));
    const aviso = screen.getByTestId('aviso');
    expect(within(aviso).getByText(/12 meses de \$1,000$/)).toBeTruthy();
    expect(listarPlanesMsi(p.ctx, p.oro)).toHaveLength(1);
    expect(
      listarMovimientos(p.ctx)
        .flatMap((d) => d.movimientos)
        .filter((m) => m.monto === 1_200_000),
    ).toHaveLength(1);
    fireEvent.press(within(aviso).getByText('Deshacer'));
    expect(listarPlanesMsi(p.ctx, p.oro)).toEqual([]);
  });
});

describe('Avisos', () => {
  it('CA-M4-04 · las preferencias de Ajustes cambian lo que se programa (límite 3 días antes, horario silencioso)', async () => {
    const p = e510();
    const n = notificacionesEnMemoria('concedido');
    const limite = `tarjeta:limite:${p.oro}:2026-11-30`;
    const corte = `tarjeta:corte:${p.oro}:2026-11-10`;
    montar(
      p.ctx,
      <>
        <SincronizarAvisosTarjetas hora={() => '10:00'} />
        <SeccionAvisos />
      </>,
      { notificaciones: n },
    );
    await waitFor(() => expect(n.puerto.lista().find((a) => a.id === limite)).toBeTruthy());
    expect(n.puerto.lista().find((a) => a.id === limite)).toMatchObject({
      fecha: '2026-11-27',
      hora: '09:00',
    });
    expect(n.puerto.lista().find((a) => a.id === corte)).toMatchObject({
      fecha: '2026-11-10',
      hora: '09:00',
    });

    // Apagar "Fecha límite de pago": se cancelan esos avisos y quedan los de corte.
    fireEvent.press(screen.getByTestId('ajustes-aviso-limite'));
    await waitFor(() => expect(n.puerto.lista().some((a) => a.id.startsWith('tarjeta:limite:'))).toBe(false));
    expect(n.puerto.lista().some((a) => a.id === corte)).toBe(true);
    fireEvent.press(screen.getByTestId('ajustes-aviso-limite'));
    await waitFor(() => expect(n.puerto.lista().some((a) => a.id === limite)).toBe(true));

    // Hora dentro del silencio (22:00–08:00): sale al terminar el silencio.
    fireEvent.changeText(screen.getByTestId('ajustes-aviso-hora'), '23:30');
    fireEvent.press(screen.getByTestId('ajustes-guardar-horario'));
    await waitFor(() =>
      expect(n.puerto.lista().find((a) => a.id === limite)).toMatchObject({
        fecha: '2026-11-28',
        hora: '08:00',
      }),
    );

    // Otro horario silencioso: todo sale a las 09:30.
    fireEvent.changeText(screen.getByTestId('ajustes-aviso-hora'), '09:00');
    fireEvent.changeText(screen.getByTestId('ajustes-silencio-inicio'), '21:00');
    fireEvent.changeText(screen.getByTestId('ajustes-silencio-fin'), '9:30');
    fireEvent.press(screen.getByTestId('ajustes-guardar-horario'));
    await waitFor(() => expect(n.puerto.lista().every((a) => a.hora === '09:30')).toBe(true));
    expect(screen.getByText('Listo. Tus avisos ya usan este horario.')).toBeTruthy();

    // Apagar "Día de corte".
    fireEvent.press(screen.getByTestId('ajustes-aviso-corte'));
    await waitFor(() => expect(n.puerto.lista().some((a) => a.id.startsWith('tarjeta:corte:'))).toBe(false));

    fireEvent.changeText(screen.getByTestId('ajustes-aviso-hora'), '25:00');
    fireEvent.press(screen.getByTestId('ajustes-guardar-horario'));
    expect(screen.getByText('Escribe las horas así: 22:00.')).toBeTruthy();
  });

  it('con una tarjeta y sin permiso, Hoy explica para qué son los avisos antes de pedirlo', async () => {
    const p = e510();
    const n = notificacionesEnMemoria('sin_preguntar');
    montar(
      p.ctx,
      <>
        <SincronizarAvisosTarjetas hora={() => '10:00'} />
        {hoy()}
      </>,
      { notificaciones: n },
    );
    expect(await screen.findByTestId('invitacion-avisos')).toBeTruthy();
    expect(n.vecesPedido()).toBe(0);
    expect(n.puerto.lista()).toEqual([]);
    fireEvent.press(screen.getByTestId('invitacion-avisos-si'));
    await waitFor(() => expect(n.puerto.lista().length).toBeGreaterThan(0));
    expect(n.vecesPedido()).toBe(1);
    expect(screen.queryByTestId('invitacion-avisos')).toBeNull();
  });

  it('"Ahora no" no pide el permiso', async () => {
    const p = e510();
    const n = notificacionesEnMemoria('sin_preguntar');
    montar(p.ctx, hoy(), { notificaciones: n });
    fireEvent.press(await screen.findByTestId('invitacion-avisos-no'));
    expect(screen.queryByTestId('invitacion-avisos')).toBeNull();
    expect(n.vecesPedido()).toBe(0);
  });
});

describe('tarjetas/textos · pagos planeados', () => {
  it('copy centralizado del botón y del aviso al apartar', () => {
    expect(BTN_AGREGAR_PAGO_PLANEADO).toBe('Agregar pago planeado');
    expect(mensajePagoPlaneadoApartado(50_000)).toBe('Listo: aparto $500 para cada pago planeado.');
  });
});
