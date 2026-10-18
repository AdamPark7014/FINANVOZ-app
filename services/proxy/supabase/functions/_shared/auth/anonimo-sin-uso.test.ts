import { describe, expect, it } from 'vitest';
import {
  evaluarCandidatoAnonimo,
  plusNegocioVigente,
  umbralInactividad,
  type PerfilAnonimo,
} from './anonimo-sin-uso.ts';

const base = (extra: Partial<PerfilAnonimo> = {}): PerfilAnonimo => ({
  esAnonimo: true,
  correoConfirmado: false,
  tieneObjetosRespaldo: false,
  plan: null,
  vigenteHasta: null,
  enGrupoCompartidoActivo: false,
  ultimaActividad: '2026-01-01T00:00:00.000Z',
  ...extra,
});

describe('plusNegocioVigente', () => {
  const ahora = new Date('2026-06-15T12:00:00.000Z');

  it('gratis o sin fila no cuenta como Plus', () => {
    expect(plusNegocioVigente(null, null, ahora)).toBe(false);
    expect(plusNegocioVigente('gratis', null, ahora)).toBe(false);
  });

  it('Plus sin vencimiento sigue vigente', () => {
    expect(plusNegocioVigente('plus', null, ahora)).toBe(true);
  });

  it('Plus vencido no protege al usuario', () => {
    expect(plusNegocioVigente('plus', '2026-06-01T00:00:00.000Z', ahora)).toBe(false);
  });
});

describe('evaluarCandidatoAnonimo', () => {
  const ahora = new Date('2026-06-15T12:00:00.000Z');
  const umbral = umbralInactividad(90, ahora);

  it('huérfano inactivo es candidato', () => {
    expect(evaluarCandidatoAnonimo(base(), umbral, ahora)).toEqual({ candidato: true });
  });

  it('rechaza no anónimo, respaldo, Plus vigente y grupo activo', () => {
    expect(evaluarCandidatoAnonimo(base({ esAnonimo: false }), umbral, ahora).motivo).toBe(
      'no_anonimo',
    );
    expect(evaluarCandidatoAnonimo(base({ correoConfirmado: true }), umbral, ahora).motivo).toBe(
      'correo_respaldo',
    );
    expect(evaluarCandidatoAnonimo(base({ tieneObjetosRespaldo: true }), umbral, ahora).motivo).toBe(
      'respaldo_nube',
    );
    expect(
      evaluarCandidatoAnonimo(base({ plan: 'plus', vigenteHasta: null }), umbral, ahora).motivo,
    ).toBe('plus_vigente');
    expect(
      evaluarCandidatoAnonimo(base({ enGrupoCompartidoActivo: true }), umbral, ahora).motivo,
    ).toBe('grupo_compartido');
  });

  it('actividad reciente excluye aunque sea anónimo', () => {
    const r = evaluarCandidatoAnonimo(
      base({ ultimaActividad: '2026-06-10T00:00:00.000Z' }),
      umbral,
      ahora,
    );
    expect(r).toEqual({ candidato: false, motivo: 'activo_reciente' });
  });
});
