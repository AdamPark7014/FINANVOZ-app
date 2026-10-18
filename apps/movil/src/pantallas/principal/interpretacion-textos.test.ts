import { describe, expect, it } from 'vitest';
import {
  etiquetaAvisoRiesgo,
  etiquetaBotonElegirMovimiento,
  etiquetaConfirmarAnularMovimiento,
  etiquetaTarjetaDelDia,
  TEXTO_AVISO_RIESGO_HOY,
  TEXTO_CONFIRMAR_ANULAR_MOVIMIENTO,
  ETIQUETA_AVISO_RIESGO,
  TITULO_DUPLICADOS,
  TITULO_ELEGIR_MOVIMIENTO,
  TITULO_TARJETA_DEL_DIA,
} from './textos';

describe('principal/textos · interpretación', () => {
  it('títulos de elegir movimiento en tuteo', () => {
    expect(TITULO_ELEGIR_MOVIMIENTO.corregir).toMatch(/\?$/);
    expect(TITULO_DUPLICADOS).toMatch(/repetido/i);
  });

  it('botón de anular dice Borrar', () => {
    expect(etiquetaBotonElegirMovimiento('anular')).toBe('Borrar');
    expect(etiquetaBotonElegirMovimiento('corregir')).toBe('Guardar');
  });

  it('tarjeta del día agrupa título y tip para TalkBack', () => {
    expect(etiquetaTarjetaDelDia('Paga la luz antes del viernes')).toBe(
      `${TITULO_TARJETA_DEL_DIA}. Paga la luz antes del viernes`,
    );
  });

  it('aviso de riesgo en Hoy lleva prefijo para TalkBack', () => {
    expect(etiquetaAvisoRiesgo()).toBe(`${ETIQUETA_AVISO_RIESGO}. ${TEXTO_AVISO_RIESGO_HOY}`);
    const cuerpo = 'Revisa qué viene antes de tu próximo ingreso.';
    expect(etiquetaAvisoRiesgo(cuerpo)).toBe(`${ETIQUETA_AVISO_RIESGO}. ${cuerpo}`);
  });

  it('confirmación de anular en Movimientos agrupa la pregunta para TalkBack', () => {
    expect(etiquetaConfirmarAnularMovimiento()).toContain(TEXTO_CONFIRMAR_ANULAR_MOVIMIENTO);
  });
});
