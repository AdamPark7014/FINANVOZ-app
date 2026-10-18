import { z } from 'zod';
import { ErrorDominio, construirCuentaDividida, dividirCuenta, esFecha, type Centavos } from '@cartera/core';
import { CUENTAS_SISTEMA, esquema } from '@cartera/datos';
import { exigirConsentimiento } from '../privacidad/consentimiento';
import { cuentaPorId, idCategoriaDe, normalizarAliases } from './catalogo';
import { esSaludEnEfectivo } from './deducciones';
import { enTransaccion, type Contexto } from './contexto';
import { trasRegistrar, type MovimientoRegistrado, type OrigenRegistro } from './formulario';
import { listarPersonas } from './personas';

const { aliasContacto } = esquema;

/** Máximo de partes (mismo tope que el esquema del intérprete, `06 §3`). */
export const MAX_PARTES = 50;

/**
 * Cuenta dividida que pagaste tú (`05 §E12.1`, caso 8 de `04 §4`): `total` entre `partes` (tú incluido). Cada
 * persona de `personaIds` (cuentas `contraparte:persona`, una entrada por parte ajena; puede repetirse) queda debiendo su
 * parte; tu parte va a la categoría. `origenId` es con qué pagaste (o `pasivo:por_asignar`).
 */
export const EntradaCuentaDividida = z
  .strictObject({
    total: z.int().min(1).max(Number.MAX_SAFE_INTEGER),
    partes: z.int().min(2).max(MAX_PARTES),
    personaIds: z
      .array(z.string().min(1))
      .min(1)
      .max(MAX_PARTES - 1),
    origenId: z.string().min(1),
    categoria: z.string().min(1),
    fecha: z.string().refine(esFecha, 'fecha inválida').optional(),
    descripcion: z.string().trim().min(1).max(200).optional(),
  })
  .refine((e) => e.personaIds.length === e.partes - 1, { message: 'una persona por parte ajena' })
  .refine((e) => e.total >= e.partes, { message: 'cada parte debe ser mayor que cero' });
export type EntradaCuentaDividida = z.infer<typeof EntradaCuentaDividida>;

/** Vista previa del reparto (E12.1) para la confirmación: "Tu parte $300 · Te deben $900". */
export interface RepartoVista {
  readonly parteUsuario: Centavos;
  /** Parte de cada persona, en el orden de `personaIds`. */
  readonly partesOtros: readonly Centavos[];
  readonly porCobrarTotal: Centavos;
}

/** `dividirCuenta` de `core`; `null` si el total o las partes todavía no alcanzan para repartir. */
export function repartoCuentaDividida(total: Centavos | null, partes: number): RepartoVista | null {
  if (total === null || !Number.isSafeInteger(partes) || partes < 2 || partes > MAX_PARTES) return null;
  if (!Number.isSafeInteger(total) || total < partes) return null;
  return dividirCuenta(total, partes);
}

export interface CuentaDivididaRegistrada extends MovimientoRegistrado {
  readonly reparto: RepartoVista;
}

/**
 * Registra la cuenta dividida con `Libro.registrar` en una transacción SQLite: tu parte a gasto y cada parte
 * ajena a `contraparte:<persona>` (no es ingreso). Las partes salen de `dividirCuenta` (tu parte absorbe el
 * centavo sobrante, no lo que te deben).
 */
export function registrarCuentaDividida(
  ctx: Contexto,
  entrada: EntradaCuentaDividida,
  opciones: { origen?: OrigenRegistro; claveIdempotencia?: string } = {},
): CuentaDivididaRegistrada {
  exigirConsentimiento(ctx);
  const r = EntradaCuentaDividida.safeParse(entrada);
  if (!r.success) throw new ErrorDominio('movimiento_invalido', 'revisa los datos de la cuenta dividida');
  const e = r.data;
  for (const id of e.personaIds) {
    const c = cuentaPorId(ctx, id);
    if (c.naturaleza !== 'contraparte' || c.subtipo !== 'persona') {
      throw new ErrorDominio('persona_invalida', 'cada parte debe ser de una persona');
    }
  }
  const fecha = e.fecha ?? ctx.reloj.hoy();
  const reparto = dividirCuenta(e.total, e.partes);
  const propuesto = construirCuentaDividida({
    categoria: idCategoriaDe(ctx, e.categoria, 'gasto'),
    personas: e.personaIds,
    pago: e.origenId,
    total: e.total,
  });
  return enTransaccion(ctx, () => {
    const { transaccion: tx, nueva } = ctx.libro.registrar({
      tipo: propuesto.tipo,
      fecha,
      origen: opciones.origen ?? 'manual',
      claveIdempotencia: opciones.claveIdempotencia ?? `mov:${ctx.generarId()}`,
      asientos: propuesto.asientos,
      descripcion: e.descripcion ?? null,
      comercio: null,
      porRevisar: false,
    });
    const despues = nueva ? trasRegistrar(ctx, tx.id) : { cobertura: null, preguntaLiquidar: null };
    const avisoDeducible = esSaludEnEfectivo(ctx, {
      tipo: 'gasto',
      monto: e.total,
      categoria: e.categoria,
      origenId: e.origenId,
    });
    return { transaccionId: tx.id, deshacer: tx.id, fecha, reparto, ...despues, avisoDeducible };
  });
}

/** ¿El origen es la cuenta puente "por asignar"? (la confirmación lo dice). */
export function esPorAsignar(cuentaId: string): boolean {
  return cuentaId === CUENTAS_SISTEMA.porAsignar;
}

/**
 * Personas por nombre dicho (`division.participantes`): coincidencia exacta con el nombre o algún alias
 * normalizado del contacto. Un nombre que coincide con dos contactos o con ninguno no se resuelve (la persona
 * elige en la confirmación).
 */
export function resolverParticipantes(
  ctx: Contexto,
  nombres: readonly string[],
): { personaIds: string[]; sinResolver: string[] } {
  const aliasPorContacto = new Map<string, string[]>();
  for (const a of ctx.db.select().from(aliasContacto).all()) {
    aliasPorContacto.set(a.contactoId, [...(aliasPorContacto.get(a.contactoId) ?? []), a.aliasNormalizado]);
  }
  const porAlias = new Map<string, Set<string>>();
  for (const p of listarPersonas(ctx)) {
    const suyos = [p.nombre, ...(p.contactoId ? (aliasPorContacto.get(p.contactoId) ?? []) : [])];
    for (const a of normalizarAliases(suyos))
      porAlias.set(a, new Set([...(porAlias.get(a) ?? []), p.cuentaId]));
  }
  const personaIds: string[] = [];
  const sinResolver: string[] = [];
  for (const n of nombres) {
    const [clave] = normalizarAliases([n]);
    const ids = clave ? [...(porAlias.get(clave) ?? [])] : [];
    const [unico] = ids;
    if (ids.length === 1 && unico) personaIds.push(unico);
    else sinResolver.push(n);
  }
  return { personaIds, sinResolver };
}
