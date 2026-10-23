import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { aceptarConsentimiento, obtenerVozRespuesta, type Contexto } from '../../servicios';
import { obtenerAjustesVoz, obtenerConfirmarPorVoz } from '../../servicios/preferencias';
import { ProveedorSesion } from '../../sesion/ProveedorSesion';
import type { VozSistema } from '../../voz/voces';
import { abrirPruebaPantalla } from '../principal/__pruebas__/base';
import {
  DESC_CONFIRMAR_POR_VOZ,
  ETIQUETA_CONFIRMAR_POR_VOZ,
  SeccionVoz,
  type FuentesVoz,
} from './SeccionVoz';
import { MENSAJE_NO_GUARDAR } from './textos';
import {
  DESC_SILENCIO_IOS,
  descVoz,
  ETIQUETA_SILENCIO_IOS,
  ETIQUETA_VOZ,
  ETIQUETAS_VELOCIDAD,
  etiquetaEscucharVoz,
  FRASE_MUESTRA_VOZ,
  GUIA_VOZ_MEJORADA_IOS,
  GUIA_VOZ_MEJORADA_IOS_HABLADA,
  SIN_VOCES,
  TITULO_GUIA_MEJORADA,
} from './voz-textos';

let prueba: ReturnType<typeof abrirPruebaPantalla>;

beforeEach(() => {
  prueba = abrirPruebaPantalla();
});

afterEach(() => {
  prueba.cerrar();
  jest.restoreAllMocks();
});

/** Las voces nunca llegan: para las pruebas que no miran «cómo suena». */
const SIN_RESPUESTA: FuentesVoz = {
  cargarVoces: () => new Promise(() => {}),
  hayInternet: () => new Promise(() => {}),
  hablar: async () => 'dicha',
};

function montar(ctx: Contexto, fuentes: FuentesVoz = SIN_RESPUESTA) {
  return render(
    <ProveedorSesion ctx={ctx} nube={null}>
      <SeccionVoz fuentes={fuentes} />
    </ProveedorSesion>,
  );
}

const voz = (identifier: string, language: string, quality = 'Default'): VozSistema => ({
  identifier,
  name: identifier.split('.').at(-1) ?? identifier,
  language,
  quality,
});

const ANDROID: readonly VozSistema[] = [
  voz('es-us-x-sfb-network', 'es-US', 'Enhanced'),
  voz('es-us-x-sfb-local', 'es-US', 'Enhanced'),
  voz('es-us-x-esd-network', 'es-US', 'Enhanced'),
  voz('es-us-x-esd-local', 'es-US', 'Enhanced'),
  voz('es-es-x-eea-local', 'es-ES', 'Enhanced'),
  voz('en-us-x-iob-local', 'en-US', 'Enhanced'),
];

const IPHONE_SIN_MEJORADA: readonly VozSistema[] = [
  voz('com.apple.voice.compact.es-MX.Paulina', 'es-MX'),
  voz('com.apple.voice.compact.es-MX.Juan', 'es-MX'),
];

function fuentesFalsas(voces: readonly VozSistema[], enLinea = true) {
  return {
    cargarVoces: jest.fn(async () => voces),
    hayInternet: jest.fn(async () => enLinea),
    hablar: jest.fn(async () => 'dicha' as const),
  } satisfies FuentesVoz;
}

const seleccion = (testID: string) =>
  screen.getByTestId(testID).props.accessibilityState as { selected: boolean };

const estado = (testID: string) =>
  screen.getByTestId(testID).props.accessibilityState as { checked: boolean };

describe('Ajustes › Voz', () => {
  it('«Confirmar por voz» está encendido por omisión, con su explicación', () => {
    aceptarConsentimiento(prueba.ctx, { datosFinancieros: true });
    montar(prueba.ctx);
    expect(screen.getByText(ETIQUETA_CONFIRMAR_POR_VOZ)).toBeTruthy();
    expect(screen.getByText(DESC_CONFIRMAR_POR_VOZ)).toBeTruthy();
    expect(estado('ajustes-voz-confirmar').checked).toBe(true);
    expect(screen.getByTestId('ajustes-voz-confirmar')).toHaveProp('accessibilityRole', 'switch');
    expect(screen.getByTestId('ajustes-voz-confirmar')).toHaveProp(
      'accessibilityHint',
      DESC_CONFIRMAR_POR_VOZ,
    );
  });

  it('apagarlo y volverlo a encender se guarda', () => {
    aceptarConsentimiento(prueba.ctx, { datosFinancieros: true });
    montar(prueba.ctx);
    fireEvent.press(screen.getByTestId('ajustes-voz-confirmar'));
    expect(obtenerConfirmarPorVoz(prueba.ctx).activa).toBe(false);
    expect(estado('ajustes-voz-confirmar').checked).toBe(false);
    fireEvent.press(screen.getByTestId('ajustes-voz-confirmar'));
    expect(obtenerConfirmarPorVoz(prueba.ctx).activa).toBe(true);
    expect(estado('ajustes-voz-confirmar').checked).toBe(true);
    expect(screen.queryByTestId('ajustes-voz-error')).toBeNull();
  });

  it('es independiente de «Contestarte en voz»', () => {
    aceptarConsentimiento(prueba.ctx, { datosFinancieros: true });
    montar(prueba.ctx);
    const contestar = obtenerVozRespuesta(prueba.ctx).activa;
    fireEvent.press(screen.getByTestId('ajustes-voz-confirmar'));
    expect(obtenerVozRespuesta(prueba.ctx).activa).toBe(contestar);
    fireEvent.press(screen.getByTestId('ajustes-voz-contestar'));
    expect(obtenerVozRespuesta(prueba.ctx).activa).toBe(!contestar);
    expect(obtenerConfirmarPorVoz(prueba.ctx).activa).toBe(false);
  });

  it('sin el aviso de privacidad aceptado no cambia y dice que no se pudo guardar', () => {
    montar(prueba.ctx);
    fireEvent.press(screen.getByTestId('ajustes-voz-confirmar'));
    expect(obtenerConfirmarPorVoz(prueba.ctx).activa).toBe(true);
    expect(screen.getByTestId('ajustes-voz-error')).toBeTruthy();
    expect(screen.getByText(MENSAJE_NO_GUARDAR)).toBeTruthy();
  });

  it('redacción: tuteo, sin exclamaciones y con un ejemplo de lo que se puede decir', () => {
    for (const t of [ETIQUETA_CONFIRMAR_POR_VOZ, DESC_CONFIRMAR_POR_VOZ]) expect(t).not.toMatch(/[!¡]/);
    expect(DESC_CONFIRMAR_POR_VOZ).toMatch(/«sí»/);
    expect(DESC_CONFIRMAR_POR_VOZ).toMatch(/«no»/);
    expect(DESC_CONFIRMAR_POR_VOZ).not.toMatch(/usted/i);
  });
});

describe('Ajustes › Voz › cómo suena', () => {
  it('con «Contestarte en voz» encendido: las 3 mejores voces, la mejor elegida, cada una con «Escuchar»', async () => {
    aceptarConsentimiento(prueba.ctx, { datosFinancieros: true });
    const fuentes = fuentesFalsas(ANDROID);
    montar(prueba.ctx, fuentes);
    expect(await screen.findByTestId('ajustes-voz-opcion-0')).toBeTruthy();
    expect(fuentes.cargarVoces).toHaveBeenCalledWith(true);
    expect(screen.getByText(ETIQUETA_VOZ)).toBeTruthy();
    expect(screen.getByText(descVoz('android'))).toBeTruthy();
    expect(screen.getByTestId('ajustes-voz-opcion-2')).toBeTruthy();
    expect(screen.queryByTestId('ajustes-voz-opcion-3')).toBeNull();
    expect(seleccion('ajustes-voz-opcion-0').selected).toBe(true);
    expect(seleccion('ajustes-voz-opcion-1').selected).toBe(false);
    expect(screen.getByTestId('ajustes-voz-opcion-0')).toHaveProp('accessibilityRole', 'radio');
    expect(screen.getByTestId('ajustes-voz-opcion-0')).toHaveProp(
      'accessibilityLabel',
      'Voz 1, Español de Estados Unidos · más natural con internet',
    );
    expect(screen.getByTestId('ajustes-voz-escuchar-0')).toHaveProp(
      'accessibilityLabel',
      etiquetaEscucharVoz('Voz 1'),
    );
    // Android no calla la voz con el modo silencio: no hay interruptor ni guía de iPhone.
    expect(screen.queryByTestId('ajustes-voz-silencio')).toBeNull();
    expect(screen.queryByTestId('ajustes-voz-guia')).toBeNull();
  });

  it('elegir otra voz se recuerda; «Escuchar» dice la frase de ejemplo con esa voz aunque haya lector', async () => {
    aceptarConsentimiento(prueba.ctx, { datosFinancieros: true });
    const fuentes = fuentesFalsas(ANDROID);
    montar(prueba.ctx, fuentes);
    fireEvent.press(await screen.findByTestId('ajustes-voz-opcion-1'));
    expect(obtenerAjustesVoz(prueba.ctx).voz).toBe('es-us-x-esd');
    expect(seleccion('ajustes-voz-opcion-1').selected).toBe(true);
    expect(seleccion('ajustes-voz-opcion-0').selected).toBe(false);
    await act(async () => {
      fireEvent.press(screen.getByTestId('ajustes-voz-escuchar-2'));
    });
    expect(fuentes.hablar).toHaveBeenCalledWith(FRASE_MUESTRA_VOZ, {
      voz: 'es-es-x-eea',
      velocidad: 'normal',
      forzar: true,
    });
  });

  it('velocidad en tres chips; la elegida se guarda y se anuncia', async () => {
    aceptarConsentimiento(prueba.ctx, { datosFinancieros: true });
    montar(prueba.ctx, fuentesFalsas(ANDROID));
    await screen.findByTestId('ajustes-voz-opcion-0');
    for (const v of ['pausada', 'normal', 'rapida'] as const) {
      expect(screen.getByTestId(`ajustes-voz-velocidad-${v}`)).toHaveProp(
        'accessibilityLabel',
        ETIQUETAS_VELOCIDAD[v],
      );
    }
    expect(seleccion('ajustes-voz-velocidad-normal').selected).toBe(true);
    fireEvent.press(screen.getByTestId('ajustes-voz-velocidad-rapida'));
    expect(obtenerAjustesVoz(prueba.ctx).velocidad).toBe('rapida');
    expect(seleccion('ajustes-voz-velocidad-rapida').selected).toBe(true);
  });

  it('con «Contestarte en voz» apagado no hay nada que elegir', async () => {
    aceptarConsentimiento(prueba.ctx, { datosFinancieros: true });
    montar(prueba.ctx, fuentesFalsas(ANDROID));
    await screen.findByTestId('ajustes-voz-opcion-0');
    fireEvent.press(screen.getByTestId('ajustes-voz-contestar'));
    expect(screen.queryByTestId('ajustes-voz-como-suena')).toBeNull();
    expect(screen.getByTestId('ajustes-voz-confirmar')).toBeTruthy();
  });

  it('sin voces en español lo dice y sigue contestando en pantalla', async () => {
    aceptarConsentimiento(prueba.ctx, { datosFinancieros: true });
    montar(prueba.ctx, fuentesFalsas([voz('en-us-x-iob-local', 'en-US')]));
    expect(await screen.findByText(SIN_VOCES)).toBeTruthy();
  });

  it('cambiarla sin el aviso de privacidad aceptado no guarda y lo dice', async () => {
    montar(prueba.ctx, fuentesFalsas(ANDROID));
    fireEvent.press(await screen.findByTestId('ajustes-voz-velocidad-pausada'));
    expect(obtenerAjustesVoz(prueba.ctx).velocidad).toBe('normal');
    expect(screen.getByTestId('ajustes-voz-error')).toBeTruthy();
  });
});

describe('Ajustes › Voz en iPhone', () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'ios');
  });

  it('«Hablar aunque el iPhone esté en silencio»: apagado por omisión y se guarda', async () => {
    aceptarConsentimiento(prueba.ctx, { datosFinancieros: true });
    montar(prueba.ctx, fuentesFalsas(IPHONE_SIN_MEJORADA));
    await screen.findByTestId('ajustes-voz-opcion-0');
    expect(screen.getByText(ETIQUETA_SILENCIO_IOS)).toBeTruthy();
    expect(screen.getByText(DESC_SILENCIO_IOS)).toBeTruthy();
    expect(estado('ajustes-voz-silencio').checked).toBe(false);
    fireEvent.press(screen.getByTestId('ajustes-voz-silencio'));
    expect(obtenerAjustesVoz(prueba.ctx).enSilencio).toBe(true);
    expect(estado('ajustes-voz-silencio').checked).toBe(true);
  });

  it('sin voz mejorada: una sola vez, cómo descargar «Paulina (mejorada)», con la ruta dicha sin signos', async () => {
    aceptarConsentimiento(prueba.ctx, { datosFinancieros: true });
    const fuentes = fuentesFalsas(IPHONE_SIN_MEJORADA);
    const primera = montar(prueba.ctx, fuentes);
    expect(await screen.findByTestId('ajustes-voz-guia')).toBeTruthy();
    expect(screen.getByText(TITULO_GUIA_MEJORADA)).toBeTruthy();
    expect(screen.getByText(GUIA_VOZ_MEJORADA_IOS)).toHaveProp(
      'accessibilityLabel',
      GUIA_VOZ_MEJORADA_IOS_HABLADA,
    );
    expect(obtenerAjustesVoz(prueba.ctx).guiaMejoradaVista).toBe(true);
    fireEvent.press(screen.getByTestId('ajustes-voz-guia-cerrar'));
    expect(screen.queryByTestId('ajustes-voz-guia')).toBeNull();
    primera.unmount();
    montar(prueba.ctx, fuentes);
    await screen.findByTestId('ajustes-voz-opcion-0');
    expect(screen.queryByTestId('ajustes-voz-guia')).toBeNull();
  });

  it('con «Paulina (mejorada)» no hay guía y es la elegida', async () => {
    aceptarConsentimiento(prueba.ctx, { datosFinancieros: true });
    montar(
      prueba.ctx,
      fuentesFalsas([
        ...IPHONE_SIN_MEJORADA,
        voz('com.apple.voice.enhanced.es-MX.Paulina', 'es-MX', 'Enhanced'),
      ]),
    );
    const primera = await screen.findByTestId('ajustes-voz-opcion-0');
    expect(primera).toHaveProp('accessibilityLabel', 'Paulina (mejorada), Español de México · mejorada');
    expect(seleccion('ajustes-voz-opcion-0').selected).toBe(true);
    expect(screen.queryByTestId('ajustes-voz-guia')).toBeNull();
  });
});

describe('Ajustes › Voz › redacción', () => {
  it('tuteo, sin exclamaciones ni tecnicismos; la guía nombra la ruta del iPhone', () => {
    const textos = [
      ETIQUETA_VOZ,
      descVoz('ios'),
      descVoz('android'),
      SIN_VOCES,
      FRASE_MUESTRA_VOZ,
      ETIQUETA_SILENCIO_IOS,
      DESC_SILENCIO_IOS,
      TITULO_GUIA_MEJORADA,
      GUIA_VOZ_MEJORADA_IOS,
      GUIA_VOZ_MEJORADA_IOS_HABLADA,
      ...Object.values(ETIQUETAS_VELOCIDAD),
    ];
    for (const t of textos) {
      expect(t).not.toMatch(/[!¡]/);
      expect(t).not.toMatch(/\busted\b|TTS|sintetizador|\bnetwork\b/i);
    }
    expect(GUIA_VOZ_MEJORADA_IOS).toMatch(/Accesibilidad › Contenido leído › Voces › Español \(México\)/);
    expect(GUIA_VOZ_MEJORADA_IOS_HABLADA).not.toMatch(/[›«»]/);
    expect(descVoz('ios')).not.toMatch(/Android|Google|TalkBack/);
  });
});
