import { describe, expect, it } from 'vitest';
import { esCodigo } from '../observabilidad/depuracion';
import { MENSAJE_TECNICO_ENVIO_HTTP, codigoEnvioHttpAnalitica, errorEnvioHttpAnalitica } from './mensajes';

const SENSIBLES = ['$1,234.56', 'OXXO', 'María López', 'BBVA: Compra por $1,099.90', '109990', '5512345678'];

describe('mensajes técnicos de analítica (regla 9)', () => {
  it('el mensaje de envío HTTP es fijo y sin datos de la persona', () => {
    for (const s of SENSIBLES) {
      expect(MENSAJE_TECNICO_ENVIO_HTTP.toLowerCase()).not.toContain(s.toLowerCase());
    }
    expect(MENSAJE_TECNICO_ENVIO_HTTP).not.toMatch(/\$|\d{3,}/);
    expect(MENSAJE_TECNICO_ENVIO_HTTP.length).toBeLessThanOrEqual(200);
  });

  it('el código HTTP es estable y válido para Sentry', () => {
    expect(codigoEnvioHttpAnalitica(500)).toBe('analitica_http_500');
    expect(codigoEnvioHttpAnalitica(429)).toBe('analitica_http_429');
    expect(esCodigo(codigoEnvioHttpAnalitica(503))).toBe(true);
    expect(esCodigo(codigoEnvioHttpAnalitica(0))).toBe(true);
  });

  it('errorEnvioHttpAnalitica no incluye el cuerpo de la respuesta', () => {
    const err = errorEnvioHttpAnalitica(500);
    expect(err.codigo).toBe('analitica_http_500');
    expect(err.message).toBe(MENSAJE_TECNICO_ENVIO_HTTP);
    expect(err.message).not.toMatch(/nope|cuerpo|500/);
  });
});
