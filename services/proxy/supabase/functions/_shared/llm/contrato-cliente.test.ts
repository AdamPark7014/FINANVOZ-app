import { describe, expect, it } from 'vitest';
import { crearClienteTurno, HERRAMIENTAS_EXPLICAR, type MensajeTurno } from '@cartera/nlu';
import { fetchFalso, json, respuestaAnthropic } from '../nlu/__pruebas__/dobles.ts';
import { crearManejadorTurno } from './manejador.ts';
import { crearAnthropicTurno } from './proveedores.ts';
import { turno } from './turno.ts';

// El cliente de la app (`packages/nlu/src/cliente/turno.ts`) con las herramientas reales del teléfono contra el
// manejador del proxy: lo que arma la app pasa la validación estricta y la salida vuelve con la forma esperada.
describe('contrato cliente ↔ proxy de /llm/turno', () => {
  it('una pregunta con dos vueltas: herramientas y respuesta', async () => {
    const proveedor = fetchFalso([
      json({
        ...respuestaAnthropic(''),
        content: [
          { type: 'tool_use', id: 'toolu_1', name: 'comparar_periodos', input: { categoria: 'comida' } },
        ],
      }),
      json(respuestaAnthropic('Vas $350 arriba en comida.')),
    ]);
    const manejador = crearManejadorTurno({
      configurado: true,
      verificarUsuario: async () => 'u1',
      consumirCupo: async () => 'ok',
      devolverCupo: async () => undefined,
      turno: (s) =>
        turno(s, {
          adaptadores: [crearAnthropicTurno({ llave: 'k', fetch: proveedor.fetch })],
          ahora: () => 0,
        }),
      hashUsuario: async () => 'h',
      registrar: () => undefined,
    });
    const cliente = crearClienteTurno({
      url: 'https://p.prueba',
      obtenerToken: async () => 'jwt',
      transporte: (url, p) =>
        manejador(new Request(url, { method: p.method, headers: p.headers, body: p.body })),
    });

    const mensajes: MensajeTurno[] = [
      { rol: 'usuario', texto: '¿por qué no me alcanzó la quincena pasada?' },
    ];
    const primera = await cliente.turno(mensajes, HERRAMIENTAS_EXPLICAR);
    if (primera.tipo !== 'ok' || primera.salida.tipo !== 'herramientas') throw new Error(primera.tipo);
    const [llamada] = primera.salida.llamadas;
    if (!llamada) throw new Error('sin llamada');
    mensajes.push(
      { rol: 'asistente', llamadas: [llamada] },
      {
        rol: 'herramienta',
        id: llamada.id,
        nombre: llamada.nombre,
        resultado: '{"texto":"Vas $350 arriba en comida."}',
      },
    );
    const segunda = await cliente.turno(mensajes, HERRAMIENTAS_EXPLICAR);
    expect(segunda).toMatchObject({
      tipo: 'ok',
      salida: { tipo: 'respuesta', texto: 'Vas $350 arriba en comida.' },
    });
  });
});
