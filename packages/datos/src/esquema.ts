import { integer, primaryKey, sqliteTable, sqliteView, text } from 'drizzle-orm/sqlite-core';

/**
 * Esquema Drizzle de `0001_inicial` (`docs/04-DATOS.md §3`). La fuente de verdad es el SQL de
 * `migraciones/0001_inicial.sql`: los `CHECK`, índices parciales, triggers y la vista viven ahí (ADR-012).
 * Aquí solo se declaran columnas y tipos para las consultas tipadas; una prueba verifica que coincidan.
 */

export const contacto = sqliteTable('contacto', {
  id: text('id').primaryKey(),
  nombre: text('nombre').notNull(),
  telefono: text('telefono'),
  creadoEn: integer('creado_en').notNull(),
});

export const aliasContacto = sqliteTable(
  'alias_contacto',
  {
    contactoId: text('contacto_id')
      .notNull()
      .references(() => contacto.id),
    aliasNormalizado: text('alias_normalizado').notNull(),
  },
  (t) => [primaryKey({ columns: [t.contactoId, t.aliasNormalizado] })],
);

export const cuenta = sqliteTable('cuenta', {
  id: text('id').primaryKey(),
  naturaleza: text('naturaleza', {
    enum: ['activo', 'pasivo', 'contraparte', 'ingreso', 'gasto', 'capital'],
  }).notNull(),
  subtipo: text('subtipo').notNull(),
  nombre: text('nombre').notNull(),
  padreId: text('padre_id'),
  institucion: text('institucion'),
  ultimos4: text('ultimos4'),
  liquida: integer('liquida').notNull().default(0),
  espacio: text('espacio', { enum: ['personal', 'negocio'] })
    .notNull()
    .default('personal'),
  comisionBp: integer('comision_bp'),
  categoriaSlug: text('categoria_slug'),
  tipoGasto: text('tipo_gasto', { enum: ['variable', 'fijo'] }),
  contactoId: text('contacto_id').references(() => contacto.id),
  apartarDeuda: integer('apartar_deuda').notNull().default(1),
  sistema: integer('sistema').notNull().default(0),
  archivada: integer('archivada').notNull().default(0),
  creadaEn: integer('creada_en').notNull(),
});

export const aliasCuenta = sqliteTable(
  'alias_cuenta',
  {
    cuentaId: text('cuenta_id')
      .notNull()
      .references(() => cuenta.id),
    aliasNormalizado: text('alias_normalizado').notNull(),
  },
  (t) => [primaryKey({ columns: [t.cuentaId, t.aliasNormalizado] })],
);

export const tarjeta = sqliteTable('tarjeta', {
  cuentaId: text('cuenta_id')
    .primaryKey()
    .references(() => cuenta.id),
  diaCorte: integer('dia_corte').notNull(),
  diasParaPagar: integer('dias_para_pagar'),
  diaLimitePago: integer('dia_limite_pago'),
  limiteCredito: integer('limite_credito').notNull(),
  modo: text('modo', { enum: ['totalero', 'plan'] })
    .notNull()
    .default('totalero'),
  tasaAnualBp: integer('tasa_anual_bp'),
  alta: text('alta').notNull(),
});

const columnasTransaccion = {
  id: text('id').primaryKey(),
  fecha: text('fecha').notNull(),
  registradaEn: integer('registrada_en').notNull(),
  tipo: text('tipo').notNull(),
  descripcion: text('descripcion'),
  comercio: text('comercio'),
  origen: text('origen').notNull(),
  estimada: integer('estimada').notNull().default(0),
  extraordinaria: integer('extraordinaria').notNull().default(0),
  porRevisar: integer('por_revisar').notNull().default(0),
  claveIdempotencia: text('clave_idempotencia').notNull().unique(),
  revierteA: text('revierte_a').unique(),
  reemplazaA: text('reemplaza_a'),
  meta: text('meta'),
};

export const transaccion = sqliteTable('transaccion', columnasTransaccion);

export const asiento = sqliteTable('asiento', {
  id: text('id').primaryKey(),
  transaccionId: text('transaccion_id')
    .notNull()
    .references(() => transaccion.id),
  cuentaId: text('cuenta_id')
    .notNull()
    .references(() => cuenta.id),
  monto: integer('monto').notNull(),
});

/** Transacciones ni anuladas ni reversas (la crea la migración). */
export const transaccionVigente = sqliteView('transaccion_vigente', columnasTransaccion).existing();

export const planMsi = sqliteTable('plan_msi', {
  id: text('id').primaryKey(),
  tarjetaId: text('tarjeta_id')
    .notNull()
    .references(() => tarjeta.cuentaId),
  cuentaMsiId: text('cuenta_msi_id')
    .notNull()
    .references(() => cuenta.id),
  transaccionAltaId: text('transaccion_alta_id')
    .notNull()
    .references(() => transaccion.id),
  origenAlta: text('origen_alta', { enum: ['compra', 'existente', 'pasar_a_meses'] }).notNull(),
  monto: integer('monto').notNull(),
  meses: integer('meses').notNull(),
  mesesDiferimiento: integer('meses_diferimiento').notNull().default(0),
  fechaCompra: text('fecha_compra'),
  primerCorte: text('primer_corte').notNull(),
  estado: text('estado', { enum: ['activo', 'liquidado', 'terminado'] })
    .notNull()
    .default('activo'),
});

export const estadoCuenta = sqliteTable(
  'estado_cuenta',
  {
    tarjetaId: text('tarjeta_id')
      .notNull()
      .references(() => tarjeta.cuentaId),
    corte: text('corte').notNull(),
    limite: text('limite').notNull(),
    saldoCorte: integer('saldo_corte').notNull(),
    procesadoEn: integer('procesado_en').notNull(),
  },
  (t) => [primaryKey({ columns: [t.tarjetaId, t.corte] })],
);

export const programado = sqliteTable('programado', {
  id: text('id').primaryKey(),
  tipo: text('tipo', { enum: ['ingreso', 'egreso'] }).notNull(),
  concepto: text('concepto').notNull(),
  monto: integer('monto').notNull(),
  regla: text('regla').notNull(),
  cuentaId: text('cuenta_id').references(() => cuenta.id),
  categoriaCuentaId: text('categoria_cuenta_id').references(() => cuenta.id),
  comercioNormalizado: text('comercio_normalizado'),
  tarjetaId: text('tarjeta_id').references(() => tarjeta.cuentaId),
  variable: integer('variable').notNull().default(0),
  defineHorizonte: integer('define_horizonte').notNull().default(0),
  espacio: text('espacio', { enum: ['personal', 'negocio'] })
    .notNull()
    .default('personal'),
  desde: text('desde').notNull(),
  hasta: text('hasta'),
  activo: integer('activo').notNull().default(1),
});

export const ocurrencia = sqliteTable(
  'ocurrencia',
  {
    programadoId: text('programado_id')
      .notNull()
      .references(() => programado.id),
    fecha: text('fecha').notNull(),
    estado: text('estado', { enum: ['pendiente', 'cubierta', 'omitida'] }).notNull(),
    transaccionId: text('transaccion_id').references(() => transaccion.id),
  },
  (t) => [primaryKey({ columns: [t.programadoId, t.fecha] })],
);

export const arqueo = sqliteTable('arqueo', {
  id: text('id').primaryKey(),
  cuentaId: text('cuenta_id')
    .notNull()
    .references(() => cuenta.id),
  fecha: text('fecha').notNull(),
  realizadoEn: integer('realizado_en').notNull(),
  saldoContable: integer('saldo_contable').notNull(),
  reasignado: integer('reasignado').notNull().default(0),
  efectivoReal: integer('efectivo_real').notNull(),
  hueco: integer('hueco').notNull(),
  transaccionId: text('transaccion_id').references(() => transaccion.id),
});

export const captura = sqliteTable('captura', {
  id: text('id').primaryKey(),
  fuente: text('fuente', {
    enum: ['notificacion', 'correo', 'estado_cuenta', 'ticket', 'apple_pay'],
  }).notNull(),
  recibidaEn: integer('recibida_en').notNull(),
  origenApp: text('origen_app'),
  textoCrudo: text('texto_crudo'),
  plantillaId: text('plantilla_id'),
  datos: text('datos'),
  huella: text('huella').notNull(),
  estado: text('estado', {
    enum: ['nueva', 'interpretada', 'vinculada', 'descartada', 'no_reconocida', 'error'],
  }).notNull(),
  transaccionId: text('transaccion_id').references(() => transaccion.id),
});

export const reglaComercio = sqliteTable('regla_comercio', {
  comercioNormalizado: text('comercio_normalizado').primaryKey(),
  categoriaCuentaId: text('categoria_cuenta_id')
    .notNull()
    .references(() => cuenta.id),
  fuente: text('fuente', { enum: ['semilla', 'usuario', 'aprendida'] }).notNull(),
  usos: integer('usos').notNull().default(0),
  actualizadaEn: integer('actualizada_en').notNull(),
});

export const prediccion = sqliteTable('prediccion', {
  horizonteInicio: text('horizonte_inicio').primaryKey(),
  horizonteFin: text('horizonte_fin').notNull(),
  probabilidadBp: integer('probabilidad_bp').notNull(),
  versionSimulador: text('version_simulador').notNull(),
  resultado: integer('resultado'),
});

export const ajuste = sqliteTable('ajuste', {
  clave: text('clave').primaryKey(),
  valor: text('valor').notNull(),
  actualizadoEn: integer('actualizado_en').notNull(),
});

export const auditoria = sqliteTable('auditoria', {
  id: text('id').primaryKey(),
  en: integer('en').notNull(),
  entidad: text('entidad').notNull(),
  entidadId: text('entidad_id').notNull(),
  accion: text('accion').notNull(),
  antes: text('antes'),
  despues: text('despues'),
});

/** `0002_tandas` (M8, `04 §3.2`): una tanda, su cuenta `contraparte:tanda` y el programado de sus aportaciones. */
export const tanda = sqliteTable('tanda', {
  id: text('id').primaryKey(),
  cuentaId: text('cuenta_id')
    .notNull()
    .references(() => cuenta.id),
  nombre: text('nombre').notNull(),
  aportacion: integer('aportacion').notNull(),
  participantes: integer('participantes').notNull(),
  turno: integer('turno').notNull(),
  regla: text('regla').notNull(),
  inicio: text('inicio').notNull(),
  programadoId: text('programado_id')
    .notNull()
    .references(() => programado.id),
  activa: integer('activa').notNull().default(1),
});

/** Tablas de `0002_tandas`, por nombre SQL. */
export const TABLAS_0002 = { tanda } as const;

/** `0003_suscripciones` (M10, `04 §3`): suscripciones detectadas por E14. */
export const suscripcion = sqliteTable('suscripcion', {
  comercioNormalizado: text('comercio_normalizado').primaryKey(),
  periodicidad: text('periodicidad').notNull(),
  montoTipico: integer('monto_tipico').notNull(),
  ultimoCargo: text('ultimo_cargo').notNull(),
  estado: text('estado').notNull(),
  programadoId: text('programado_id').references(() => programado.id),
  actualizadaEn: integer('actualizada_en').notNull(),
});

/** `0003_suscripciones` (M10, `07 §3.1`): versiones de plantillas remotas firmadas; a lo más una activa. */
export const plantillaRemota = sqliteTable('plantilla_remota', {
  version: integer('version').primaryKey(),
  sha256: text('sha256').notNull(),
  firma: text('firma').notNull(),
  recibidaEn: integer('recibida_en').notNull(),
  activa: integer('activa').notNull().default(0),
});

/** Tablas de `0003_suscripciones`, por nombre SQL. */
export const TABLAS_0003 = { suscripcion, plantilla_remota: plantillaRemota } as const;

/**
 * `0004_cfdi` (M12, `04 §3.2` y `§3.3`): facturas CFDI 4.0 importadas, con el XML completo, lo que E13 necesita
 * para filtrar y las etiquetas del usuario (alumno, nivel, lentes, pago confirmado de un PPD) en JSON.
 */
export const cfdi = sqliteTable('cfdi', {
  uuid: text('uuid').primaryKey(),
  xml: text('xml').notNull(),
  emisorRfc: text('emisor_rfc').notNull(),
  receptorRfc: text('receptor_rfc').notNull(),
  fecha: text('fecha').notNull(),
  tipoComprobante: text('tipo_comprobante').notNull(),
  usoCfdi: text('uso_cfdi'),
  formaPago: text('forma_pago'),
  metodoPago: text('metodo_pago'),
  total: integer('total').notNull(),
  iva: integer('iva').notNull(),
  estatus: text('estatus').notNull().default('desconocido'),
  etiquetas: text('etiquetas').notNull().default('{}'),
  transaccionId: text('transaccion_id').references(() => transaccion.id),
  importadoEn: integer('importado_en').notNull(),
});

/** Tablas de `0004_cfdi`, por nombre SQL. */
export const TABLAS_0004 = { cfdi } as const;

/** Tablas de `0001_inicial`, por nombre SQL. */
export const TABLAS_0001 = {
  contacto,
  alias_contacto: aliasContacto,
  cuenta,
  alias_cuenta: aliasCuenta,
  tarjeta,
  transaccion,
  asiento,
  plan_msi: planMsi,
  estado_cuenta: estadoCuenta,
  programado,
  ocurrencia,
  arqueo,
  captura,
  regla_comercio: reglaComercio,
  prediccion,
  ajuste,
  auditoria,
} as const;
