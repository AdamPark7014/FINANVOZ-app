import { describe, expect, it } from 'vitest';
import { aceptarConsentimiento } from '../privacidad/consentimiento';
import { listarMovimientos } from './movimientos';
import { agregarCuenta } from './onboarding';
import {
  contarEsperandoConexion,
  listarPorInterpretar,
  procesarPorInterpretar,
  registrarTexto,
  revisarPorInterpretar,
} from './registrar';
import { abrirPrueba } from './__pruebas__/base';
import { nubeFalsa } from './__pruebas__/nube';

const HOY = '2026-10-11';
const RECHAZADA = 'una frase que el proxy rechaza';
// Con cifra: sin ella el nivel 0 ya pregunta el monto sin la nube (reglas/sin-nube.ts).
const PAN = 'compré el pan de siempre en efectivo por 35';
// Una anulación que solo entiende la nube: «borra lo del cine» ya la aplica el nivel 0 en el teléfono (06 §15).
const BORRA_CINE = 'borra lo que puse del cine';

function conCuenta() {
  const p = abrirPrueba(HOY);
  aceptarConsentimiento(p.ctx, { datosFinancieros: true });
  const efectivo = agregarCuenta(p.ctx, { subtipo: 'efectivo', nombre: 'Cartera', saldo: 64_000 });
  const f = nubeFalsa({
    [RECHAZADA]: { tipo: 'error', codigo: 'peticion_invalida', status: 400 },
    [PAN]: {
      intencion: 'registrar',
      movimientos: [
        {
          tipo: 'gasto',
          monto: 3_500,
          fecha: HOY,
          descripcion: 'pan',
          categoria: 'super',
          origen: { tipo: 'efectivo' },
        },
      ],
    },
    [BORRA_CINE]: { intencion: 'anular', objetivo: { texto: 'cine' } },
  });
  return { ...p, efectivo, ...f };
}

async function guardarSinRed(p: ReturnType<typeof conCuenta>, frases: readonly string[]) {
  p.desconectar();
  for (const f of frases) {
    expect(await registrarTexto(p.ctx, f, 'voz', { nube: p.nube })).toMatchObject({
      resultado: 'por_interpretar',
    });
  }
  p.reconectar();
}

describe('cola "por interpretar": rechazos definitivos y cambios sin la persona', () => {
  it('un 400 del proxy no detiene la cola: esa frase va a revisión y la siguiente se aplica', async () => {
    const p = conCuenta();
    await guardarSinRed(p, [RECHAZADA, PAN]);
    expect(await procesarPorInterpretar(p.ctx, p.nube)).toEqual({
      aplicadas: 1,
      porRevisar: 1,
      pendientes: 0,
    });
    expect(p.recibidas.map((r) => r.texto)).toEqual([RECHAZADA, PAN]);
    expect(p.ctx.libro.saldo(p.efectivo)).toBe(64_000 - 3_500);
    expect(listarPorInterpretar(p.ctx)).toEqual([
      expect.objectContaining({ texto: RECHAZADA, estado: 'revisar' }),
    ]);
    expect(contarEsperandoConexion(p.ctx)).toBe(0);
  });

  it('un 5xx, un 429 o un 401 sí pausan la cola sin saltarse el orden', async () => {
    for (const falla of [
      { tipo: 'error', codigo: 'proveedor', status: 502 },
      { tipo: 'limite', codigo: 'limite_diario' },
      { tipo: 'error', codigo: 'no_autorizado', status: 401 },
    ] as const) {
      const p = conCuenta();
      await guardarSinRed(p, [PAN]);
      p.fallar(falla);
      expect(await procesarPorInterpretar(p.ctx, p.nube)).toEqual({
        aplicadas: 0,
        porRevisar: 0,
        pendientes: 1,
      });
      expect(contarEsperandoConexion(p.ctx)).toBe(1);
    }
  });

  it('en el registro directo, un 400 es "no te entendí" y no se guarda para siempre', async () => {
    const p = conCuenta();
    expect(await registrarTexto(p.ctx, RECHAZADA, 'voz', { nube: p.nube })).toEqual({
      resultado: 'no_entendi',
    });
    expect(listarPorInterpretar(p.ctx)).toEqual([]);
  });

  it('un texto de más de 500 caracteres no viaja a la nube', async () => {
    const p = conCuenta();
    const largo = 'bla '.repeat(150);
    expect(largo.length).toBe(600);
    expect(await registrarTexto(p.ctx, largo, 'voz', { nube: p.nube })).toEqual({
      resultado: 'no_entendi',
      motivo: 'texto_largo',
    });
    // Sin nube tampoco se guarda: nunca podría interpretarse.
    expect(await registrarTexto(p.ctx, largo, 'voz')).toEqual({
      resultado: 'no_entendi',
      motivo: 'texto_largo',
    });
    expect(p.recibidas).toEqual([]);
    expect(listarPorInterpretar(p.ctx)).toEqual([]);
  });

  it('anular desde la cola no anula: queda para que la persona lo revise', async () => {
    const p = conCuenta();
    expect(await registrarTexto(p.ctx, 'cine 150 en efectivo')).toMatchObject({ resultado: 'registrado' });
    await guardarSinRed(p, [BORRA_CINE]);
    expect(await procesarPorInterpretar(p.ctx, p.nube)).toEqual({
      aplicadas: 0,
      porRevisar: 1,
      pendientes: 0,
    });
    expect(p.ctx.libro.saldo(p.efectivo)).toBe(64_000 - 15_000);
    expect(listarMovimientos(p.ctx).flatMap((d) => d.movimientos)).toHaveLength(1);
    const [frase] = listarPorInterpretar(p.ctx);
    expect(frase).toMatchObject({ texto: BORRA_CINE, estado: 'revisar' });

    // Al revisarla, la persona ve la anulación con su Deshacer.
    expect(await revisarPorInterpretar(p.ctx, frase?.id as string, p.nube)).toMatchObject({
      resultado: 'anulado',
    });
    expect(p.ctx.libro.saldo(p.efectivo)).toBe(64_000);
  });
});
