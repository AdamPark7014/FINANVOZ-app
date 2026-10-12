import { describe, expect, it } from 'vitest';
import { clasificarErrorMotor, ESTADO_INICIAL, reducirDictado, type AccionDictado } from './estado';

const correr = (...acciones: AccionDictado[]) => acciones.reduce(reducirDictado, ESTADO_INICIAL);

describe('reducirDictado', () => {
  it('escuchar → parciales → detener → final', () => {
    expect(correr({ tipo: 'escuchar' }, { tipo: 'parcial', texto: 'coca' })).toMatchObject({
      estado: 'escuchando',
      parcial: 'coca',
    });
    expect(
      correr({ tipo: 'escuchar' }, { tipo: 'parcial', texto: 'coca 25' }, { tipo: 'detener' }).estado,
    ).toBe('procesando');
    expect(
      correr({ tipo: 'escuchar' }, { tipo: 'detener' }, { tipo: 'final', texto: ' coca 25 en efectivo ' }),
    ).toEqual({ estado: 'inactivo', parcial: '', transcripcion: 'coca 25 en efectivo', error: null });
  });

  it('fin sin resultado final usa el último parcial', () => {
    expect(
      correr({ tipo: 'escuchar' }, { tipo: 'parcial', texto: 'tacos 80' }, { tipo: 'fin' }).transcripcion,
    ).toBe('tacos 80');
  });

  it('fin sin nada dictado es "sin voz"', () => {
    expect(correr({ tipo: 'escuchar' }, { tipo: 'fin' })).toMatchObject({
      estado: 'error',
      error: 'sin_voz',
    });
  });

  it('ignora eventos tardíos cuando no está escuchando', () => {
    const s = correr({ tipo: 'parcial', texto: 'x' }, { tipo: 'final', texto: 'x' }, { tipo: 'fin' });
    expect(s).toEqual(ESTADO_INICIAL);
  });

  it('cancelar descarta lo dictado', () => {
    expect(correr({ tipo: 'escuchar' }, { tipo: 'parcial', texto: 'coca' }, { tipo: 'cancelar' })).toEqual(
      ESTADO_INICIAL,
    );
  });

  it('sin permiso y errores', () => {
    expect(correr({ tipo: 'sin_permiso' }).estado).toBe('sin_permiso');
    expect(correr({ tipo: 'escuchar' }, { tipo: 'error', error: 'red' })).toMatchObject({
      estado: 'error',
      error: 'red',
    });
    expect(correr({ tipo: 'error', error: 'red' }, { tipo: 'escuchar' }).error).toBeNull();
  });
});

describe('clasificarErrorMotor', () => {
  it.each([
    ['aborted', null],
    ['not-allowed', 'sin_permiso'],
    ['no-speech', 'sin_voz'],
    ['speech-timeout', 'sin_voz'],
    ['network', 'red'],
    ['busy', 'ocupado'],
    ['audio-capture', 'audio'],
    ['language-not-supported', 'no_disponible'],
    ['client', 'desconocido'],
  ] as const)('%s → %s', (codigo, esperado) => {
    expect(clasificarErrorMotor(codigo)).toBe(esperado);
  });
});
