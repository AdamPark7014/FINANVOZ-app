import { sql } from 'drizzle-orm';
import { ErrorDominio } from '@cartera/core';
import type { BaseDatos } from '@cartera/datos';

/** Una migración de `packages/datos/migraciones` embebida en el bundle (`migraciones.generado.ts`). */
export interface MigracionEmbebida {
  readonly idx: number;
  readonly etiqueta: string;
  /** `when` del journal: orden y marca de aplicada en `__drizzle_migrations.created_at`. */
  readonly cuando: number;
  readonly puntosDeCorte: boolean;
  readonly hash: string;
  readonly sql: string;
}

const TABLA = '__drizzle_migrations';

/**
 * Corredor de migraciones guiado por el journal, compatible con la tabla `__drizzle_migrations` del migrador
 * de Drizzle (mismo criterio: aplica las que tengan `cuando` mayor que la última registrada). Es síncrono y
 * agnóstico del driver, así corre igual en la app (`expo-sqlite` + SQLCipher) y en Node (`better-sqlite3`).
 * Todo va en una sola transacción: si una sentencia falla, la base queda como estaba.
 *
 * Falla cerrado (`migracion_fuera_de_orden`, sin aplicar nada) si el journal trae una migración con `cuando`
 * menor o igual que la última aplicada que no está registrada: Drizzle la saltaría en silencio.
 *
 * Devuelve las etiquetas aplicadas.
 */
export function migrar(db: BaseDatos, migraciones: readonly MigracionEmbebida[]): string[] {
  db.run(
    sql.raw(
      `CREATE TABLE IF NOT EXISTS "${TABLA}" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)`,
    ),
  );
  const ultima = db.get<{ creada: number | null }>(
    sql.raw(`SELECT max(created_at) AS creada FROM "${TABLA}"`),
  );
  const desde = Number(ultima?.creada ?? -1);
  const aplicadas = new Set(
    db
      .all<{ creada: number }>(sql.raw(`SELECT created_at AS creada FROM "${TABLA}"`))
      .map((f) => Number(f.creada)),
  );
  if (migraciones.some((m) => m.cuando <= desde && !aplicadas.has(m.cuando)))
    throw new ErrorDominio(
      'migracion_fuera_de_orden',
      'hay una migración anterior a la última aplicada que no está registrada',
    );
  const pendientes = [...migraciones].sort((a, b) => a.cuando - b.cuando).filter((m) => m.cuando > desde);
  if (pendientes.length === 0) return [];
  db.transaction((tx) => {
    for (const m of pendientes) {
      const sentencias = m.puntosDeCorte ? m.sql.split('--> statement-breakpoint') : [m.sql];
      for (const s of sentencias) {
        if (s.trim() !== '') tx.run(sql.raw(s));
      }
      tx.run(
        sql`INSERT INTO ${sql.identifier(TABLA)} ("hash", "created_at") VALUES (${m.hash}, ${m.cuando})`,
      );
    }
  });
  return pendientes.map((m) => m.etiqueta);
}
