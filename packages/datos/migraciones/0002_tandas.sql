-- 0002_tandas · tandas de M8 (docs/04-DATOS.md §3.2, docs/05-MOTORES.md §E11). Nunca se edita: los cambios van
-- en una migración nueva. El dinero de la tanda vive en su cuenta `contraparte:tanda` (saldo positivo = te deben;
-- negativo = debes) y sus aportaciones son las ocurrencias de un programado de egreso (`programado_id`).
CREATE TABLE tanda (
  id            TEXT PRIMARY KEY,
  cuenta_id     TEXT NOT NULL UNIQUE REFERENCES cuenta(id),        -- contraparte:tanda:<id>
  nombre        TEXT NOT NULL,
  aportacion    INTEGER NOT NULL CHECK (aportacion > 0),           -- centavos por ronda
  participantes INTEGER NOT NULL CHECK (participantes BETWEEN 2 AND 50),
  turno         INTEGER NOT NULL CHECK (turno BETWEEN 1 AND participantes),  -- 1 = cobras primero
  regla         TEXT NOT NULL,                                     -- JSON Regla (docs/05 §E3.1)
  inicio        TEXT NOT NULL CHECK (length(inicio) = 10),         -- primera ronda
  programado_id TEXT NOT NULL UNIQUE REFERENCES programado(id),    -- aportaciones como compromisos
  activa        INTEGER NOT NULL DEFAULT 1 CHECK (activa IN (0,1))
);
