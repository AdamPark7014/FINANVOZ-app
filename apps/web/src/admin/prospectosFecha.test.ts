import { describe, expect, it } from 'vitest';
import { etiquetaSiguientePaso } from './prospectosFecha';

const hoy = '2026-11-22';

describe('etiquetaSiguientePaso', () => {
  it('sin fecha deja vacío', () => {
    expect(etiquetaSiguientePaso(null, hoy)).toBe('');
  });

  it('hoy', () => {
    expect(etiquetaSiguientePaso('2026-11-22', hoy)).toBe('Hoy');
  });

  it('mañana', () => {
    expect(etiquetaSiguientePaso('2026-11-23', hoy)).toBe('Mañana');
  });

  it('atrasado', () => {
    expect(etiquetaSiguientePaso('2026-11-20', hoy)).toBe('Atrasado desde el 20 nov');
  });

  it('fecha futura corta', () => {
    expect(etiquetaSiguientePaso('2026-11-25', hoy)).toBe('25 nov');
  });
});
