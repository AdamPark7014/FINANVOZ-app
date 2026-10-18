// Presupuesto total de `/llm/turno` (P1): el alterno solo se intenta si cabe en lo que queda del presupuesto.
import { describe, expect, it } from 'vitest';
import {
  FallaProveedor,
  type NombreProveedor,
  PRESUPUESTO_TOTAL_MS,
  TIEMPO_MINIMO_INTENTO_MS,
} from '../nlu/proveedores.ts';
import type { SolicitudTurno } from './contrato.ts';
import type { AdaptadorTurno } from './proveedores.ts';
import { turno } from './turno.ts';

const SOLICITUD: SolicitudTurno = {
  mensajes: [{ rol: 'usuario', texto: '¿por qué no me alcanzó?' }],
  herramientas: [{ nombre: 'gasto', descripcion: 'Gasto en un periodo.', parametros: { type: 'object' } }],
};

// Cada paso avanza el reloj inyectado `ms` (lo que "tardó" el proveedor) y responde o falla.
type Paso = { ms: number; falla?: FallaProveedor };

function armar(principal: Paso[], alterno: Paso[]) {
  const reloj = { t: 0 };
  const llamadas: NombreProveedor[] = [];
  const adaptador = (nombre: NombreProveedor, pasos: Paso[]): AdaptadorTurno => ({
    nombre,
    modelo: `${nombre}-x`,
    async llamar() {
      llamadas.push(nombre);
      const paso = pasos.shift();
      if (!paso) throw new Error('sin paso preparado');
      reloj.t += paso.ms;
      if (paso.falla) throw paso.falla;
      return { salida: { tipo: 'respuesta', texto: 'ok' }, tokens_entrada: 10, tokens_salida: 5 };
    },
  });
  const opciones = {
    adaptadores: [adaptador('anthropic', principal), adaptador('openai', alterno)],
    ahora: () => reloj.t,
  };
  return { opciones, llamadas };
}

describe('turno · presupuesto total de la petición', () => {
  it('principal lento que agota el presupuesto → no se llama al alterno; tiempo_agotado', async () => {
    const { opciones, llamadas } = armar(
      [{ ms: PRESUPUESTO_TOTAL_MS - TIEMPO_MINIMO_INTENTO_MS + 1, falla: new FallaProveedor('tiempo') }],
      [{ ms: 100 }],
    );
    expect(await turno(SOLICITUD, opciones)).toMatchObject({
      ok: false,
      codigo: 'tiempo_agotado',
      proveedor: 'anthropic',
      llamadas: 1,
    });
    expect(llamadas).toEqual(['anthropic']);
  });

  it('5xx rápido del principal → el alterno sí se llama porque queda tiempo', async () => {
    const { opciones, llamadas } = armar(
      [{ ms: 300, falla: new FallaProveedor('servidor', 503) }],
      [{ ms: 900 }],
    );
    expect(await turno(SOLICITUD, opciones)).toMatchObject({
      ok: true,
      proveedor: 'openai',
      salida: { tipo: 'respuesta', texto: 'ok' },
      latencia_ms: 1200,
      llamadas: 2,
    });
    expect(llamadas).toEqual(['anthropic', 'openai']);
  });
});
