import { createHash } from 'node:crypto';
import { render, screen } from '@testing-library/react-native';
import { ProveedorCaptura } from '../../captura/ProveedorCaptura';
import type { PuenteCaptura } from '../../captura/tipos';
import { activarCaptura } from '../../servicios';
import { ProveedorSesion } from '../../sesion/ProveedorSesion';
import { conEscenario } from '../principal/__pruebas__/base';
import {
  ETIQUETA_AVISO_AL_CAPTURAR,
  ETIQUETA_CAPTURA_APAGADA,
  ETIQUETA_CAPTURA_NO_DISPONIBLE,
  etiquetaCapturaActiva,
  PISTA_ACTIVAR_CAPTURA,
  PISTA_DESACTIVAR_CAPTURA,
  PREGUNTA_MODO_AVISO,
  SECCION_CAPTURA,
  textoCapturaActiva,
} from './captura-textos';
import { SeccionCaptura } from './SeccionCaptura';

const sha256 = async (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

function puenteFalso(): PuenteCaptura {
  return {
    disponible: () => true,
    esDepuracion: () => true,
    leerCola: jest.fn(async () => []),
    confirmarProcesadas: jest.fn(async () => 0),
    suscribirse: jest.fn(() => () => {}),
    estadoPermiso: jest.fn(async () => 'concedido'),
    appsBancariasInstaladas: jest.fn(async () => []),
    ultimoEvento: jest.fn(async () => null),
    fijarCatalogoRemoto: jest.fn(async () => true),
    fijarListaBlanca: jest.fn(async () => {}),
  } as unknown as PuenteCaptura;
}

describe('captura-textos (TalkBack)', () => {
  it('etiquetaCapturaActiva lee el conteo en palabras', () => {
    expect(textoCapturaActiva(2)).toBe('Activa: leo los avisos de 2 apps de banco.');
    expect(etiquetaCapturaActiva(1)).toBe('Activa: leo los avisos de una app de banco.');
    expect(etiquetaCapturaActiva(2)).toBe('Activa: leo los avisos de dos apps de banco.');
    expect(etiquetaCapturaActiva(0)).toBe('Activa: aún no hay apps de banco en la lista.');
  });

  it('estados apagada y no disponible tienen etiqueta hablada', () => {
    expect(ETIQUETA_CAPTURA_APAGADA).toMatch(/apagada/i);
    expect(ETIQUETA_CAPTURA_NO_DISPONIBLE).toMatch(/no disponible/i);
  });
});

function renderSeccionCaptura(appsActivas?: readonly string[]) {
  const p = conEscenario('e4-01');
  if (appsActivas) activarCaptura(p.ctx, appsActivas);
  render(
    <ProveedorSesion ctx={p.ctx}>
      <ProveedorCaptura puente={puenteFalso()} sha256={sha256} plantillasRemotas={null}>
        <SeccionCaptura />
      </ProveedorCaptura>
    </ProveedorSesion>,
  );
  return p;
}

describe('SeccionCaptura (TalkBack)', () => {
  it('título de sección es encabezado', () => {
    const p = renderSeccionCaptura();
    expect(screen.getByTestId('ajustes-captura-titulo')).toHaveProp('accessibilityRole', 'header');
    expect(screen.getByText(SECCION_CAPTURA)).toBeTruthy();
    p.cerrar();
  });

  it('captura apagada: estado hablado y pista de activar', () => {
    const p = renderSeccionCaptura();
    expect(screen.getByTestId('ajustes-captura-estado')).toHaveProp(
      'accessibilityLabel',
      ETIQUETA_CAPTURA_APAGADA,
    );
    expect(screen.getByTestId('ajustes-captura-activar')).toHaveProp(
      'accessibilityHint',
      PISTA_ACTIVAR_CAPTURA,
    );
    p.cerrar();
  });

  it('sin puente nativo: no disponible y sin activar', () => {
    const p = conEscenario('e4-01');
    render(
      <ProveedorSesion ctx={p.ctx}>
        <ProveedorCaptura puente={null} sha256={sha256} plantillasRemotas={null}>
          <SeccionCaptura />
        </ProveedorCaptura>
      </ProveedorSesion>,
    );
    expect(screen.getByTestId('ajustes-captura-estado')).toHaveProp(
      'accessibilityLabel',
      ETIQUETA_CAPTURA_NO_DISPONIBLE,
    );
    expect(screen.queryByTestId('ajustes-captura-activar')).toBeNull();
    p.cerrar();
  });

  it('con captura activa: estado, aviso y modo aviso para TalkBack', () => {
    const p = renderSeccionCaptura(['mx.ejemplo.bancoa']);
    expect(screen.getByTestId('ajustes-captura-estado')).toHaveProp(
      'accessibilityLabel',
      etiquetaCapturaActiva(1),
    );
    expect(screen.getByTestId('ajustes-captura-aviso-titulo')).toHaveProp('accessibilityRole', 'header');
    expect(screen.getByText(ETIQUETA_AVISO_AL_CAPTURAR)).toBeTruthy();
    const pregunta = screen.getByTestId('ajustes-captura-aviso-pregunta', { includeHiddenElements: true });
    expect(pregunta.props.accessibilityElementsHidden).toBe(true);
    expect(pregunta.props.importantForAccessibility).toBe('no-hide-descendants');
    const grupo = screen.getByLabelText(PREGUNTA_MODO_AVISO);
    expect(grupo.props.accessibilityRole).toBe('radiogroup');
    expect(screen.getByTestId('ajustes-captura-aviso-agrupados').props.accessibilityState?.selected).toBe(
      true,
    );
    expect(screen.getByTestId('ajustes-captura-desactivar')).toHaveProp(
      'accessibilityHint',
      PISTA_DESACTIVAR_CAPTURA,
    );
    p.cerrar();
  });
});
