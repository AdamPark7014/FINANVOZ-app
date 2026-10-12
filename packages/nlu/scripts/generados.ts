/**
 * Archivos que el proxy (Deno) consume y que se generan desde `packages/nlu`: el proxy no importa paquetes del
 * monorepo al desplegarse, así que lleva copias generadas. `generados.test.ts` falla si están desactualizados;
 * se regeneran con `pnpm --filter @cartera/nlu generar:proveedor`.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as prettier from 'prettier';
import { serializarEsquemasProveedor } from '../src/esquema-proveedor';

export const raiz = (ruta: string) => fileURLToPath(new URL(`../../../${ruta}`, import.meta.url));

const COMPARTIDO = 'services/proxy/supabase/functions/_shared';

const IMPORT_CORE = "import { esFecha } from '@cartera/core';";

/** Copia de `esFecha` de `packages/core/src/fecha.ts` sin dependencias (misma regla de días por mes). */
const ES_FECHA_LOCAL = `
const PATRON_FECHA_CIVIL = /^(\\d{4})-(\\d{2})-(\\d{2})$/;

/** Copia de \`esFecha\` de \`packages/core/src/fecha.ts\`: la fecha civil existe (no hay 30 de febrero). */
function esFecha(valor: unknown): valor is string {
  if (typeof valor !== 'string') return false;
  const m = PATRON_FECHA_CIVIL.exec(valor);
  if (!m) return false;
  const anio = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  if (mes < 1 || mes > 12 || dia < 1) return false;
  const bisiesto = (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
  const dias = mes === 2 ? (bisiesto ? 29 : 28) : [4, 6, 9, 11].includes(mes) ? 30 : 31;
  return dia <= dias;
}
`;

const ENCABEZADO =
  '// GENERADO desde packages/nlu/src/esquema.ts por `pnpm --filter @cartera/nlu generar:proveedor`. No editar a mano.\n' +
  "// En Deno, `zod` se resuelve con el mapa de importaciones de cada función (deno.json).\n";

function esquemaZodParaProxy(): string {
  const fuente = readFileSync(raiz('packages/nlu/src/esquema.ts'), 'utf8');
  if (!fuente.includes(IMPORT_CORE)) {
    throw new Error('esquema.ts ya no importa esFecha de @cartera/core: actualiza scripts/generados.ts');
  }
  const sinCore = fuente.replace(IMPORT_CORE, '');
  // La copia local va después de los imports.
  const marca = "import { z } from 'zod';";
  return ENCABEZADO + sinCore.replace(marca, `${marca}\n${ES_FECHA_LOCAL}`);
}

async function formatear(contenido: string, ruta: string): Promise<string> {
  const opciones = (await prettier.resolveConfig(raiz(ruta))) ?? {};
  return prettier.format(contenido, { ...opciones, filepath: raiz(ruta) });
}

export interface ArchivoGenerado {
  /** Ruta relativa a la raíz del repositorio. */
  ruta: string;
  contenido: () => Promise<string>;
}

export const ARCHIVOS_GENERADOS: readonly ArchivoGenerado[] = [
  {
    ruta: `${COMPARTIDO}/esquema-proveedor.json`,
    contenido: () => formatear(serializarEsquemasProveedor(), `${COMPARTIDO}/esquema-proveedor.json`),
  },
  {
    ruta: `${COMPARTIDO}/nlu/esquema.generado.ts`,
    contenido: () => formatear(esquemaZodParaProxy(), `${COMPARTIDO}/nlu/esquema.generado.ts`),
  },
];
