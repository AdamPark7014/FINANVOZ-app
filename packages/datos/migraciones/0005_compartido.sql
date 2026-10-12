-- 0005_compartido · gastos compartidos en pareja de M16 (docs/04-DATOS.md §3.2, docs/05-MOTORES.md §E17).
-- Se numera 0005 porque M11 se saltó y M12 usó 0004 (docs/ESTADO.md → Decisiones): el journal sigue contiguo.
-- La llave del grupo vive en el almacén seguro (y viaja dentro del respaldo cifrado, E16), nunca en la base.
-- Nunca se edita: los cambios van en una migración nueva.
CREATE TABLE grupo_compartido (
  id             TEXT PRIMARY KEY,                                  -- UUID que asigna el servidor
  nombre         TEXT NOT NULL CHECK (length(nombre) BETWEEN 1 AND 80),
  contraparte_id TEXT NOT NULL UNIQUE REFERENCES cuenta(id),        -- contraparte:pareja de este grupo
  mi_autor       TEXT NOT NULL CHECK (mi_autor IN ('a','b')),
  creado_en      INTEGER NOT NULL,
  cerrado_en     INTEGER                                            -- ms UTC del cierre que marcó el servidor
);
--> statement-breakpoint
-- `id` es UUIDv4 (excepción a §1: va en claro en el servidor, E17). `recibido_en` es el instante del servidor
-- (texto ISO 8601 con microsegundos); NULL = creado en este teléfono y todavía no publicado.
CREATE TABLE evento_compartido (
  id             TEXT PRIMARY KEY,
  grupo_id       TEXT NOT NULL REFERENCES grupo_compartido(id),
  autor          TEXT NOT NULL CHECK (autor IN ('a','b')),
  creado_en      INTEGER NOT NULL,
  tipo           TEXT NOT NULL
                 CHECK (tipo IN ('gasto_compartido_creado','pago_compartido_creado','evento_anulado')),
  cuerpo         TEXT NOT NULL,                                     -- JSON validado con Zod (E17)
  transaccion_id TEXT REFERENCES transaccion(id),                   -- asientos de E12.2 en este libro
  recibido_en    TEXT
);
--> statement-breakpoint
CREATE INDEX evento_compartido_grupo ON evento_compartido(grupo_id, recibido_en);
--> statement-breakpoint
-- Un evento es inmutable (E17): solo se completan `transaccion_id` y `recibido_en`. No se borra.
CREATE TRIGGER evento_compartido_inmutable_u
BEFORE UPDATE OF id, grupo_id, autor, creado_en, tipo, cuerpo ON evento_compartido
BEGIN
  SELECT RAISE(ABORT, 'evento_compartido_inmutable');
END;
--> statement-breakpoint
CREATE TRIGGER evento_compartido_inmutable_d
BEFORE DELETE ON evento_compartido
BEGIN
  SELECT RAISE(ABORT, 'evento_compartido_inmutable');
END;
