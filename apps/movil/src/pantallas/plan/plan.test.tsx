// M7 · planes en la UI: pantalla del plan con la tienda en memoria, candados de Plus, CA-M7-02 (mensaje al agotar
// las interpretaciones del mes) y CA-M7-07 (al terminar la prueba sin pagar todo sigue visible y editable).
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Platform, Text } from 'react-native';
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
import { CANDADO_COMPROMISO_12_MESES } from '../tarjetas/textos';
import { PantallaPlan, PuertaPlus, SeccionPlan } from '.';
import {
  DESCRIPCION_PUERTA_PLUS as DESCRIPCION_ME_ALCANZA,
  INVITACION_PRUEBA_PLUS,
  TITULO_PUERTA_PLUS as TITULO_ME_ALCANZA,
} from '../me-alcanza/textos';
import {
  etiquetaAccesibilidadCandadoPronto,
  etiquetaAccesibleOfertaDetalle,
  etiquetaAccesibleResumenPlan,
  etiquetaCandadoPlus,
  etiquetaCandadoPlusPronto,
  etiquetaOferta,
  FUNCIONES_PLUS,
  ID,
  MENSAJE_ERROR_COMPRA,
  MENSAJE_LIMITE_DIARIO,
  MENSAJE_LIMITE_MENSUAL_GRATIS,
  MENSAJE_LIMITE_MENSUAL_PLUS,
  MENSAJE_LISTO,
  MENSAJE_OFERTAS_VACIAS,
  MENSAJE_RESTAURADO_SIN_PLUS,
  MENSAJE_SIN_TIENDA,
  NOTA_PLUS_DE_PRUEBA,
  PISTA_ABRIR_PLANES,
  PISTA_ADMINISTRAR,
  PISTA_INTENTAR,
  PISTA_RESTAURAR,
  PISTA_VER_PLANES,
  PISTA_VOLVER,
  pistaComprarOferta,
  PUERTA_PLUS_SIN_TIENDA,
  resumenPlan,
  TEXTO_PLUS_DE_PRUEBA,
  TITULO_PLAN_GRATIS,
  TITULO_PLUS,
  TITULO_PLUS_DE_PRUEBA,
} from './textos';

const DIA = 86_400_000;
/** Frase que el nivel de reglas no cubre (sin verbo, «chelas» fuera del diccionario): va a la nube. */
const COMPLEJA = 'unas chelas de 80 con la Nu y una coca de 25 en efectivo';
const T0 = Date.UTC(2026, 9, 11, 18, 0, 0);

const textoDe = (testID: string) => {
  const hijos = screen.getByTestId(testID).props.children as unknown;
  return Array.isArray(hijos) ? hijos.join('') : String(hijos);
};

function montar(
  ctx: Contexto,
  ui: ReactNode,
  o: {
    compras?: TiendaEnMemoria | null;
    nube?: NivelNube | null;
    abrirPlan?: () => void;
    /** `EXPO_PUBLIC_PLUS_SIN_TIENDA=1` en la build. */
    plusSinTienda?: boolean;
  } = {},
) {
  return render(
    <ProveedorSesion ctx={ctx} nube={o.nube ?? null}>
      <ProveedorPlan
        compras={o.compras ?? null}
        abrirPlan={o.abrirPlan ?? null}
        plusSinTienda={o.plusSinTienda ?? false}
      >
        <ProveedorAvisos>{ui}</ProveedorAvisos>
      </ProveedorPlan>
    </ProveedorSesion>,
  );
}

/** Ninguna tienda, precio ni plataforma en lo que se ve (`02 §12`, App Store 2.3.10 y 3.1.1). */
const TIENDAS = /Google Play|App Store|Android|iPhone|\$\d/;

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
  it('iPhone (M14): sin ofertas, sin restaurar y sin nombrar tiendas; solo explica que Plus no está aún', async () => {
    const plataforma = jest.replaceProperty(Platform, 'OS', 'ios');
    try {
      const p = e510();
      const tienda = crearComprasEnMemoria({ ahora: () => T0 });
      montar(p.ctx, <PantallaPlan alVolver={jest.fn()} />, { compras: tienda });
      await act(async () => {
        await tienda.ofertas();
      });
      expect(screen.getByTestId(ID.soloIos)).toHaveTextContent(/Plus todavía no está en iPhone/);
      expect(screen.queryByTestId(ID.oferta('mensual'))).toBeNull();
      expect(screen.queryByTestId(ID.oferta('anual'))).toBeNull();
      expect(screen.queryByTestId(ID.restaurar)).toBeNull();
      expect(screen.queryByTestId(ID.administrar)).toBeNull();
      expect(screen.queryByText(/Google Play|Android|App Store/)).toBeNull();
      expect(screen.getByTestId(ID.volver)).toHaveProp('accessibilityHint', PISTA_VOLVER);
    } finally {
      plataforma.restore();
    }
  });

  it('Volver anuncia pista para cerrar la pantalla', () => {
    const p = e510();
    montar(p.ctx, <PantallaPlan alVolver={jest.fn()} />);
    expect(screen.getByTestId(ID.tituloPantalla)).toHaveProp('accessibilityRole', 'header');
    expect(screen.getByTestId(ID.volver)).toHaveProp('accessibilityHint', PISTA_VOLVER);
  });

  it('TalkBack: resumen del plan, precio de oferta y pistas de compra', async () => {
    const p = e510();
    const tienda = crearComprasEnMemoria({ ahora: () => T0 });
    montar(p.ctx, <PantallaPlan alVolver={jest.fn()} />, { compras: tienda });
    expect(screen.getByTestId(ID.cargando)).toHaveProp('accessibilityLiveRegion', 'polite');
    const resumen = resumenPlan(obtenerPlan(p.ctx));
    expect(screen.getByTestId(ID.titulo)).toHaveProp(
      'accessibilityLabel',
      etiquetaAccesibleResumenPlan(resumen.titulo, resumen.detalle),
    );
    await waitFor(() => expect(screen.getByTestId(ID.oferta('mensual'))).toBeTruthy());
    const ofertas = await tienda.ofertas();
    const mensual = definido(ofertas.find((o) => o.periodo === 'mensual'));
    const e = etiquetaOferta(mensual);
    expect(screen.getByTestId(ID.oferta('mensual'))).toHaveProp(
      'accessibilityHint',
      pistaComprarOferta(mensual),
    );
    expect(screen.getByTestId(ID.ofertaDetalle('mensual'))).toHaveProp(
      'accessibilityLabel',
      etiquetaAccesibleOfertaDetalle(e.detalle),
    );
    expect(etiquetaAccesibleOfertaDetalle(e.detalle)).toMatch(/sesenta y nueve pesos/);
    expect(screen.getByTestId(ID.restaurar)).toHaveProp('accessibilityHint', PISTA_RESTAURAR);
  });

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
    expect(textoDe(ID.titulo)).toBe(TITULO_PLAN_GRATIS);
    // Hoy en Gratis: candado discreto en lugar de la probabilidad y sin tarjeta del día (`02 §4`). Ola 7: la
    // probabilidad (o su candado) vive en el desglose que abre la barra del día.
    fireEvent.press(screen.getByTestId('boton-desglose'));
    expect(screen.getByText(etiquetaCandadoPlus('Ver probabilidad'))).toBeTruthy();
    expect(screen.queryByTestId('tarjeta-del-dia')).toBeNull();
    fireEvent.press(screen.getByTestId('candado-probabilidad'));
    expect(abrirPlan).toHaveBeenCalled();

    const ofertas = await tienda.ofertas();
    const ofertaMensual = etiquetaOferta(definido(ofertas.find((o) => o.periodo === 'mensual')));
    const ofertaAnual = etiquetaOferta(definido(ofertas.find((o) => o.periodo === 'anual')));
    await waitFor(() => expect(screen.getByTestId(ID.oferta('mensual'))).toBeTruthy());
    expect(screen.getByLabelText(ofertaMensual.etiqueta)).toBeTruthy();
    expect(screen.getByText(ofertaMensual.detalle)).toBeTruthy();
    expect(screen.getByLabelText(ofertaAnual.etiqueta)).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByTestId(ID.oferta('mensual')));
    });
    const resumenPlus = resumenPlan(obtenerPlan(p.ctx));
    expect(textoDe(ID.mensaje)).toBe(MENSAJE_LISTO);
    expect(textoDe(ID.titulo)).toBe(resumenPlus.titulo);
    expect(textoDe(ID.detalle)).toBe(resumenPlus.detalle);
    expect(screen.getByTestId(ID.administrar)).toHaveProp('accessibilityHint', PISTA_ADMINISTRAR);
    expect(screen.queryByTestId(ID.oferta('mensual'))).toBeNull();
    // Hoy ya muestra lo de Plus.
    expect(screen.queryByTestId('candado-probabilidad')).toBeNull();
    expect(screen.getByTestId('tarjeta-del-dia')).toBeTruthy();
  });

  it('cancelar la compra no cambia nada; un error lo dice sin cobrar; restaurar sin compras lo explica', async () => {
    const p = e510();
    const tienda = crearComprasEnMemoria({ ahora: () => T0 });
    montar(p.ctx, <PantallaPlan alVolver={jest.fn()} />, { compras: tienda });
    await waitFor(() => expect(screen.getByTestId(ID.oferta('anual'))).toBeTruthy());
    tienda.siguienteCompra('cancelado');
    await act(async () => {
      fireEvent.press(screen.getByTestId(ID.oferta('anual')));
    });
    expect(screen.queryByTestId(ID.mensaje)).toBeNull();
    tienda.siguienteCompra('error');
    await act(async () => {
      fireEvent.press(screen.getByTestId(ID.oferta('anual')));
    });
    expect(textoDe(ID.mensaje)).toBe(MENSAJE_ERROR_COMPRA);
    expect(screen.getByTestId(ID.mensaje)).toHaveProp('accessibilityRole', 'alert');
    expect(screen.getByTestId(ID.mensaje)).toHaveProp('accessibilityLiveRegion', 'polite');
    await act(async () => {
      fireEvent.press(screen.getByTestId(ID.restaurar));
    });
    expect(textoDe(ID.mensaje)).toBe(MENSAJE_RESTAURADO_SIN_PLUS);
    expect(obtenerPlan(p.ctx).plan).toBe('gratis');
  });

  it('Ajustes → Plan muestra el plan actual y abre la pantalla del plan', () => {
    const p = e510();
    const abrir = jest.fn();
    const { unmount } = montar(p.ctx, <SeccionPlan alAbrirPlan={abrir} />);
    expect(textoDe(ID.ajustesPlanTitulo)).toBe(TITULO_PLAN_GRATIS);
    expect(screen.getByTestId(ID.ajustesPlanTitulo)).toHaveProp(
      'accessibilityLabel',
      etiquetaAccesibleResumenPlan(TITULO_PLAN_GRATIS, resumenPlan(obtenerPlan(p.ctx)).detalle),
    );
    expect(screen.getByTestId(ID.ajustesPlanVer)).toHaveProp('accessibilityHint', PISTA_VER_PLANES);
    fireEvent.press(screen.getByTestId(ID.ajustesPlanVer));
    expect(abrir).toHaveBeenCalled();
    unmount();
    activarPlus(p.ctx);
    montar(p.ctx, <SeccionPlan alAbrirPlan={abrir} />);
    expect(textoDe(ID.ajustesPlanTitulo)).toBe(TITULO_PLUS);
  });

  it('sin tienda (build sin llave): lo dice, la cuenta sigue en Gratis y no habla de cobros ni de Google Play', () => {
    const p = e510();
    montar(p.ctx, <PantallaPlan alVolver={jest.fn()} />);
    expect(screen.getByTestId(ID.sinTienda)).toHaveTextContent(MENSAJE_SIN_TIENDA);
    expect(screen.queryByTestId(ID.restaurar)).toBeNull();
    expect(screen.queryByTestId(ID.notaTienda)).toBeNull();
    expect(screen.queryByText(/Google Play/)).toBeNull();
    expect(textoDe(ID.titulo)).toBe(TITULO_PLAN_GRATIS);
  });

  it('ofertas vacías de Google Play lo explican y permiten reintentar', async () => {
    const p = e510();
    const tienda = crearComprasEnMemoria({ ahora: () => T0 });
    const sinOfertas = { ...tienda, ofertas: async () => [] as const };
    montar(p.ctx, <PantallaPlan alVolver={jest.fn()} />, { compras: sinOfertas });
    await waitFor(() => expect(screen.getByTestId(ID.vacioOfertas)).toBeTruthy());
    expect(screen.getByTestId(ID.vacioOfertas)).toHaveTextContent(MENSAJE_OFERTAS_VACIAS);
    expect(screen.getByTestId(ID.intentar)).toHaveProp('accessibilityHint', PISTA_INTENTAR);
    expect(screen.getByTestId(ID.vacioOfertas)).toHaveProp('accessibilityLiveRegion', 'polite');
  });

  it('¿Me alcanza? en Gratis explica que es de Plus e invita a probarlo; en Plus abre la pantalla', () => {
    const p = e510();
    const abrirPlan = jest.fn();
    const tienda = crearComprasEnMemoria({ ahora: () => T0 });
    const ui = (
      <PuertaPlus
        funcion="meAlcanza"
        titulo={TITULO_ME_ALCANZA}
        descripcion={DESCRIPCION_ME_ALCANZA}
        invitacion={INVITACION_PRUEBA_PLUS}
      >
        <Text testID="me-alcanza-dentro">dentro</Text>
      </PuertaPlus>
    );
    const { unmount } = montar(p.ctx, ui, { abrirPlan, compras: tienda });
    expect(screen.getByText(TITULO_ME_ALCANZA)).toBeTruthy();
    expect(screen.getByText(`${DESCRIPCION_ME_ALCANZA} ${INVITACION_PRUEBA_PLUS}`)).toBeTruthy();
    expect(INVITACION_PRUEBA_PLUS).toBe('Pruébalo 14 días gratis.');
    expect(screen.getByTestId(ID.puertaPlusConocer)).toHaveProp('accessibilityHint', PISTA_ABRIR_PLANES);
    expect(screen.queryByTestId(ID.puertaPlusPronto)).toBeNull();
    fireEvent.press(screen.getByTestId(ID.puertaPlusConocer));
    expect(abrirPlan).toHaveBeenCalled();
    expect(screen.queryByTestId('me-alcanza-dentro')).toBeNull();
    unmount();
    activarPlus(p.ctx);
    montar(p.ctx, ui, { compras: tienda });
    expect(screen.queryByTestId(ID.puertaPlus)).toBeNull();
    expect(screen.getByTestId('me-alcanza-dentro')).toBeTruthy();
  });
});

describe('sin tienda y sin Plus de prueba: ningún candado lleva a un callejón', () => {
  it('el candado es solo texto, sin botón, aunque haya navegación al plan', () => {
    const p = e510();
    const abrirPlan = jest.fn();
    montar(p.ctx, <PantallaHoy navegacion={navegacionFalsa()} motor={crearMotorFalso().motor} />, {
      abrirPlan,
    });
    fireEvent.press(screen.getByTestId('boton-desglose'));
    const candado = screen.getByTestId('candado-probabilidad');
    expect(screen.getByText(etiquetaCandadoPlusPronto('Ver probabilidad'))).toBeTruthy();
    expect(screen.queryByText(etiquetaCandadoPlus('Ver probabilidad'))).toBeNull();
    expect(candado).toHaveProp('accessibilityLabel', etiquetaAccesibilidadCandadoPronto('Ver probabilidad'));
    expect(candado.props.accessibilityRole).toBeUndefined();
    expect(candado.props.onPress).toBeUndefined();
    fireEvent.press(candado);
    expect(abrirPlan).not.toHaveBeenCalled();
  });

  it('la puerta de ¿Me alcanza? no ofrece «Conocer Plus» ni la prueba de 14 días; dice que llega pronto y deja volver', () => {
    const p = e510();
    const abrirPlan = jest.fn();
    const alVolver = jest.fn();
    montar(
      p.ctx,
      <PuertaPlus
        funcion="meAlcanza"
        titulo={TITULO_ME_ALCANZA}
        descripcion={DESCRIPCION_ME_ALCANZA}
        invitacion={INVITACION_PRUEBA_PLUS}
        alVolver={alVolver}
      >
        <></>
      </PuertaPlus>,
      { abrirPlan },
    );
    expect(screen.getByText(DESCRIPCION_ME_ALCANZA)).toBeTruthy();
    expect(screen.queryByText(/Pruébalo|14 días/)).toBeNull();
    expect(screen.queryByTestId(ID.puertaPlusConocer)).toBeNull();
    expect(screen.getByTestId(ID.puertaPlusPronto)).toHaveTextContent(PUERTA_PLUS_SIN_TIENDA);
    expect(screen.queryByText(TIENDAS)).toBeNull();
    fireEvent.press(screen.getByTestId(ID.volver));
    expect(alVolver).toHaveBeenCalled();
  });
});

describe('Plus de prueba (EXPO_PUBLIC_PLUS_SIN_TIENDA=1 y sin tienda)', () => {
  for (const os of ['android', 'ios'] as const) {
    it(`${os}: la pantalla del plan lo dice honesto, con lo que incluye; sin ofertas, fecha, restaurar ni tiendas`, async () => {
      const plataforma = jest.replaceProperty(Platform, 'OS', os);
      try {
        const p = e510();
        montar(p.ctx, <PantallaPlan alVolver={jest.fn()} />, { plusSinTienda: true, abrirPlan: jest.fn() });
        expect(obtenerPlan(p.ctx)).toMatchObject({ plan: 'plus', plusDePrueba: true, fechaFin: null });
        expect(textoDe(ID.titulo)).toBe(TITULO_PLUS_DE_PRUEBA);
        expect(textoDe(ID.detalle)).toBe(TEXTO_PLUS_DE_PRUEBA);
        expect(TEXTO_PLUS_DE_PRUEBA).toBe(
          'Estás usando Finanvoz Plus de prueba. Mientras dure la prueba no hay cobro.',
        );
        for (const f of FUNCIONES_PLUS) expect(screen.getByText(`• ${f}`)).toBeTruthy();
        expect(screen.getByTestId(ID.notaPlusDePrueba)).toHaveTextContent(NOTA_PLUS_DE_PRUEBA);
        expect(screen.queryByTestId(ID.soloIos)).toBeNull();
        expect(screen.queryByTestId(ID.sinTienda)).toBeNull();
        expect(screen.queryByTestId(ID.oferta('mensual'))).toBeNull();
        expect(screen.queryByTestId(ID.oferta('anual'))).toBeNull();
        expect(screen.queryByTestId(ID.restaurar)).toBeNull();
        expect(screen.queryByTestId(ID.administrar)).toBeNull();
        expect(screen.queryByTestId(ID.notaTienda)).toBeNull();
        expect(screen.queryByText(/Restaurar|cobro el|empieza el cobro|Se renueva|al mes|al año/)).toBeNull();
        expect(screen.queryByText(TIENDAS)).toBeNull();
      } finally {
        plataforma.restore();
      }
    });
  }

  it('libera Hoy (probabilidad y tarjeta del día), ¿Me alcanza? y Ajustes → Plan dice «Plus de prueba»', () => {
    const p = e510();
    const abrirPlan = jest.fn();
    montar(
      p.ctx,
      <>
        <PantallaHoy navegacion={navegacionFalsa()} motor={crearMotorFalso().motor} />
        <PuertaPlus funcion="meAlcanza" titulo={TITULO_ME_ALCANZA} descripcion={DESCRIPCION_ME_ALCANZA}>
          <Text testID="me-alcanza-dentro">dentro</Text>
        </PuertaPlus>
        <SeccionPlan alAbrirPlan={abrirPlan} />
      </>,
      { plusSinTienda: true, abrirPlan },
    );
    expect(screen.queryByTestId('candado-probabilidad')).toBeNull();
    expect(screen.getByTestId('tarjeta-del-dia')).toBeTruthy();
    expect(screen.queryByTestId(ID.puertaPlus)).toBeNull();
    expect(screen.getByTestId('me-alcanza-dentro')).toBeTruthy();
    expect(textoDe(ID.ajustesPlanTitulo)).toBe(TITULO_PLUS_DE_PRUEBA);
    expect(textoDe(ID.ajustesPlanDetalle)).toBe(TEXTO_PLUS_DE_PRUEBA);
  });

  it('con tienda real la variable no cambia nada: Gratis con ofertas, como hoy', async () => {
    const p = e510();
    const tienda = crearComprasEnMemoria({ ahora: () => T0 });
    montar(p.ctx, <PantallaPlan alVolver={jest.fn()} />, { compras: tienda, plusSinTienda: true });
    expect(obtenerPlan(p.ctx)).toMatchObject({ plan: 'gratis', plusDePrueba: false });
    expect(textoDe(ID.titulo)).toBe(TITULO_PLAN_GRATIS);
    await waitFor(() => expect(screen.getByTestId(ID.oferta('mensual'))).toBeTruthy());
    expect(screen.getByTestId(ID.restaurar)).toBeTruthy();
    expect(screen.queryByTestId(ID.plusDePrueba)).toBeNull();
  });

  it('sin la variable y sin tienda: Gratis (iPhone sigue con «Plus todavía no está en iPhone», sin compras)', () => {
    const plataforma = jest.replaceProperty(Platform, 'OS', 'ios');
    try {
      const p = e510();
      montar(p.ctx, <PantallaPlan alVolver={jest.fn()} />, { plusSinTienda: false });
      expect(obtenerPlan(p.ctx)).toMatchObject({ plan: 'gratis', plusDePrueba: false });
      expect(screen.getByTestId(ID.soloIos)).toHaveTextContent(/Plus todavía no está en iPhone/);
      expect(screen.queryByTestId(ID.oferta('mensual'))).toBeNull();
      expect(screen.queryByTestId(ID.restaurar)).toBeNull();
      expect(screen.queryByTestId(ID.plusDePrueba)).toBeNull();
    } finally {
      plataforma.restore();
    }
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
    // Ola 7: el mensaje es la pregunta del asistente sobre la frase guardada («¿Es un gasto?»…), que se anuncia como
    // todo turno nuevo (antes, un aviso con rol de alerta).
    expect(textoDe('pregunta-texto')).toBe(MENSAJE_LIMITE_MENSUAL_GRATIS);
    expect(MENSAJE_LIMITE_MENSUAL_GRATIS).toContain('30 frases');
    expect(listarPorInterpretar(p.ctx)).toHaveLength(1);
    const llamadas = f.recibidas.length;

    // Nivel de reglas: sin llamar al proxy.
    await escribir('tacos 80 en efectivo');
    expect(screen.getByTestId('aviso-texto')).toHaveTextContent(/^Registré Tacos \$80/);
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
    expect(textoDe('pregunta-texto')).toBe(MENSAJE_LIMITE_MENSUAL_PLUS);
    f.fallar({ tipo: 'limite', codigo: 'limite_diario' });
    await escribir(COMPLEJA);
    expect(textoDe('pregunta-texto')).toBe(MENSAJE_LIMITE_DIARIO);
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
      // Con tienda y pantalla del plan, como en la app: Hoy solo pinta el candado si hay a dónde llevar.
      { compras: tienda, abrirPlan: jest.fn() },
    );
    await waitFor(() => expect(screen.getByTestId(ID.oferta('mensual'))).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByTestId(ID.oferta('mensual')));
    });
    expect(obtenerPlan(p.ctx).plan).toBe('plus');
    await escribir('tacos 80 en efectivo');
    const debeEnPlus = textoDe('tarjeta-deuda');
    expect(screen.getByTestId('compromiso-12-meses')).toBeTruthy();
    const movimientosEnPlus = listarMovimientos(p.ctx);

    // La persona cancela en Google Play y la prueba vence sin cobro.
    act(() => tienda.cancelar());
    expect(textoDe(ID.detalle)).toBe(resumenPlan(obtenerPlan(p.ctx)).detalle);
    ahora += 14 * DIA + 1;
    p.reloj.fijarInstante(ahora);
    act(() => tienda.vencer());

    const resumenGratis = resumenPlan(obtenerPlan(p.ctx));
    expect(textoDe(ID.titulo)).toBe(resumenGratis.titulo);
    expect(textoDe(ID.detalle)).toBe(resumenGratis.detalle);
    // Solo se ocultan las funciones de Plus (la probabilidad, en el desglose de la barra del día).
    fireEvent.press(screen.getByTestId('boton-desglose'));
    expect(screen.getByText(etiquetaCandadoPlus('Ver probabilidad'))).toBeTruthy();
    expect(screen.queryByTestId('tarjeta-del-dia')).toBeNull();
    // Los datos siguen ahí y se pueden seguir registrando.
    expect(screen.queryByTestId('compromiso-12-meses')).toBeNull();
    expect(screen.getByText(etiquetaCandadoPlus(CANDADO_COMPROMISO_12_MESES))).toBeTruthy();
    expect(textoDe('tarjeta-deuda')).toBe(debeEnPlus);
    expect(textoDe('tarjeta-deuda-meses')).toBe('De eso, $12,000 son meses sin intereses.');
    expect(listarMovimientos(p.ctx)).toEqual(movimientosEnPlus);
    await escribir('coca 25 en efectivo');
    expect(screen.getByTestId('aviso-texto')).toHaveTextContent(/^Registré Coca \$25/);
  });
});

/** Falla la prueba si el valor no existe (evita `!`). */
function definido<T>(v: T | undefined): T {
  if (v === undefined) throw new Error('valor esperado no encontrado');
  return v;
}
