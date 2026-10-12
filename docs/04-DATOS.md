# 04 · Modelo de datos

> Base local en el teléfono: SQLite cifrado con SQLCipher (`expo-sqlite` con `useSQLCipher: true`). Es la **fuente de verdad**. El servidor no guarda movimientos en v1.

## 1. Convenciones

| Tipo | Representación | Regla |
|---|---|---|
| Identificadores | `TEXT` UUIDv7 | Ordenables por tiempo. Se generan en la capa de servicios, nunca en `core`. |
| Dinero | `INTEGER` centavos | Sin `REAL` para dinero. |
| Fecha civil | `TEXT 'YYYY-MM-DD'` | Fecha de la operación en la zona del usuario. |
| Instante | `INTEGER` ms UTC | Cuándo se registró algo. |
| Booleano | `INTEGER` 0/1 con `CHECK` | |
| JSON | `TEXT` | Se valida con Zod al leer y escribir. Nunca se consulta por dentro con SQL. |
| Porcentaje | `INTEGER` puntos base | 3000 = 30 %. |

Tablas sin `STRICT` (compatibilidad con Drizzle); los tipos se protegen con `CHECK`. Toda escritura financiera pasa por `Libro.registrar()` dentro de una transacción SQLite; nada más inserta asientos.

## 2. Plan de cuentas

En contabilidad de doble partida, **todo** es una cuenta: el efectivo, cada tarjeta, cada categoría de gasto, cada persona que te debe. Un movimiento es una transacción con 2 o más asientos que suman cero. Signo: débito positivo, crédito negativo. La UI nunca muestra "débito/crédito" ni "pasivo": muestra "tienes", "debes", "te deben".

| Naturaleza | Saldo normal | Subtipos | ¿Entra en L? |
|---|---|---|---|
| `activo` | + | `efectivo`, `debito`, `billetera` | sí (`liquida = 1`) |
| `activo` | + | `ahorro`, `externa`, `transito`, `por_asignar_entradas` | no (`transito` negativo sí resta, ver L) |
| `pasivo` | − | `tarjeta_credito`, `msi` (hija de una tarjeta), `prestamo`, `por_asignar` | no (`por_asignar` resta, ver L) |
| `contraparte` | ± | `persona` (te debe si +, le debes si −), `tanda`, `cliente` (negocio: fiado), `pareja` (v2) | no |
| `ingreso` | − | categorías de ingreso | no |
| `gasto` | + | categorías de gasto (`tipo_gasto`: `variable` o `fijo`) | no |
| `capital` | − | `saldos_iniciales`, `ajuste_conciliacion` | no |

### 2.1 Cuentas de sistema

Se crean en la migración inicial, una de cada una, y no se pueden archivar:

| Cuenta | Para qué |
|---|---|
| `pasivo:por_asignar` | Gastos dictados sin método de pago ("me compré una coca de 25"). Se resuelve cuando llega la notificación del cargo (E9.3) o cuando el usuario lo marca en el arqueo como efectivo (E7). |
| `activo:por_asignar_entradas` | Ingresos dictados sin destino ("me pagaron 2,000"). Se resuelve cuando llega el depósito (E9.3) o cuando el usuario dice dónde quedó. |
| `activo:transito` | Una transferencia propia de la que solo se ha visto una mitad (E9.4). |
| `activo:cuentas_externas` | Cuentas propias que el usuario no lleva en la app. No se muestra ni entra en L. |
| `capital:saldos_iniciales` | Saldos de apertura y planes MSI que ya existían al registrar una tarjeta. |
| `capital:ajuste_conciliacion` | Diferencias cuando el usuario corrige el saldo de una cuenta. |

Las cuentas de sistema pertenecen al espacio `personal`; al activar el negocio (M11) se crean **las seis** otra vez con `espacio = 'negocio'` (`por_asignar`, `por_asignar_entradas`, `transito`, `cuentas_externas`, `saldos_iniciales`, `ajuste_conciliacion`), para que ningún movimiento del negocio necesite una cuenta del espacio personal.

Resolver una cuenta puente es siempre `reemplazar` (E2): se anula el movimiento puente y se registra el mismo movimiento con la cuenta real, conservando categoría y descripción.

### 2.2 L · liquidez

```
L(espacio) = Σ saldo(c)  para c con liquida = 1, archivada = 0 y c.espacio = espacio
           + min(0, saldo(pasivo:por_asignar del espacio))   -- gastos que saldrán de alguna cuenta líquida
           + min(0, saldo(activo:transito del espacio))      -- pagos que llegaron sin ver de qué cuenta salieron
```

No entran: ahorro, crédito, tránsito positivo (dinero que ya salió y no ha llegado), entradas por asignar ni cuentas externas. Siempre se elige el valor que no infla el dinero libre.

### 2.3 Catálogo inicial de categorías (`categoria_slug`)

Una categoría es única **por espacio** (`UNIQUE (espacio, categoria_slug)`): `ventas` existe en personal (vendí mi bici) y en negocio.

**Espacio personal**

Gasto variable: `comida_fuera`, `antojos`, `super`, `transporte`, `gasolina`, `entretenimiento`, `ropa`, `hogar`, `cuidado_personal`, `salud`, `mascotas`, `regalos`, `apoyo_familiar`, `viajes`, `tecnologia`, `deporte`, `otros_gastos`, `varios_efectivo` (solo sistema/arqueo).
Gasto fijo: `vivienda`, `servicios`, `suscripciones`, `educacion`, `comisiones_intereses`.
Ingreso: `sueldo`, `honorarios`, `ventas`, `regalo_recibido`, `reembolso`, `rendimientos`, `otros_ingresos`.
Grupos para consultas: `comida` = {comida_fuera, antojos, super}; `movilidad` = {transporte, gasolina}; `casa` = {vivienda, servicios, hogar}.

**Espacio negocio** (migración `0004_negocio`)

Ingreso: `ventas`, `servicios_prestados`, `otros_ingresos`.
Gasto variable: `mercancia`, `insumos`, `transporte`, `publicidad`, `mantenimiento`, `otros_gastos`.
Gasto fijo: `renta_local`, `servicios`, `sueldos_ayudantes`, `comisiones_intereses`, `equipo`, `impuestos`, `otros_impuestos`.
`impuestos` es solo el ISR y el IVA del régimen: los estima E15 y se pagan con `pago_impuestos`. `otros_impuestos` (predial del local, impuesto sobre nómina, licencias y derechos) son gastos y compromisos normales.

`tipo_gasto` es el valor por defecto de la categoría. El usuario puede marcar una transacción como `extraordinaria` para excluirla de la simulación (E8.2).

### 2.4 Espacios

Cada cuenta pertenece a un espacio: `personal` o `negocio` (M11, `docs/10-NEGOCIO.md`); los programados también (`programado.espacio`). E4 y los reportes se calculan por espacio. Una transacción puede tocar dos espacios solo si es `retiro_dueno` o `aportacion_dueno`; cualquier otro tipo con cuentas de dos espacios se rechaza (`patron_invalido`).

**Movimientos que cruzan espacios.** Si un movimiento real toca los dos espacios (un gasto personal pagado con la cuenta del negocio; el pago de la tarjeta del negocio desde la cuenta personal), servicios lo descompone en **dos** transacciones dentro de la misma transacción SQLite, usando el `activo:transito` del espacio de destino (`§4`, caso 29):

1. `retiro_dueno` o `aportacion_dueno` de la cuenta real del espacio de origen al `transito` del espacio de destino;
2. el movimiento original dentro del espacio de destino, con ese `transito` como cuenta propia.

El tránsito queda en cero; cada espacio ve solo lo suyo (el negocio, un retiro del dueño; lo personal, un gasto normal que sí entra a E8). Una transferencia directa entre una cuenta del negocio y una personal es un solo `retiro_dueno` o `aportacion_dueno` (E9.4, E9-50).

## 3. Esquema SQL (migración `0001_inicial`)

```sql
CREATE TABLE contacto (
  id         TEXT PRIMARY KEY,
  nombre     TEXT NOT NULL,
  telefono   TEXT,
  creado_en  INTEGER NOT NULL
);

CREATE TABLE alias_contacto (
  contacto_id       TEXT NOT NULL REFERENCES contacto(id),
  alias_normalizado TEXT NOT NULL,
  PRIMARY KEY (contacto_id, alias_normalizado)
);

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
CREATE UNIQUE INDEX cuenta_categoria ON cuenta(espacio, categoria_slug) WHERE categoria_slug IS NOT NULL;
CREATE INDEX cuenta_activas ON cuenta(espacio, naturaleza, subtipo) WHERE archivada = 0;
CREATE INDEX cuenta_ultimos4 ON cuenta(ultimos4) WHERE ultimos4 IS NOT NULL;

CREATE TABLE alias_cuenta (
  cuenta_id         TEXT NOT NULL REFERENCES cuenta(id),
  alias_normalizado TEXT NOT NULL,
  PRIMARY KEY (cuenta_id, alias_normalizado)
);
CREATE INDEX alias_cuenta_texto ON alias_cuenta(alias_normalizado);

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
CREATE INDEX transaccion_fecha ON transaccion(fecha);

CREATE TABLE asiento (
  id             TEXT PRIMARY KEY,
  transaccion_id TEXT NOT NULL REFERENCES transaccion(id),
  cuenta_id      TEXT NOT NULL REFERENCES cuenta(id),
  monto          INTEGER NOT NULL CHECK (monto <> 0)
);
CREATE INDEX asiento_cuenta ON asiento(cuenta_id);
CREATE INDEX asiento_transaccion ON asiento(transaccion_id);

-- Inmutabilidad del libro
CREATE TRIGGER asiento_inmutable_u BEFORE UPDATE ON asiento BEGIN SELECT RAISE(ABORT, 'asiento inmutable'); END;
CREATE TRIGGER asiento_inmutable_d BEFORE DELETE ON asiento BEGIN SELECT RAISE(ABORT, 'asiento inmutable'); END;
CREATE TRIGGER transaccion_inmutable_d BEFORE DELETE ON transaccion BEGIN SELECT RAISE(ABORT, 'transaccion inmutable'); END;
CREATE TRIGGER transaccion_campos_fijos
BEFORE UPDATE OF fecha, tipo, origen, estimada, clave_idempotencia, revierte_a, reemplaza_a, registrada_en ON transaccion
BEGIN SELECT RAISE(ABORT, 'campo inmutable'); END;
CREATE TRIGGER reversa_no_anulable BEFORE INSERT ON transaccion
WHEN NEW.revierte_a IS NOT NULL AND (SELECT tipo FROM transaccion WHERE id = NEW.revierte_a) = 'reversa'
BEGIN SELECT RAISE(ABORT, 'una reversa no se anula'); END;
-- Editables sin reversa (no financieros): descripcion, comercio, extraordinaria, por_revisar, meta.
-- Cada cambio deja registro en auditoria.

-- Transacciones vigentes: ni anuladas ni reversas. Las usan reportes, consultas y E8.2.
-- Los saldos NO usan esta vista: suman todos los asientos (la reversa ya compensa).
CREATE VIEW transaccion_vigente AS
SELECT t.* FROM transaccion t
WHERE t.tipo <> 'reversa'
  AND NOT EXISTS (SELECT 1 FROM transaccion r WHERE r.revierte_a = t.id);

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
CREATE UNIQUE INDEX programado_un_horizonte ON programado(define_horizonte)
  WHERE define_horizonte = 1 AND activo = 1;   -- un solo ingreso define el horizonte

CREATE TABLE ocurrencia (
  programado_id  TEXT NOT NULL REFERENCES programado(id),
  fecha          TEXT NOT NULL,          -- fecha efectiva (ya ajustada)
  estado         TEXT NOT NULL CHECK (estado IN ('pendiente','cubierta','omitida')),
  transaccion_id TEXT REFERENCES transaccion(id),
  PRIMARY KEY (programado_id, fecha)
);

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
CREATE UNIQUE INDEX captura_huella ON captura(fuente, huella);

CREATE TABLE regla_comercio (
  comercio_normalizado TEXT PRIMARY KEY,
  categoria_cuenta_id  TEXT NOT NULL REFERENCES cuenta(id),
  fuente               TEXT NOT NULL CHECK (fuente IN ('semilla','usuario','aprendida')),
  usos                 INTEGER NOT NULL DEFAULT 0,
  actualizada_en       INTEGER NOT NULL
);

CREATE TABLE prediccion (
  horizonte_inicio  TEXT PRIMARY KEY,
  horizonte_fin     TEXT NOT NULL,
  probabilidad_bp   INTEGER NOT NULL CHECK (probabilidad_bp BETWEEN 0 AND 10000),
  version_simulador TEXT NOT NULL,
  resultado         INTEGER CHECK (resultado IN (0,1))
);

CREATE TABLE ajuste (
  clave          TEXT PRIMARY KEY,
  valor          TEXT NOT NULL,     -- JSON validado con Zod por clave
  actualizado_en INTEGER NOT NULL
);

CREATE TABLE auditoria (
  id         TEXT PRIMARY KEY,
  en         INTEGER NOT NULL,
  entidad    TEXT NOT NULL,
  entidad_id TEXT NOT NULL,
  accion     TEXT NOT NULL,
  antes      TEXT,
  despues    TEXT
);
```

Claves de `ajuste`: `colchon` (centavos), `inicio_uso` (fecha del primer día completo con registros; E8.2), `modo_ingreso` (`'programado' | 'variable'`), `consentimientos` (instante de cada consentimiento: datos financieros, captura, intérprete en la nube, analítica, respaldo en la nube), `bloqueo_biometrico` (booleano). Desde M8: `datos_cobro` (celular y CLABE propios para cobrar, opcionales). Desde M9: `respaldo` (`{auto, ultimo, cuenta_enmascarada, sal_b64}`; la llave va en el almacén seguro, E16). Desde M11: `negocio` (`{nombre, regimen, cobra_iva, colchon, porcentaje_bp, ingresos_previos_ejercicio, saldo_favor_iva_inicial, comisiones_por_confirmar}`; `ingresos_previos_ejercicio` y `saldo_favor_iva_inicial` se piden al activarlo, E15; `comisiones_por_confirmar` son los ids de terminales con la comisión supuesta de `07 §5`). Desde M12: `perfil_fiscal` (`{rfc, ingresos_brutos_anuales, base_gravable_estimada}`, E13).

Comprobación de integridad (pruebas y arranque en builds de desarrollo); las tres deben venir vacías o en cero:

```sql
SELECT transaccion_id FROM asiento GROUP BY transaccion_id HAVING SUM(monto) <> 0;
SELECT t.id FROM transaccion t LEFT JOIN asiento a ON a.transaccion_id = t.id
  GROUP BY t.id HAVING COUNT(a.id) < 2;
SELECT SUM(monto) FROM asiento;   -- 0
```

Las tablas de hitos posteriores (tandas, suscripciones, negocio, CFDI, gastos compartidos) llegan en migraciones nuevas (§3.2); el subtipo `persona` ya existe para cuentas por cobrar y por pagar.

### 3.1 Tipos de transacción

`Libro.registrar()` rechaza un `tipo` fuera de la lista y un patrón de cuentas que no corresponda al tipo (`ErrorDominio('patron_invalido')`). "Líquida" = cuenta con `liquida = 1`. "Propia" = líquida, ahorro o externa.

**Cuentas puente:** en los tipos con una sola cuenta propia (gasto, ingreso, pago de tarjeta, préstamos, cuenta dividida, tanda, cobro a cliente, pago de impuestos), esa cuenta puede ser la puente del sentido del dinero: `pasivo:por_asignar` si sale, `activo:por_asignar_entradas` si entra (`06 §5`). No aplica a `transferencia` ni a `retiro_efectivo`, que siempre llevan dos cuentas reales, ni a los tipos de sistema.

| `tipo` | Patrón (débito + / crédito −) | ¿Consumo en E8? |
|---|---|---|
| `gasto` | gasto + / líquida, tarjeta o `por_asignar` − | sí |
| `ingreso` | líquida, `por_asignar_entradas` o tarjeta (bonificación) + / ingreso − | no |
| `transferencia` | propia + / propia − | no |
| `transferencia_pendiente` | `transito` + / propia −, o tarjeta + / `transito` − | no |
| `retiro_efectivo` | efectivo + / otra líquida o tarjeta − | no |
| `pago_tarjeta` | tarjeta + / propia − | no |
| `prestamo_otorgado` · `pago_prestamo` | persona o pareja + / líquida o tarjeta − | no |
| `cobro_prestamo` · `prestamo_recibido` | líquida o tarjeta + / persona o pareja − | no |
| `compra_msi` | gasto + / msi − | no (sus cuotas son compromisos) |
| `reclasificacion_msi` · `liquidacion_msi` | msi + / tarjeta madre − | no |
| `cuenta_dividida` | Pagaste tú: gasto + (parte propia) y persona o pareja + (cada parte ajena) / líquida o tarjeta −. Pagó otra persona (M16): gasto + (parte propia) / persona o pareja − | solo la parte propia |
| `aportacion_tanda` · `cobro_tanda` | tanda + / líquida − · líquida + / tanda − | no |
| `ajuste_arqueo` | gasto + (una o más categorías) / efectivo − (`estimada = 1`) | sí, repartido (E8.2) |
| `reembolso` | tarjeta o líquida + / gasto − (o `ingreso:reembolso` − si no se encontró el cargo) | sí, negativo (solo la parte contra gasto) |
| `saldo_inicial` | cuenta ± / `capital:saldos_iniciales` ∓ | no |
| `conciliacion` | cuenta ± / `capital:ajuste_conciliacion` ∓ | no |
| `reversa` | espejo exacto de `revierte_a` | no se usa: E8.2 lee `transaccion_vigente` |
| `venta_credito` (negocio) | cliente + / ingreso − | no (negocio) |
| `cobro_cliente` (negocio) | líquida + / cliente − | no (negocio) |
| `retiro_dueno` | propia personal (o su `transito`) + / propia o tarjeta del negocio − | no |
| `aportacion_dueno` | propia negocio (o su `transito`) + / propia o tarjeta personal − | no |
| `pago_impuestos` (negocio) | gasto:impuestos + / líquida − | no (negocio) |

E8 y "hoy puedes" son del espacio personal; las transacciones del negocio no entran a su historial. En la segunda transacción de una descomposición entre espacios (§2.4), la cuenta propia del `gasto` o del `pago_tarjeta` es el `transito` de ese espacio.

### 3.2 Migraciones posteriores

Cada una es un archivo nuevo en `packages/datos/migraciones/` y llega con su hito. Ninguna altera un `CHECK` existente.

| Migración | Hito | Contenido |
|---|---|---|
| `0002_tandas` | M8 | `tanda (id, cuenta_id → contraparte:tanda UNIQUE, nombre, aportacion > 0, participantes 2–50, turno 1–participantes, regla JSON, inicio, programado_id UNIQUE, activa)` |
| `0003_suscripciones` | M10 | `suscripcion (comercio_normalizado PK, periodicidad, monto_tipico, ultimo_cargo, estado CHECK IN ('detectada','compromiso','ignorada'), programado_id, actualizada_en)` y `plantilla_remota (version PK, sha256, firma, recibida_en, activa)` |
| `0004_negocio` | M11 | Categorías del negocio; `fiscal_movimiento (transaccion_id PK, iva, retencion_isr, retencion_iva, cfdi_uuid, con_cfdi)`; `impuesto_periodo (espacio, periodo 'YYYY-MM', modo, estimado_ajustado, estado CHECK IN ('estimado','pagado'), pago_transaccion_id, PRIMARY KEY (espacio, periodo))` |
| `0005_cfdi` | M12 | `cfdi (uuid PK, xml TEXT, emisor_rfc, receptor_rfc, fecha, tipo_comprobante, uso_cfdi, forma_pago, metodo_pago, total, iva, estatus CHECK IN ('vigente','cancelado','desconocido'), etiquetas JSON, transaccion_id, importado_en)` |
| `0006_compartido` | M16 | `grupo_compartido (id, nombre, contraparte_id → contraparte:pareja, mi_autor, creado_en, cerrado_en)`, `evento_compartido (id PK, grupo_id, autor, creado_en, tipo, cuerpo JSON, transaccion_id, recibido_en)` (su `id` es UUIDv4, excepción a §1: va en claro en el servidor, E17); la llave del grupo vive en el almacén seguro (y viaja dentro del respaldo cifrado, E16), no en la base |

El respaldo (M9) no necesita tablas: usa la clave `respaldo` de `ajuste` y el almacén seguro (E16).

### 3.3 Datos fiscales

El XML de cada CFDI importado se guarda completo en `cfdi.xml`, dentro de la base cifrada; sale del teléfono solo en el paquete para el contador que el usuario comparte (`10 §6`). Los RFC de terceros que contiene son datos personales de esas personas (`08 §2`).

## 4. Asientos por caso

Montos en pesos para legibilidad; en la base van en centavos. "Reemplaza #n" = `reemplazar` de E2: reversa de #n más la transacción nueva con `reemplaza_a = #n`, en una sola transacción SQLite.

| # | Caso | `tipo` | Asientos |
|---|---|---|---|
| 1 | "Coca de 25 en efectivo" | gasto | `gasto:antojos +25` · `activo:efectivo −25` |
| 2 | "Tacos de 80 con la Nu" | gasto | `gasto:comida_fuera +80` · `pasivo:tarjeta:nu −80` |
| 3 | "Pagué 2,000 de la Nu desde BBVA" | pago_tarjeta | `pasivo:tarjeta:nu +2,000` · `activo:bbva −2,000` (no es gasto) |
| 4 | "Saqué 500 del cajero" | retiro_efectivo | `activo:efectivo +500` · `activo:bbva −500` |
| 5 | "Me cayó la quincena, 8,000" (a BBVA) | ingreso | `activo:bbva +8,000` · `ingreso:sueldo −8,000` |
| 6a | "Tele de 12,000 a 12 MSI con la Oro" | compra_msi | `gasto:hogar +12,000` · `pasivo:tarjeta:oro:msi:<plan> −12,000` |
| 6b | Corte k de ese plan (sistema) | reclasificacion_msi | `pasivo:tarjeta:oro:msi:<plan> +1,000` · `pasivo:tarjeta:oro −1,000` |
| 6c | Onboarding: "en la Oro me faltan 7 mensualidades de 1,000" | saldo_inicial | `capital:saldos_iniciales +7,000` · `pasivo:tarjeta:oro:msi:<plan> −7,000` (no es gasto; E6-06) |
| 6d | "Ese cargo de 12,000 fue a 12 meses" (pasar a meses) | reversa + compra_msi | Reemplaza el cargo `gasto:hogar +12,000` · `pasivo:tarjeta:oro −12,000` por 6a con la misma fecha |
| 6e | Pago que deja la Oro con saldo a favor; el usuario confirma que fue para liquidar el plan | liquidacion_msi | `pasivo:tarjeta:oro:msi:<plan> +5,000` · `pasivo:tarjeta:oro −5,000`; `plan_msi.estado = 'liquidado'` |
| 7a | "Le presté 500 a Juan" (efectivo) | prestamo_otorgado | `contraparte:juan +500` · `activo:efectivo −500` |
| 7b | "Juan me regresó 300" (a BBVA) | cobro_prestamo | `activo:bbva +300` · `contraparte:juan −300` (no es ingreso) |
| 7c | "Mi hermano me prestó 1,000" (a BBVA) | prestamo_recibido | `activo:bbva +1,000` · `contraparte:hermano −1,000` (no es ingreso; E4 lo aparta salvo `apartar_deuda = 0`) |
| 7d | "Le pagué 1,000 a mi hermano" | pago_prestamo | `contraparte:hermano +1,000` · `activo:bbva −1,000` |
| 8 | "Cena de 1,200 entre 4 con la Nu" | cuenta_dividida | `gasto:comida_fuera +300` · `contraparte:<cada amigo> +300` ×3 · `pasivo:tarjeta:nu −1,200` |
| 9 | Aportar / cobrar tanda | aportacion_tanda / cobro_tanda | `contraparte:tanda +500` · `activo:bbva −500` / `activo:bbva +5,000` · `contraparte:tanda −5,000` |
| 10 | Arqueo con hueco de $340 (E7-02) | ajuste_arqueo | `gasto:comida_fuera +194.29` · `gasto:antojos +80.95` · `gasto:transporte +48.57` · `gasto:varios_efectivo +16.19` · `activo:efectivo −340` (`estimada = 1`) |
| 11 | Saldo inicial de BBVA 3,590 | saldo_inicial | `activo:bbva +3,590` · `capital:saldos_iniciales −3,590` |
| 12 | "Saqué 300 con la Oro en el cajero" | retiro_efectivo | `activo:efectivo +300` · `pasivo:tarjeta:oro −300` (la comisión llega después como `gasto:comisiones_intereses`) |
| 13 | Gasto sin método: "coca de 25" | gasto | `gasto:antojos +25` · `pasivo:por_asignar −25`. Al resolverse (notificación de la Nu, E9-38, o marcado en el arqueo, E7-08) se reemplaza por el mismo gasto con la cuenta real |
| 14 | Anular #1 | reversa | `gasto:antojos −25` · `activo:efectivo +25`, `revierte_a = #1` |
| 15 | Captura "Enviaste $4,200" desde BBVA, aún sin pareja | transferencia_pendiente | `activo:transito +4,200` · `activo:bbva −4,200` (sale de L de inmediato) |
| 16 | Llega "Recibimos tu pago de $4,200" en la tarjeta 8812 | reversa + pago_tarjeta | Reemplaza #15 por `pasivo:tarjeta:8812 +4,200` · `activo:bbva −4,200` |
| 17 | "Recibimos tu pago" llega primero | transferencia_pendiente | `pasivo:tarjeta:8812 +4,200` · `activo:transito −4,200` (el tránsito negativo resta de L hasta ver la salida) |
| 18 | #15 sin pareja en 24 h; el usuario responde | reversa + según respuesta | Reemplaza #15 por: "A otra cuenta mía que no llevo aquí" → `activo:cuentas_externas +4,200` · `activo:bbva −4,200` (transferencia); "Le presté a Caro" → `contraparte:caro +4,200` · `activo:bbva −4,200`; "Pagué algo" → `gasto:<categoría> +4,200` · `activo:bbva −4,200` |
| 19 | #17 sin pareja en 24 h | reversa + según respuesta | Reemplaza #17 por: "De una de mis cuentas" → pago_tarjeta desde esa cuenta; "De una cuenta que no llevo aquí" → `pasivo:tarjeta:8812 +4,200` · `activo:cuentas_externas −4,200`; "Alguien más la pagó" → contra `contraparte:<persona>` (le debes) o `ingreso:regalo_recibido` |
| 20 | "Me pagaron 2,000 de un trabajo" (sin decir dónde) | ingreso | `activo:por_asignar_entradas +2,000` · `ingreso:honorarios −2,000`; al llegar el depósito (E9-43) se reemplaza por `activo:bbva +2,000` · `ingreso:honorarios −2,000` |
| 21 | Devolución de 300 en la Oro de una compra de ropa | reembolso | `pasivo:tarjeta:oro +300` · `gasto:ropa −300`; si no se encuentra el cargo original: `… · ingreso:reembolso −300` |
| 22 | "En BBVA tengo 4,200" y el libro dice 4,350 | conciliacion | `capital:ajuste_conciliacion +150` · `activo:bbva −150` |
| 23 | Tanda: "di mi tanda de 500" (efectivo) / "me tocó la tanda, 5 mil" | aportacion_tanda / cobro_tanda | `contraparte:tanda:<id> +500` · `activo:efectivo −500` / `activo:efectivo +5,000` · `contraparte:tanda:<id> −5,000` (ni gasto ni ingreso) |
| 23b | Tanda que ya existía (E11-03: 6 aportaciones hechas, ya cobró) | saldo_inicial | `capital:saldos_iniciales +2,000` · `contraparte:tanda:<id> −2,000`; las 6 ocurrencias pasadas se crean `omitida` |
| 24 | Negocio: "vendí 850" (caja) | ingreso | `activo:caja +850` · `ingreso:ventas (negocio) −850` |
| 25 | Negocio: "le fié 150 a doña Mari" / "doña Mari me pagó" | venta_credito / cobro_cliente | `contraparte:cliente:mari +150` · `ingreso:ventas (negocio) −150` / `activo:caja +150` · `contraparte:cliente:mari −150` |
| 26 | Negocio: "saqué 3 mil de la caja para mí" | retiro_dueno | `activo:efectivo (personal) +3,000` · `activo:caja (negocio) −3,000` |
| 27 | Negocio: pagué el ISR de septiembre desde Banorte | pago_impuestos | `gasto:impuestos (negocio) +900` · `activo:banorte −900`; `impuesto_periodo('2026-09').estado = 'pagado'` |
| 28 | Negocio: corte de caja con $2,700 de más (E7-20), confirmado | ingreso | `activo:caja +2,700` · `ingreso:ventas (negocio) −2,700` (`estimada = 1`) |
| 29 | Movimiento que cruza espacios (§2.4): "tacos de 180 con la de Banorte" (cuenta del negocio, gasto personal) | retiro_dueno + gasto | (1) `activo:transito (personal) +180` · `activo:banorte (negocio) −180`; (2) `gasto:comida_fuera +180` · `activo:transito (personal) −180`. Pago de la tarjeta del negocio desde BBVA (E9-50, `pago_tarjeta: true`): (1) `aportacion_dueno` `activo:transito (negocio) +1,500` · `activo:bbva −1,500`; (2) `pago_tarjeta` `pasivo:tarjeta (negocio) +1,500` · `activo:transito (negocio) −1,500`. Si la cuenta del negocio es una tarjeta de crédito, (1) acredita `pasivo:tarjeta (negocio)` en vez de la cuenta líquida (el negocio se endeuda por un gasto tuyo); al revés, un gasto del negocio con tu tarjeta personal es un `aportacion_dueno` que acredita esa tarjeta |
| 30 | Negocio: cobro de $580 en la terminal con comisión de 3.5 % (`comision_bp = 350`; N-20) | ingreso + gasto | (1) `activo:terminal +580` · `ingreso:ventas (negocio) −580`; (2) `gasto:comisiones_intereses (negocio) +20.30` · `activo:terminal −20.30` (`redondear(58000·350 / 10000)` = 2030 centavos). La base de impuestos es la venta bruta |
| 31 | Pareja (M16): Ana pagó el súper de 1,200 con reparto 60/40 y tu parte es 40 % | cuenta_dividida | `gasto:super +480` · `contraparte:ana −480` (le debes); al saldar: `contraparte:ana +480` · `activo:bbva −480` (`pago_prestamo`) |

## 5. Ocurrencias de programados

- **Materialización** (al abrir la app y en la tarea diaria, idempotente por la llave primaria): ocurrencias con fecha efectiva en `[desde, hoy + 90)` de cada programado activo, sin pasar de `hasta` (inclusivo), calculadas con E3.2. Una tanda de 10 rondas con `hasta` = fecha de la ronda 10 produce 10 ocurrencias.
- **Cobertura:** cada movimiento nuevo se compara con las ocurrencias pendientes usando E3.5 (`cubreOcurrencia`): `cubrir` → `estado = 'cubierta'` y `transaccion_id`; `preguntar` → tarjeta en Hoy; `no` → nada. El usuario también puede marcar una ocurrencia como cubierta u omitida.
- **Pagos planeados de tarjeta** (programado con `tarjeta_id`): para E3.5, la "categoría" del programado es la tarjeta y la de un movimiento `pago_tarjeta` es la tarjeta que recibe el pago.
- Si se anula o reemplaza la transacción que cubrió una ocurrencia, la ocurrencia vuelve a `pendiente` (por ejemplo, cuando E9.4 convierte en transferencia un depósito que había cubierto la quincena), salvo cuando el reemplazo es un `retiro_dueno` que llega a lo personal: sigue cubierta y se vincula a la transacción nueva (E9.4).
- **Consumidores:** E4 usa las ocurrencias de egreso `pendiente` con `fecha < fin_efectivo`, incluidas las vencidas (Hoy pregunta "¿Ya pagaste la luz?"). E3.3 usa como `recibidas` las ocurrencias `cubierta` del programado con `define_horizonte = 1`.

## 6. Retención, exportación y borrado

| Dato | Retención |
|---|---|
| `captura.texto_crudo` | 30 días para cualquier captura (reconocida o no); después se pone en `NULL` y se conservan `datos`. |
| Transacciones y asientos | Mientras exista la cuenta del usuario. |
| `auditoria` | 24 meses. |

- **Exportar** (derecho de acceso): JSON completo + CSV de movimientos, generado en el teléfono y compartido con la hoja nativa del sistema. Disponible siempre, también en el plan Gratis y después de cancelar Plus.
- **Borrar todo** (derecho de cancelación): se destruye la llave de cifrado en el almacén seguro y se elimina el archivo de la base. Sin llave, cualquier copia residual es ilegible.

## 7. Llave de cifrado

- 32 bytes aleatorios generados en el primer arranque; guardados con `expo-secure-store` sin `requireAuthentication` (Android Keystore; en iOS, Keychain `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`). La tarea diaria, el widget y el respaldo automático abren la base con el teléfono bloqueado; con `WHEN_UNLOCKED` fallarían. **Todas** las llaves del almacén seguro usan esa misma configuración: la de la base, la del respaldo (E16) y las de grupos compartidos (E17), que el respaldo automático incluye. El bloqueo biométrico de la app es una capa de la interfaz, no de la llave.
- Se aplica con `PRAGMA key` inmediatamente después de abrir la base y antes de cualquier otra consulta (incluidas las migraciones de Drizzle).
- Android: excluir la base de Auto Backup (`backup_rules` / `data_extraction_rules`); la llave no viaja con el respaldo y la base restaurada sería ilegible.
- Respaldo propio cifrado con contraseña del usuario: M9 (`05 §E16`; `docs/03-ARQUITECTURA.md`, ADR-011 y ADR-017).

## 8. Migraciones

- Drizzle Kit genera SQL numerado en `packages/datos/migraciones/`. Los triggers, la vista y los `CHECK` que Drizzle no exprese se agregan a mano en el SQL generado. Las mismas migraciones corren en Node (pruebas, `better-sqlite3`) y en la app (`expo-sqlite` + SQLCipher).
- La migración `0001_inicial` también inserta las cuentas de sistema (§2.1) y el catálogo de categorías (§2.3).
- Nunca se edita una migración aplicada; se agrega otra.
- Cada migración tiene prueba: se aplica sobre la base de la versión anterior con datos de ejemplo y se verifica la comprobación de integridad.
