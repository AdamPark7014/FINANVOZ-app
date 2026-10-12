import { describe, expect, it } from 'vitest';
import { cargarContexto, cargarVectoresResolver } from './eval/fixtures';
import { normalizarAlias } from './normalizar';
import { resolverCuenta, type RefResolutor } from './resolutor';
import { jaroWinkler } from './similitud';

const vectores = cargarVectoresResolver();
const { cuentas } = cargarContexto();

describe('normalizarAlias (NLU_resolver.normalizar_alias)', () => {
  for (const v of vectores.normalizar_alias) {
    it(`${JSON.stringify(v.entrada)} → ${JSON.stringify(v.esperado)}`, () => {
      expect(normalizarAlias(v.entrada)).toBe(v.esperado);
    });
  }

  it('deja espacios simples y quita signos', () => {
    expect(normalizarAlias('  Mi  Cuenta--de   Débito!! ')).toBe('debito');
  });
});

describe('resolverCuenta (NLU_resolver.resolver)', () => {
  for (const v of vectores.resolver) {
    it(v.id, () => {
      expect(resolverCuenta(v.ref as unknown as RefResolutor, cuentas)).toEqual(v.esperado);
    });
  }

  it('el mismo alias en dos espacios: gana el del movimiento; sin desempate, ambigua', () => {
    const dobles = [
      { id: 'b', tipo: 'efectivo', nombre: 'Caja', alias: ['caja'], espacio: 'negocio' },
      { id: 'a', tipo: 'efectivo', nombre: 'Caja chica', alias: ['caja'] },
    ] as const;
    expect(resolverCuenta({ tipo: 'efectivo', alias: 'caja', espacio: 'negocio' }, dobles)).toEqual({
      resultado: 'cuenta',
      cuenta: 'b',
    });
    expect(resolverCuenta({ tipo: 'efectivo', alias: 'caja' }, dobles)).toEqual({
      resultado: 'cuenta',
      cuenta: 'a',
    });
    const iguales = [dobles[0], { ...dobles[1], espacio: 'negocio' as const }];
    expect(resolverCuenta({ tipo: 'efectivo', alias: 'caja' }, iguales)).toEqual({
      resultado: 'ambigua',
      candidatas: ['a', 'b'],
    });
  });

  it('una billetera cuenta como débito', () => {
    const conBilletera = [{ id: 'w', tipo: 'billetera', nombre: 'Billetera', alias: ['billetera'] }] as const;
    expect(resolverCuenta({ tipo: 'debito' }, conBilletera)).toEqual({ resultado: 'cuenta', cuenta: 'w' });
  });
});

describe('jaroWinkler (05 §E9.2)', () => {
  it('valores conocidos', () => {
    expect(jaroWinkler('MARTHA', 'MARHTA')).toBeCloseTo(0.9611, 4);
    expect(jaroWinkler('', 'A')).toBe(0);
    expect(jaroWinkler('ABC', 'ABC')).toBe(1);
  });
});
