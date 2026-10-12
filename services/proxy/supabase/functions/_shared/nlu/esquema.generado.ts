// GENERADO desde packages/nlu/src/esquema.ts por `pnpm --filter @cartera/nlu generar:proveedor`. No editar a mano.
// En Deno, `zod` se resuelve con el mapa de importaciones de cada función (deno.json).
/**
 * Esquema canónico de la salida del intérprete (docs/06-NLU.md §3).
 * Copia en JSON Schema: `fixtures/nlu/esquema.json`; `esquema.test.ts` comprueba que ambos acepten y rechacen lo mismo.
 */

import { z } from 'zod';

const PATRON_FECHA_CIVIL = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Copia de `esFecha` de `packages/core/src/fecha.ts`: la fecha civil existe (no hay 30 de febrero). */
function esFecha(valor: unknown): valor is string {
  if (typeof valor !== 'string') return false;
  const m = PATRON_FECHA_CIVIL.exec(valor);
  if (!m) return false;
  const anio = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  if (mes < 1 || mes > 12 || dia < 1) return false;
  const bisiesto = (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
  const dias = mes === 2 ? (bisiesto ? 29 : 28) : [4, 6, 9, 11].includes(mes) ? 30 : 31;
  return dia <= dias;
}

const PATRON_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** `'YYYY-MM-DD'`. Además del patrón del JSON Schema, Zod exige que la fecha civil exista (no hay 30 de febrero). */
export const Fecha = z.string().regex(PATRON_FECHA).refine(esFecha, { message: 'fecha civil inexistente' });
/** Centavos enteros > 0. */
export const Centavos = z.int().min(1);
/** Centavos enteros ≥ 0 (arqueo, colchón, saldo). */
export const Centavos0 = z.int().min(0);
const Texto = z.string().min(1).max(120);

export const CATEGORIAS = [
  'comida_fuera',
  'antojos',
  'super',
  'transporte',
  'gasolina',
  'entretenimiento',
  'ropa',
  'hogar',
  'cuidado_personal',
  'salud',
  'mascotas',
  'regalos',
  'apoyo_familiar',
  'viajes',
  'tecnologia',
  'deporte',
  'otros_gastos',
  'vivienda',
  'servicios',
  'suscripciones',
  'educacion',
  'comisiones_intereses',
  'sueldo',
  'honorarios',
  'ventas',
  'regalo_recibido',
  'reembolso',
  'rendimientos',
  'otros_ingresos',
  'servicios_prestados',
  'mercancia',
  'insumos',
  'renta_local',
  'sueldos_ayudantes',
  'publicidad',
  'equipo',
  'mantenimiento',
  'impuestos',
  'otros_impuestos',
] as const;
export const Categoria = z.enum(CATEGORIAS);
export type Categoria = z.infer<typeof Categoria>;

/** Categorías que solo valen con `espacio: 'negocio'` (§3.1, Espacio negocio). */
export const CATEGORIAS_NEGOCIO_EXCLUSIVAS: readonly Categoria[] = [
  'servicios_prestados',
  'mercancia',
  'insumos',
  'renta_local',
  'sueldos_ayudantes',
  'publicidad',
  'equipo',
  'mantenimiento',
  'impuestos',
  'otros_impuestos',
];

export const GRUPOS_CATEGORIA = ['comida', 'movilidad', 'casa'] as const;
const CategoriaConsulta = z.union([Categoria, z.enum(GRUPOS_CATEGORIA)]);

export const Espacio = z.enum(['personal', 'negocio']);
export type Espacio = z.infer<typeof Espacio>;

export const TIPOS_REF_CUENTA = ['efectivo', 'debito', 'credito', 'tarjeta', 'desconocido'] as const;
export const RefCuenta = z.strictObject({ tipo: z.enum(TIPOS_REF_CUENTA), alias: Texto.optional() });
export type RefCuenta = z.infer<typeof RefCuenta>;

const Rango = z.strictObject({ desde: Fecha, hasta: Fecha });
const Msi = z.strictObject({ meses: z.int().min(2).max(48) });
const Dia = z.int().min(1).max(31);
const AjusteFinDeSemana = z.enum(['anterior', 'siguiente', 'ninguno']);

const ReglaQuincenal15Ultimo = z.strictObject({
  tipo: z.literal('quincenal_15_ultimo'),
  ajuste: AjusteFinDeSemana.optional(),
});
const ReglaQuincenalDias = z.strictObject({
  tipo: z.literal('quincenal_dias'),
  dias: z.tuple([Dia, Dia]),
  ajuste: AjusteFinDeSemana.optional(),
});
const ReglaMensual = z.strictObject({
  tipo: z.literal('mensual'),
  dia: Dia,
  ajuste: AjusteFinDeSemana.optional(),
});
const ReglaSemanal = z.strictObject({
  tipo: z.literal('semanal'),
  dia_semana: z.int().min(1).max(7),
  ajuste: AjusteFinDeSemana.optional(),
});
const ReglaCatorcenal = z.strictObject({
  tipo: z.literal('catorcenal'),
  ancla: Fecha,
  ajuste: AjusteFinDeSemana.optional(),
});
const ReglaAnual = z.strictObject({
  tipo: z.literal('anual'),
  mes: z.int().min(1).max(12),
  dia: Dia,
  ajuste: AjusteFinDeSemana.optional(),
});
const ReglaUnica = z.strictObject({ tipo: z.literal('unica'), fecha: Fecha });

const VARIANTES_RECURRENTES = [
  ReglaQuincenal15Ultimo,
  ReglaQuincenalDias,
  ReglaMensual,
  ReglaSemanal,
  ReglaCatorcenal,
  ReglaAnual,
] as const;
/** Regla de 05 §E3.1 sin `unica`. */
export const ReglaRecurrente = z.discriminatedUnion('tipo', [...VARIANTES_RECURRENTES]);
/** Regla de 05 §E3.1, incluida `{ tipo: 'unica', fecha }`. */
export const Regla = z.discriminatedUnion('tipo', [...VARIANTES_RECURRENTES, ReglaUnica]);
export type Regla = z.infer<typeof Regla>;

/** Una categoría exclusiva del negocio exige `espacio: 'negocio'` (el `if/then` del JSON Schema). */
function exigirEspacioNegocio(valor: { categoria?: Categoria | undefined; espacio?: Espacio | undefined }) {
  return (
    valor.categoria === undefined ||
    !CATEGORIAS_NEGOCIO_EXCLUSIVAS.includes(valor.categoria) ||
    valor.espacio === 'negocio'
  );
}
const MENSAJE_NEGOCIO = { message: 'categoría exclusiva del negocio sin espacio negocio', path: ['espacio'] };

export const TIPOS_MOVIMIENTO = [
  'gasto',
  'ingreso',
  'transferencia',
  'retiro_efectivo',
  'pago_tarjeta',
  'prestamo_otorgado',
  'cobro_prestamo',
  'prestamo_recibido',
  'pago_prestamo',
  'compra_msi',
  'cuenta_dividida',
  'aportacion_tanda',
  'cobro_tanda',
  'retiro_dueno',
  'aportacion_dueno',
] as const;

export const Movimiento = z
  .strictObject({
    tipo: z.enum(TIPOS_MOVIMIENTO),
    monto: Centavos,
    fecha: Fecha,
    descripcion: Texto.optional(),
    categoria: Categoria.optional(),
    espacio: Espacio.optional(),
    origen: RefCuenta.optional(),
    destino: RefCuenta.optional(),
    contraparte: Texto.optional(),
    msi: Msi.optional(),
    division: z
      .strictObject({ partes: z.int().min(2).max(50), participantes: z.array(Texto).optional() })
      .optional(),
    aproximado: z.boolean().optional(),
  })
  .refine(exigirEspacioNegocio, MENSAJE_NEGOCIO);
export type Movimiento = z.infer<typeof Movimiento>;

const alMenosUnCampo = (valor: object) => Object.keys(valor).length >= 1;

export const Referencia = z
  .strictObject({
    ultimo: z.boolean().optional(),
    texto: Texto.optional(),
    fecha: Fecha.optional(),
    monto: Centavos.optional(),
  })
  .refine(alMenosUnCampo, { message: 'la referencia necesita al menos un campo' });

const Cambios = z
  .strictObject({
    monto: Centavos.optional(),
    fecha: Fecha.optional(),
    categoria: Categoria.optional(),
    origen: RefCuenta.optional(),
    descripcion: Texto.optional(),
    msi: Msi.optional(),
  })
  .refine(alMenosUnCampo, { message: 'los cambios necesitan al menos un campo' });

export const TIPOS_CONSULTA = [
  'hoy_puedes',
  'gasto_total',
  'gasto_por_categoria',
  'saldo',
  'deuda_tarjetas',
  'compromisos',
  'por_cobrar',
  'comparar_periodos',
  'mayores_gastos',
  'suscripciones',
  'explicar',
  'impuestos',
  'deducciones',
  'puedo_retirar',
] as const;

export const Consulta = z.strictObject({
  tipo: z.enum(TIPOS_CONSULTA),
  desde: Fecha.optional(),
  hasta: Fecha.optional(),
  categoria: CategoriaConsulta.optional(),
  alias: Texto.optional(),
  contraparte: Texto.optional(),
  actual: Rango.optional(),
  anterior: Rango.optional(),
  limite: z.int().min(1).max(20).optional(),
  pregunta: Texto.optional(),
});

export const Ajuste = z.discriminatedUnion('tipo', [
  z.strictObject({
    tipo: z.literal('tarjeta_ciclo'),
    alias: Texto.optional(),
    dia_corte: Dia.optional(),
    dia_limite_pago: Dia.optional(),
    dias_para_pagar: z.int().min(1).max(60).optional(),
  }),
  z.strictObject({ tipo: z.literal('colchon'), monto: Centavos0 }),
  z.strictObject({
    tipo: z.literal('ingreso_recurrente'),
    monto: Centavos.optional(),
    regla: ReglaRecurrente.optional(),
  }),
  z.strictObject({ tipo: z.literal('saldo_cuenta'), alias: Texto.optional(), monto: Centavos0 }),
  z
    .strictObject({
      tipo: z.literal('compromiso'),
      concepto: Texto.optional(),
      monto: Centavos,
      categoria: Categoria.optional(),
      regla: Regla,
      espacio: Espacio.optional(),
    })
    .refine(exigirEspacioNegocio, MENSAJE_NEGOCIO),
  z.strictObject({
    tipo: z.literal('tanda'),
    aportacion: Centavos,
    participantes: z.int().min(2).max(50),
    turno: z.int().min(1).max(50),
    regla: ReglaRecurrente,
    inicio: Fecha.optional(),
  }),
]);
export type Ajuste = z.infer<typeof Ajuste>;

export const MOTIVOS_ACLARAR = [
  'monto_faltante',
  'monto_ambiguo',
  'tipo_ambiguo',
  'fecha_ambigua',
  'referencia_ambigua',
  'no_entendi',
] as const;

export const Interpretacion = z.discriminatedUnion('intencion', [
  z.strictObject({ intencion: z.literal('registrar'), movimientos: z.array(Movimiento).min(1).max(10) }),
  z.strictObject({ intencion: z.literal('corregir'), objetivo: Referencia, cambios: Cambios }),
  z.strictObject({ intencion: z.literal('anular'), objetivo: Referencia }),
  z.strictObject({
    intencion: z.literal('revisar_duplicados'),
    filtro: z.strictObject({ texto: Texto.optional(), fecha: Fecha.optional() }),
  }),
  z.strictObject({
    intencion: z.literal('arqueo'),
    efectivo_real: Centavos0,
    aproximado: z.boolean().optional(),
  }),
  z.strictObject({ intencion: z.literal('consultar'), consulta: Consulta }),
  z.strictObject({
    intencion: z.literal('simular'),
    compra: z.strictObject({
      precio: Centavos,
      descripcion: Texto.optional(),
      meses: z.int().min(2).max(48).optional(),
      fecha: Fecha.optional(),
    }),
  }),
  z.strictObject({ intencion: z.literal('configurar'), ajuste: Ajuste }),
  z.strictObject({
    intencion: z.literal('aclarar'),
    motivo: z.enum(MOTIVOS_ACLARAR),
    pregunta: Texto,
    opciones: z.array(Texto).max(4).optional(),
    parcial: z.record(z.string(), z.unknown()).optional(),
  }),
  z.strictObject({
    intencion: z.literal('fuera_de_alcance'),
    motivo: z.enum(['mueve_dinero', 'asesoria_inversion', 'ajeno', 'instrucciones']).optional(),
  }),
]);
export type Interpretacion = z.infer<typeof Interpretacion>;
