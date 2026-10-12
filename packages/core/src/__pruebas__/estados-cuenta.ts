import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { EstadoCuentaLeido } from '../captura/estados-cuenta';

/** Ruta de un archivo de `fixtures/pdf/`. */
export const rutaPdf = (nombre: string) =>
  fileURLToPath(new URL(`../../../../fixtures/pdf/${nombre}`, import.meta.url));

/** `fixtures/pdf/analizadores.ejemplo.json` sin validar (eso lo hace el motor). */
export function cargarAnalizadoresEjemplo(): unknown {
  return JSON.parse(readFileSync(rutaPdf('analizadores.ejemplo.json'), 'utf8')) as unknown;
}

export const BANCOS_PDF = ['banco_b', 'banco_e', 'banco_f'] as const;

/** El texto que PDFBox extrae del PDF del banco (lo comprueba `nucleo-jvm`), como una sola página. */
export function textoPdf(banco: string): string {
  return readFileSync(rutaPdf(`${banco}.txt`), 'utf8');
}

/** Lo que el analizador debe leer (CA-M15-01). */
export function jsonEsperado(banco: string): unknown {
  return JSON.parse(readFileSync(rutaPdf(`${banco}.json`), 'utf8')) as unknown;
}

/** `EstadoCuentaLeido` en el vocabulario de los `.json` de `fixtures/pdf` (snake_case). */
export function aJson(e: EstadoCuentaLeido): unknown {
  return {
    analizador: e.analizador,
    banco: e.banco,
    nombre_banco: e.nombreBanco,
    ultimos4: e.ultimos4,
    periodo: e.periodo,
    corte: e.corte,
    limite: e.limite,
    limite_credito: e.limiteCredito,
    saldo_anterior: e.saldoAnterior,
    saldo_corte: e.saldoCorte,
    pngi: e.pngi,
    pago_minimo: e.pagoMinimo,
    total_cargos: e.totalCargos,
    total_abonos: e.totalAbonos,
    movimientos: e.movimientos,
    msi: e.msi.map((m) => ({
      descripcion: m.descripcion,
      monto_original: m.montoOriginal,
      saldo_pendiente: m.saldoPendiente,
      cuota: m.cuota,
      cuota_numero: m.cuotaNumero,
      cuotas_totales: m.cuotasTotales,
    })),
    renglones_sin_leer: e.renglonesSinLeer,
    cuadra: e.cuadra,
  };
}
