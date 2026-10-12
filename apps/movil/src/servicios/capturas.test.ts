import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { CUENTAS_SISTEMA, esquema } from '@cartera/datos';
import { ingerirNotificaciones } from '../captura/ingesta';
import { calcularHuella } from '../captura/huella';
import type { ResultadoCaptura } from './capturas';
import type { Contexto } from './contexto';
import { liquidez } from './hoy';
import {
  listarCapturasPorRevisar,
  noReconocidasPorBanco,
  transaccionesDesdeCapturas,
} from './preguntas-captura';
import { cargarEscenario, type EscenarioCargado } from './semilla';
import { abrirPrueba, escenario } from './__pruebas__/base';
import {
  colaECaptura,
  cruda,
  ejemplos,
  INICIO_E_CAPTURA,
  MINUTO,
  opcionesPrueba,
  sha256Node,
} from './__pruebas__/captura';

const { transaccion, cuenta } = esquema;

interface EsperadoECaptura {
  por_notificacion: {
    id: string;
    captura: string;
    movimiento: Record<string, unknown> | null;
    por_revisar?: boolean;
    chip?: string;
  }[];
  saldos_finales: Record<string, number | string>;
  transacciones_vigentes_desde_capturas: number;
  por_revisar: string[];
  no_reconocidas_por_banco: Record<string, number>;
}

function preparar() {
  const p = abrirPrueba();
  const e = cargarEscenario(p.ctx, escenario('e-captura'));
  p.reloj.fijar(e.hoy);
  return { ...p, e, esperado: e.esperado as EsperadoECaptura };
}

/** El movimiento de una transacción en el vocabulario de `e-captura.json` (claves de cuentas y contactos). */
function describir(p: { ctx: Contexto; e: EscenarioCargado }, transaccionId: string) {
  const { ctx, e } = p;
  const clave = (id: string): string => {
    if (id === CUENTAS_SISTEMA.transito) return 'activo:transito';
    const deCuenta = Object.entries(e.cuentas).find(([, v]) => v === id)?.[0];
    const deContacto = Object.entries(e.contactos).find(([, v]) => v === id)?.[0];
    return deCuenta ?? deContacto ?? id;
  };
  const t = ctx.db.select().from(transaccion).where(eq(transaccion.id, transaccionId)).get();
  if (!t) throw new Error('sin transacción');
  const asientos = ctx.db
    .select({ cuentaId: esquema.asiento.cuentaId, monto: esquema.asiento.monto, c: cuenta })
    .from(esquema.asiento)
    .innerJoin(cuenta, eq(cuenta.id, esquema.asiento.cuentaId))
    .where(eq(esquema.asiento.transaccionId, transaccionId))
    .all();
  const meta = t.meta ? (JSON.parse(t.meta) as { sin_categoria?: boolean; revisar?: string[] }) : {};
  const sale = asientos.find((a) => a.monto < 0);
  const llega = asientos.find((a) => a.monto > 0);
  const cat = asientos.find((a) => a.c.naturaleza === 'gasto' || a.c.naturaleza === 'ingreso');
  const monto = asientos.reduce((s, a) => s + Math.max(0, a.monto), 0);
  const mov: Record<string, unknown> = { tipo: t.tipo, monto };
  switch (t.tipo) {
    case 'gasto':
      mov['cuenta'] = clave(sale?.cuentaId ?? '');
      mov['categoria'] = meta.sin_categoria ? null : (cat?.c.categoriaSlug ?? null);
      break;
    case 'ingreso':
      mov['cuenta'] = clave(llega?.cuentaId ?? '');
      mov['categoria'] = cat?.c.categoriaSlug ?? null;
      break;
    case 'cobro_prestamo':
      mov['cuenta'] = clave(llega?.cuentaId ?? '');
      mov['contraparte'] = clave(sale?.cuentaId ?? '');
      break;
    case 'reembolso':
      mov['cuenta'] = clave(llega?.cuentaId ?? '');
      mov['contra'] = `${cat?.c.naturaleza}:${cat?.c.categoriaSlug}`;
      break;
    default:
      mov['de'] = clave(sale?.cuentaId ?? '');
      mov['a'] = clave(llega?.cuentaId ?? '');
  }
  return {
    movimiento: mov,
    porRevisar: t.porRevisar === 1,
    chip: meta.revisar?.includes('fue_a_meses') ? '¿Fue a meses?' : undefined,
  };
}

function saldosFinales(p: { ctx: Contexto }, e: EscenarioCargado) {
  const { ctx } = p;
  const saldo = (id: string) => ctx.libro.saldo(id);
  const deuda = (id: string) => -ctx.libro.saldo(id) || 0;
  return {
    efectivo: saldo(e.cuentas['efectivo'] as string),
    banco_a: saldo(e.cuentas['banco_a'] as string),
    billetera_c: saldo(e.cuentas['billetera_c'] as string),
    banco_b: deuda(e.cuentas['banco_b'] as string),
    caro: saldo(e.contactos['caro'] as string),
    'activo:transito': saldo(CUENTAS_SISTEMA.transito),
    'pasivo:por_asignar': deuda(CUENTAS_SISTEMA.porAsignar),
    'activo:por_asignar_entradas': saldo(CUENTAS_SISTEMA.porAsignarEntradas),
  };
}

const idsDe = (
  p: { resultados: readonly ResultadoCaptura[] },
  capturas: readonly { capturaId: string }[],
) => {
  const porCaptura = new Map(p.resultados.map((r, i) => [r.capturaId, ejemplos()[i]?.id]));
  return capturas.map((c) => porCaptura.get(c.capturaId));
};

async function correr(orden?: (cola: ReturnType<typeof colaECaptura>) => ReturnType<typeof colaECaptura>) {
  const p = preparar();
  const cola = colaECaptura();
  const enOrden = orden ? orden(cola) : cola;
  const porNotificacion: (ResultadoCaptura & { descripcion: ReturnType<typeof describir> | null })[] = [];
  for (const n of enOrden) {
    const [r] = await ingerirNotificaciones(p.ctx, [n], opcionesPrueba);
    if (!r) throw new Error('sin resultado');
    porNotificacion.push({ ...r, descripcion: r.transaccionId ? describir(p, r.transaccionId) : null });
  }
  // En el orden de los ids del archivo.
  const resultados = cola.map((n) => porNotificacion[enOrden.indexOf(n)] as (typeof porNotificacion)[number]);
  return { ...p, cola, resultados };
}

describe('e-captura (CA-M5-01, CI)', () => {
  it('los 12 ejemplos producen exactamente los resultados por notificación, saldos y "Por revisar"', async () => {
    const p = await correr();
    const esperado = p.esperado;
    esperado.por_notificacion.forEach((x, i) => {
      const r = p.resultados[i];
      expect({ id: x.id, captura: r?.estado }).toEqual({ id: x.id, captura: x.captura });
      if (x.movimiento === null) {
        expect(r?.transaccionId ?? null).toBeNull();
        return;
      }
      expect({ id: x.id, ...r?.descripcion?.movimiento }).toEqual({ id: x.id, ...x.movimiento });
      expect({ id: x.id, porRevisar: r?.descripcion?.porRevisar }).toEqual({
        id: x.id,
        porRevisar: x.por_revisar,
      });
      if (x.chip) expect(r?.descripcion?.chip).toBe(x.chip);
    });
    const { convencion: _c, ...saldos } = esperado.saldos_finales;
    void _c;
    expect(saldosFinales(p, p.e)).toEqual(saldos);
    expect(transaccionesDesdeCapturas(p.ctx)).toHaveLength(esperado.transacciones_vigentes_desde_capturas);
    expect(idsDe(p, listarCapturasPorRevisar(p.ctx, opcionesPrueba.catalogo))).toEqual(esperado.por_revisar);
    expect(noReconocidasPorBanco(p.ctx)).toEqual(esperado.no_reconocidas_por_banco);
    expect(p.ctx.libro.comprobarIntegridad()).toEqual([]);
  });

  it('procesar otra vez la misma cola no crea capturas ni movimientos (huella)', async () => {
    const p = await correr();
    const contar = () => ({
      capturas: p.ctx.db.select().from(esquema.captura).all().length,
      transacciones: p.ctx.db.select().from(transaccion).all().length,
    });
    const antes = contar();
    const otra = await ingerirNotificaciones(p.ctx, p.cola, opcionesPrueba);
    expect(otra.every((r) => !r.nueva)).toBe(true);
    expect(contar()).toEqual(antes);
  });

  it('si N-08 llega antes que N-04 el resultado es idéntico; entre ambas el tránsito vale −420000 y resta de L', async () => {
    const normal = await correr();
    const p = preparar();
    const cola = colaECaptura();
    const n04 = cola[3];
    const n08 = cola[7];
    if (!n04 || !n08) throw new Error('faltan ejemplos');
    const primero = cola.filter((n) => n !== n04 && n !== n08);
    await ingerirNotificaciones(p.ctx, primero.slice(0, 3), opcionesPrueba);
    const l0 = liquidez(p.ctx);
    await ingerirNotificaciones(p.ctx, [n08], opcionesPrueba);
    expect(p.ctx.libro.saldo(CUENTAS_SISTEMA.transito)).toBe(-420_000);
    expect(liquidez(p.ctx)).toBe(l0 - 420_000);
    await ingerirNotificaciones(p.ctx, [n04], opcionesPrueba);
    expect(p.ctx.libro.saldo(CUENTAS_SISTEMA.transito)).toBe(0);
    expect(liquidez(p.ctx)).toBe(l0 - 420_000);
    await ingerirNotificaciones(p.ctx, primero.slice(3), opcionesPrueba);
    expect(saldosFinales(p, p.e)).toEqual(saldosFinales(normal, normal.e));
    expect(transaccionesDesdeCapturas(p.ctx)).toHaveLength(9);
    expect(p.ctx.libro.comprobarIntegridad()).toEqual([]);
  });
});

describe('huella (CA-M5-10)', () => {
  it('la misma notificación dos veces (reconexión) se registra una vez; con cuando distinto, dos veces', async () => {
    const p = preparar();
    const [n01] = ejemplos();
    if (!n01) throw new Error('falta N-01');
    const a = cruda(n01, INICIO_E_CAPTURA);
    const b = cruda(n01, INICIO_E_CAPTURA + MINUTO);
    const banco = p.e.cuentas['banco_a'] as string;
    const inicial = p.ctx.libro.saldo(banco);
    const r1 = await ingerirNotificaciones(p.ctx, [a, a], opcionesPrueba);
    expect(r1.map((r) => r.nueva)).toEqual([true, false]);
    expect(p.ctx.libro.saldo(banco)).toBe(inicial - 25_000);
    const r2 = await ingerirNotificaciones(p.ctx, [b], opcionesPrueba);
    expect(r2[0]?.nueva).toBe(true);
    expect(p.ctx.libro.saldo(banco)).toBe(inicial - 50_000);
  });

  it('es SHA-256 hex de paquete|clave|cuando|titulo|texto; sin when usa postTime', async () => {
    const [n01] = ejemplos();
    if (!n01) throw new Error('falta N-01');
    const n = { ...cruda(n01, 0), publicada_en: 1234 };
    const h = await calcularHuella(n, sha256Node);
    expect(h).toBe(await sha256Node(`${n.paquete}|${n.clave}|1234|${n.titulo}|${n.texto}`));
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});
