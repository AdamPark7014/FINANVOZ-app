-- 0003_suscripciones · suscripciones detectadas (E14) y plantillas remotas firmadas de M10 (docs/04-DATOS.md §3,
-- docs/07-CAPTURA.md §3.1). Nunca se edita: los cambios van en una migración nueva.
CREATE TABLE suscripcion (
  comercio_normalizado TEXT PRIMARY KEY,                             -- E9.2
  periodicidad         TEXT NOT NULL,                                -- 'mensual' | 'anual' | … (E14)
  monto_tipico         INTEGER NOT NULL CHECK (monto_tipico > 0),    -- centavos
  ultimo_cargo         TEXT NOT NULL CHECK (length(ultimo_cargo) = 10),
  estado               TEXT NOT NULL CHECK (estado IN ('detectada','compromiso','ignorada')),
  programado_id        TEXT UNIQUE REFERENCES programado(id),          -- solo con estado 'compromiso'
  actualizada_en       INTEGER NOT NULL,
  CHECK ((estado = 'compromiso') = (programado_id IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE plantilla_remota (
  version     INTEGER PRIMARY KEY CHECK (version > 0),
  sha256      TEXT NOT NULL CHECK (length(sha256) = 64),
  firma       TEXT NOT NULL,                                         -- Ed25519, base64
  recibida_en INTEGER NOT NULL,
  activa      INTEGER NOT NULL DEFAULT 0 CHECK (activa IN (0,1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX plantilla_remota_una_activa ON plantilla_remota(activa) WHERE activa = 1;
