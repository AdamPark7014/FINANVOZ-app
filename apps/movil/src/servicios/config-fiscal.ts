import { ErrorDominio, validarConfigFiscal, type ConfigFiscal } from '@cartera/core';
import config2026 from '../../../../config/fiscal/2026.json';
import type { Contexto } from './contexto';

/** `config/fiscal/<año>.json` que trae la app (regla 13: ningún valor fiscal en código). */
const ARCHIVOS: Readonly<Record<number, unknown>> = { 2026: config2026 };

export type CargaConfigFiscal =
  | { readonly estado: 'lista'; readonly config: ConfigFiscal }
  /**
   * No hay archivo del ejercicio, le faltan parámetros (`config_fiscal_incompleta`), su forma no es la de
   * `10 §5`, o todavía no lo valida un contador (`estado: "por_validar"`). En cualquiera de esos casos no se
   * calcula nada: un parámetro sin validar no puede producir una deducción (pendiente 93).
   */
  | { readonly estado: 'sin_parametros' };

/**
 * Parámetros fiscales del ejercicio, ya validados por `validarConfigFiscal` y firmados por un contador. Falla
 * cerrado: cualquier problema es `sin_parametros`, sin detalle (las rutas pendientes viven en ESTADO).
 */
export function cargarConfigFiscal(ctx: Contexto, ejercicio: number): CargaConfigFiscal {
  const archivos = ctx.configFiscal ?? ARCHIVOS;
  if (!Object.hasOwn(archivos, ejercicio)) return { estado: 'sin_parametros' };
  try {
    const config = validarConfigFiscal(archivos[ejercicio], ejercicio);
    if (config.estado !== 'validado') return { estado: 'sin_parametros' };
    return { estado: 'lista', config };
  } catch (error) {
    if (error instanceof ErrorDominio) return { estado: 'sin_parametros' };
    throw error;
  }
}
