/**
 * `pnpm eval:nlu` (docs/06-NLU.md §8). Imprime solo ids, nombres de campo y agregados, nunca el texto dictado ni
 * montos (regla 9). En Windows: tip pwsh en `packages/nlu/README.md`.
 *
 * Salida (eval UI en consola): reglas → cobertura/precisión + ids fallidos; nube/offline → `formatearReporte`
 * (campos vs umbral, latencia, tokens, costo). Progreso largo va a stderr (`eval:nlu: N casos…`).
 *
 *   --nivel reglas                                   nivel 0, sin red
 *   --nivel nube --proveedor X [--modelo M] [--grabar] [--limite N] [--concurrencia N]
 *       Con NLU_PROXY_URL y NLU_PROXY_JWT llama al proxy (local o desplegado); si no, llama directo al proveedor
 *       con su llave del entorno (ANTHROPIC_API_KEY, OPENAI_API_KEY o GOOGLE_API_KEY; nunca en el repositorio).
 *       --grabar escribe fixtures/nlu/grabaciones/<proveedor>/<modelo>.jsonl.
 *   --offline                                        reproduce las grabaciones y calcula el reporte
 *   --pasos                                          lectores por paso del onboarding contra golden-pasos.jsonl
 *                                                    (06 §13), sin red; umbral 100 % de cobertura y precisión
 *
 * Salida: 0 si cumple los umbrales (o si --offline no encuentra grabaciones), 1 si no, 2 si el uso es incorrecto.
 */
import {
  type ContextoMinimo,
  validarSolicitud,
} from '../../../services/proxy/supabase/functions/_shared/nlu/contrato.ts';
import {
  describirErrorZod,
  interpretar,
  type Validador,
} from '../../../services/proxy/supabase/functions/_shared/nlu/interpretar.ts';
import {
  CREADORES,
  MODELO_POR_OMISION,
  NOMBRES_PROVEEDOR,
  type NombreProveedor,
} from '../../../services/proxy/supabase/functions/_shared/nlu/proveedores.ts';
import { Interpretacion } from '../src/esquema';
import { evaluarReglas, type ResultadoCaso } from '../src/eval/evaluar';
import { evaluarPasos } from '../src/eval/evaluar-pasos';
import {
  cargarContexto,
  cargarContextoOnboarding,
  cargarGolden,
  cargarGoldenPasos,
  type CasoGolden,
} from '../src/eval/fixtures';
import { DIRECTORIO_GRABACIONES, escribirGrabaciones, listarGrabaciones, precioDe } from '../src/eval/grabaciones';
import { evaluarNube, formatearReporte, type Grabacion } from '../src/eval/nube';

function opcion(argumentos: readonly string[], nombre: string): string | undefined {
  const i = argumentos.indexOf(nombre);
  return i === -1 ? undefined : argumentos[i + 1];
}

const porcentaje = (a: number, b: number) => (b === 0 ? '—' : `${((a / b) * 100).toFixed(1)} %`);

const USO =
  'Uso: pnpm eval:nlu --nivel reglas | --nivel nube --proveedor anthropic|openai|google [--modelo M] [--grabar] [--limite N] | --offline | --pasos';

interface ReporteCobertura {
  casos: ResultadoCaso[];
  marcados: number;
  marcadosCubiertos: number;
  respondidos: number;
  respondidosCorrectos: number;
  aprobado: boolean;
}

function imprimirCobertura(titulo: string, reporte: ReporteCobertura): number {
  console.log(titulo);
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

function lectoresPorPaso(): number {
  const casos = cargarGoldenPasos();
  const reporte = evaluarPasos(casos, cargarContextoOnboarding());
  return imprimirCobertura(`Nivel 0 · lectores por paso — ${casos.length} casos de golden-pasos`, reporte);
}

function nivelReglas(): number {
  const casos = cargarGolden();
  const reporte = evaluarReglas(casos, cargarContexto().contexto);
  return imprimirCobertura(`Nivel 0 · reglas — ${casos.length} casos del golden set`, reporte);
}

function offline(): number {
  const archivos = listarGrabaciones();
  if (archivos.length === 0) {
    console.log(
      'eval:nlu --offline: sin grabaciones en fixtures/nlu/grabaciones/. ' +
        'Se generan con `pnpm eval:nlu --nivel nube --proveedor X --grabar` (services/proxy/README.md).',
    );
    return 0;
  }
  const casos = cargarGolden();
  let alguno = false;
  for (const { grabaciones } of archivos) {
    const primera = grabaciones[0];
    const precio = primera ? precioDe(primera.proveedor, primera.modelo) : undefined;
    const reporte = evaluarNube(casos, grabaciones, precio);
    console.log(formatearReporte(reporte));
    alguno ||= reporte.cumple;
  }
  console.log(alguno ? 'Resultado: al menos un modelo cumple' : 'Resultado: ningún modelo cumple');
  return alguno ? 0 : 1;
}

const validarZod: Validador = (valor) => {
  const r = Interpretacion.safeParse(valor);
  return r.success ? { ok: true, valor: r.data } : { ok: false, error: describirErrorZod(r.error.issues) };
};

type Llamar = (caso: CasoGolden, contexto: ContextoMinimo) => Promise<Grabacion>;

function llamadaDirecta(proveedor: NombreProveedor, modelo: string): Llamar | null {
  const variable = { anthropic: 'ANTHROPIC_API_KEY', openai: 'OPENAI_API_KEY', google: 'GOOGLE_API_KEY' }[proveedor];
  const llave = process.env[variable]?.trim();
  if (!llave) {
    console.error(`eval:nlu: falta ${variable} en el entorno (o NLU_PROXY_URL y NLU_PROXY_JWT para usar el proxy).`);
    return null;
  }
  const modoAnthropic = process.env.NLU_ANTHROPIC_MODO === 'herramienta' ? 'herramienta' : 'json_schema';
  // Un solo proveedor, sin alterno: cada grabación mide un modelo.
  const adaptador = CREADORES[proveedor]({ llave, modelo, fetch: (u, i) => fetch(u, i), modoAnthropic });
  return async (caso, contexto) => {
    const r = await interpretar(caso.texto, contexto, {
      adaptadores: [adaptador],
      validar: validarZod,
      ahora: () => performance.now(),
    });
    return {
      id: caso.id,
      proveedor,
      modelo,
      codigo: r.ok ? r.desenlace : r.codigo,
      interpretacion: r.ok ? (r.interpretacion as Record<string, unknown>) : null,
      tokens_entrada: r.tokens_entrada,
      tokens_salida: r.tokens_salida,
      latencia_ms: Math.round(r.latencia_ms),
    };
  };
}

function llamadaProxy(url: string, jwt: string, proveedor: string, modelo: string): Llamar {
  return async (caso, contexto) => {
    const inicio = performance.now();
    const base = { id: caso.id, proveedor, modelo, tokens_entrada: 0, tokens_salida: 0 };
    try {
      const respuesta = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ texto: caso.texto, contexto_min: contexto, version_esquema: 1 }),
      });
      const cuerpo = (await respuesta.json()) as Record<string, unknown>;
      if (!respuesta.ok) {
        return {
          ...base,
          codigo: typeof cuerpo.error === 'string' ? cuerpo.error : `http_${respuesta.status}`,
          interpretacion: null,
          latencia_ms: Math.round(performance.now() - inicio),
        };
      }
      return {
        id: caso.id,
        proveedor: String(cuerpo.proveedor),
        modelo: String(cuerpo.modelo),
        codigo: 'ok',
        interpretacion: cuerpo.interpretacion as Record<string, unknown>,
        tokens_entrada: Number(cuerpo.tokens_entrada) || 0,
        tokens_salida: Number(cuerpo.tokens_salida) || 0,
        // Latencia vista por el cliente (incluye la red al proxy).
        latencia_ms: Math.round(performance.now() - inicio),
      };
    } catch {
      return { ...base, codigo: 'red', interpretacion: null, latencia_ms: Math.round(performance.now() - inicio) };
    }
  };
}

async function enParalelo<T, R>(lista: readonly T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const salida: R[] = new Array(lista.length);
  let siguiente = 0;
  const trabajador = async () => {
    while (siguiente < lista.length) {
      const i = siguiente++;
      salida[i] = await fn(lista[i] as T);
      if ((i + 1) % 20 === 0) console.error(`  ${i + 1}/${lista.length}`);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, n) }, trabajador));
  return salida;
}

async function nivelNube(argumentos: readonly string[]): Promise<number> {
  const proveedor = opcion(argumentos, '--proveedor');
  if (!proveedor || !(NOMBRES_PROVEEDOR as readonly string[]).includes(proveedor)) {
    console.error(USO);
    return 2;
  }
  const nombre = proveedor as NombreProveedor;
  const modelo =
    opcion(argumentos, '--modelo') ??
    process.env[`NLU_MODELO_${nombre.toUpperCase()}`]?.trim() ??
    MODELO_POR_OMISION[nombre];
  const limite = Number(opcion(argumentos, '--limite') ?? '0');
  const concurrencia = Number(opcion(argumentos, '--concurrencia') ?? '4');
  const grabar = argumentos.includes('--grabar');

  const url = process.env.NLU_PROXY_URL?.trim();
  const jwt = process.env.NLU_PROXY_JWT?.trim();
  const llamar = url && jwt ? llamadaProxy(url, jwt, nombre, modelo) : llamadaDirecta(nombre, modelo);
  if (llamar === null) return 2;

  // El mismo contrato que valida el proxy: si el contexto del golden set no lo cumple, no se llama a nadie.
  const contexto = cargarContexto().contexto;
  const solicitud = validarSolicitud({ texto: 'prueba', contexto_min: contexto, version_esquema: 1 });
  if (solicitud === null) {
    console.error('eval:nlu: fixtures/nlu/contexto.json no cumple el contrato de /nlu/interpretar');
    return 2;
  }
  const todos = cargarGolden();
  const casos = limite > 0 ? todos.slice(0, limite) : todos;
  console.error(`eval:nlu: ${casos.length} casos con ${nombre}/${modelo} vía ${url && jwt ? 'proxy' : 'API directa'}`);
  const grabaciones = await enParalelo(casos, concurrencia, (c) => llamar(c, solicitud.contexto_min));

  const reporte = evaluarNube(casos, grabaciones, precioDe(nombre, modelo));
  console.log(formatearReporte(reporte));
  if (grabar) {
    if (limite > 0) {
      console.error('eval:nlu: --grabar exige el golden set completo (sin --limite); no se escribió nada.');
      return 2;
    }
    const ruta = escribirGrabaciones(grabaciones, DIRECTORIO_GRABACIONES);
    console.log(`Grabado en ${ruta}`);
  }
  return reporte.cumple ? 0 : 1;
}

async function main(argumentos: readonly string[]): Promise<number> {
  if (argumentos.includes('--offline')) return offline();
  if (argumentos.includes('--pasos')) return lectoresPorPaso();
  const nivel = opcion(argumentos, '--nivel');
  if (nivel === 'reglas') return nivelReglas();
  if (nivel === 'nube') return nivelNube(argumentos);
  console.error(USO);
  return 2;
}

process.exitCode = await main(process.argv.slice(2));
