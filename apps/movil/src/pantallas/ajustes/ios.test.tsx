import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import { aceptarConsentimiento, type Contexto } from '../../servicios';
import { mensajeAutenticacion, pistaDesbloquear, type Autenticador } from '../../seguridad';
import { ProveedorSesion } from '../../sesion/ProveedorSesion';
import { PantallaAyuda, PREGUNTAS_FRECUENTES, preguntasFrecuentes } from '../ayuda';
import { abrirPruebaPantalla } from '../principal/__pruebas__/base';
import { pistaPermisosTelefono, permisosTelefono, saleDelTelefono, textoCaptura } from '../privacidad/textos';
import { SeccionBloqueo } from './SeccionBloqueo';
import { SeccionCaptura } from './SeccionCaptura';
import { SeccionVoz } from './SeccionVoz';
import {
  descMultitarea,
  ETIQUETA_BLOQUEO_IOS,
  etiquetaBloqueo,
  DESC_MULTITAREA_IOS,
  mensajeBloqueoSinSeguridad,
} from './textos';
import { PISTA_CONTESTAR_EN_VOZ_IOS, pistaContestarEnVoz } from './voz-textos';

/** Palabras que en un iPhone serían mentira o no existen. */
const SOLO_ANDROID =
  /Android|Google Play|TalkBack|huella|\bPIN\b|acceso a notificaciones|Permitir ajustes restringidos/i;

function montar(ctx: Contexto, ui: ReactNode) {
  return render(
    <ProveedorSesion ctx={ctx} nube={null}>
      {ui}
    </ProveedorSesion>,
  );
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('textos de iPhone (auditoría: nada de Android visible en iOS)', () => {
  it('Ajustes: bloqueo con Face ID o código, multitarea sin prometer que se bloquean capturas, voz con VoiceOver', () => {
    expect(etiquetaBloqueo('ios')).toBe('Pedir Face ID o código al abrir');
    expect(etiquetaBloqueo('android')).toBe('Pedir huella o PIN al abrir');
    expect(descMultitarea('ios')).not.toMatch(/captura/i);
    expect(descMultitarea('android')).toMatch(/capturas de pantalla/);
    expect(pistaContestarEnVoz('ios')).toMatch(/VoiceOver/);
    expect(pistaContestarEnVoz('android')).toMatch(/TalkBack/);
    expect(mensajeBloqueoSinSeguridad('ios')).toMatch(/Face ID y código/);
    for (const t of [
      etiquetaBloqueo('ios'),
      descMultitarea('ios'),
      pistaContestarEnVoz('ios'),
      mensajeBloqueoSinSeguridad('ios'),
    ]) {
      expect(t).not.toMatch(SOLO_ANDROID);
    }
  });

  it('cortina de bloqueo: Face ID o código y cómo poner un código', () => {
    expect(pistaDesbloquear('ios')).toBe('Usa Face ID o el código del iPhone');
    expect(mensajeAutenticacion('sin_seguridad', 'ios')).toMatch(/Face ID y código/);
    expect(mensajeAutenticacion('sin_seguridad', 'ios')).not.toMatch(SOLO_ANDROID);
    expect(mensajeAutenticacion('sin_seguridad', 'android')).toMatch(/PIN/);
  });

  it('privacidad: sin Google Play ni acceso a notificaciones; Face ID; captura explicada', () => {
    const sale = saleDelTelefono('ios')
      .map((s) => `${s.que} ${s.quien}`)
      .join('\n');
    expect(sale).not.toMatch(/Google Play|RevenueCat/);
    expect(saleDelTelefono('android').some((s) => /Google Play/.test(s.quien))).toBe(true);
    const permisos = permisosTelefono('ios')
      .map((p) => `${p.nombre} ${p.para}`)
      .join('\n');
    expect(permisos).toMatch(/Face ID/);
    expect(permisos).not.toMatch(SOLO_ANDROID);
    expect(pistaPermisosTelefono('ios')).not.toMatch(SOLO_ANDROID);
    expect(textoCaptura(false, 0, 'ios')).toMatch(/no existe en iPhone/);
    expect(textoCaptura(true, 2, 'android')).toMatch(/2 apps de banco/);
  });

  it('ayuda: las mismas 10 preguntas, sin Android, Google Play, TalkBack, huella ni PIN', () => {
    const ios = preguntasFrecuentes('ios');
    expect(ios.map((p) => p.id)).toEqual(PREGUNTAS_FRECUENTES.map((p) => p.id));
    for (const p of ios) expect([p.pregunta, ...p.respuesta].join('\n')).not.toMatch(SOLO_ANDROID);
    expect(preguntasFrecuentes('android')).toBe(PREGUNTAS_FRECUENTES);
  });
});

describe('pantallas con Platform.OS = ios', () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'ios');
  });

  it('Ajustes oculta «Captura automática» (solo Android) y nombra Face ID y VoiceOver', () => {
    const p = abrirPruebaPantalla();
    aceptarConsentimiento(p.ctx, { datosFinancieros: true });
    const conCodigo: Autenticador = {
      disponible: async () => true,
      autenticar: async () => ({ exito: true }),
    };
    montar(
      p.ctx,
      <>
        <SeccionBloqueo autenticador={conCodigo} />
        <SeccionVoz />
        <SeccionCaptura />
      </>,
    );
    expect(screen.queryByTestId('ajustes-captura')).toBeNull();
    expect(screen.getByText(ETIQUETA_BLOQUEO_IOS)).toBeTruthy();
    expect(screen.getByText(DESC_MULTITAREA_IOS)).toBeTruthy();
    expect(screen.getByTestId('ajustes-voz-contestar')).toHaveProp(
      'accessibilityHint',
      PISTA_CONTESTAR_EN_VOZ_IOS,
    );
    p.cerrar();
  });

  it('un iPhone sin código no enciende el bloqueo y VoiceOver oye por qué', async () => {
    const p = abrirPruebaPantalla();
    aceptarConsentimiento(p.ctx, { datosFinancieros: true });
    const anuncio = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    const sinCodigo: Autenticador = {
      disponible: async () => false,
      autenticar: async () => ({ exito: false, error: 'sin_seguridad' }),
    };
    montar(p.ctx, <SeccionBloqueo autenticador={sinCodigo} />);
    await act(async () => {
      fireEvent.press(screen.getByTestId('ajustes-bloqueo'));
    });
    expect(screen.getByTestId('ajustes-bloqueo')).toHaveProp('accessibilityState', {
      checked: false,
      disabled: false,
    });
    expect(screen.getByTestId('ajustes-bloqueo-mensaje')).toHaveTextContent(
      mensajeBloqueoSinSeguridad('ios'),
    );
    expect(anuncio).toHaveBeenCalledWith(mensajeBloqueoSinSeguridad('ios'));
    p.cerrar();
  });

  it('Ayuda muestra la respuesta de iPhone y el correo se puede copiar', () => {
    render(<PantallaAyuda alVolver={jest.fn()} abrirEnlace={jest.fn(async () => {})} />);
    fireEvent.press(screen.getByTestId('ayuda-pregunta-captura'));
    expect(screen.getByText(/iOS no deja que una app lea las notificaciones/)).toBeTruthy();
    expect(screen.queryByText(/Por ahora solo Android/)).toBeNull();
    expect(screen.getByTestId('ayuda-contacto-cuerpo')).toHaveProp('selectable', true);
  });
});
