import { describe, expect, it } from 'vitest';
import { ENLACE_WIDGET, type VistaWidget } from '../servicios';
import {
  detalleConSeparador,
  etiquetaAccesibleWidget,
  tamanoFuenteCifra,
} from './formatoWidget';

describe('formatoWidget (presentación)', () => {
  it('detalle con separador medio', () => {
    expect(detalleConSeparador('4 días')).toBe('· 4 días');
    expect(detalleConSeparador(null)).toBeNull();
  });

  it('tamaño de fuente según longitud de la cifra', () => {
    expect(tamanoFuenteCifra('$214')).toBe(22);
    expect(tamanoFuenteCifra('$12,345')).toBe(20);
    expect(tamanoFuenteCifra('$123,456.78')).toBe(18);
  });

  it('TalkBack lee centavos cuando la cifra trae decimales', () => {
    const vista: VistaWidget = {
      tipo: 'cifra',
      titulo: 'Hoy puedes',
      cifra: '$1,099.90',
      detalle: '4 días',
      texto: 'Hoy puedes $1,099.90 · 4 días',
      enlace: ENLACE_WIDGET,
    };
    expect(etiquetaAccesibleWidget(vista)).toMatch(/noventa centavos/);
  });
});
