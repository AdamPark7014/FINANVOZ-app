import { describe, expect, it } from 'vitest';
import { huellaIp, ipCliente, validarSolicitud } from './lista-espera.ts';

const valida = {
  correo: ' Ana@Ejemplo.MX ',
  respuestas: { telefono: 'android', notificaciones: 'si', precio: '50_99', uso: 'contador' },
  consentimiento: true,
  version_aviso: '2026-10-12',
  sitio_web: '',
};

describe('validarSolicitud', () => {
  it('acepta una solicitud completa y normaliza el correo', () => {
    const r = validarSolicitud(valida);
    expect(r).toEqual({
      tipo: 'valida',
      solicitud: { correo: 'ana@ejemplo.mx', respuestas: valida.respuestas, versionAviso: '2026-10-12' },
    });
  });

  it('CA-M0-05 · sin consentimiento no guarda', () => {
    expect(validarSolicitud({ ...valida, consentimiento: false })).toEqual({
      tipo: 'invalida',
      codigo: 'sin_consentimiento',
    });
    expect(validarSolicitud({ ...valida, consentimiento: 'true' })).toMatchObject({
      codigo: 'sin_consentimiento',
    });
  });

  it.each(['ana', 'ana@ejemplo', '@ejemplo.mx', 'ana @ejemplo.mx', `${'a'.repeat(250)}@e.mx`])(
    'CA-M0-05 · rechaza el correo %j',
    (correo) => expect(validarSolicitud({ ...valida, correo })).toMatchObject({ codigo: 'correo_invalido' }),
  );

  it('rechaza respuestas fuera de catálogo, faltantes o con campos extra (como montos)', () => {
    const r = valida.respuestas;
    expect(validarSolicitud({ ...valida, respuestas: { ...r, uso: 'otro' } })).toMatchObject({
      codigo: 'respuestas_invalidas',
    });
    expect(validarSolicitud({ ...valida, respuestas: { telefono: 'android' } })).toMatchObject({
      codigo: 'respuestas_invalidas',
    });
    expect(validarSolicitud({ ...valida, respuestas: { ...r, ingreso: 2000000 } })).toMatchObject({
      codigo: 'respuestas_invalidas',
    });
  });

  it('trata el campo trampa lleno como bot', () => {
    expect(validarSolicitud({ ...valida, sitio_web: 'http://spam' })).toEqual({ tipo: 'bot' });
  });

  it('rechaza cuerpos que no son objeto', () => {
    expect(validarSolicitud(null)).toMatchObject({ codigo: 'formato' });
    expect(validarSolicitud([])).toMatchObject({ codigo: 'formato' });
  });
});

describe('IP', () => {
  it('toma la primera IP de x-forwarded-for', () => {
    expect(ipCliente(new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }))).toBe('203.0.113.7');
    expect(ipCliente(new Headers())).toBe('');
  });

  it('la huella depende de la sal y no contiene la IP', async () => {
    const a = await huellaIp('203.0.113.7', 'sal-1');
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toContain('203');
    expect(await huellaIp('203.0.113.7', 'sal-2')).not.toBe(a);
  });
});
