/**
 * `pnpm eval:nlu --nivel reglas` (docs/06-NLU.md §8). Imprime solo ids y nombres de campo, nunca el texto dictado
 * ni montos (regla 9). Sale con código 1 si no se cumplen los umbrales y con 2 si el modo no existe todavía.
 */
import { evaluarReglas } from '../src/eval/evaluar';
import { cargarContexto, cargarGolden } from '../src/eval/fixtures';

function opcion(argumentos: readonly string[], nombre: string): string | undefined {
  const i = argumentos.indexOf(nombre);
  return i === -1 ? undefined : argumentos[i + 1];
}

const porcentaje = (a: number, b: number) => (b === 0 ? '—' : `${((a / b) * 100).toFixed(1)} %`);

function main(argumentos: readonly string[]): number {
  const nivel = opcion(argumentos, '--nivel');
  if (argumentos.includes('--offline') || nivel === 'nube') {
    console.error('eval:nlu: el nivel nube y --offline llegan en M3 (docs/09-ROADMAP.md).');
    return 2;
  }
  if (nivel !== 'reglas') {
    console.error('Uso: pnpm eval:nlu --nivel reglas');
    return 2;
  }

  const casos = cargarGolden();
  const reporte = evaluarReglas(casos, cargarContexto().contexto);

  console.log(`Nivel 0 · reglas — ${casos.length} casos del golden set`);
  console.log(
    `Cobertura (reglas: true): ${reporte.marcadosCubiertos}/${reporte.marcados} ` +
      `(${porcentaje(reporte.marcadosCubiertos, reporte.marcados)}; umbral 100 %)`,
  );
  console.log(
    `Precisión: ${reporte.respondidosCorrectos}/${reporte.respondidos} ` +
      `(${porcentaje(reporte.respondidosCorrectos, reporte.respondidos)}; umbral 100 %)`,
  );
  const sinCubrir = reporte.casos.filter((r) => r.marcadoReglas && !(r.respondio && r.correcto));
  for (const r of sinCubrir) console.log(`  sin cubrir: ${r.id}${r.respondio ? ` (${r.fallas.join(', ')})` : ''}`);
  const incorrectos = reporte.casos.filter((r) => r.respondio && !r.correcto);
  for (const r of incorrectos) console.log(`  incorrecto: ${r.id} (${r.fallas.join(', ')})`);
  console.log(reporte.aprobado ? 'Resultado: pasa' : 'Resultado: falla');
  return reporte.aprobado ? 0 : 1;
}

process.exitCode = main(process.argv.slice(2));
