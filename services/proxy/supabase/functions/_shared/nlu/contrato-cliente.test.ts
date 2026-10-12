import { describe, expect, it } from 'vitest';
import { contextoMinimo, VERSION_ESQUEMA } from '@cartera/nlu';
import { validarSolicitud } from './contrato';

// El cliente de la app (`packages/nlu/src/cliente`) y el proxy comparten el contrato de `03 §6`: lo que arma
// la app debe pasar la validación estricta del proxy (que rechaza claves desconocidas).
describe('contrato cliente ↔ proxy', () => {
  it('la solicitud que arma la app es válida para el proxy', () => {
    const contexto_min = contextoMinimo({
      hoy: '2026-10-11',
      espacios: ['personal'],
      cuentas: [
        { tipo: 'efectivo', alias: ['efectivo', 'cartera'], nombre: 'Cartera', espacio: 'personal' },
        { tipo: 'debito', alias: ['bbva'], nombre: 'BBVA Débito ••5521', espacio: 'personal' },
        { tipo: 'credito', alias: ['nu', 'morada'], nombre: 'Nu ••4410', espacio: 'personal' },
      ],
      contactos: [['jefa', 'mama']],
      ultimoIngreso: '2026-09-30',
      proximoIngreso: '2026-10-15',
    });
    const solicitud = {
      texto: 'me eché unos tacos de 80 con la nu',
      contexto_min,
      version_esquema: VERSION_ESQUEMA,
    };
    expect(validarSolicitud(JSON.parse(JSON.stringify(solicitud)))).not.toBeNull();
  });
});
