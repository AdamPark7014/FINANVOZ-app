/**
 * Cargador de escenarios semilla (solo desarrollo): `pnpm --filter movil semilla <id>`.
 *
 * Carga `fixtures/escenarios/<id>.json` con el mismo servicio que usa la app (`cargarEscenario`) en una base nueva
 * `apps/movil/.semillas/<id>.db` (better-sqlite3, sin cifrar: datos sintéticos) y muestra el resumen de Hoy con el
 * reloj fijo en la fecha del escenario, para compararlo con su `esperado`. En el teléfono, el build de desarrollo
 * llama `cargarEscenario` sobre la base cifrada con el JSON del escenario y fija el reloj con `relojFijo(hoy)`.
 */
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { abrirBaseCifrada } from '../src/db/abrir';
import { almacenEnMemoria } from '../src/db/llave';
import { aleatorioNode, puertoNode } from '../src/db/node';
import { crearContexto } from '../src/servicios/contexto';
import { obtenerHoy } from '../src/servicios/hoy';
import { crearGeneradorUuidV7 } from '../src/servicios/ids';
import { relojFijo } from '../src/servicios/reloj';
import { cargarEscenario } from '../src/servicios/semilla';

const id = process.argv[2];
if (process.env.NODE_ENV === 'production') {
  console.error('El cargador de semillas solo existe en desarrollo.');
  process.exit(1);
}
if (!id || !/^[a-z0-9-]+$/.test(id)) {
  console.error('Uso: pnpm --filter movil semilla <id>   (por ejemplo e4-01)');
  process.exit(1);
}

const archivoEscenario = fileURLToPath(new URL(`../../../fixtures/escenarios/${id}.json`, import.meta.url));
const datos: unknown = JSON.parse(readFileSync(archivoEscenario, 'utf8'));
const carpeta = fileURLToPath(new URL('../.semillas/', import.meta.url));
mkdirSync(carpeta, { recursive: true });
const archivoBase = `${carpeta}${id}.db`;
const puerto = puertoNode(archivoBase);
puerto.eliminarArchivo();
rmSync(archivoBase, { force: true });

const base = abrirBaseCifrada({ puerto, almacen: almacenEnMemoria(), aleatorio: aleatorioNode });
const hoy = (datos as { hoy?: string }).hoy ?? '';
const reloj = relojFijo(hoy, Date.now());
const ctx = crearContexto({ db: base.db, reloj, generarId: crearGeneradorUuidV7(() => reloj.ahora(), aleatorioNode) });
const cargado = cargarEscenario(ctx, datos);
const vista = obtenerHoy(ctx);
base.cerrar();

console.log(`Escenario ${cargado.id} cargado en ${archivoBase}`);
console.log(`Reloj fijo: ${cargado.hoy}`);
console.log(
  JSON.stringify(
    {
      estado: vista.estado,
      hoy_puedes_pesos: vista.hoyPuedesPesos,
      dias: vista.dias,
      texto_dias: vista.textoDias,
      libre: vista.libre,
      reservado: vista.reservado,
      desglose: vista.desglose,
      esperado: cargado.esperado,
    },
    null,
    2,
  ),
);
