import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { LEYENDA_ESTIMACION } from '../../servicios/deducciones';
import { RESPONSABLE } from '../onboarding/aviso';
import { auditar } from '../__pruebas__/accesibilidad';
import {
  ASUNTO_CORREO_AYUDA,
  CORREO_AYUDA,
  enlaceCorreoAyuda,
  PantallaAyuda,
  PREGUNTAS_FRECUENTES,
} from './index';
import {
  ACCESIBILIDAD_ESCRIBIR_CORREO,
  ACCESIBILIDAD_VOLVER,
  BTN_ESCRIBIR_CORREO,
  CONTACTO_TITULO,
  ETIQUETA_RESPUESTA,
  ETIQUETA_VOLVER,
  INTRO,
  mensajeSinAppCorreo,
  PISTA_ESCRIBIR_CORREO,
  PISTA_VOLVER,
  PREGUNTAS_TITULO,
  pistaPreguntaFrecuente,
  TITULO,
} from './textos';

/** CA-M13-04: ayuda en la app con 10 preguntas frecuentes y correo de contacto. */

const TEMAS = [
  'captura',
  'permisos',
  'efectivo',
  'tarjetas',
  'hoy-puedes',
  'respaldo',
  'privacidad',
  'plus',
  'borrar',
  'facturas',
];

const todoElTexto = (p: (typeof PREGUNTAS_FRECUENTES)[number]) => [p.pregunta, ...p.respuesta].join('\n');

describe('contenido de la ayuda', () => {
  it('la UI fija vive en textos.ts sin exclamaciones', () => {
    const ui = [TITULO, ETIQUETA_VOLVER, BTN_ESCRIBIR_CORREO, mensajeSinAppCorreo(CORREO_AYUDA)].join('\n');
    expect(ui).not.toMatch(/[!¡]/);
  });

  it('son 10 preguntas, una por tema, con ids únicos y respuesta', () => {
    expect(PREGUNTAS_FRECUENTES).toHaveLength(10);
    expect(PREGUNTAS_FRECUENTES.map((p) => p.id)).toEqual(TEMAS);
    for (const p of PREGUNTAS_FRECUENTES) {
      expect(p.pregunta).toMatch(/^¿.+\?$/);
      expect(p.respuesta.length).toBeGreaterThan(0);
      for (const parrafo of p.respuesta) expect(parrafo.trim()).not.toBe('');
    }
  });

  it('sigue las reglas de redacción (`02 §14`): sin exclamaciones, "por favor" ni tecnicismos contables', () => {
    const prohibidas =
      /[!¡]|por favor|exitosamente|\bpasivos?\b|\bactivos?\b|\basientos?\b|transacci[oó]n|d[eé]bito contable|cr[eé]dito contable/i;
    for (const p of PREGUNTAS_FRECUENTES) expect(todoElTexto(p)).not.toMatch(prohibidas);
  });

  it('tutea: no usa "usted" ni formas de "su"', () => {
    for (const p of PREGUNTAS_FRECUENTES) expect(todoElTexto(p)).not.toMatch(/\busted\b|\bsus? datos\b/i);
  });

  it('no promete precios (los pone la tienda) y las deducciones llevan el texto fijo de `08 §1`', () => {
    const plus = PREGUNTAS_FRECUENTES.find((p) => p.id === 'plus');
    expect(todoElTexto(plus as never)).not.toMatch(/\$/);
    const facturas = PREGUNTAS_FRECUENTES.find((p) => p.id === 'facturas');
    expect(facturas?.respuesta).toContain(LEYENDA_ESTIMACION);
  });

  it('el correo es el del responsable y el enlace solo lleva el asunto', () => {
    expect(CORREO_AYUDA).toBe('gerencia@nexara.com.mx');
    expect(CORREO_AYUDA).toBe(RESPONSABLE.correo);
    expect(enlaceCorreoAyuda()).toBe('mailto:gerencia@nexara.com.mx?subject=Ayuda%20con%20Finanvoz');
    expect(decodeURIComponent(enlaceCorreoAyuda())).toContain(ASUNTO_CORREO_AYUDA);
    expect(enlaceCorreoAyuda()).not.toMatch(/body=|cc=|bcc=|&/);
  });
});

describe('pantalla de ayuda', () => {
  afterEach(() => jest.restoreAllMocks());

  it('muestra las 10 preguntas cerradas; tocar una la abre y tocarla otra vez la cierra', () => {
    render(<PantallaAyuda alVolver={jest.fn()} abrirEnlace={jest.fn(async () => {})} />);
    for (const p of PREGUNTAS_FRECUENTES) {
      expect(screen.getByText(p.pregunta)).toBeTruthy();
      expect(screen.queryByTestId(`ayuda-respuesta-${p.id}`)).toBeNull();
    }
    const boton = screen.getByTestId('ayuda-pregunta-respaldo');
    expect(boton).toHaveProp('accessibilityState', { expanded: false });
    expect(boton).toHaveProp('accessibilityHint', pistaPreguntaFrecuente(false));
    fireEvent.press(boton);
    expect(screen.getByTestId('ayuda-respuesta-respaldo')).toHaveProp(
      'accessibilityLabel',
      ETIQUETA_RESPUESTA,
    );
    expect(screen.getByTestId('ayuda-pregunta-respaldo')).toHaveProp('accessibilityState', {
      expanded: true,
    });
    expect(screen.getByTestId('ayuda-pregunta-respaldo')).toHaveProp(
      'accessibilityHint',
      pistaPreguntaFrecuente(true),
    );
    // Abrir otra cierra la anterior.
    fireEvent.press(screen.getByTestId('ayuda-pregunta-borrar'));
    expect(screen.queryByTestId('ayuda-respuesta-respaldo')).toBeNull();
    expect(screen.getByTestId('ayuda-respuesta-borrar')).toBeTruthy();
    fireEvent.press(screen.getByTestId('ayuda-pregunta-borrar'));
    expect(screen.queryByTestId('ayuda-respuesta-borrar')).toBeNull();
  });

  it('cada pregunta abierta pasa la auditoría de accesibilidad (cifras en palabras, rol y nombre)', () => {
    render(<PantallaAyuda alVolver={jest.fn()} abrirEnlace={jest.fn(async () => {})} />);
    expect(auditar(screen.toJSON())).toEqual([]);
    for (const p of PREGUNTAS_FRECUENTES) {
      fireEvent.press(screen.getByTestId(`ayuda-pregunta-${p.id}`));
      expect(auditar(screen.toJSON())).toEqual([]);
    }
    // El "$1,000" de tarjetas se lee en palabras.
    fireEvent.press(screen.getByTestId('ayuda-pregunta-tarjetas'));
    expect(screen.getByText(/\$1,000/)).toHaveProp('accessibilityLabel', expect.stringMatching(/mil pesos/));
  });

  it('"Escribir un correo" abre el mailto sin datos de la persona', async () => {
    const abrir = jest.fn(async () => true);
    render(<PantallaAyuda alVolver={jest.fn()} abrirEnlace={abrir} />);
    expect(screen.getByText(/gerencia@nexara\.com\.mx/)).toBeTruthy();
    expect(screen.getByTestId('ayuda-escribir')).toHaveProp('accessibilityLabel', ACCESIBILIDAD_ESCRIBIR_CORREO);
    expect(screen.getByTestId('ayuda-escribir')).toHaveProp('accessibilityHint', PISTA_ESCRIBIR_CORREO);
    fireEvent.press(screen.getByTestId('ayuda-escribir'));
    expect(abrir).toHaveBeenCalledWith('mailto:gerencia@nexara.com.mx?subject=Ayuda%20con%20Finanvoz');
    await waitFor(() => expect(screen.queryByTestId('ayuda-sin-correo')).toBeNull());
  });

  it('por omisión usa Linking; sin app de correo muestra la dirección', async () => {
    const abrir = jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('sin app'));
    render(<PantallaAyuda alVolver={jest.fn()} />);
    fireEvent.press(screen.getByTestId('ayuda-escribir'));
    expect(abrir).toHaveBeenCalledWith(enlaceCorreoAyuda());
    expect(await screen.findByTestId('ayuda-sin-correo')).toHaveTextContent(mensajeSinAppCorreo(CORREO_AYUDA));
    expect(screen.getByTestId('ayuda-sin-correo')).toHaveProp('accessibilityRole', 'alert');
    expect(auditar(screen.toJSON())).toEqual([]);
  });

  it('"Volver" regresa', () => {
    const volver = jest.fn();
    render(<PantallaAyuda alVolver={volver} />);
    expect(screen.getByTestId('ayuda-volver')).toHaveProp('accessibilityLabel', ACCESIBILIDAD_VOLVER);
    expect(screen.getByTestId('ayuda-volver')).toHaveProp('accessibilityHint', PISTA_VOLVER);
    fireEvent.press(screen.getByTestId('ayuda-volver'));
    expect(volver).toHaveBeenCalled();
  });

  it('expone testID estables en título, intro y contacto', () => {
    render(<PantallaAyuda alVolver={jest.fn()} abrirEnlace={jest.fn(async () => {})} />);
    expect(screen.getByTestId('ayuda-titulo')).toHaveTextContent(TITULO);
    expect(screen.getByTestId('ayuda-titulo')).toHaveProp('accessibilityRole', 'header');
    expect(screen.getByTestId('ayuda-intro')).toHaveTextContent(INTRO);
    expect(screen.getByTestId('ayuda-preguntas-titulo')).toHaveTextContent(PREGUNTAS_TITULO);
    expect(screen.getByTestId('ayuda-preguntas-titulo')).toHaveProp('accessibilityRole', 'header');
    expect(screen.getByTestId('ayuda-contacto-titulo')).toHaveTextContent(CONTACTO_TITULO);
    expect(screen.getByTestId('ayuda-contacto-titulo')).toHaveProp('accessibilityRole', 'header');
  });
});
