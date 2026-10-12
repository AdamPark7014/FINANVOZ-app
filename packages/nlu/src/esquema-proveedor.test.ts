import { readFileSync } from 'node:fs';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { ARCHIVOS_GENERADOS, raiz } from '../scripts/generados';
import { Interpretacion } from './esquema';
import {
  generarEsquemasProveedor,
  PALABRAS_PERMITIDAS,
  palabrasClave,
  PROVEEDORES,
  quitarNulos,
  VARIANTE_POR_PROVEEDOR,
  type NodoEsquema,
} from './esquema-proveedor';
import { cargarGolden } from './eval/fixtures';

const esquemas = generarEsquemasProveedor();
const golden = cargarGolden();
const ajv = new Ajv2020({ allErrors: true, strict: false });
const validar = { estandar: ajv.compile(esquemas.estandar), nulable: ajv.compile(esquemas.nulable) };

const esNodo = (v: unknown): v is NodoEsquema => typeof v === 'object' && v !== null && !Array.isArray(v);

function objetos(n: unknown, salida: NodoEsquema[] = []): NodoEsquema[] {
  if (Array.isArray(n)) n.forEach((x) => objetos(x, salida));
  else if (esNodo(n)) {
    if (n.type === 'object') salida.push(n);
    for (const [clave, valor] of Object.entries(n)) {
      if (clave === 'properties' && esNodo(valor)) Object.values(valor).forEach((x) => objetos(x, salida));
      else if (clave !== 'enum') objetos(valor, salida);
    }
  }
  return salida;
}

/** Rama de un `anyOf` cuyos `enum` de un solo valor (discriminantes) coinciden con el valor. */
function elegirRama(ramas: NodoEsquema[], valor: unknown): NodoEsquema | undefined {
  return ramas.find((r) => {
    if (valor === null) return r.type === 'null';
    if (r.type === 'object') {
      if (!esNodo(valor) || !esNodo(r.properties)) return false;
      return Object.entries(r.properties).every(([clave, p]) => {
        if (!esNodo(p) || !Array.isArray(p.enum) || p.enum.length !== 1) return true;
        return valor[clave] === p.enum[0];
      });
    }
    if (r.type === 'array') return Array.isArray(valor);
    if (r.type === 'integer') return Number.isInteger(valor);
    return r.type === typeof valor;
  });
}

/** Completa un esperado del golden set con `null` en los campos opcionales ausentes (variante nulable). */
function completarConNulos(valor: unknown, esquema: NodoEsquema): unknown {
  if (Array.isArray(esquema.anyOf)) {
    const rama = elegirRama(esquema.anyOf.filter(esNodo), valor);
    return rama === undefined ? valor : completarConNulos(valor, rama);
  }
  if (Array.isArray(valor) && esNodo(esquema.items)) {
    const items = esquema.items;
    return valor.map((v) => completarConNulos(v, items));
  }
  if (esNodo(valor) && esNodo(esquema.properties)) {
    const salida: NodoEsquema = {};
    for (const [clave, sub] of Object.entries(esquema.properties)) {
      salida[clave] = clave in valor && esNodo(sub) ? completarConNulos(valor[clave], sub) : null;
    }
    return salida;
  }
  return valor;
}

describe('CA-M3-07 · proyección del esquema para proveedores (06 §10.1)', () => {
  it('la raíz es un objeto { interpretacion } y no una unión', () => {
    for (const e of [esquemas.estandar, esquemas.nulable]) {
      expect(e.type).toBe('object');
      expect(e.required).toEqual(['interpretacion']);
      expect(e.anyOf).toBeUndefined();
      expect(e.oneOf).toBeUndefined();
    }
  });

  for (const proveedor of PROVEEDORES) {
    it(`${proveedor}: sin palabras clave fuera de su lista permitida`, () => {
      const usadas = palabrasClave(esquemas[VARIANTE_POR_PROVEEDOR[proveedor]]);
      const fuera = [...usadas].filter((p) => !PALABRAS_PERMITIDAS[proveedor].has(p));
      expect(fuera).toEqual([]);
    });
  }

  it('sin restricciones numéricas, de longitud, patrones, oneOf, const ni if/then', () => {
    const prohibidas = [
      'minimum',
      'maximum',
      'minLength',
      'maxLength',
      'minItems',
      'maxItems',
      'pattern',
      'oneOf',
      'const',
      'if',
      'then',
      'minProperties',
      'prefixItems',
      '$schema',
    ];
    for (const e of [esquemas.estandar, esquemas.nulable]) {
      const usadas = palabrasClave(e);
      expect(prohibidas.filter((p) => usadas.has(p))).toEqual([]);
    }
  });

  it('additionalProperties: false en todos los objetos', () => {
    for (const e of [esquemas.estandar, esquemas.nulable]) {
      const lista = objetos(e);
      expect(lista.length).toBeGreaterThan(20);
      for (const o of lista) expect(o.additionalProperties).toBe(false);
    }
  });

  it('variante nulable: todos los campos son obligatorios', () => {
    for (const o of objetos(esquemas.nulable)) {
      expect(o.required).toEqual(Object.keys(o.properties as NodoEsquema));
    }
  });

  it('las fechas y los montos explican su formato en la descripción', () => {
    const texto = JSON.stringify(esquemas.estandar);
    expect(texto).toContain('YYYY-MM-DD');
    expect(texto).toContain('Centavos enteros');
  });
});

describe('CA-M3-07 · todo esperado del golden set valida contra la proyección', () => {
  for (const caso of golden) {
    it(caso.id, () => {
      const estandar = { interpretacion: caso.esperado };
      expect(validar.estandar(estandar), JSON.stringify(validar.estandar.errors)).toBe(true);

      const completo = completarConNulos(estandar, esquemas.nulable);
      expect(validar.nulable(completo), JSON.stringify(validar.nulable.errors)).toBe(true);
      // El adaptador quita los null y Zod vuelve a aceptar exactamente el esperado.
      const limpio = quitarNulos(completo) as { interpretacion: unknown };
      expect(limpio.interpretacion).toEqual(caso.esperado);
      expect(Interpretacion.safeParse(limpio.interpretacion).success).toBe(true);
    });
  }
});

describe('quitarNulos', () => {
  it('quita propiedades null en cualquier nivel y conserva arreglos', () => {
    expect(
      quitarNulos({ a: null, b: { c: null, d: 1 }, e: [{ f: null, g: 'x' }], h: false, i: 0, j: '' }),
    ).toEqual({ b: { d: 1 }, e: [{ g: 'x' }], h: false, i: 0, j: '' });
  });
});

describe('archivos generados para el proxy', () => {
  for (const archivo of ARCHIVOS_GENERADOS) {
    it(`${archivo.ruta} está al día (pnpm --filter @cartera/nlu generar:proveedor)`, async () => {
      expect(readFileSync(raiz(archivo.ruta), 'utf8')).toBe(await archivo.contenido());
    });
  }
});
