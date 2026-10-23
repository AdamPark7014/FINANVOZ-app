// Reproducción de grabaciones (`pnpm eval:nlu --offline`, CA-M3-06) con una grabación sintética de prueba.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { cargarGolden } from './fixtures';
import { escribirGrabaciones, listarGrabaciones, precioDe } from './grabaciones';
import { evaluarNube, formatearReporte, percentil } from './nube';

const SINTETICO = fileURLToPath(new URL('./__pruebas__/grabaciones', import.meta.url));
const golden = cargarGolden();
const casos = golden.filter((c) => ['G01', 'G02', 'G03', 'G04', 'G05'].includes(c.id));

describe('reproducción offline de grabaciones (CA-M3-06)', () => {
  const [archivo] = listarGrabaciones(SINTETICO);

  it('lee <proveedor>/<modelo>.jsonl', () => {
    expect(archivo?.grabaciones.map((g) => g.id)).toEqual(['G01', 'G02', 'G03', 'G04']);
  });

  it('calcula aciertos por campo, latencia, tokens y costo por caso completo correcto', () => {
    const r = evaluarNube(casos, archivo?.grabaciones ?? [], { entrada: 1, salida: 2 });
    expect(r.proveedor).toBe('sintetico');
    expect(r.modelo).toBe('modelo-falso');
    expect(r.faltantes).toEqual(['G05']);
    expect(r.resultados.map((c) => [c.id, c.fallas])).toEqual([
      ['G01', []],
      ['G02', ['movimientos[0].monto']],
      ['G03', ['sin_respuesta']],
      ['G04', ['movimientos[0].categoria']],
      ['G05', ['sin_respuesta']],
    ]);
    expect(r.campos).toEqual({
      intencion: { aciertos: 3, total: 5 },
      monto: { aciertos: 2, total: 5 },
      fecha: { aciertos: 3, total: 5 },
      cuentas: { aciertos: 3, total: 5 },
      categoria: { aciertos: 2, total: 5 },
      completo: { aciertos: 1, total: 5 },
    });
    expect(r.latencia).toEqual({ p50: 1200, p95: 8000 });
    expect(r.tokens).toEqual({
      entrada_promedio: 1000,
      salida_promedio: 50,
      cache_leida_promedio: 0,
      cache_escrita_promedio: 0,
    });
    expect(r.costo_total).toBeCloseTo(0.0044, 10);
    expect(r.costo_por_correcto).toBeCloseTo(0.0044, 10);
    expect(r.cumple).toBe(false);
    expect(r.incumplidos).toEqual(expect.arrayContaining(['monto', 'completo', 'latencia_p95', 'faltantes']));
  });

  it('el reporte no imprime montos ni texto dictado', () => {
    const texto = formatearReporte(evaluarNube(casos, archivo?.grabaciones ?? [], undefined));
    expect(texto).toContain('sin precio confirmado');
    expect(texto).toContain('incorrecto: G02 (movimientos[0].monto)');
    for (const prohibido of ['2500', '2600', 'coca', 'tacos', 'nu"']) expect(texto).not.toContain(prohibido);
  });

  it('un caso con salida que Zod rechaza cuenta como falla de esquema', () => {
    const [g] = archivo?.grabaciones ?? [];
    if (!g) throw new Error('falta la grabación');
    const r = evaluarNube(
      casos.slice(0, 1),
      [{ ...g, interpretacion: { intencion: 'registrar', movimientos: [] } }],
      undefined,
    );
    expect(r.resultados[0]?.fallas).toEqual(['esquema']);
  });

  it('todas las grabaciones perfectas cumplen los umbrales', () => {
    const perfectas = golden.map((c) => ({
      id: c.id,
      proveedor: 'p',
      modelo: 'm',
      codigo: 'ok',
      interpretacion: c.esperado,
      tokens_entrada: 10,
      tokens_salida: 1,
      latencia_ms: 100,
    }));
    const r = evaluarNube(golden, perfectas, undefined);
    expect(r.cumple).toBe(true);
    expect(r.campos.completo).toEqual({ aciertos: 164, total: 164 });
  });
});

describe('escribirGrabaciones', () => {
  let dir: string | undefined;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('escribe <proveedor>/<modelo>.jsonl ordenado por id y se vuelve a leer igual', () => {
    dir = mkdtempSync(join(tmpdir(), 'grabaciones-'));
    const [archivo] = listarGrabaciones(SINTETICO);
    const originales = archivo?.grabaciones ?? [];
    const ruta = escribirGrabaciones([...originales].reverse(), dir);
    expect(ruta).toBe(join(dir, 'sintetico', 'modelo-falso.jsonl'));
    expect(readFileSync(ruta, 'utf8')).toBe(readFileSync(archivo?.ruta ?? '', 'utf8'));
  });

  it('sin directorio no hay grabaciones', () => {
    expect(listarGrabaciones(join(tmpdir(), 'no-existe-cartera'))).toEqual([]);
  });
});

describe('precios y percentiles', () => {
  it('lee la tabla de config/nlu/precios.json', () => {
    expect(precioDe('anthropic', 'claude-haiku-5-5')).toEqual({ entrada: 0.1, salida: 0.5 });
    expect(precioDe('anthropic', 'otro')).toBeUndefined();
  });

  it('percentil por rango más cercano', () => {
    expect(percentil([], 95)).toBe(0);
    expect(percentil([5, 1, 3], 50)).toBe(3);
    expect(
      percentil(
        Array.from({ length: 100 }, (_, i) => i + 1),
        95,
      ),
    ).toBe(95);
  });
});

describe('costo con caché (lectura 0.1×, escritura de 1 h 2×)', () => {
  it('cobra la entrada leída y escrita en caché con su factor, no a precio lleno', () => {
    const caso = casos.find((c) => c.id === 'G01');
    if (!caso) throw new Error('falta G01');
    const g = {
      id: 'G01',
      proveedor: 'anthropic',
      modelo: 'claude-haiku-5-5',
      codigo: 'ok',
      interpretacion: caso.esperado,
      tokens_entrada: 10_000,
      tokens_cache_leidos: 8_000,
      tokens_cache_escritos: 1_000,
      tokens_salida: 100,
      latencia_ms: 900,
    };
    const r = evaluarNube([caso], [g], { entrada: 0.1, salida: 0.5 });
    // 1,000 sin caché × 0.1 + 8,000 × 0.01 + 1,000 × 0.2 + 100 × 0.5, por millón.
    expect(r.costo_total).toBeCloseTo((100 + 80 + 200 + 50) / 1_000_000, 12);
    expect(r.tokens).toMatchObject({ cache_leida_promedio: 8_000, cache_escrita_promedio: 1_000 });
    expect(formatearReporte(r)).toContain('caché leída 8000 · escrita 1000');
  });
});
