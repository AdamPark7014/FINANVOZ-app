/**
 * Nivel 0 · gramática de reglas (docs/06-NLU.md §9). Responde solo si está seguro; cualquier otra cosa → `null`.
 * Corre en el teléfono, sin red. Nunca registra en logs el texto ni los montos (regla 9).
 *
 * Orden de las producciones (gana la primera que consume la frase completa): la RESPUESTA a la aclaración del turno
 * anterior (§15), FUERA_DE_ALCANCE, GASTO_COMPARTIDO, CONSULTA, POR_QUE, SIMULAR, ARQUEO, CONFIGURAR, CORREGIR,
 * ANULAR, DUPLICADOS, RETIRO, TRANSFERENCIA, INGRESO, PAGO_TDC, PRESTAMOS, TANDA, MSI, DIVIDIDA, GASTO, SEGUIMIENTO
 * del turno anterior (§15), la frase tras «y», «también»…, y ACLARAR (`sin-nube.ts`). Una frase completa gana al
 * seguimiento: «uber 120» después de una consulta es un registro.
 */
import type { ContextoInterprete } from '../contexto';
import type { Interpretacion } from '../esquema';
import { arqueo } from './arqueo';
import { compartido } from './compartido';
import { configurarFrase } from './configurar';
import { consulta } from './consultas';
import { anular, corregirFrase, duplicados } from './correcciones';
import { Entorno } from './entorno';
import { gastos, gastoSinMonto } from './gasto';
import { aclaracionLocal, fueraDeAlcance, preguntaPorQue } from './sin-nube';
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
import { otraIgualConFecha, respuestaAclaracion, seguimiento, type Reinterpretar } from './seguimiento';
import { SEP, tokenizar, type Tokens } from './tokens';

type Produccion = (tokens: Tokens, env: Entorno, reinterpretar: Reinterpretar) => Interpretacion | null;

/** Palabras con que empieza una frase que sigue a otra («y una coca de 25», «¿y cuánto debo?»). */
const CONJUNCIONES = new Set(['y', 'e', 'tambien', 'ademas', 'ah', 'pues']);

/** La frase sin «y», «también»… al inicio, interpretada sola. */
function trasConjuncion(tokens: Tokens, reinterpretar: Reinterpretar): Interpretacion | null {
  let i = 0;
  while (i < tokens.t.length - 1 && (CONJUNCIONES.has(tokens.t[i] ?? '') || tokens.t[i] === SEP)) i++;
  if (i === 0) return null;
  return reinterpretar(tokens.c.slice(i).join(' '));
}

const PRODUCCIONES: readonly Produccion[] = [
  consulta,
  (t) => preguntaPorQue(t),
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
  // Lo que solo se entiende con el turno anterior (§15): «¿y la semana pasada?», «otra igual», «no, en efectivo».
  seguimiento,
  otraIgualConFecha,
  // «y una coca de 25», «¿y cuánto debo?»: la frase completa tras la conjunción.
  (t, _env, reinterpretar) => trasConjuncion(t, reinterpretar),
  // Una lista de gastos donde a una parte le falta su cifra ("unos tacos de 80 y una coca") → monto_faltante.
  gastoSinMonto,
  // Al final: solo pregunta lo obvio (gasto sin cifra, sueldo bruto, «la semana pasada», «¿me alcanza?» sin precio,
  // «dos cincuenta»).
  (t) => aclaracionLocal(t),
];

/** Interpreta `texto` con la gramática del nivel 0. Devuelve `null` si no está seguro. */
export function interpretarReglas(texto: string, contexto: ContextoInterprete): Interpretacion | null {
  const tokens = tokenizar(texto);
  if (tokens.t.length === 0) return null;
  const env = new Entorno(contexto);
  // Lo que se vuelve a leer (la frase de antes con la respuesta, lo que sigue a una conjunción) va sin turno anterior.
  const { anterior: _anterior, ...sinAnterior } = contexto;
  void _anterior;
  const reinterpretar: Reinterpretar = (otro) => interpretarReglas(otro, sinAnterior);
  // La respuesta a una aclaración va primero: «unos tenis de 1,200» tras «¿me alcanza?» es la compra.
  const respuesta = respuestaAclaracion(tokens, env, reinterpretar);
  if (respuesta) return respuesta;
  // Lo que la app no hace (mover dinero, aconsejar inversiones, mostrar sus instrucciones) se contesta aquí.
  const fuera = fueraDeAlcance(tokens);
  if (fuera) return fuera;
  // Con una señal de gasto compartido la frase es eso o nada: nunca se registra como gasto personal.
  const conPareja = compartido(tokens, env);
  if (conPareja !== undefined) return conPareja;
  for (const produccion of PRODUCCIONES) {
    const salida = produccion(tokens, env, reinterpretar);
    if (salida) return salida;
  }
  return null;
}
