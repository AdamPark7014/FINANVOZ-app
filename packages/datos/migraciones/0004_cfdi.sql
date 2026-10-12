-- 0004_cfdi · facturas (CFDI 4.0) importadas para las deducciones personales de M12 (docs/04-DATOS.md §3.2 y
-- §3.3, docs/05-MOTORES.md §E13). Se numera 0004 porque M11 se saltó (docs/ESTADO.md → Decisiones).
-- El XML se guarda completo dentro de la base cifrada. Nunca se edita: los cambios van en una migración nueva.
CREATE TABLE cfdi (
  uuid             TEXT PRIMARY KEY CHECK (uuid = upper(uuid)),   -- UUID del timbre, en mayúsculas
  xml              TEXT NOT NULL,
  emisor_rfc       TEXT NOT NULL,
  receptor_rfc     TEXT NOT NULL,
  fecha            TEXT NOT NULL CHECK (length(fecha) = 10),
  tipo_comprobante TEXT NOT NULL,
  uso_cfdi         TEXT,
  forma_pago       TEXT,
  metodo_pago      TEXT,
  total            INTEGER NOT NULL CHECK (total >= 0),           -- centavos
  iva              INTEGER NOT NULL CHECK (iva >= 0),             -- centavos (traslados 002)
  estatus          TEXT NOT NULL DEFAULT 'desconocido'
                   CHECK (estatus IN ('vigente','cancelado','desconocido')),
  etiquetas        TEXT NOT NULL DEFAULT '{}',                    -- JSON validado con Zod (E13.2)
  transaccion_id   TEXT REFERENCES transaccion(id),
  importado_en     INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX cfdi_fecha ON cfdi(fecha);
