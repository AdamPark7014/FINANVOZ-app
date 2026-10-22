// CA-M7-02 · el proxy rechaza con 429 `limite_mensual` al agotar las 30 interpretaciones del mes (Gratis): la
// frase se guarda "por interpretar" con el límite que se agotó, y el nivel de reglas sigue registrando sin red.
import { describe, expect, it } from 'vitest';
import { aceptarConsentimiento } from '../privacidad/consentimiento';
import { listarMovimientos } from './movimientos';
import { agregarCuenta } from './onboarding';
import { contarEsperandoConexion, procesarPorInterpretar, registrarTexto } from './registrar';
import { abrirPrueba } from './__pruebas__/base';
import { nubeFalsa } from './__pruebas__/nube';

// Sin verbo y con «chelas» (fuera del diccionario): el nivel 0 la deja a la nube (06 §9.3).
const COMPLEJA = 'unas chelas de 80 y una coca de 25 en efectivo';

function preparar() {
  const p = abrirPrueba();
  aceptarConsentimiento(p.ctx, { datosFinancieros: true });
  agregarCuenta(p.ctx, { subtipo: 'efectivo', nombre: 'Cartera', saldo: 64_000 });
  return { ...p, ...nubeFalsa() };
}

describe('CA-M7-02 · límite mensual del intérprete en la nube', () => {
  it('la frase queda por interpretar con el límite agotado (mensual o diario)', async () => {
    const p = preparar();
    p.fallar({ tipo: 'limite', codigo: 'limite_mensual' });
    expect(await registrarTexto(p.ctx, COMPLEJA, 'voz', { nube: p.nube })).toMatchObject({
      resultado: 'por_interpretar',
      motivo: 'limite',
      limite: 'limite_mensual',
    });
    p.fallar({ tipo: 'limite', codigo: 'limite_diario' });
    expect(await registrarTexto(p.ctx, COMPLEJA, 'voz', { nube: p.nube })).toMatchObject({
      limite: 'limite_diario',
    });
    p.fallar({ tipo: 'sin_red' });
    const sinRed = await registrarTexto(p.ctx, COMPLEJA, 'voz', { nube: p.nube });
    expect(sinRed).not.toHaveProperty('limite');
    expect(contarEsperandoConexion(p.ctx)).toBe(3);
  });

  it('el nivel de reglas sigue registrando sin llamar al proxy', async () => {
    const p = preparar();
    p.fallar({ tipo: 'limite', codigo: 'limite_mensual' });
    expect(await registrarTexto(p.ctx, 'tacos 80 en efectivo', 'voz', { nube: p.nube })).toMatchObject({
      resultado: 'registrado',
    });
    expect(p.recibidas).toEqual([]);
    expect(listarMovimientos(p.ctx).flatMap((d) => d.movimientos)).toHaveLength(1);
  });

  it('la cola no pierde frases mientras dura el límite y las interpreta cuando vuelve el cupo', async () => {
    const p = preparar();
    p.responder(COMPLEJA, {
      intencion: 'registrar',
      movimientos: [
        {
          tipo: 'gasto',
          monto: 8000,
          fecha: '2026-10-11',
          descripcion: 'tacos',
          categoria: 'comida_fuera',
          origen: { tipo: 'efectivo' },
        },
      ],
    });
    p.fallar({ tipo: 'limite', codigo: 'limite_mensual' });
    await registrarTexto(p.ctx, COMPLEJA, 'voz', { nube: p.nube });
    expect(await procesarPorInterpretar(p.ctx, p.nube)).toMatchObject({ aplicadas: 0, pendientes: 1 });
    p.fallar(null); // empieza el mes siguiente
    expect(await procesarPorInterpretar(p.ctx, p.nube)).toMatchObject({ aplicadas: 1, pendientes: 0 });
  });
});
