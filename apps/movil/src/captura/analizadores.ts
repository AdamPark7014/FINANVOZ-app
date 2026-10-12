import { compilarAnalizadores, type CatalogoAnalizadores } from '@cartera/core';
import sinteticos from '../../../../fixtures/pdf/analizadores.ejemplo.json';
import reales from './analizadores/reales.json';

/**
 * Analizadores de estados de cuenta en PDF embebidos en la app (`07 §8`): los reales siempre y, después, los
 * sintéticos de `fixtures/pdf` (Banco B, E y F, que no existen) solo en builds de desarrollo, para probar con los
 * PDF del repositorio. El primero que reconoce el texto gana, así que los reales van antes.
 */
export function catalogoAnalizadores(incluirSinteticos: boolean): CatalogoAnalizadores {
  return compilarAnalizadores({
    version: 1,
    analizadores: [...reales.analizadores, ...(incluirSinteticos ? sinteticos.analizadores : [])],
  });
}

let catalogoDeLaApp: CatalogoAnalizadores | null = null;

/** Catálogo con el que corre la app: los sintéticos solo con `__DEV__` (en Node, donde no existe, también). */
export function catalogoAnalizadoresApp(): CatalogoAnalizadores {
  catalogoDeLaApp ??= catalogoAnalizadores(typeof __DEV__ === 'undefined' || __DEV__);
  return catalogoDeLaApp;
}

/** Nombres de los bancos que la app sabe leer, sin repetir, en orden. */
export function bancosConAnalizador(catalogo: CatalogoAnalizadores): string[] {
  return [...new Set(catalogo.analizadores.map((a) => a.nombre))];
}
