// M7 · planes en la UI: pantalla del plan con la tienda en memoria, candados de Plus, CA-M7-02 (mensaje al agotar
// las interpretaciones del mes) y CA-M7-07 (al terminar la prueba sin pagar todo sigue visible y editable).
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import {
  listarMovimientos,
  listarPorInterpretar,
  listarTarjetas,
  obtenerPlan,
  registrarCompraMsi,
  type Contexto,
  type NivelNube,
} from '../../servicios';
import { nubeFalsa } from '../../servicios/__pruebas__/nube';
import { ProveedorSesion } from '../../sesion/ProveedorSesion';
import { crearComprasEnMemoria, type TiendaEnMemoria } from '../../suscripciones/memoria';
import { ProveedorPlan } from '../../suscripciones/ProveedorPlan';
import { crearMotorFalso, navegacionFalsa } from '../principal/__pruebas__/arnes';
import { activarPlus, conEscenario } from '../principal/__pruebas__/base';
import { PantallaHoy } from '../principal/PantallaHoy';
import { PantallaMovimientos } from '../principal/PantallaMovimientos';
import { ProveedorAvisos } from '../principal/ProveedorAvisos';
import { PantallaTarjeta } from '../tarjetas/PantallaTarjeta';
import { PantallaPlan, PuertaPlus, SeccionPlan } from '.';
import { MENSAJE_LIMITE_DIARIO, MENSAJE_LIMITE_MENSUAL_GRATIS, MENSAJE_LIMITE_MENSUAL_PLUS } from './textos';

const DIA = 86_400_000;
/** Frase que el nivel de reglas no cubre: va a la nube. */
const COMPLEJA = 'me eché unos tacos de 80 con la Nu y una coca de 25 en efectivo';
const T0 = Date.UTC(2026, 9, 11, 18, 0, 0);

const textoDe = (testID: string) => {
  const hijos = screen.getByTestId(testID).props.children as unknown;
  return Array.isArray(hijos) ? hijos.join('') : String(hijos);
};

function montar(
  ctx: Contexto,
  ui: ReactNode,
  o: { compras?: TiendaEnMemoria | null; nube?: NivelNube | null; abrirPlan?: () => void } = {},
) {
  return render(
    <ProveedorSesion ctx={ctx} nube={o.nube ?? null}>
      <ProveedorPlan compras={o.compras ?? null} abrirPlan={o.abrirPlan ?? null}>
        <ProveedorAvisos>{ui}</ProveedorAvisos>
      </ProveedorPlan>
    </ProveedorSesion>,
  );
}

function e510() {
  const p = conEscenario('e5-10');
  p.reloj.fijarInstante(T0);
  return p;
}

async function escribir(frase: string) {
  if (!screen.queryByTestId('campo-registrar')) fireEvent.press(screen.getByTestId('boton-escribir'));
  fireEvent.changeText(screen.getByTestId('campo-registrar'), frase);
  await act(async () => {
    fireEvent.press(screen.getByTestId('boton-enviar-registro'));
  });
}

describe('pantalla del plan', () => {
  it('Gratis: ofrece la prueba de 14 días con el precio de la tienda; comprar activa Plus en toda la app', async () => {
    const p = e510();
    const tienda = crearComprasEnMemoria({ ahora: () => T0 });
    const abrirPlan = jest.fn();
    montar(
      p.ctx,
      <>
        <PantallaPlan alVolver={jest.fn()} />
        <PantallaHoy navegacion={navegacionFalsa()} motor={crearMotorFalso().motor} />
      </>,
      { compras: tienda, abrirPlan },
    );
    expect(textoDe('plan-titulo')).toBe('Plan Gratis');
    // Hoy en Gratis: candado discreto en lugar de la probabilidad y sin tarjeta del día (`02 §4`).
    expect(screen.getByText('Ver probabilidad · Plus')).toBeTruthy();
    expect(screen.queryByTestId('tarjeta-del-dia')).toBeNull();
    fireEvent.press(screen.getByTestId('candado-probabilidad'));
    expect(abrirPlan).toHaveBeenCalled();

    await waitFor(() => expect(screen.getByTestId('plan-oferta-mensual')).toBeTruthy());
    expect(screen.getByText('Mensual: prueba 14 días gratis')).toBeTruthy();
    expect(screen.getByText('Después, $69.00 al mes. Cancela cuando quieras en Google Play.')).toBeTruthy();
    expect(screen.getByText('Anual: prueba 14 días gratis')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByTestId('plan-oferta-mensual'));
    });
    expect(textoDe('plan-mensaje')).toBe('¡Listo! Ya tienes Plus.');
    expect(textoDe('plan-titulo')).toBe('Tienes Plus · prueba gratis');
    expect(textoDe('plan-detalle')).toBe('Te quedan 14 días de prueba; el 25 oct empieza el cobro.');
    expect(screen.getByTestId('plan-administrar')).toBeTruthy();
    expect(screen.queryByTestId('plan-oferta-mensual')).toBeNull();
    // Hoy ya muestra lo de Plus.
    expect(screen.queryByTestId('candado-probabilidad')).toBeNull();
    expect(screen.getByTestId('tarjeta-del-dia')).toBeTruthy();
  });

  it('cancelar la compra no cambia nada; un error lo dice sin cobrar; restaurar sin compras lo explica', async () => {
    const p = e510();
    const tienda = crearComprasEnMemoria({ ahora: () => T0 });
    montar(p.ctx, <PantallaPlan alVolver={jest.fn()} />, { compras: tienda });
    await waitFor(() => expect(screen.getByTestId('plan-oferta-anual')).toBeTruthy());
    tienda.siguienteCompra('cancelado');
    await act(async () => {
      fireEvent.press(screen.getByTestId('plan-oferta-anual'));
    });
    expect(screen.queryByTestId('plan-mensaje')).toBeNull();
    tienda.siguienteCompra('error');
    await act(async () => {
      fireEvent.press(screen.getByTestId('plan-oferta-anual'));
    });
    expect(textoDe('plan-mensaje')).toBe('No se completó la compra. No se te cobró nada; intenta de nuevo.');
    await act(async () => {
      fireEvent.press(screen.getByTestId('plan-restaurar'));
    });
    expect(textoDe('plan-mensaje')).toBe('No encontré una suscripción de Plus en tu cuenta de Google.');
    expect(obtenerPlan(p.ctx).plan).toBe('gratis');
  });

  it('Ajustes → Plan muestra el plan actual y abre la pantalla del plan', () => {
    const p = e510();
    const abrir = jest.fn();
    const { unmount } = montar(p.ctx, <SeccionPlan alAbrirPlan={abrir} />);
    expect(textoDe('ajustes-plan-titulo')).toBe('Plan Gratis');
    fireEvent.press(screen.getByTestId('ajustes-plan-ver'));
    expect(abrir).toHaveBeenCalled();
    unmount();
    activarPlus(p.ctx);
    montar(p.ctx, <SeccionPlan alAbrirPlan={abrir} />);
    expect(textoDe('ajustes-plan-titulo')).toBe('Tienes Plus');
  });

  it('sin tienda (build sin llave): lo dice y la cuenta sigue en Gratis', () => {
    const p = e510();
    montar(p.ctx, <PantallaPlan alVolver={jest.fn()} />);
    expect(screen.getByText('Las suscripciones todavía no están disponibles en esta versión.')).toBeTruthy();
    expect(screen.queryByTestId('plan-restaurar')).toBeNull();
  });

  it('¿Me alcanza? en Gratis explica que es de Plus; en Plus abre la pantalla', () => {
    const p = e510();
    const abrirPlan = jest.fn();
    const ui = (
      <PuertaPlus funcion="meAlcanza" titulo="¿Me alcanza? es de Plus" descripcion="Pruébalo 14 días gratis.">
        <></>
      </PuertaPlus>
    );
    const { unmount } = montar(p.ctx, ui, { abrirPlan });
    expect(screen.getByText('¿Me alcanza? es de Plus')).toBeTruthy();
    fireEvent.press(screen.getByTestId('puerta-plus-conocer'));
    expect(abrirPlan).toHaveBeenCalled();
    unmount();
    activarPlus(p.ctx);
    montar(p.ctx, ui);
    expect(screen.queryByTestId('puerta-plus')).toBeNull();
  });
});

describe('CA-M7-02 · al agotar las 30 interpretaciones del mes', () => {
  it('Gratis ve un mensaje claro, la frase queda en Por revisar y el nivel de reglas sigue registrando', async () => {
    const p = conEscenario('e4-01');
    const f = nubeFalsa();
    f.fallar({ tipo: 'limite', codigo: 'limite_mensual' });
    montar(p.ctx, <PantallaHoy navegacion={navegacionFalsa()} motor={crearMotorFalso().motor} />, {
      nube: f.nube,
    });

    await escribir(COMPLEJA);
    expect(textoDe('mensaje-registro')).toBe(MENSAJE_LIMITE_MENSUAL_GRATIS);
    expect(MENSAJE_LIMITE_MENSUAL_GRATIS).toContain('30 frases');
    expect(listarPorInterpretar(p.ctx)).toHaveLength(1);
    const llamadas = f.recibidas.length;

    // Nivel de reglas: sin llamar al proxy.
    await escribir('tacos 80 en efectivo');
    expect(within(screen.getByTestId('aviso')).getByText(/^Registré: Tacos \$80/)).toBeTruthy();
    expect(f.recibidas).toHaveLength(llamadas);
    expect(listarMovimientos(p.ctx).flatMap((d) => d.movimientos)).toHaveLength(1);
  });

  it('Plus y el límite del día tienen su propio mensaje', async () => {
    const p = conEscenario('e4-01');
    activarPlus(p.ctx);
    const f = nubeFalsa();
    f.fallar({ tipo: 'limite', codigo: 'limite_mensual' });
    montar(p.ctx, <PantallaHoy navegacion={navegacionFalsa()} motor={crearMotorFalso().motor} />, {
      nube: f.nube,
    });
    await escribir(COMPLEJA);
    expect(textoDe('mensaje-registro')).toBe(MENSAJE_LIMITE_MENSUAL_PLUS);
    f.fallar({ tipo: 'limite', codigo: 'limite_diario' });
    await escribir(COMPLEJA);
    expect(textoDe('mensaje-registro')).toBe(MENSAJE_LIMITE_DIARIO);
  });
});

describe('CA-M7-07 · al terminar la prueba sin pagar', () => {
  it('vuelve a Gratis: datos visibles, tarjeta y movimientos iguales, solo se ocultan las funciones de Plus', async () => {
    const p = e510();
    let ahora = T0;
    const tienda = crearComprasEnMemoria({ ahora: () => ahora });
    const oro = listarTarjetas(p.ctx).find((t) => t.nombre.startsWith('Banamex'))?.id as string;
    registrarCompraMsi(p.ctx, { tarjetaId: oro, monto: 1_200_000, meses: 12, descripcion: 'tele' });
    montar(
      p.ctx,
      <>
        <PantallaPlan alVolver={jest.fn()} />
        <PantallaHoy navegacion={navegacionFalsa()} motor={crearMotorFalso().motor} />
        <PantallaMovimientos alRegistrar={jest.fn()} alRevisar={jest.fn()} />
        <PantallaTarjeta tarjetaId={oro} alVolver={jest.fn()} />
      </>,
      { compras: tienda },
    );
    await waitFor(() => expect(screen.getByTestId('plan-oferta-mensual')).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByTestId('plan-oferta-mensual'));
    });
    expect(obtenerPlan(p.ctx).plan).toBe('plus');
    await escribir('tacos 80 en efectivo');
    const debeEnPlus = textoDe('tarjeta-deuda');
    expect(screen.getByTestId('compromiso-12-meses')).toBeTruthy();
    const movimientosEnPlus = listarMovimientos(p.ctx);

    // La persona cancela en Google Play y la prueba vence sin cobro.
    act(() => tienda.cancelar());
    expect(textoDe('plan-detalle')).toBe(
      'Te quedan 14 días de prueba. Cancelaste: no se te cobrará y después vuelves a Gratis.',
    );
    ahora += 14 * DIA + 1;
    p.reloj.fijarInstante(ahora);
    act(() => tienda.vencer());

    expect(textoDe('plan-titulo')).toBe('Plan Gratis');
    expect(textoDe('plan-detalle')).toBe(
      'Tu prueba de Plus terminó. Todo sigue aquí: tus datos siguen visibles, editables y puedes descargarlos.',
    );
    // Solo se ocultan las funciones de Plus.
    expect(screen.getByText('Ver probabilidad · Plus')).toBeTruthy();
    expect(screen.queryByTestId('tarjeta-del-dia')).toBeNull();
    // Los datos siguen ahí y se pueden seguir registrando.
    expect(screen.queryByTestId('compromiso-12-meses')).toBeNull();
    expect(screen.getByText('Ver tus meses de los próximos 12 meses · Plus')).toBeTruthy();
    expect(textoDe('tarjeta-deuda')).toBe(debeEnPlus);
    expect(textoDe('tarjeta-deuda-meses')).toBe('De eso, $12,000 son meses sin intereses.');
    expect(listarMovimientos(p.ctx)).toEqual(movimientosEnPlus);
    expect(screen.getAllByText(/Tacos/).length).toBeGreaterThan(0);
    await escribir('coca 25 en efectivo');
    expect(within(screen.getByTestId('aviso')).getByText(/^Registré: Coca \$25/)).toBeTruthy();
  });
});
