/**
 * Nivel 0 · gramática de reglas (docs/06-NLU.md §9). Responde solo si está seguro; cualquier otra cosa → `null`.
 * Corre en el teléfono, sin red. Nunca registra en logs el texto ni los montos (regla 9).
 *
 * Orden de las producciones (gana la primera que consume la frase completa): GASTO_COMPARTIDO, CONSULTA, SIMULAR,
 * ARQUEO, CONFIGURAR, CORREGIR, ANULAR, DUPLICADOS, RETIRO, TRANSFERENCIA, INGRESO, PAGO_TDC, PRESTAMOS, TANDA, MSI,
 * DIVIDIDA y GASTO.
 */
import type { ContextoInterprete } from '../contexto';
import type { Interpretacion } from '../esquema';
import { arqueo } from './arqueo';
import { compartido } from './compartido';
import { configurarFrase } from './configurar';
import { consulta } from './consultas';
import { anular, corregirFrase, duplicados } from './correcciones';
import { Entorno } from './entorno';
import { gastos } from './gasto';
import { simular } from './simular';
import {
  compraMsi,
  cuentaDividida,
  ingreso,
  pagoTarjeta,
  prestamos,
  retiro,
  tanda,
  transferencia,
} from './movimientos';
import { tokenizar, type Tokens } from './tokens';

type Produccion = (tokens: Tokens, env: Entorno) => Interpretacion | null;

const PRODUCCIONES: readonly Produccion[] = [
  consulta,
  simular,
  (t) => arqueo(t),
  configurarFrase,
  corregirFrase,
  anular,
  duplicados,
  retiro,
  transferencia,
  ingreso,
  pagoTarjeta,
  prestamos,
  tanda,
  compraMsi,
  cuentaDividida,
  gastos,
];

/** Interpreta `texto` con la gramática del nivel 0. Devuelve `null` si no está seguro. */
export function interpretarReglas(texto: string, contexto: ContextoInterprete): Interpretacion | null {
  const tokens = tokenizar(texto);
  if (tokens.t.length === 0) return null;
  const env = new Entorno(contexto);
  // Con una señal de gasto compartido la frase es eso o nada: nunca se registra como gasto personal.
  const conPareja = compartido(tokens, env);
  if (conPareja !== undefined) return conPareja;
  for (const produccion of PRODUCCIONES) {
    const salida = produccion(tokens, env);
    if (salida) return salida;
  }
  return null;
}
