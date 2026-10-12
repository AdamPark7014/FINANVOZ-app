-- 0001_inicial · esquema de docs/04-DATOS.md §3 (copiado tal cual), cuentas de sistema (§2.1)
-- y catálogo de categorías del espacio personal (§2.3). Nunca se edita: los cambios van en una migración nueva.
-- Las sentencias se separan con el marcador de Drizzle (statement-breakpoint).
CREATE TABLE contacto (
  id         TEXT PRIMARY KEY,
  nombre     TEXT NOT NULL,
  telefono   TEXT,
  creado_en  INTEGER NOT NULL
);
--> statement-breakpoint

CREATE TABLE alias_contacto (
  contacto_id       TEXT NOT NULL REFERENCES contacto(id),
  alias_normalizado TEXT NOT NULL,
  PRIMARY KEY (contacto_id, alias_normalizado)
);
--> statement-breakpoint

CREATE TABLE cuenta (
  id             TEXT PRIMARY KEY,
  naturaleza     TEXT NOT NULL CHECK (naturaleza IN ('activo','pasivo','contraparte','ingreso','gasto','capital')),
  subtipo        TEXT NOT NULL,
  nombre         TEXT NOT NULL,
  padre_id       TEXT REFERENCES cuenta(id),          -- subcuenta MSI → su tarjeta (cuenta raíz)
  institucion    TEXT,
  ultimos4       TEXT CHECK (ultimos4 IS NULL OR ultimos4 GLOB '[0-9][0-9][0-9][0-9]'),
  liquida        INTEGER NOT NULL DEFAULT 0 CHECK (liquida IN (0,1)),
  espacio        TEXT NOT NULL DEFAULT 'personal' CHECK (espacio IN ('personal','negocio')),
  comision_bp    INTEGER CHECK (comision_bp IS NULL OR comision_bp BETWEEN 0 AND 2000),  -- no nulo = terminal de cobro (M11, 07 §5)
  categoria_slug TEXT,
  tipo_gasto     TEXT CHECK (tipo_gasto IS NULL OR tipo_gasto IN ('variable','fijo')),
  contacto_id    TEXT REFERENCES contacto(id),
  apartar_deuda  INTEGER NOT NULL DEFAULT 1 CHECK (apartar_deuda IN (0,1)),  -- persona: E4 aparta lo que le debes
  sistema        INTEGER NOT NULL DEFAULT 0 CHECK (sistema IN (0,1)),
  archivada      INTEGER NOT NULL DEFAULT 0 CHECK (archivada IN (0,1)),
  creada_en      INTEGER NOT NULL,
  CHECK (liquida = 0 OR (naturaleza = 'activo' AND subtipo IN ('efectivo','debito','billetera'))),
  CHECK (sistema = 0 OR archivada = 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX cuenta_categoria ON cuenta(espacio, categoria_slug) WHERE categoria_slug IS NOT NULL;
--> statement-breakpoint
CREATE INDEX cuenta_activas ON cuenta(espacio, naturaleza, subtipo) WHERE archivada = 0;
--> statement-breakpoint
CREATE INDEX cuenta_ultimos4 ON cuenta(ultimos4) WHERE ultimos4 IS NOT NULL;
--> statement-breakpoint

CREATE TABLE alias_cuenta (
  cuenta_id         TEXT NOT NULL REFERENCES cuenta(id),
  alias_normalizado TEXT NOT NULL,
  PRIMARY KEY (cuenta_id, alias_normalizado)
);
--> statement-breakpoint
CREATE INDEX alias_cuenta_texto ON alias_cuenta(alias_normalizado);
--> statement-breakpoint

CREATE TABLE tarjeta (
  cuenta_id       TEXT PRIMARY KEY REFERENCES cuenta(id),
  dia_corte       INTEGER NOT NULL CHECK (dia_corte BETWEEN 1 AND 31),
  dias_para_pagar INTEGER CHECK (dias_para_pagar BETWEEN 1 AND 60),
  dia_limite_pago INTEGER CHECK (dia_limite_pago BETWEEN 1 AND 31),
  limite_credito  INTEGER NOT NULL CHECK (limite_credito > 0),
  modo            TEXT NOT NULL DEFAULT 'totalero' CHECK (modo IN ('totalero','plan')),
  tasa_anual_bp   INTEGER,
  alta            TEXT NOT NULL CHECK (length(alta) = 10),  -- fecha de registro en la app; E5.3 solo procesa cortes posteriores
  CHECK ((dias_para_pagar IS NULL) <> (dia_limite_pago IS NULL))
);
--> statement-breakpoint

CREATE TABLE transaccion (
  id                 TEXT PRIMARY KEY,
  fecha              TEXT NOT NULL CHECK (length(fecha) = 10),
  registrada_en      INTEGER NOT NULL,
  tipo               TEXT NOT NULL CHECK (tipo IN (
                       'gasto','ingreso','transferencia','transferencia_pendiente','retiro_efectivo',
                       'pago_tarjeta','prestamo_otorgado','cobro_prestamo','prestamo_recibido','pago_prestamo',
                       'compra_msi','reclasificacion_msi','liquidacion_msi','cuenta_dividida',
                       'aportacion_tanda','cobro_tanda','ajuste_arqueo','reembolso',
                       'saldo_inicial','conciliacion','reversa',
                       'venta_credito','cobro_cliente','retiro_dueno','aportacion_dueno','pago_impuestos')),
                       -- los cinco últimos se usan desde M11 (negocio); están desde 0001 porque un CHECK no se altera
  descripcion        TEXT,
  comercio           TEXT,
  origen             TEXT NOT NULL CHECK (origen IN ('voz','texto','manual','notificacion','correo','estado_cuenta','ticket','arqueo','sistema')),
  estimada           INTEGER NOT NULL DEFAULT 0 CHECK (estimada IN (0,1)),
  extraordinaria     INTEGER NOT NULL DEFAULT 0 CHECK (extraordinaria IN (0,1)),
  por_revisar        INTEGER NOT NULL DEFAULT 0 CHECK (por_revisar IN (0,1)),  -- aparece en "Por revisar"
  clave_idempotencia TEXT NOT NULL UNIQUE,
  revierte_a         TEXT UNIQUE REFERENCES transaccion(id),   -- UNIQUE: una transacción se anula una sola vez
  reemplaza_a        TEXT REFERENCES transaccion(id),
  meta               TEXT,
  CHECK ((tipo = 'reversa') = (revierte_a IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX transaccion_fecha ON transaccion(fecha);
--> statement-breakpoint

CREATE TABLE asiento (
  id             TEXT PRIMARY KEY,
  transaccion_id TEXT NOT NULL REFERENCES transaccion(id),
  cuenta_id      TEXT NOT NULL REFERENCES cuenta(id),
  monto          INTEGER NOT NULL CHECK (monto <> 0)
);
--> statement-breakpoint
CREATE INDEX asiento_cuenta ON asiento(cuenta_id);
--> statement-breakpoint
CREATE INDEX asiento_transaccion ON asiento(transaccion_id);
--> statement-breakpoint

-- Inmutabilidad del libro
CREATE TRIGGER asiento_inmutable_u BEFORE UPDATE ON asiento BEGIN SELECT RAISE(ABORT, 'asiento inmutable'); END;
--> statement-breakpoint
CREATE TRIGGER asiento_inmutable_d BEFORE DELETE ON asiento BEGIN SELECT RAISE(ABORT, 'asiento inmutable'); END;
--> statement-breakpoint
CREATE TRIGGER transaccion_inmutable_d BEFORE DELETE ON transaccion BEGIN SELECT RAISE(ABORT, 'transaccion inmutable'); END;
--> statement-breakpoint
CREATE TRIGGER transaccion_campos_fijos
BEFORE UPDATE OF fecha, tipo, origen, estimada, clave_idempotencia, revierte_a, reemplaza_a, registrada_en ON transaccion
BEGIN SELECT RAISE(ABORT, 'campo inmutable'); END;
--> statement-breakpoint
CREATE TRIGGER reversa_no_anulable BEFORE INSERT ON transaccion
WHEN NEW.revierte_a IS NOT NULL AND (SELECT tipo FROM transaccion WHERE id = NEW.revierte_a) = 'reversa'
BEGIN SELECT RAISE(ABORT, 'una reversa no se anula'); END;
--> statement-breakpoint
-- Editables sin reversa (no financieros): descripcion, comercio, extraordinaria, por_revisar, meta.
-- Cada cambio deja registro en auditoria.

-- Transacciones vigentes: ni anuladas ni reversas. Las usan reportes, consultas y E8.2.
-- Los saldos NO usan esta vista: suman todos los asientos (la reversa ya compensa).
CREATE VIEW transaccion_vigente AS
SELECT t.* FROM transaccion t
WHERE t.tipo <> 'reversa'
  AND NOT EXISTS (SELECT 1 FROM transaccion r WHERE r.revierte_a = t.id);
--> statement-breakpoint

CREATE TABLE plan_msi (
  id                  TEXT PRIMARY KEY,
  tarjeta_id          TEXT NOT NULL REFERENCES tarjeta(cuenta_id),
  cuenta_msi_id       TEXT NOT NULL REFERENCES cuenta(id),
  transaccion_alta_id TEXT NOT NULL REFERENCES transaccion(id),
  origen_alta         TEXT NOT NULL CHECK (origen_alta IN ('compra','existente','pasar_a_meses')),
  monto               INTEGER NOT NULL CHECK (monto > 0),       -- existente: mensualidad × restantes
  meses               INTEGER NOT NULL CHECK (meses BETWEEN 1 AND 48),  -- cuotas que lleva la app; compra nueva ≥ 2
  meses_diferimiento  INTEGER NOT NULL DEFAULT 0 CHECK (meses_diferimiento >= 0),
  fecha_compra        TEXT,                                     -- NULL solo si origen_alta = 'existente'
  primer_corte        TEXT NOT NULL,                            -- corte de la cuota 1 (E6.1)
  estado              TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','liquidado','terminado')),
  CHECK ((origen_alta = 'existente') = (fecha_compra IS NULL))
);
--> statement-breakpoint
-- Cuota k (1..meses): distribuirMayorResiduo(monto, [1 × meses])[k−1], en el corte k−1 posterior a primer_corte.
-- Cuotas ya reclasificadas: transacciones con clave 'msi:{plan}:{k}'.

CREATE TABLE estado_cuenta (
  tarjeta_id   TEXT NOT NULL REFERENCES tarjeta(cuenta_id),
  corte        TEXT NOT NULL,
  limite       TEXT NOT NULL,
  saldo_corte  INTEGER NOT NULL,       -- revolvente al corte, ya con las cuotas MSI de ese corte
  procesado_en INTEGER NOT NULL,
  PRIMARY KEY (tarjeta_id, corte)
);
--> statement-breakpoint
-- PNGI no se guarda: max(0, saldo_corte − pagos y abonos con fecha > corte) (E5.3).

CREATE TABLE programado (
  id                   TEXT PRIMARY KEY,
  tipo                 TEXT NOT NULL CHECK (tipo IN ('ingreso','egreso')),
  concepto             TEXT NOT NULL,
  monto                INTEGER NOT NULL CHECK (monto > 0),
  regla                TEXT NOT NULL,          -- JSON Regla (docs/05 §E3.1), incluidas 'anual' y 'unica'
  cuenta_id            TEXT REFERENCES cuenta(id),            -- de dónde sale / a dónde llega; NULL = cualquiera
  categoria_cuenta_id  TEXT REFERENCES cuenta(id),
  comercio_normalizado TEXT,                                  -- cobertura por comercio (E3.5)
  tarjeta_id           TEXT REFERENCES tarjeta(cuenta_id),    -- pago planeado de una tarjeta en modo plan
  variable             INTEGER NOT NULL DEFAULT 0 CHECK (variable IN (0,1)),   -- recibo de monto variable (luz, agua)
  define_horizonte     INTEGER NOT NULL DEFAULT 0 CHECK (define_horizonte IN (0,1)),
  espacio              TEXT NOT NULL DEFAULT 'personal' CHECK (espacio IN ('personal','negocio')),
  desde                TEXT NOT NULL,          -- inclusivo
  hasta                TEXT,                   -- INCLUSIVO: la última ocurrencia puede caer en esta fecha (tandas)
  activo               INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0,1)),
  CHECK (define_horizonte = 0 OR tipo = 'ingreso'),
  CHECK (tarjeta_id IS NULL OR tipo = 'egreso')
);
--> statement-breakpoint
CREATE UNIQUE INDEX programado_un_horizonte ON programado(define_horizonte)
  WHERE define_horizonte = 1 AND activo = 1;   -- un solo ingreso define el horizonte
--> statement-breakpoint

CREATE TABLE ocurrencia (
  programado_id  TEXT NOT NULL REFERENCES programado(id),
  fecha          TEXT NOT NULL,          -- fecha efectiva (ya ajustada)
  estado         TEXT NOT NULL CHECK (estado IN ('pendiente','cubierta','omitida')),
  transaccion_id TEXT REFERENCES transaccion(id),
  PRIMARY KEY (programado_id, fecha)
);
--> statement-breakpoint

CREATE TABLE arqueo (
  id             TEXT PRIMARY KEY,
  cuenta_id      TEXT NOT NULL REFERENCES cuenta(id),
  fecha          TEXT NOT NULL,
  realizado_en   INTEGER NOT NULL,
  saldo_contable INTEGER NOT NULL,
  reasignado     INTEGER NOT NULL DEFAULT 0,   -- Σ marcados (E7)
  efectivo_real  INTEGER NOT NULL CHECK (efectivo_real >= 0),
  hueco          INTEGER NOT NULL,
  transaccion_id TEXT REFERENCES transaccion(id)
);
--> statement-breakpoint

CREATE TABLE captura (
  id             TEXT PRIMARY KEY,
  fuente         TEXT NOT NULL CHECK (fuente IN ('notificacion','correo','estado_cuenta','ticket','apple_pay')),
  recibida_en    INTEGER NOT NULL,
  origen_app     TEXT,
  texto_crudo    TEXT,       -- se pone en NULL a los 30 días (§6)
  plantilla_id   TEXT,
  datos          TEXT,       -- JSON {tipo, monto, comercio, ultimos4, contraparte, fecha}
  huella         TEXT NOT NULL,   -- SHA-256 hex (docs/07 §2.4)
  estado         TEXT NOT NULL CHECK (estado IN ('nueva','interpretada','vinculada','descartada','no_reconocida','error')),
  transaccion_id TEXT REFERENCES transaccion(id)
);
--> statement-breakpoint
CREATE UNIQUE INDEX captura_huella ON captura(fuente, huella);
--> statement-breakpoint

CREATE TABLE regla_comercio (
  comercio_normalizado TEXT PRIMARY KEY,
  categoria_cuenta_id  TEXT NOT NULL REFERENCES cuenta(id),
  fuente               TEXT NOT NULL CHECK (fuente IN ('semilla','usuario','aprendida')),
  usos                 INTEGER NOT NULL DEFAULT 0,
  actualizada_en       INTEGER NOT NULL
);
--> statement-breakpoint

CREATE TABLE prediccion (
  horizonte_inicio  TEXT PRIMARY KEY,
  horizonte_fin     TEXT NOT NULL,
  probabilidad_bp   INTEGER NOT NULL CHECK (probabilidad_bp BETWEEN 0 AND 10000),
  version_simulador TEXT NOT NULL,
  resultado         INTEGER CHECK (resultado IN (0,1))
);
--> statement-breakpoint

CREATE TABLE ajuste (
  clave          TEXT PRIMARY KEY,
  valor          TEXT NOT NULL,     -- JSON validado con Zod por clave
  actualizado_en INTEGER NOT NULL
);
--> statement-breakpoint

CREATE TABLE auditoria (
  id         TEXT PRIMARY KEY,
  en         INTEGER NOT NULL,
  entidad    TEXT NOT NULL,
  entidad_id TEXT NOT NULL,
  accion     TEXT NOT NULL,
  antes      TEXT,
  despues    TEXT
);
--> statement-breakpoint

-- Cuentas de sistema del espacio personal (§2.1): una de cada una, no archivables.
INSERT INTO cuenta (id, naturaleza, subtipo, nombre, espacio, sistema, creada_en) VALUES
  ('sis:personal:por_asignar', 'pasivo', 'por_asignar', 'Por asignar', 'personal', 1, 0),
  ('sis:personal:por_asignar_entradas', 'activo', 'por_asignar_entradas', 'Entradas por asignar', 'personal', 1, 0),
  ('sis:personal:transito', 'activo', 'transito', 'En tránsito', 'personal', 1, 0),
  ('sis:personal:cuentas_externas', 'activo', 'externa', 'Cuentas externas', 'personal', 1, 0),
  ('sis:personal:saldos_iniciales', 'capital', 'saldos_iniciales', 'Saldos iniciales', 'personal', 1, 0),
  ('sis:personal:ajuste_conciliacion', 'capital', 'ajuste_conciliacion', 'Ajuste de conciliación', 'personal', 1, 0);
--> statement-breakpoint
-- Catálogo de categorías del espacio personal (§2.3). `varios_efectivo` es solo de sistema (arqueo, E7).
INSERT INTO cuenta (id, naturaleza, subtipo, nombre, espacio, categoria_slug, tipo_gasto, sistema, creada_en) VALUES
  ('cat:personal:comida_fuera', 'gasto', 'categoria', 'Comida fuera', 'personal', 'comida_fuera', 'variable', 0, 0),
  ('cat:personal:antojos', 'gasto', 'categoria', 'Antojos', 'personal', 'antojos', 'variable', 0, 0),
  ('cat:personal:super', 'gasto', 'categoria', 'Súper', 'personal', 'super', 'variable', 0, 0),
  ('cat:personal:transporte', 'gasto', 'categoria', 'Transporte', 'personal', 'transporte', 'variable', 0, 0),
  ('cat:personal:gasolina', 'gasto', 'categoria', 'Gasolina', 'personal', 'gasolina', 'variable', 0, 0),
  ('cat:personal:entretenimiento', 'gasto', 'categoria', 'Entretenimiento', 'personal', 'entretenimiento', 'variable', 0, 0),
  ('cat:personal:ropa', 'gasto', 'categoria', 'Ropa', 'personal', 'ropa', 'variable', 0, 0),
  ('cat:personal:hogar', 'gasto', 'categoria', 'Hogar', 'personal', 'hogar', 'variable', 0, 0),
  ('cat:personal:cuidado_personal', 'gasto', 'categoria', 'Cuidado personal', 'personal', 'cuidado_personal', 'variable', 0, 0),
  ('cat:personal:salud', 'gasto', 'categoria', 'Salud', 'personal', 'salud', 'variable', 0, 0),
  ('cat:personal:mascotas', 'gasto', 'categoria', 'Mascotas', 'personal', 'mascotas', 'variable', 0, 0),
  ('cat:personal:regalos', 'gasto', 'categoria', 'Regalos', 'personal', 'regalos', 'variable', 0, 0),
  ('cat:personal:apoyo_familiar', 'gasto', 'categoria', 'Apoyo familiar', 'personal', 'apoyo_familiar', 'variable', 0, 0),
  ('cat:personal:viajes', 'gasto', 'categoria', 'Viajes', 'personal', 'viajes', 'variable', 0, 0),
  ('cat:personal:tecnologia', 'gasto', 'categoria', 'Tecnología', 'personal', 'tecnologia', 'variable', 0, 0),
  ('cat:personal:deporte', 'gasto', 'categoria', 'Deporte', 'personal', 'deporte', 'variable', 0, 0),
  ('cat:personal:otros_gastos', 'gasto', 'categoria', 'Otros gastos', 'personal', 'otros_gastos', 'variable', 0, 0),
  ('cat:personal:varios_efectivo', 'gasto', 'categoria', 'Varios en efectivo', 'personal', 'varios_efectivo', 'variable', 1, 0),
  ('cat:personal:vivienda', 'gasto', 'categoria', 'Vivienda', 'personal', 'vivienda', 'fijo', 0, 0),
  ('cat:personal:servicios', 'gasto', 'categoria', 'Servicios', 'personal', 'servicios', 'fijo', 0, 0),
  ('cat:personal:suscripciones', 'gasto', 'categoria', 'Suscripciones', 'personal', 'suscripciones', 'fijo', 0, 0),
  ('cat:personal:educacion', 'gasto', 'categoria', 'Educación', 'personal', 'educacion', 'fijo', 0, 0),
  ('cat:personal:comisiones_intereses', 'gasto', 'categoria', 'Comisiones e intereses', 'personal', 'comisiones_intereses', 'fijo', 0, 0),
  ('cat:personal:sueldo', 'ingreso', 'categoria', 'Sueldo', 'personal', 'sueldo', NULL, 0, 0),
  ('cat:personal:honorarios', 'ingreso', 'categoria', 'Honorarios', 'personal', 'honorarios', NULL, 0, 0),
  ('cat:personal:ventas', 'ingreso', 'categoria', 'Ventas', 'personal', 'ventas', NULL, 0, 0),
  ('cat:personal:regalo_recibido', 'ingreso', 'categoria', 'Regalo recibido', 'personal', 'regalo_recibido', NULL, 0, 0),
  ('cat:personal:reembolso', 'ingreso', 'categoria', 'Reembolsos', 'personal', 'reembolso', NULL, 0, 0),
  ('cat:personal:rendimientos', 'ingreso', 'categoria', 'Rendimientos', 'personal', 'rendimientos', NULL, 0, 0),
  ('cat:personal:otros_ingresos', 'ingreso', 'categoria', 'Otros ingresos', 'personal', 'otros_ingresos', NULL, 0, 0);
