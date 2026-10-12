// TEMPORAL: re-exporta el barril de E2 (`packages/core/src/libro.ts`) mientras `packages/core/src/index.ts`
// no lo exporte. Al integrar: agregar `export * from './libro';` al índice de core y cambiar los imports de
// este paquete de './nucleo' a '@cartera/core'.
export * from '../../core/src/libro';
