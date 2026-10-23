/**
 * Herramientas del modo explicar (`06 §6`, RF-CON-02): las consultas tipadas de solo lectura, ofrecidas al modelo
 * como funciones. El teléfono las ejecuta contra su libro y devuelve solo la respuesta en plantilla (cifras ya
 * formateadas y agregadas); el modelo nunca ve movimientos sueltos ni ids. Aquí viven las definiciones (JSON
 * Schema que viaja al proxy) y la traducción de los argumentos que propone el modelo a una `Consulta` validada.
 *
 * Los periodos con nombre (`periodo`: "esta quincena", "la semana pasada") los resuelve el teléfono con su fecha y
 * sus días de pago (`ResolverPeriodos`): el modelo no cuenta días ni adivina cuándo empezó la quincena.
 */
import { z } from 'zod';
import { CATEGORIAS, Consulta, Fecha, GRUPOS_CATEGORIA, type Categoria } from '../esquema';

/** Definición que viaja en `POST /llm/turno` (`03 §6`). */
export interface DefinicionHerramienta {
  readonly nombre: string;
  readonly descripcion: string;
  readonly parametros: Readonly<Record<string, unknown>>;
}

/** Periodos con nombre para lo ya gastado (`gasto`, `mayores_gastos`). */
export const PERIODOS_GASTO = [
  'hoy',
  'ayer',
  'esta_semana',
  'semana_pasada',
  'esta_quincena',
  'quincena_pasada',
  'este_mes',
  'mes_pasado',
  'ultimos_30_dias',
] as const;
/** Periodos con nombre para lo que viene (`compromisos`), siempre desde hoy. */
export const PERIODOS_PAGOS = [
  'hoy',
  'esta_semana',
  'esta_quincena',
  'este_mes',
  'proximos_7_dias',
  'proximos_30_dias',
] as const;
/** Lo que va de este periodo contra el mismo tramo del anterior (`comparar_periodos`). */
export const PERIODOS_COMPARAR = ['esta_semana', 'esta_quincena', 'este_mes'] as const;

export type PeriodoGasto = (typeof PERIODOS_GASTO)[number];
export type PeriodoPagos = (typeof PERIODOS_PAGOS)[number];
export type PeriodoComparar = (typeof PERIODOS_COMPARAR)[number];

export interface RangoFechas {
  readonly desde: string;
  readonly hasta: string;
}

/**
 * Resuelve un periodo con nombre a fechas con la fecha de hoy y los días de pago del teléfono. `null` si no se
 * puede (por ejemplo, "esta quincena" sin ingreso registrado): la herramienta responde con un error.
 */
export interface ResolverPeriodos {
  gasto(periodo: PeriodoGasto): RangoFechas | null;
  pagos(periodo: PeriodoPagos): RangoFechas | null;
  comparar(periodo: PeriodoComparar): { readonly actual: RangoFechas; readonly anterior: RangoFechas } | null;
}

/** Categorías de gasto personales (las de ingresos y las del negocio no aplican a estas consultas). */
const CATEGORIAS_GASTO = CATEGORIAS.slice(0, CATEGORIAS.indexOf('comisiones_intereses') + 1) as Categoria[];
const CATEGORIAS_HERRAMIENTA = [...CATEGORIAS_GASTO, ...GRUPOS_CATEGORIA];

const fecha = (descripcion: string) => ({ type: 'string', description: `${descripcion} (AAAA-MM-DD)` });
const categoria = {
  type: 'string',
  enum: CATEGORIAS_HERRAMIENTA,
  description: 'Categoría o grupo (comida, movilidad, casa). Sin ella: todas.',
};
const periodo = (valores: readonly string[], descripcion: string) => ({
  type: 'string',
  enum: valores,
  description: `${descripcion} Úsalo en vez de desde/hasta cuando lo piden así.`,
});
const objeto = (properties: Record<string, unknown> = {}, required?: string[]) => ({
  type: 'object',
  properties,
  ...(required ? { required } : {}),
  additionalProperties: false,
});

export const HERRAMIENTAS_EXPLICAR = [
  {
    nombre: 'hoy',
    descripcion: 'Cuánto puede gastar hoy la persona y cuántos días faltan para su próximo ingreso.',
    parametros: objeto(),
  },
  {
    nombre: 'me_alcanza',
    descripcion:
      'Si le alcanza para una compra que menciona con su precio ("¿puedo gastar 500 en unos tenis?"): simula pagarla hoy de contado, a meses y esperando a su próximo ingreso, con la probabilidad de no quedarse corto de cada opción.',
    parametros: objeto(
      {
        precio: {
          type: 'number',
          exclusiveMinimum: 0,
          description: 'Precio en pesos, como lo dijo (500 = $500).',
        },
        descripcion: { type: 'string', maxLength: 60, description: 'Qué compraría ("unos tenis").' },
        fecha: fecha('Día en que compraría, si lo dice'),
        meses: { type: 'integer', minimum: 2, maximum: 48, description: 'Meses sin intereses, si los pide.' },
      },
      ['precio'],
    ),
  },
  {
    nombre: 'gasto',
    descripcion:
      'Total gastado en un periodo, de todas las categorías o de una. Por omisión, del 1 del mes a hoy.',
    parametros: objeto({
      periodo: periodo(PERIODOS_GASTO, 'Periodo con nombre (esta_quincena: desde su último ingreso).'),
      desde: fecha('Inicio'),
      hasta: fecha('Fin'),
      categoria,
    }),
  },
  {
    nombre: 'mayores_gastos',
    descripcion:
      'Categorías en las que más gastó en un periodo, de mayor a menor. Por omisión, últimos 30 días.',
    parametros: objeto({
      periodo: periodo(PERIODOS_GASTO, 'Periodo con nombre.'),
      desde: fecha('Inicio'),
      hasta: fecha('Fin'),
      limite: { type: 'integer', minimum: 1, maximum: 10 },
    }),
  },
  {
    nombre: 'comparar_periodos',
    descripcion:
      'Diferencia de gasto entre dos periodos. Sin fechas: del 1 del mes a hoy contra los mismos días del mes pasado.',
    parametros: objeto({
      periodo: periodo(PERIODOS_COMPARAR, 'Lo que va de este periodo contra el mismo tramo del anterior.'),
      actual_desde: fecha('Inicio del periodo actual'),
      actual_hasta: fecha('Fin del periodo actual'),
      anterior_desde: fecha('Inicio del periodo anterior'),
      anterior_hasta: fecha('Fin del periodo anterior'),
      categoria,
    }),
  },
  {
    nombre: 'saldos',
    descripcion: 'Saldo de sus cuentas, o de una por su alias (por ejemplo "bbva" o "nu").',
    parametros: objeto({ alias: { type: 'string', maxLength: 60 } }),
  },
  {
    nombre: 'tarjetas',
    descripcion: 'Cuánto debe en sus tarjetas de crédito y su próximo pago.',
    parametros: objeto(),
  },
  {
    nombre: 'compromisos',
    descripcion:
      'Pagos programados que vienen (renta, servicios, tanda, tarjetas). Por omisión, próximos 30 días.',
    parametros: objeto({
      periodo: periodo(PERIODOS_PAGOS, 'Desde hoy (esta_quincena: hasta su próximo ingreso).'),
      desde: fecha('Inicio'),
      hasta: fecha('Fin'),
    }),
  },
  {
    nombre: 'por_cobrar',
    descripcion: 'Quién le debe dinero y cuánto.',
    parametros: objeto({ persona: { type: 'string', maxLength: 60 } }),
  },
  {
    nombre: 'suscripciones',
    descripcion:
      'Suscripciones y cargos recurrentes detectados en sus gastos y cuánto paga por ellos al mes.',
    parametros: objeto(),
  },
] as const satisfies readonly DefinicionHerramienta[];

/** Una consulta tipada (`06 §3`) ya validada. */
export type ConsultaHerramienta = z.infer<typeof Consulta>;

export type NombreHerramienta = (typeof HERRAMIENTAS_EXPLICAR)[number]['nombre'];

/** La compra de `me_alcanza` en la forma de `06 §3` (`simular`): precio en centavos. */
export interface CompraHerramienta {
  readonly precio: number;
  readonly descripcion?: string;
  readonly fecha?: string;
  readonly meses?: number;
}

const Categoria_ = z.enum(CATEGORIAS_HERRAMIENTA as [string, ...string[]]);
const Alias = z.string().trim().min(1).max(60);
const Rango = z
  .strictObject({ desde: Fecha.optional(), hasta: Fecha.optional() })
  .refine((r) => r.desde === undefined || r.hasta === undefined || r.desde <= r.hasta);

const ARGUMENTOS = {
  hoy: z.strictObject({}),
  me_alcanza: z.strictObject({
    precio: z.number().positive().max(100_000_000),
    descripcion: z.string().trim().min(1).max(60).optional(),
    fecha: Fecha.optional(),
    meses: z.int().min(2).max(48).optional(),
  }),
  gasto: z.strictObject({
    periodo: z.enum(PERIODOS_GASTO).optional(),
    desde: Fecha.optional(),
    hasta: Fecha.optional(),
    categoria: Categoria_.optional(),
  }),
  mayores_gastos: z.strictObject({
    periodo: z.enum(PERIODOS_GASTO).optional(),
    desde: Fecha.optional(),
    hasta: Fecha.optional(),
    limite: z.int().min(1).max(10).optional(),
  }),
  comparar_periodos: z.strictObject({
    periodo: z.enum(PERIODOS_COMPARAR).optional(),
    actual_desde: Fecha.optional(),
    actual_hasta: Fecha.optional(),
    anterior_desde: Fecha.optional(),
    anterior_hasta: Fecha.optional(),
    categoria: Categoria_.optional(),
  }),
  saldos: z.strictObject({ alias: Alias.optional() }),
  tarjetas: z.strictObject({}),
  compromisos: z.strictObject({
    periodo: z.enum(PERIODOS_PAGOS).optional(),
    desde: Fecha.optional(),
    hasta: Fecha.optional(),
  }),
  por_cobrar: z.strictObject({ persona: Alias.optional() }),
  suscripciones: z.strictObject({}),
} satisfies Record<NombreHerramienta, z.ZodType>;

const esNombre = (n: string): n is NombreHerramienta => Object.hasOwn(ARGUMENTOS, n);

/**
 * Traduce `me_alcanza` a la compra de "¿Me alcanza?" (`simular`, `06 §3`): el precio que dijo, en centavos.
 * `null` si la herramienta es otra o los argumentos no pasan la validación.
 */
export function compraDeHerramienta(nombre: string, argumentos: unknown): CompraHerramienta | null {
  if (nombre !== 'me_alcanza') return null;
  const r = ARGUMENTOS.me_alcanza.safeParse(argumentos ?? {});
  if (!r.success) return null;
  const precio = Math.round(r.data.precio * 100);
  if (precio < 1) return null;
  return {
    precio,
    ...(r.data.descripcion ? { descripcion: r.data.descripcion } : {}),
    ...(r.data.fecha ? { fecha: r.data.fecha } : {}),
    ...(r.data.meses ? { meses: r.data.meses } : {}),
  };
}

/**
 * Traduce una llamada del modelo a la `Consulta` que responde `servicios/consultas`. `null` si la herramienta no
 * existe (o es `me_alcanza`, que va por `compraDeHerramienta`), si los argumentos no pasan la validación (fechas
 * inexistentes, rangos al revés, claves extra, un periodo de la comparación a medias) o si un `periodo` con nombre
 * no se puede resolver: el teléfono le responde al modelo con un error, sin ejecutar nada. Con `periodo` y fechas a
 * la vez, gana `periodo`.
 */
export function consultaDeHerramienta(
  nombre: string,
  argumentos: unknown,
  periodos?: ResolverPeriodos,
): ConsultaHerramienta | null {
  if (!esNombre(nombre) || nombre === 'me_alcanza') return null;
  const r = ARGUMENTOS[nombre].safeParse(argumentos ?? {});
  if (!r.success) return null;
  const a = r.data as Record<string, string | number | undefined>;
  const rango = (desde: unknown, hasta: unknown) => {
    const v = Rango.safeParse({ desde, hasta });
    return v.success ? v.data : null;
  };
  const consulta = (c: Record<string, unknown>) => {
    const v = Consulta.safeParse(Object.fromEntries(Object.entries(c).filter(([, x]) => x !== undefined)));
    return v.success ? v.data : null;
  };
  switch (nombre) {
    case 'hoy':
      return consulta({ tipo: 'hoy_puedes' });
    case 'tarjetas':
      return consulta({ tipo: 'deuda_tarjetas' });
    case 'saldos':
      return consulta({ tipo: 'saldo', alias: a.alias });
    case 'por_cobrar':
      return consulta({ tipo: 'por_cobrar', contraparte: a.persona });
    case 'suscripciones':
      return consulta({ tipo: 'suscripciones' });
    case 'gasto':
    case 'mayores_gastos':
    case 'compromisos': {
      let p: { desde?: string | undefined; hasta?: string | undefined } | null;
      if (a.periodo !== undefined) {
        if (!periodos) return null;
        p =
          nombre === 'compromisos'
            ? periodos.pagos(a.periodo as PeriodoPagos)
            : periodos.gasto(a.periodo as PeriodoGasto);
      } else {
        p = rango(a.desde, a.hasta);
      }
      if (!p) return null;
      const tipo = {
        gasto: a.categoria === undefined ? 'gasto_total' : 'gasto_por_categoria',
        mayores_gastos: 'mayores_gastos',
        compromisos: 'compromisos',
      }[nombre];
      return consulta({ tipo, desde: p.desde, hasta: p.hasta, categoria: a.categoria, limite: a.limite });
    }
    case 'comparar_periodos': {
      if (a.periodo !== undefined) {
        const c = periodos?.comparar(a.periodo as PeriodoComparar) ?? null;
        if (!c) return null;
        return consulta({
          tipo: 'comparar_periodos',
          actual: c.actual,
          anterior: c.anterior,
          categoria: a.categoria,
        });
      }
      const fechas = [a.actual_desde, a.actual_hasta, a.anterior_desde, a.anterior_hasta];
      const algunas = fechas.some((f) => f !== undefined);
      if (algunas && !fechas.every((f) => f !== undefined)) return null;
      const actual = algunas ? rango(a.actual_desde, a.actual_hasta) : undefined;
      const anterior = algunas ? rango(a.anterior_desde, a.anterior_hasta) : undefined;
      if (actual === null || anterior === null) return null;
      return consulta({ tipo: 'comparar_periodos', actual, anterior, categoria: a.categoria });
    }
  }
}
