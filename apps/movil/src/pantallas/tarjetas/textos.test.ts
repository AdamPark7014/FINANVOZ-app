import { describe, expect, it } from 'vitest';
import {
  ACCESIBILIDAD_TARJETA_NO_ENCONTRADA,
  etiquetaAccesibleDato,
  etiquetaAccesibleMovimientoTarjeta,
  etiquetaAccesibleEstadoCuentaTarjeta,
  etiquetaAccesiblePlanMsi,
  etiquetaAccesibleBarraUsoTarjeta,
  etiquetaAccesibleSaldoAFavorDetalle,
  etiquetaAccesibleTarjetaEnLista,
  etiquetaAccesibleUsoTarjeta,
  AYUDA_SALDO_A_FAVOR,
  PISTA_ABRIR_DETALLE_TARJETA,
  PISTA_GUARDAR_PAGO_TARJETA,
  PISTA_PAGAR_TARJETA,
  etiquetaVacioEstadosTarjeta,
  etiquetaVacioMovimientosTarjeta,
  etiquetaVacioMsiTarjeta,
  etiquetaAvisoNoSeIncluyeMsi,
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

  it('pregunta tarjeta desconocida cita el alias dictado', () => {
    expect(preguntaTarjetaConfirmarMsi({ motivo: 'no_encontrada', alias: 'Oro' })).toBe(
      'No tengo una tarjeta «Oro». ¿Con cuál fue?',
    );
    expect(preguntaTarjetaConfirmarMsi({ motivo: 'cuenta' })).toBe(TITULO_CONFIRMAR_MSI.cuenta);
  });

  it('etiqueta accesible de liquidar repite la descripción del plan', () => {
    expect(etiquetaSiLiquidar('la tele')).toBe('Sí, la tele');
  });

  it('aviso «No sé» en saldo incluye meses antepone Aviso para TalkBack', () => {
    expect(etiquetaAvisoNoSeIncluyeMsi()).toMatch(/^Aviso:/);
    expect(etiquetaAvisoNoSeIncluyeMsi()).toMatch(/estado de cuenta/);
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

  it('pagar en el detalle y saldo a favor incluyen pista y aviso E4-07', () => {
    expect(PISTA_PAGAR_TARJETA).toMatch(/cuenta/i);
    expect(PISTA_GUARDAR_PAGO_TARJETA).toMatch(/libro/i);
    expect(etiquetaAccesibleSaldoAFavorDetalle(580_000)).toBe(
      `Saldo a favor: cinco mil ochocientos pesos. ${AYUDA_SALDO_A_FAVOR}`,
    );
  });

  it('filas del resumen y movimientos leen etiqueta y valor', () => {
    expect(etiquetaAccesibleDato('Próximo corte', '28 oct')).toBe('Próximo corte: 28 oct');
    expect(etiquetaAccesibleUsoTarjeta(42)).toBe('Usas 42 % de tu límite');
    expect(etiquetaAccesibleBarraUsoTarjeta(4, 3_000_000)).toBe(
      'Usas 4 % de tu límite de treinta mil pesos. La marca es el 30 %.',
    );
    expect(etiquetaAccesibleMovimientoTarjeta('Oxxo', '12 oct', 15_000, true)).toBe(
      'Oxxo, 12 oct, gasto ciento cincuenta pesos',
    );
    expect(etiquetaAccesibleMovimientoTarjeta('Pago', '1 nov', 200_000, false)).toBe(
      'Pago, 1 nov, abono dos mil pesos',
    );
  });

  it('plan MSI describe cuota y cuotas restantes', () => {
    expect(etiquetaAccesiblePlanMsi('Tele', '$500.00', 6, 12)).toBe(
      'Tele, $500.00 al mes, faltan 6 de 12',
    );
  });

  it('lista en Cuentas resume deuda, fechas y barra en una etiqueta', () => {
    expect(PISTA_ABRIR_DETALLE_TARJETA).toBe('Abre el detalle de la tarjeta');
    const debes = {
      id: 'tc:oro',
      tipo: 'tarjeta' as const,
      nombre: 'Oro',
      ultimos4: '8812',
      saldo: 120_000,
      meses: 0,
      limiteCredito: 3_000_000,
      apartar: null,
    };
    const vista = {
      pngi: 0,
      etiquetaFechaLimite: '30 nov',
      etiquetaProximoCorte: '10 dic',
      usoPorcentaje: 4,
      limiteCredito: 3_000_000,
    };
    const etiqueta = etiquetaAccesibleTarjetaEnLista(debes, vista as never);
    expect(etiqueta).toMatch(/Debes en Oro.*mil doscientos pesos/);
    expect(etiqueta).toMatch(/treinta mil pesos\. La marca es el 30 %/);
  });

  it('estado de cuenta cerrado resume saldo, pagos y PNGI en palabras', () => {
    expect(
      etiquetaAccesibleEstadoCuentaTarjeta('10 nov', 450_000, 100_000, 350_000, '30 nov'),
    ).toBe(
      'Corte del 10 nov. Lo que debías el día de corte: cuatro mil quinientos pesos. Lo que ya pagaste desde entonces: mil pesos. Para no generar intereses: tres mil quinientos pesos. Fecha límite: 30 nov',
    );
  });
});
