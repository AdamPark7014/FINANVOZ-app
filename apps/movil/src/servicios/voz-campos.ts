import { interpretarMonto } from '@cartera/nlu';
import type { LectorMonto } from '../voz/ProveedorDictado';

/**
 * Cifra dicha en un campo de dinero ("ocho mil quinientos", "como 500", "no debo nada"): reglas locales del
 * intérprete, sin red y sin LLM (regla 4: la cifra sale de reglas deterministas). La raíz la inyecta en
 * `ProveedorDictado`. Lo dictado no va a logs (regla 9).
 */
export const leerMontoDictado: LectorMonto = (texto, o) => interpretarMonto(texto, o);
