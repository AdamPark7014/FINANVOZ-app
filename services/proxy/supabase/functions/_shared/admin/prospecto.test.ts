import { describe, expect, it } from 'vitest';
import { huellaIp, ipCliente, responder, validarProspecto } from './prospecto.ts';

const valida = {
  nombre: ' Ana Pérez ',
  contacto: 'Contadora',
  telefono: '222 123 4567',
  correo: ' Ana@Ejemplo.MX ',
  interes: 'plus',
  mensaje: 'Quiero Plus para el equipo',
  sitio_web: '',
};

describe('validarProspecto', () => {
  it('acepta una solicitud completa y normaliza', () => {
    expect(validarProspecto(valida)).toEqual({
      tipo: 'valida',
      solicitud: {
        nombre: 'Ana Pérez',
        contacto: 'Contadora',
        telefono: '222 123 4567',
        correo: 'ana@ejemplo.mx',
        interes: 'plus',
        mensaje: 'Quiero Plus para el equipo',
      },
    });
  });

  it('trata el honeypot lleno como bot', () => {
    expect(validarProspecto({ ...valida, sitio_web: 'http://spam' })).toEqual({ tipo: 'bot' });
  });

  it('rechaza nombre vacío o demasiado largo', () => {
    expect(validarProspecto({ ...valida, nombre: '  ' })).toMatchObject({ codigo: 'nombre' });
    expect(validarProspecto({ ...valida, nombre: 'x'.repeat(201) })).toMatchObject({
      codigo: 'formato',
    });
  });

  it('rechaza correo mal formado (si viene)', () => {
    expect(validarProspecto({ ...valida, correo: 'ana' })).toMatchObject({ codigo: 'correo' });
  });

  it('acepta correo vacío', () => {
    const r = validarProspecto({ ...valida, correo: '' });
    expect(r).toMatchObject({ tipo: 'valida', solicitud: { correo: '' } });
  });

  it('rechaza interés fuera de catálogo', () => {
    expect(validarProspecto({ ...valida, interes: 'gratis' })).toMatchObject({ codigo: 'interes' });
  });

  it('rechaza cuerpos que no son objeto', () => {
    expect(validarProspecto(null)).toMatchObject({ codigo: 'formato' });
    expect(validarProspecto([])).toMatchObject({ codigo: 'formato' });
  });

  it('rechaza mensaje demasiado largo', () => {
    expect(validarProspecto({ ...valida, mensaje: 'm'.repeat(1001) })).toMatchObject({
      codigo: 'formato',
    });
  });
});

describe('IP y CORS', () => {
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

  it('OPTIONS responde 204 sin cuerpo con CORS de WEB_ORIGEN', async () => {
    const origen = 'https://finanvoz.com';
    const r = responder(204, null, origen);
    expect(r.status).toBe(204);
    expect(r.body).toBeNull();
    expect(r.headers.get('access-control-allow-origin')).toBe(origen);
    expect(r.headers.get('access-control-allow-methods')).toBe('POST, OPTIONS');
  });

  it('límite responde 429 con CORS', async () => {
    const r = responder(429, { codigo: 'limite' }, 'https://finanvoz.com');
    expect(r.status).toBe(429);
    expect(await r.json()).toEqual({ codigo: 'limite' });
  });
});
