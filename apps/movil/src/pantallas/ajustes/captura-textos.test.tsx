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

describe('SeccionCaptura (TalkBack)', () => {
  it('con captura activa, aviso al capturar es encabezado', () => {
    const p = conEscenario('e4-01');
    activarCaptura(p.ctx, ['mx.ejemplo.bancoa']);
    render(
      <ProveedorSesion ctx={p.ctx}>
        <ProveedorCaptura puente={puenteFalso()} sha256={sha256} plantillasRemotas={null}>
          <SeccionCaptura />
        </ProveedorCaptura>
      </ProveedorSesion>,
    );
    expect(screen.getByTestId('ajustes-captura-aviso-titulo')).toHaveProp('accessibilityRole', 'header');
    expect(screen.getByText(ETIQUETA_AVISO_AL_CAPTURAR)).toBeTruthy();
    p.cerrar();
  });
});
