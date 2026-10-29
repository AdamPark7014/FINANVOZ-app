/** Carga de `fixtures/` para pruebas y evaluación (solo Node; no se exporta desde el paquete). */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { ContextoInterprete } from '../contexto';
import type { Espacio } from '../esquema';
import type { CuentaResolutor } from '../resolutor';

const raiz = (ruta: string) => fileURLToPath(new URL(`../../../../${ruta}`, import.meta.url));
const leerJson = (ruta: string): unknown => JSON.parse(readFileSync(raiz(ruta), 'utf8'));

export interface CasoGolden {
  id: string;
  texto: string;
  esperado: Record<string, unknown>;
  reglas?: boolean;
  nota?: string;
}

export function cargarGolden(): CasoGolden[] {
  return readFileSync(raiz('fixtures/nlu/golden.jsonl'), 'utf8')
    .split('\n')
    .filter((linea) => linea.trim() !== '')
    .map((linea) => JSON.parse(linea) as CasoGolden);
}

/** Caso de `fixtures/nlu/golden-pasos.jsonl`; `esperado: null` = no hay lectura correcta (debe dar `null`). */
export interface CasoPaso {
  id: string;
  paso: string;
  texto: string;
  esperado: Record<string, unknown> | null;
  reglas?: boolean;
  nota?: string;
}

export function cargarGoldenPasos(): CasoPaso[] {
  return readFileSync(raiz('fixtures/nlu/golden-pasos.jsonl'), 'utf8')
    .split('\n')
    .filter((linea) => linea.trim() !== '')
    .map((linea) => JSON.parse(linea) as CasoPaso);
}

const leerJsonl = <T>(ruta: string): T[] =>
  readFileSync(raiz(ruta), 'utf8')
    .split('\n')
    .filter((linea) => linea.trim() !== '')
    .map((linea) => JSON.parse(linea) as T);

/**
 * Caso de `fixtures/nlu/golden-confirmacion.jsonl`: la respuesta hablada a una tarjeta «Entendí»
 * (`pasos/confirmacion.ts`). `tarjeta` acota filas y movimiento; `esperado: null` = no hay lectura segura.
 */
export interface CasoConfirmacion {
  id: string;
  texto: string;
  tarjeta?: { filas?: string[]; movimiento?: 'gasto' | 'ingreso' };
  esperado: Record<string, unknown> | null;
  nota?: string;
}

export function cargarGoldenConfirmacion(): CasoConfirmacion[] {
  return leerJsonl<CasoConfirmacion>('fixtures/nlu/golden-confirmacion.jsonl');
}

/**
 * Caso de `fixtures/nlu/golden-reparacion.jsonl`: lo que el nivel 0 no entendió y las opciones esperadas, en orden,
 * con la frase reescrita cuando la hay (`pasos/reparacion.ts`).
 */
export interface CasoReparacion {
  id: string;
  texto: string;
  esperado: { tipo: string; frase?: string }[];
  nota?: string;
}

export function cargarGoldenReparacion(): CasoReparacion[] {
  return leerJsonl<CasoReparacion>('fixtures/nlu/golden-reparacion.jsonl');
}

/**
 * Un turno de `fixtures/nlu/golden-conversaciones.jsonl`: lo dicho y lo esperado. `esperado` es una
 * `Interpretacion` o `{ charla: <tipo> }` (la app contesta sin intérprete). `reglas` = el nivel 0 debe entenderlo;
 * `solo_reglas` = la cuenta la hace el teléfono (regla 4) y la nube no lo ve.
 */
export interface TurnoConversacion {
  texto: string;
  esperado: Record<string, unknown>;
  reglas?: boolean;
  solo_reglas?: boolean;
  nota?: string;
}

/** Caso de `golden-conversaciones.jsonl`: varios turnos seguidos (docs/06-NLU.md §15). */
export interface CasoConversacion {
  id: string;
  nota?: string;
  turnos: TurnoConversacion[];
}

export function cargarGoldenConversaciones(): CasoConversacion[] {
  return leerJsonl<CasoConversacion>('fixtures/nlu/golden-conversaciones.jsonl');
}

/** `fixtures/nlu/contexto-onboarding.json`: la persona en el onboarding, sin cuentas todavía. */
export function cargarContextoOnboarding(): ContextoInterprete {
  const f = leerJson('fixtures/nlu/contexto-onboarding.json') as ContextoInterprete;
  return {
    fecha_referencia: f.fecha_referencia,
    ...(f.dia_semana !== undefined ? { dia_semana: f.dia_semana } : {}),
    espacios: f.espacios,
    cuentas: f.cuentas,
    contactos: f.contactos ?? [],
  };
}

export function cargarEsquemaJson(): Record<string, unknown> {
  return leerJson('fixtures/nlu/esquema.json') as Record<string, unknown>;
}

export function cargarVectoresResolver(): {
  normalizar_alias: { entrada: string; esperado: string }[];
  resolver: { id: string; ref: Record<string, unknown>; esperado: Record<string, unknown> }[];
} {
  const vectores = leerJson('fixtures/motores/vectores.json') as Record<string, unknown>;
  return vectores.NLU_resolver as ReturnType<typeof cargarVectoresResolver>;
}

interface ContextoFixture {
  fecha_referencia: string;
  dia_semana_referencia: string;
  espacios: Espacio[];
  ingreso: { ultimo_ingreso: string; proximo_ingreso: string };
  cuentas: CuentaResolutor[];
  contactos: { alias: string[] }[];
  clientes: { alias: string[] }[];
}

/** `fixtures/nlu/contexto.json`: las cuentas completas (para el resolutor) y el contexto mínimo de §4. */
export function cargarContexto(): { cuentas: CuentaResolutor[]; contexto: ContextoInterprete } {
  const f = leerJson('fixtures/nlu/contexto.json') as ContextoFixture;
  return {
    cuentas: f.cuentas,
    contexto: {
      fecha_referencia: f.fecha_referencia,
      dia_semana: f.dia_semana_referencia,
      espacios: f.espacios,
      cuentas: f.cuentas.map((c) =>
        c.espacio === undefined
          ? { tipo: c.tipo, alias: c.alias }
          : { tipo: c.tipo, alias: c.alias, espacio: c.espacio },
      ),
      contactos: f.contactos.map((c) => c.alias),
      clientes: f.clientes.map((c) => c.alias),
      ultimo_ingreso: f.ingreso.ultimo_ingreso,
      proximo_ingreso: f.ingreso.proximo_ingreso,
    },
  };
}
