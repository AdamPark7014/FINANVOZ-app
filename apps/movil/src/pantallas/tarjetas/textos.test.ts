import { describe, expect, it } from 'vitest';
import {
  ACCESIBILIDAD_TARJETA_NO_ENCONTRADA,
  etiquetaAccesibleDato,
  etiquetaAccesibleMovimientoTarjeta,
  etiquetaAccesiblePlanMsi,
  etiquetaAccesibleUsoTarjeta,
  etiquetaVacioEstadosTarjeta,
  etiquetaVacioMovimientosTarjeta,
  etiquetaVacioMsiTarjeta,
  etiquetaSiLiquidar,
  mensajePagoPlaneadoApartado,
  preguntaTarjetaConfirmarMsi,
  PISTA_VOLVER,
  TITULO_DESDE_ULTIMO_CORTE,
  TITULO_ESTADOS_CUENTA,
  tituloCompraMsiMeses,
  TITULO_CONFIRMAR_MSI,
  VACIO_MSI_TARJETA,
  VACIO_MOVIMIENTOS_TARJETA,
} from './textos';

describe('tarjetas/textos · confirmar MSI', () => {
  it('título de compra incluye meses', () => {
    expect(tituloCompraMsiMeses(12)).toBe('Compra a 12 meses sin intereses');
  });

  it('motivo monto alto coincide con confirmación de registro', () => {
    expect(TITULO_CONFIRMAR_MSI.monto_alto).toMatch(/Revísalo/);
  });

  it('aviso al apartar pago planeado incluye el monto', () => {
    expect(mensajePagoPlaneadoApartado(50_000)).toBe('Listo: aparto $500 para cada pago planeado.');
  });

  it('vacío MSI incluye el título de sección para TalkBack', () => {
    expect(etiquetaVacioMsiTarjeta()).toBe(`Meses sin intereses. ${VACIO_MSI_TARJETA}`);
  });
});

describe('tarjetas/textos · TalkBack', () => {
  it('vacíos de movimientos y estados antepone el título de sección', () => {
    expect(etiquetaVacioMovimientosTarjeta(TITULO_DESDE_ULTIMO_CORTE)).toBe(
      `${TITULO_DESDE_ULTIMO_CORTE}. ${VACIO_MOVIMIENTOS_TARJETA}`,
    );
    expect(etiquetaVacioEstadosTarjeta('Tu primer corte con la app es el 28 oct.')).toBe(
      `${TITULO_ESTADOS_CUENTA}. Tu primer corte con la app es el 28 oct.`,
    );
  });

  it('volver y tarjeta inexistente guían de regreso a Cuentas', () => {
    expect(PISTA_VOLVER).toBe('Regresa a Cuentas');
    expect(ACCESIBILIDAD_TARJETA_NO_ENCONTRADA).toMatch(/Volver/);
    expect(ACCESIBILIDAD_TARJETA_NO_ENCONTRADA).toMatch(/Cuentas/);
  });

  it('filas del resumen y movimientos leen etiqueta y valor', () => {
    expect(etiquetaAccesibleDato('Próximo corte', '28 oct')).toBe('Próximo corte: 28 oct');
    expect(etiquetaAccesibleUsoTarjeta(42)).toBe('Usas 42 % de tu límite');
    expect(
      etiquetaAccesibleMovimientoTarjeta('Oxxo', '12 oct', '$150.00', true),
    ).toBe('Oxxo, 12 oct, gasto $150.00');
    expect(
      etiquetaAccesibleMovimientoTarjeta('Pago', '1 nov', '$2,000.00', false),
    ).toBe('Pago, 1 nov, abono $2,000.00');
  });

  it('plan MSI describe cuota y cuotas restantes', () => {
    expect(etiquetaAccesiblePlanMsi('Tele', '$500.00', 6, 12)).toBe(
      'Tele, $500.00 al mes, faltan 6 de 12',
    );
  });
});
