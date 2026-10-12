/** `@cartera/fiscal`: lectura de CFDI 4.0 (E13.1). El cálculo de deducciones vive en `@cartera/core` (E13.2–E13.3). */
export { decimalACentavos } from './decimal';
export { NS_CFDI4, NS_TIMBRE, parsearCfdi, type CodigoErrorCfdi } from './cfdi';
export type { CfdiLeido } from '@cartera/core';
