/**
 * Herramientas del modo explicar (`06 §6`, RF-CON-02): las consultas tipadas de solo lectura, ofrecidas al modelo
 * como funciones. El teléfono las ejecuta contra su libro y devuelve solo la respuesta en plantilla (cifras ya
 * formateadas y agregadas); el modelo nunca ve movimientos sueltos ni ids. Aquí viven las definiciones (JSON
 * Schema que viaja al proxy) y la traducción de los argumentos que propone el modelo a una `Consulta` validada.
 */
import { z } from 'zod';
import { CATEGORIAS, Consulta, Fecha, GRUPOS_CATEGORIA, type Categoria } from '../esquema';

/** Definición que viaja en `POST /llm/turno` (`03 §6`). */
export interface DefinicionHerramienta {
  readonly nombre: string;
  readonly descripcion: string;
  readonly parametros: Readonly<Record<string, unknown>>;
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
const objeto = (properties: Record<string, unknown> = {}) => ({
  type: 'object',
  properties,
  additionalProperties: false,
});

export const HERRAMIENTAS_EXPLICAR = [
  {
    nombre: 'hoy',
    descripcion: 'Cuánto puede gastar hoy la persona y cuántos días faltan para su próximo ingreso.',
    parametros: objeto(),
  },
  {
    nombre: 'gasto',
    descripcion:
      'Total gastado en un periodo, de todas las categorías o de una. Por omisión, del 1 del mes a hoy.',
    parametros: objeto({ desde: fecha('Inicio'), hasta: fecha('Fin'), categoria }),
  },
  {
    nombre: 'mayores_gastos',
    descripcion:
      'Categorías en las que más gastó en un periodo, de mayor a menor. Por omisión, últimos 30 días.',
    parametros: objeto({
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
      'Pagos programados en un periodo (renta, servicios, tanda, tarjetas). Por omisión, próximos 30 días.',
    parametros: objeto({ desde: fecha('Inicio'), hasta: fecha('Fin') }),
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

const Categoria_ = z.enum(CATEGORIAS_HERRAMIENTA as [string, ...string[]]);
const Alias = z.string().trim().min(1).max(60);
const Rango = z
  .strictObject({ desde: Fecha.optional(), hasta: Fecha.optional() })
  .refine((r) => r.desde === undefined || r.hasta === undefined || r.desde <= r.hasta);

const ARGUMENTOS = {
  hoy: z.strictObject({}),
  gasto: z.strictObject({
    desde: Fecha.optional(),
    hasta: Fecha.optional(),
    categoria: Categoria_.optional(),
  }),
  mayores_gastos: z.strictObject({
    desde: Fecha.optional(),
    hasta: Fecha.optional(),
    limite: z.int().min(1).max(10).optional(),
  }),
  comparar_periodos: z.strictObject({
    actual_desde: Fecha.optional(),
    actual_hasta: Fecha.optional(),
    anterior_desde: Fecha.optional(),
    anterior_hasta: Fecha.optional(),
    categoria: Categoria_.optional(),
  }),
  saldos: z.strictObject({ alias: Alias.optional() }),
  tarjetas: z.strictObject({}),
  compromisos: z.strictObject({ desde: Fecha.optional(), hasta: Fecha.optional() }),
  por_cobrar: z.strictObject({ persona: Alias.optional() }),
  suscripciones: z.strictObject({}),
} satisfies Record<NombreHerramienta, z.ZodType>;

const esNombre = (n: string): n is NombreHerramienta => Object.hasOwn(ARGUMENTOS, n);

/**
 * Traduce una llamada del modelo a la `Consulta` que responde `servicios/consultas`. `null` si la herramienta no
 * existe o los argumentos no pasan la validación (fechas inexistentes, rangos al revés, claves extra, un periodo
 * de la comparación a medias): el teléfono le responde al modelo con un error, sin ejecutar nada.
 */
export function consultaDeHerramienta(nombre: string, argumentos: unknown): ConsultaHerramienta | null {
  if (!esNombre(nombre)) return null;
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
      const p = rango(a.desde, a.hasta);
      if (!p) return null;
      const tipo = {
        gasto: a.categoria === undefined ? 'gasto_total' : 'gasto_por_categoria',
        mayores_gastos: 'mayores_gastos',
        compromisos: 'compromisos',
      }[nombre];
      return consulta({ tipo, ...p, categoria: a.categoria, limite: a.limite });
    }
    case 'comparar_periodos': {
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
