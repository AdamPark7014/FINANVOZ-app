import { describe, expect, it } from 'vitest';
import { fijarBloqueo } from './ajustes';
import { cargarEscenario } from './semilla';
import { fijarVozRespuesta, obtenerVozRespuesta } from './voz-respuesta';
import { abrirPrueba, escenario } from './__pruebas__/base';

describe('Contestarte en voz (ajuste)', () => {
  it('encendido por omisión; apagado por omisión con bloqueo biométrico; la elección gana', () => {
    const p = abrirPrueba();
    cargarEscenario(p.ctx, escenario('e4-01'));
    expect(obtenerVozRespuesta(p.ctx)).toEqual({ activa: true });
    fijarBloqueo(p.ctx, { activo: true });
    expect(obtenerVozRespuesta(p.ctx)).toEqual({ activa: false });
    fijarVozRespuesta(p.ctx, true);
    expect(obtenerVozRespuesta(p.ctx)).toEqual({ activa: true });
    fijarVozRespuesta(p.ctx, false);
    expect(obtenerVozRespuesta(p.ctx)).toEqual({ activa: false });
  });
});
