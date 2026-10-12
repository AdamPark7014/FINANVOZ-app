import { sql } from 'drizzle-orm';
import type { Contexto } from '../servicios/contexto';
import { listarMovimientos } from '../servicios/movimientos';

/** Tablas que se exportan completas (derecho de acceso, `04 §6`). */
const TABLAS = [
  'contacto',
  'alias_contacto',
  'cuenta',
  'alias_cuenta',
  'tarjeta',
  'transaccion',
  'asiento',
  'plan_msi',
  'estado_cuenta',
  'programado',
  'ocurrencia',
  'arqueo',
  'captura',
  'regla_comercio',
  'prediccion',
  'ajuste',
  'auditoria',
  'tanda',
  'suscripcion',
  'plantilla_remota',
  'cfdi',
  'grupo_compartido',
  'evento_compartido',
] as const;

export const FORMATO_EXPORTACION = 'finanvoz-exportacion';
export const VERSION_EXPORTACION = 1;

/** Versión del esquema de la base = migraciones aplicadas (viaja en la exportación y en el respaldo, E16). */
export function versionEsquema(ctx: Pick<Contexto, 'db'>): number {
  return Number(
    ctx.db.get<{ n: number }>(sql.raw('SELECT count(*) AS n FROM "__drizzle_migrations"'))?.n ?? 0,
  );
}

/** Fila tal como sale de SQLite: texto, enteros o nulos (la base no tiene columnas BLOB). */
export type FilaExportada = Record<string, string | number | null>;

export interface DatosExportados {
  readonly formato: typeof FORMATO_EXPORTACION;
  readonly version: typeof VERSION_EXPORTACION;
  readonly version_esquema: number;
  readonly generado_en: number;
  readonly fecha: string;
  readonly montos: 'centavos';
  readonly tablas: Record<string, FilaExportada[]>;
  /**
   * Llaves de los grupos compartidos (`{grupo_id: llave en base64}`, E17). Solo dentro del respaldo cifrado
   * (`05 §E16`); la exportación en claro nunca las lleva.
   */
  readonly llaves_compartidas?: Readonly<Record<string, string>>;
}

/**
 * Exportación completa: todas las filas de todas las tablas tal como están en la base (dinero en centavos,
 * fechas civiles). Es también el contenido del respaldo cifrado (`05 §E16`).
 */
export function datosExportacion(ctx: Contexto): DatosExportados {
  const tablas: Record<string, FilaExportada[]> = {};
  for (const t of TABLAS) {
    tablas[t] = ctx.db.all<FilaExportada>(sql.raw(`SELECT * FROM "${t}" ORDER BY rowid`));
  }
  return {
    formato: FORMATO_EXPORTACION,
    version: VERSION_EXPORTACION,
    version_esquema: versionEsquema(ctx),
    generado_en: ctx.reloj.ahora(),
    fecha: ctx.reloj.hoy(),
    montos: 'centavos',
    tablas,
  };
}

/**
 * Exportación completa en JSON legible (derecho de acceso, `04 §6`). Se genera en el teléfono y se comparte con
 * la hoja del sistema; nunca pasa por un servidor. Disponible siempre (también en Gratis).
 */
export function exportarJson(ctx: Contexto): string {
  return JSON.stringify(datosExportacion(ctx), null, 2);
}

/** `1234567` → `"12345.67"` sin pasar por punto flotante. */
export function centavosADecimal(c: number): string {
  const signo = c < 0 ? '-' : '';
  const a = Math.abs(c);
  return `${signo}${Math.floor(a / 100)}.${String(a % 100).padStart(2, '0')}`;
}

function celda(valor: string | number | null): string {
  if (valor === null) return '';
  const s = String(valor);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const COLUMNAS_CSV = [
  'fecha',
  'tipo',
  'descripcion',
  'comercio',
  'categoria',
  'monto',
  'sentido',
  'sale_de',
  'llega_a',
  'origen',
  'estimado',
  'por_revisar',
  'id',
] as const;

/**
 * CSV de movimientos vigentes (los anulados no aparecen), del más reciente al más antiguo. `monto` en pesos con
 * punto decimal; separador coma, RFC 4180.
 */
export function exportarCsv(ctx: Contexto): string {
  const filas: string[] = [COLUMNAS_CSV.join(',')];
  for (const dia of listarMovimientos(ctx)) {
    for (const m of dia.movimientos) {
      filas.push(
        [
          m.fecha,
          m.tipo,
          m.descripcion,
          m.comercio,
          m.categoria,
          centavosADecimal(m.monto),
          m.sentido,
          m.saleDe.join('; '),
          m.llegaA.join('; '),
          m.origen,
          m.insignias.includes('estimado') ? 1 : 0,
          m.porRevisar ? 1 : 0,
          m.id,
        ]
          .map(celda)
          .join(','),
      );
    }
  }
  return `${filas.join('\r\n')}\r\n`;
}

/** Tablas incluidas en el JSON (una prueba exige que sean todas las de la base). */
export const TABLAS_EXPORTADAS: readonly string[] = TABLAS;
