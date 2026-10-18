import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { esquema } from '@cartera/datos';
import { idsAnulados, saldoGrupo, type EventoCompartido } from '@cartera/sincronizacion';
import { aceptarConsentimiento } from '../privacidad/consentimiento';
import { crearGrupoCompartido, internos } from './compartido';
import { enTransaccion, type Contexto } from './contexto';
import { abrirPrueba } from './__pruebas__/base';
import { depsTelefono, servidorCompartidoFalso } from './__pruebas__/compartido';

const { grupoCompartido, eventoCompartido } = esquema;

/** La versión anterior (pendiente 149), O(n) por consulta: el oráculo de "mismo resultado que antes". */
function anuladoLocalmenteAntes(ctx: Contexto, grupoId: string, id: string): boolean {
  return ctx.db
    .select()
    .from(eventoCompartido)
    .where(eq(eventoCompartido.grupoId, grupoId))
    .all()
    .some(
      (f) =>
        f.tipo === 'evento_anulado' && (JSON.parse(f.cuerpo) as { id_anulado?: unknown }).id_anulado === id,
    );
}

/**
 * 5 000 eventos en bloques de cinco: un gasto que se anula, otro vigente, un pago, la anulación (a veces antes
 * que su gasto en el lote) y un gasto propio recuperado del servidor.
 */
function lote(grupoId: string, n: number): EventoCompartido[] {
  const eventos: EventoCompartido[] = [];
  let reloj = 1_792_000_000_000;
  const comunes = (autor: 'a' | 'b') => ({ id: randomUUID(), grupo_id: grupoId, autor, creado_en: ++reloj });
  const gasto = (autor: 'a' | 'b', total: number): EventoCompartido => ({
    ...comunes(autor),
    tipo: 'gasto_compartido_creado',
    cuerpo: {
      fecha: '2026-10-10',
      total,
      pago: autor,
      proporcion_a_bp: 5000,
      descripcion: '',
      categoria: 'super',
    },
  });
  for (let i = 0; eventos.length < n; i++) {
    const anulado = gasto('b', 10_000 + i);
    const anulacion: EventoCompartido = {
      ...comunes('b'),
      tipo: 'evento_anulado',
      cuerpo: { id_anulado: anulado.id },
    };
    const bloque: EventoCompartido[] = [
      anulado,
      gasto('b', 20_000 + i),
      {
        ...comunes('b'),
        tipo: 'pago_compartido_creado',
        cuerpo: { fecha: '2026-10-10', de: 'b', monto: 300 + i },
      },
      gasto('a', 5_000 + i),
    ];
    bloque.splice(i % 2 === 0 ? 4 : 0, 0, anulacion);
    eventos.push(...bloque);
  }
  return eventos.slice(0, n);
}

describe('gastos compartidos con 5 000 eventos (pendiente 149)', () => {
  it('incorporar arma los anulados una vez: mismo libro que antes y la revisión de anulados < 300 ms', async () => {
    const p = abrirPrueba('2026-10-11');
    aceptarConsentimiento(p.ctx, { datosFinancieros: true });
    const servidor = servidorCompartidoFalso();
    const creado = await crearGrupoCompartido(p.ctx, depsTelefono(p, servidor.cliente('usuario-a')), 'Beto');
    if (!creado.ok) throw new Error(creado.error);
    const g = p.ctx.db.select().from(grupoCompartido).where(eq(grupoCompartido.id, creado.grupoId)).get();
    if (!g) throw new Error('sin grupo');

    const eventos = lote(g.id, 5000);
    expect(eventos).toHaveLength(5000);
    enTransaccion(p.ctx, () =>
      internos.incorporar(
        p.ctx,
        g,
        eventos.map((evento) => ({ evento, recibidoEn: '2026-10-12T00:00:00.000001Z' })),
      ),
    );

    // Lo que antes era cuadrático: decidir para cada uno de los 5 000 eventos si está anulado. El tiempo del
    // libro (un asiento por evento vigente) es lineal y no entra en la medición.
    const inicio = performance.now();
    const conjunto = internos.idsAnuladosLocales(p.ctx, g.id);
    const anuladosAhora = eventos.filter((e) => conjunto.has(e.id)).length;
    const ms = performance.now() - inicio;
    // La versión anterior releía el grupo completo por evento: con 20 muestras se estima el total.
    const muestra = eventos.slice(0, 20);
    const inicioAntes = performance.now();
    for (const e of muestra) anuladoLocalmenteAntes(p.ctx, g.id, e.id);
    const msAntesEstimado = ((performance.now() - inicioAntes) / muestra.length) * eventos.length;

    // Mismo resultado: los anulados son los de E17 y coinciden con la consulta anterior (muestra).
    const esperados = idsAnulados(eventos);
    const nuevos = internos.idsAnuladosLocales(p.ctx, g.id);
    expect(nuevos).toEqual(esperados);
    for (const e of eventos.filter((_, i) => i % 97 === 0)) {
      expect(nuevos.has(e.id)).toBe(anuladoLocalmenteAntes(p.ctx, g.id, e.id));
    }
    // Lo anulado no llega al libro; lo demás sí, una vez, y la contraparte lleva el saldo de E12.2.
    const filas = p.ctx.db.select().from(eventoCompartido).where(eq(eventoCompartido.grupoId, g.id)).all();
    expect(filas).toHaveLength(5000);
    for (const f of filas) {
      const llevaAlLibro = f.tipo !== 'evento_anulado' && !esperados.has(f.id);
      expect(f.transaccionId !== null).toBe(llevaAlLibro);
    }
    expect(p.ctx.libro.saldo(g.contraparteId)).toBe(saldoGrupo(eventos).saldo);
    expect(p.ctx.libro.comprobarIntegridad()).toEqual([]);

    expect(anuladosAhora).toBe(esperados.size);
    expect(ms).toBeLessThan(300);
    expect(msAntesEstimado).toBeGreaterThan(300);
    p.base.cerrar();
  }, 60_000);
});
