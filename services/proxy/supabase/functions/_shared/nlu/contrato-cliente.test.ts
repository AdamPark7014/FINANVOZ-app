import { describe, expect, it } from 'vitest';
import { ANTERIOR_MAXIMO_NUBE, anteriorParaNube, contextoMinimo, VERSION_ESQUEMA } from '@cartera/nlu';
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

  it('el turno anterior (06 §15) viaja con lo dicho y lo entendido; nada más ni más largo', () => {
    const base = contextoMinimo({ hoy: '2026-10-11', cuentas: [] });
    const pedir = (anterior: unknown) =>
      validarSolicitud(
        JSON.parse(
          JSON.stringify({
            texto: '¿y la semana pasada?',
            contexto_min: { ...base, anterior },
            version_esquema: VERSION_ESQUEMA,
          }),
        ),
      );
    const anterior = anteriorParaNube({
      frase: '¿cuánto gasté en comida esta semana?',
      interpretacion: {
        intencion: 'consultar',
        consulta: {
          tipo: 'gasto_por_categoria',
          categoria: 'comida',
          desde: '2026-10-05',
          hasta: '2026-10-11',
        },
      },
    });
    expect(anterior).toBeDefined();
    expect(pedir(anterior)?.contexto_min.anterior).toEqual(anterior);
    // Claves de más (una respuesta con cifras), una intención desconocida o algo enorme: 400.
    expect(pedir({ ...anterior, respuesta: 'Esta semana llevas $1,240' })).toBeNull();
    expect(pedir({ frase: 'hola', interpretacion: { intencion: 'saldo_secreto' } })).toBeNull();
    expect(pedir({ frase: '', interpretacion: { intencion: 'consultar' } })).toBeNull();
    const enorme = {
      frase: 'tacos 80',
      interpretacion: {
        intencion: 'registrar',
        movimientos: Array.from({ length: 10 }, () => ({ descripcion: 'x'.repeat(400) })),
      },
    };
    expect(pedir(enorme)).toBeNull();
    // La app no lo manda si no cabe: la frase va sola.
    expect(anteriorParaNube(enorme as never)).toBeUndefined();
    expect(JSON.stringify(anterior).length).toBeLessThanOrEqual(ANTERIOR_MAXIMO_NUBE);
  });
});
