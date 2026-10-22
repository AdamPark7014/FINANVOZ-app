import { createHash } from 'node:crypto';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Platform } from 'react-native';
import { ProveedorCaptura } from '../../captura/ProveedorCaptura';
import { aceptarConsentimiento, activarCaptura, obtenerEstadoCaptura } from '../../servicios';
import { apagarCapturaTrasRestaurar } from '../../servicios/estado-captura';
import { ProveedorSesion } from '../../sesion/ProveedorSesion';
import { ProveedorAvisos } from '../principal/ProveedorAvisos';
import { abrirPruebaPantalla } from '../principal/__pruebas__/base';
import { ActivarCaptura } from './ActivarCaptura';
import { TarjetaReactivarCaptura } from './TarjetasCaptura';
import {
  BTN_ENTENDIDO_REACTIVAR_IOS,
  CUERPO_NO_DISPONIBLE,
  CUERPO_NO_DISPONIBLE_IOS,
  CUERPO_REACTIVAR_CAPTURA_IOS,
  ETIQUETA_NO_DISPONIBLE,
  ETIQUETA_NO_DISPONIBLE_IOS,
  etiquetaTarjetaNoDisponibleCaptura,
  TITULO_REACTIVAR_CAPTURA_IOS,
} from './textos';

const sha256 = async (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

/** Sin módulo nativo de captura, como en iPhone. */
function sinCaptura(p: ReturnType<typeof abrirPruebaPantalla>, ui: ReactNode) {
  return render(
    <ProveedorSesion ctx={p.ctx}>
      <ProveedorCaptura puente={null} sha256={sha256} depuracion={false}>
        <ProveedorAvisos>{ui}</ProveedorAvisos>
      </ProveedorCaptura>
    </ProveedorSesion>,
  );
}

/** Todo el texto visible del árbol, para buscar menciones a Android. */
const textoVisible = () => JSON.stringify(screen.toJSON());

describe('Captura en iPhone: sin hablar de Android (auditoría B-3 · 9)', () => {
  it('iOS: "no disponible" explica que iPhone no deja leer notificaciones', () => {
    const plataforma = jest.replaceProperty(Platform, 'OS', 'ios');
    try {
      const p = abrirPruebaPantalla();
      sinCaptura(p, <ActivarCaptura testID="o6" alTerminar={jest.fn()} />);
      expect(screen.getByTestId('o6-pronto-titulo')).toHaveTextContent(ETIQUETA_NO_DISPONIBLE_IOS);
      expect(screen.getByTestId('o6-pronto-titulo')).toHaveProp(
        'accessibilityLabel',
        etiquetaTarjetaNoDisponibleCaptura(true),
      );
      expect(screen.getByTestId('o6-pronto-cuerpo')).toHaveTextContent(CUERPO_NO_DISPONIBLE_IOS);
      expect(textoVisible()).not.toMatch(/Android/);
      expect(screen.getByTestId('o6-continuar')).toBeTruthy();
      p.cerrar();
    } finally {
      plataforma.restore();
    }
  });

  it('Android sin el módulo nativo conserva su texto', () => {
    const p = abrirPruebaPantalla();
    sinCaptura(p, <ActivarCaptura testID="o6" alTerminar={jest.fn()} />);
    expect(screen.getByTestId('o6-pronto-titulo')).toHaveTextContent(ETIQUETA_NO_DISPONIBLE);
    expect(screen.getByTestId('o6-pronto-cuerpo')).toHaveTextContent(CUERPO_NO_DISPONIBLE);
    p.cerrar();
  });

  it('iOS: un respaldo de Android con captura activa no pide "reactivarla"; "Entendido" la apaga', () => {
    const plataforma = jest.replaceProperty(Platform, 'OS', 'ios');
    try {
      const p = abrirPruebaPantalla();
      aceptarConsentimiento(p.ctx, { datosFinancieros: true });
      activarCaptura(p.ctx, ['mx.ejemplo.bancoa']);
      apagarCapturaTrasRestaurar(p.ctx);
      sinCaptura(p, <TarjetaReactivarCaptura testID="reactivar" />);
      expect(screen.getByTestId('reactivar-titulo')).toHaveTextContent(TITULO_REACTIVAR_CAPTURA_IOS);
      expect(screen.getByTestId('reactivar-cuerpo')).toHaveTextContent(CUERPO_REACTIVAR_CAPTURA_IOS);
      expect(screen.queryByTestId('reactivar-reactivar')).toBeNull();
      expect(textoVisible()).not.toMatch(/Android|Vuelve a activar/);
      const entendido = screen.getByTestId('reactivar-ahora-no');
      expect(entendido.props.accessibilityLabel).toBe(BTN_ENTENDIDO_REACTIVAR_IOS);
      fireEvent.press(entendido);
      expect(obtenerEstadoCaptura(p.ctx).activada).toBe(false);
      expect(screen.queryByText(/Puedes activarla cuando quieras/)).toBeNull();
      p.cerrar();
    } finally {
      plataforma.restore();
    }
  });
});
