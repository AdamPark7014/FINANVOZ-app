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
