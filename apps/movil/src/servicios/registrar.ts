import { z } from 'zod';
import { ErrorDominio, type Centavos, type PlainDate } from '@cartera/core';
import { CUENTAS_SISTEMA, esquema } from '@cartera/datos';
import {
  interpretarReglas,
  resolverCuenta,
  type ContextoInterprete,
  type CuentaResolutor,
  type Movimiento,
  type RefCuenta,
  type ResultadoResolutor,
} from '@cartera/nlu';
import { exigirConsentimiento } from '../privacidad/consentimiento';
import { cuentaPorId, cuentasPropias, idCategoriaDe, type CuentaPropia } from './catalogo';
import { enTransaccion, type Contexto } from './contexto';
import { registrarMovimiento, type EntradaMovimiento } from './formulario';
import { borrarAjuste, escribirAjuste, listarAjustes } from './preferencias';

const { aliasContacto } = esquema;

/** Tope del registro optimista (`06 §7`): suma de montos ≤ $5,000. */
export const TOPE_OPTIMISTA: Centavos = 500_000;

export type OrigenDictado = 'voz' | 'texto';

/** Lo que muestra el aviso "Registré: Coca $25 · Antojos · Efectivo — Deshacer". */
export interface ResumenMovimiento {
  readonly transaccionId: string;
  readonly tipo: EntradaMovimiento['tipo'];
  readonly descripcion: string | null;
  readonly monto: Centavos;
  readonly categoria: string | null;
  readonly cuenta: string;
  readonly porAsignar: boolean;
}

/** Cuenta que falta elegir en la tarjeta de confirmación. */
export interface CuentaPorElegir {
  readonly campo: 'origenId' | 'destinoId';
  readonly motivo: 'ambigua' | 'no_encontrada' | 'aproximado';
  /** Alias dicho (para "No tengo una cuenta «azul». ¿La agrego?"). */
  readonly alias: string | null;
  readonly candidatas: readonly { readonly id: string; readonly nombre: string }[];
}

/** Movimiento interpretado que necesita confirmación (`02 §5`, `06 §7`). */
export interface PropuestaMovimiento {
  /** Lo que ya se sabe, con las cuentas que sí se resolvieron. */
  readonly entrada: Partial<EntradaMovimiento> & {
    readonly tipo: EntradaMovimiento['tipo'];
    readonly monto: Centavos;
  };
  readonly faltan: readonly CuentaPorElegir[];
}

export type ResultadoTexto =
  | {
      readonly resultado: 'registrado';
      /** Token de "Deshacer" (5 s). */
      readonly deshacer: string;
      readonly movimientos: readonly ResumenMovimiento[];
    }
  | {
      readonly resultado: 'confirmar';
      readonly motivo: 'monto_alto' | 'cuenta' | 'aproximado';
      readonly propuestas: readonly PropuestaMovimiento[];
    }
  /** Fuera del nivel 0 y sin nube (M3): "Lo guardé; lo interpreto cuando tengas internet." */
  | { readonly resultado: 'por_interpretar'; readonly id: string }
  | { readonly resultado: 'consulta'; readonly consulta: 'hoy_puedes' };

function tipoResolutor(c: CuentaPropia): CuentaResolutor['tipo'] | null {
  switch (c.subtipo) {
    case 'efectivo':
      return 'efectivo';
    case 'debito':
      return 'debito';
    case 'billetera':
      return 'billetera';
    case 'tarjeta_credito':
      return 'credito';
    default:
      return null; // ahorro: no se paga ni se cobra con ella desde una frase
  }
}

function cuentasResolutor(ctx: Contexto): CuentaResolutor[] {
  const salida: CuentaResolutor[] = [];
  for (const c of cuentasPropias(ctx)) {
    const tipo = tipoResolutor(c);
    if (tipo) salida.push({ id: c.id, tipo, nombre: c.nombre, alias: c.alias, espacio: 'personal' });
  }
  return salida;
}

/** Contexto mínimo del nivel 0 (`06 §4`): tipos y alias de cuentas, alias de contactos, fecha. */
export function contextoInterprete(ctx: Contexto, cuentas = cuentasResolutor(ctx)): ContextoInterprete {
  const porContacto = new Map<string, string[]>();
  for (const a of ctx.db.select().from(aliasContacto).all()) {
    porContacto.set(a.contactoId, [...(porContacto.get(a.contactoId) ?? []), a.aliasNormalizado]);
  }
  return {
    fecha_referencia: ctx.reloj.hoy(),
    espacios: ['personal'],
    cuentas: cuentas.map((c) => ({ tipo: c.tipo, alias: c.alias, espacio: 'personal' })),
    contactos: [...porContacto.values()],
  };
}

type Resuelta = { id: string } | { falta: Omit<CuentaPorElegir, 'campo'> };

function resolver(
  ref: RefCuenta | undefined,
  sentido: 'sale' | 'entra',
  cuentas: readonly CuentaResolutor[],
  permitePuente: boolean,
): Resuelta {
  const r: ResultadoResolutor = resolverCuenta(
    ref
      ? { tipo: ref.tipo, ...(ref.alias !== undefined ? { alias: ref.alias } : {}) }
      : { tipo: 'desconocido' },
    cuentas,
  );
  const nombre = (id: string) => cuentas.find((c) => c.id === id)?.nombre ?? '';
  const todas = cuentas.map((c) => ({ id: c.id, nombre: c.nombre }));
  switch (r.resultado) {
    case 'cuenta':
      return r.aproximado
        ? {
            falta: {
              motivo: 'aproximado',
              alias: ref?.alias ?? null,
              candidatas: [{ id: r.cuenta, nombre: nombre(r.cuenta) }],
            },
          }
        : { id: r.cuenta };
    case 'por_asignar':
      if (permitePuente) {
        return { id: sentido === 'sale' ? CUENTAS_SISTEMA.porAsignar : CUENTAS_SISTEMA.porAsignarEntradas };
      }
      return { falta: { motivo: 'ambigua', alias: null, candidatas: todas } };
    case 'ambigua':
      return {
        falta: {
          motivo: 'ambigua',
          alias: ref?.alias ?? null,
          candidatas: r.candidatas.map((id) => ({ id, nombre: nombre(id) })),
        },
      };
    case 'no_encontrada':
      return { falta: { motivo: 'no_encontrada', alias: ref?.alias ?? null, candidatas: todas } };
  }
}

/** Convierte un movimiento del nivel 0 en una entrada del formulario, o `null` si no es de M2. */
function aPropuesta(
  ctx: Contexto,
  m: Movimiento,
  cuentas: readonly CuentaResolutor[],
): PropuestaMovimiento | null {
  const base = { monto: m.monto, fecha: m.fecha, ...(m.descripcion ? { descripcion: m.descripcion } : {}) };
  const faltan: CuentaPorElegir[] = [];
  const cuenta = (campo: CuentaPorElegir['campo'], r: Resuelta): Record<string, string> => {
    if ('id' in r) return { [campo]: r.id };
    faltan.push({ campo, ...r.falta });
    return {};
  };
  const categoria = (slug: string | undefined, naturaleza: 'gasto' | 'ingreso', porOmision: string) => {
    if (!slug) return porOmision;
    try {
      idCategoriaDe(ctx, slug, naturaleza);
      return slug;
    } catch {
      return porOmision;
    }
  };
  switch (m.tipo) {
    case 'gasto':
      return {
        entrada: {
          tipo: 'gasto',
          ...base,
          categoria: categoria(m.categoria, 'gasto', 'otros_gastos'),
          ...cuenta('origenId', resolver(m.origen, 'sale', cuentas, true)),
        },
        faltan,
      };
    case 'ingreso':
      return {
        entrada: {
          tipo: 'ingreso',
          ...base,
          categoria: categoria(m.categoria, 'ingreso', 'otros_ingresos'),
          ...cuenta('destinoId', resolver(m.destino, 'entra', cuentas, true)),
        },
        faltan,
      };
    case 'retiro_efectivo':
      return {
        entrada: {
          tipo: 'retiro_efectivo',
          ...base,
          ...cuenta('origenId', resolver(m.origen, 'sale', cuentas, false)),
          ...cuenta('destinoId', resolver(m.destino ?? { tipo: 'efectivo' }, 'entra', cuentas, false)),
        },
        faltan,
      };
    case 'pago_tarjeta':
      return {
        entrada: {
          tipo: 'pago_tarjeta',
          ...base,
          ...cuenta('origenId', resolver(m.origen, 'sale', cuentas, true)),
          ...cuenta('destinoId', resolver(m.destino, 'entra', cuentas, false)),
        },
        faltan,
      };
    default:
      return null;
  }
}

function resumir(ctx: Contexto, transaccionId: string, e: EntradaMovimiento): ResumenMovimiento {
  const cuentaId = 'origenId' in e ? e.origenId : e.destinoId;
  return {
    transaccionId,
    tipo: e.tipo,
    descripcion: e.descripcion ?? null,
    monto: e.monto,
    categoria:
      'categoria' in e
        ? cuentaPorId(ctx, idCategoriaDe(ctx, e.categoria, e.tipo === 'gasto' ? 'gasto' : 'ingreso')).nombre
        : null,
    cuenta: cuentaPorId(ctx, cuentaId).nombre,
    porAsignar: cuentaId === CUENTAS_SISTEMA.porAsignar || cuentaId === CUENTAS_SISTEMA.porAsignarEntradas,
  };
}

/**
 * Registro por voz o texto (`03 §5.1`, `02 §5`): nivel 0 → resolutor → política de confirmación → asientos →
 * `Libro.registrar`. Lo que el nivel 0 no cubre queda "por interpretar" (RF-REG-07). Nunca registra el texto en
 * logs (regla 9).
 */
export function registrarTexto(
  ctx: Contexto,
  texto: string,
  origen: OrigenDictado = 'texto',
): ResultadoTexto {
  exigirConsentimiento(ctx);
  const cuentas = cuentasResolutor(ctx);
  const interpretacion = interpretarReglas(texto, contextoInterprete(ctx, cuentas));
  if (interpretacion?.intencion === 'consultar' && interpretacion.consulta.tipo === 'hoy_puedes') {
    return { resultado: 'consulta', consulta: 'hoy_puedes' };
  }
  if (interpretacion?.intencion !== 'registrar') {
    return { resultado: 'por_interpretar', id: guardarPorInterpretar(ctx, texto, origen) };
  }
  const propuestas: PropuestaMovimiento[] = [];
  for (const m of interpretacion.movimientos) {
    const p = aPropuesta(ctx, m, cuentas);
    if (!p) return { resultado: 'por_interpretar', id: guardarPorInterpretar(ctx, texto, origen) };
    propuestas.push(p);
  }
  const total = interpretacion.movimientos.reduce((s, m) => s + m.monto, 0);
  const aproximado = interpretacion.movimientos.some((m) => m.aproximado);
  if (propuestas.some((p) => p.faltan.length > 0)) {
    const soloAproximado = propuestas.every((p) => p.faltan.every((f) => f.motivo === 'aproximado'));
    return { resultado: 'confirmar', motivo: soloAproximado ? 'aproximado' : 'cuenta', propuestas };
  }
  if (aproximado) return { resultado: 'confirmar', motivo: 'aproximado', propuestas };
  if (total > TOPE_OPTIMISTA) return { resultado: 'confirmar', motivo: 'monto_alto', propuestas };
  return confirmarRegistro(
    ctx,
    propuestas.map((p) => p.entrada as EntradaMovimiento),
    origen,
  );
}

/** "Guardar" de la tarjeta de confirmación: registra todos los movimientos en una transacción SQLite. */
export function confirmarRegistro(
  ctx: Contexto,
  entradas: readonly EntradaMovimiento[],
  origen: OrigenDictado,
): Extract<ResultadoTexto, { resultado: 'registrado' }> {
  exigirConsentimiento(ctx);
  if (entradas.length === 0) throw new ErrorDominio('movimiento_invalido', 'no hay nada que registrar');
  return enTransaccion(ctx, () => {
    const movimientos = entradas.map((e) =>
      resumir(ctx, registrarMovimiento(ctx, e, { origen }).transaccionId, e),
    );
    return {
      resultado: 'registrado',
      deshacer: movimientos.map((m) => m.transaccionId).join(','),
      movimientos,
    };
  });
}

// ——— Por interpretar ———

const PorInterpretar = z.strictObject({
  texto: z.string(),
  origen: z.enum(['voz', 'texto']),
  fecha: z.string(),
  recibido_en: z.int(),
});

export interface FrasePorInterpretar {
  readonly id: string;
  readonly texto: string;
  readonly origen: OrigenDictado;
  readonly fecha: PlainDate;
  readonly recibidoEn: number;
}

const PREFIJO = 'por_interpretar:';

function guardarPorInterpretar(ctx: Contexto, texto: string, origen: OrigenDictado): string {
  const id = ctx.generarId();
  escribirAjuste(ctx, `${PREFIJO}${id}`, PorInterpretar, {
    texto,
    origen,
    fecha: ctx.reloj.hoy(),
    recibido_en: ctx.reloj.ahora(),
  });
  return id;
}

/** "Por revisar": frases guardadas para interpretarlas con el nivel nube (M3). */
export function listarPorInterpretar(ctx: Contexto): FrasePorInterpretar[] {
  return listarAjustes(ctx, PREFIJO, PorInterpretar).map(({ clave, valor }) => ({
    id: clave.slice(PREFIJO.length),
    texto: valor.texto,
    origen: valor.origen,
    fecha: valor.fecha,
    recibidoEn: valor.recibido_en,
  }));
}

export function contarPorInterpretar(ctx: Contexto): number {
  return listarAjustes(ctx, PREFIJO, PorInterpretar).length;
}

/** Quita una frase de "Por revisar" (ya se registró a mano o ya no aplica). */
export function descartarPorInterpretar(ctx: Contexto, id: string): void {
  exigirConsentimiento(ctx);
  borrarAjuste(ctx, `${PREFIJO}${id}`);
}
