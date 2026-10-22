/**
 * Esquema Zod de lo que leen los lectores por paso del onboarding (docs/06-NLU.md §13). Toda salida de
 * `interpretarPaso` pasa por aquí antes de llegar a la app: lo que no valida es `null`.
 */
import { z } from 'zod';
import { ReglaRecurrente } from '../esquema';

const MAX = Number.MAX_SAFE_INTEGER;
const Texto = z.string().min(1).max(120);

export const PASOS = [
  'ingreso',
  'efectivo',
  'cuentas',
  'tarjeta',
  'pagos_fijos',
  'colchon',
  'tanda',
] as const;
export const Paso = z.enum(PASOS);

/** Una cifra dicha, en centavos enteros > 0, con su marca de aproximado ("como 500"). */
export const Cifra = z.strictObject({ monto: z.int().min(1).max(MAX), aproximado: z.boolean() });
/** Igual, pero admite $0 (efectivo, saldos, deuda, colchón). */
export const Cifra0 = z.strictObject({ monto: z.int().min(0).max(MAX), aproximado: z.boolean() });

export const FRECUENCIAS_INGRESO = ['quincena', 'semanal', 'catorcenal', 'mensual', 'varia'] as const;
export const FRECUENCIAS_PAGO = ['mensual', 'quincenal', 'semanal', 'anual'] as const;
export const FRECUENCIAS_TANDA = ['semanal', 'quincenal', 'catorcenal', 'mensual'] as const;
export const SUBTIPOS_CUENTA = ['debito', 'billetera', 'ahorro'] as const;
export const FIN_DE_SEMANA = ['antes', 'despues', 'mismo'] as const;
export const AVISOS_PAGO = ['cada_dos_meses'] as const;

type TipoRegla = z.infer<typeof ReglaRecurrente>['tipo'];

/** Frecuencia de O3 que corresponde a cada regla (anual no existe para un sueldo). */
const FRECUENCIA_INGRESO_DE: Readonly<Record<TipoRegla, (typeof FRECUENCIAS_INGRESO)[number] | null>> = {
  quincenal_15_ultimo: 'quincena',
  quincenal_dias: 'quincena',
  semanal: 'semanal',
  catorcenal: 'catorcenal',
  mensual: 'mensual',
  anual: null,
};
/** Frecuencia de O5 que corresponde a cada regla (la catorcenal no tiene chip: va sin frecuencia). */
export const FRECUENCIA_PAGO_DE: Readonly<Record<TipoRegla, (typeof FRECUENCIAS_PAGO)[number] | null>> = {
  quincenal_15_ultimo: 'quincenal',
  quincenal_dias: 'quincenal',
  semanal: 'semanal',
  catorcenal: null,
  mensual: 'mensual',
  anual: 'anual',
};

const LecturaIngreso = z
  .strictObject({
    paso: z.literal('ingreso'),
    monto: Cifra.optional(),
    frecuencia: z.enum(FRECUENCIAS_INGRESO).optional(),
    regla: ReglaRecurrente.optional(),
    finDeSemana: z.enum(FIN_DE_SEMANA).optional(),
  })
  .refine((x) => x.monto !== undefined || x.frecuencia !== undefined || x.finDeSemana !== undefined, {
    message: 'la lectura no trae ningún dato',
  })
  .refine(
    (x) =>
      x.frecuencia !== 'varia' ||
      (x.monto === undefined && x.regla === undefined && x.finDeSemana === undefined),
    { message: '"varía" va solo' },
  )
  .refine((x) => x.regla === undefined || FRECUENCIA_INGRESO_DE[x.regla.tipo] === x.frecuencia, {
    message: 'la regla no corresponde a la frecuencia',
  });

const LecturaEfectivo = z.strictObject({ paso: z.literal('efectivo'), efectivo: Cifra0 });

const CuentaLeida = z.strictObject({
  nombre: Texto,
  institucion: Texto.optional(),
  subtipo: z.enum(SUBTIPOS_CUENTA),
  saldo: Cifra0,
});
const LecturaCuentas = z
  .strictObject({
    paso: z.literal('cuentas'),
    efectivo: Cifra0.optional(),
    cuentas: z.array(CuentaLeida).max(6),
  })
  .refine((x) => x.cuentas.length > 0 || x.efectivo !== undefined, { message: 'la lectura no trae cuentas' })
  .refine((x) => x.cuentas.length + (x.efectivo === undefined ? 0 : 1) <= 6, { message: 'más de 6 cuentas' })
  .refine(
    (x) =>
      new Set(x.cuentas.map((c) => `${c.institucion ?? c.nombre}:${c.subtipo}`)).size === x.cuentas.length,
    {
      message: 'la misma cuenta dos veces',
    },
  );

const LecturaTarjeta = z
  .strictObject({
    paso: z.literal('tarjeta'),
    nombre: Texto.optional(),
    ultimos4: z
      .string()
      .regex(/^\d{4}$/)
      .optional(),
    diaCorte: z.int().min(1).max(31).optional(),
    diaLimitePago: z.int().min(1).max(31).optional(),
    diasParaPagar: z.int().min(1).max(60).optional(),
    limiteCredito: Cifra.optional(),
    saldo: Cifra0.optional(),
    modo: z.enum(['totalero', 'plan']).optional(),
    msiPrevios: z
      .array(z.strictObject({ mensualidad: z.int().min(1).max(MAX), restantes: z.int().min(1).max(48) }))
      .min(1)
      .max(10)
      .optional(),
  })
  .refine((x) => Object.keys(x).length > 1, { message: 'la lectura no trae ningún dato' })
  .refine((x) => x.diaLimitePago === undefined || x.diasParaPagar === undefined, {
    message: 'día límite o días para pagar, no los dos',
  });

const PagoLeido = z
  .strictObject({
    concepto: Texto,
    monto: Cifra,
    frecuencia: z.enum(FRECUENCIAS_PAGO).optional(),
    regla: ReglaRecurrente.optional(),
    cuentaAlias: Texto.optional(),
    pagosRestantes: z.int().min(1).max(600).optional(),
    avisos: z.array(z.enum(AVISOS_PAGO)).min(1).optional(),
  })
  .refine((p) => p.regla === undefined || (FRECUENCIA_PAGO_DE[p.regla.tipo] ?? undefined) === p.frecuencia, {
    message: 'la regla no corresponde a la frecuencia',
  })
  .refine((p) => p.avisos === undefined || (p.regla === undefined && p.frecuencia === undefined), {
    message: 'cada dos meses no tiene regla (se elige a mano)',
  });
const LecturaPagosFijos = z.strictObject({
  paso: z.literal('pagos_fijos'),
  pagos: z.array(PagoLeido).min(1).max(5),
});

const LecturaColchon = z.strictObject({ paso: z.literal('colchon'), monto: Cifra0 });

const LecturaTanda = z
  .strictObject({
    paso: z.literal('tanda'),
    aportacion: Cifra.optional(),
    frecuencia: z.enum(FRECUENCIAS_TANDA).optional(),
    participantes: z.int().min(2).max(50).optional(),
    turno: z.int().min(1).max(50).optional(),
  })
  .refine((x) => Object.keys(x).length > 1, { message: 'la lectura no trae ningún dato' })
  .refine((x) => x.turno === undefined || x.participantes === undefined || x.turno <= x.participantes, {
    message: 'el turno no puede pasar de los participantes',
  });

export const LecturaPaso = z.discriminatedUnion('paso', [
  LecturaIngreso,
  LecturaEfectivo,
  LecturaCuentas,
  LecturaTarjeta,
  LecturaPagosFijos,
  LecturaColchon,
  LecturaTanda,
]);
export type LecturaPaso = z.infer<typeof LecturaPaso>;
export type Cifra = z.infer<typeof Cifra>;
