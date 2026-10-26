/**
 * `pnpm eval:nlu` (docs/06-NLU.md §8). Imprime solo ids, nombres de campo y agregados, nunca el texto dictado ni
 * montos (regla 9). En Windows: tip pwsh en `packages/nlu/README.md`.
 *
 * Salida (eval UI en consola): reglas → cobertura/precisión + ids fallidos; nube/offline → `formatearReporte`
 * (campos vs umbral, latencia, tokens, costo). Progreso largo va a stderr (`eval:nlu: N casos…`).
 *
 *   --nivel reglas                                   nivel 0, sin red
 *   --nivel nube --proveedor X [--modelo M] [--grabar] [--limite N] [--concurrencia N] [--por-minuto N]
 *       Con NLU_PROXY_URL y NLU_PROXY_JWT llama al proxy (local o desplegado); si no, llama directo al proveedor
 *       con su llave del entorno (ANTHROPIC_API_KEY, OPENAI_API_KEY o GOOGLE_API_KEY; nunca en el repositorio).
 *       --grabar escribe fixtures/nlu/grabaciones/<proveedor>/<modelo>.jsonl.
 *   --offline                                        reproduce las grabaciones y calcula el reporte
 *   --pasos                                          lectores por paso del onboarding contra golden-pasos.jsonl
 *                                                    (06 §13), sin red; umbral 100 % de cobertura y precisión
 *   --confirmacion                                   respuesta hablada a una tarjeta «Entendí» (sí / no / cambio)
 *                                                    contra golden-confirmacion.jsonl; umbral 100 % como --pasos
 *   --reparacion                                     opciones de «No entendí» con su frase reescrita contra
 *                                                    golden-reparacion.jsonl; umbral 100 % como --pasos
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
  leerModoAnthropic,
  MODELO_POR_OMISION,
  NOMBRES_PROVEEDOR,
  type NombreProveedor,
} from '../../../services/proxy/supabase/functions/_shared/nlu/proveedores.ts';
import { Interpretacion } from '../src/esquema';
import { evaluarReglas, type ResultadoCaso } from '../src/eval/evaluar';
import { evaluarConfirmacion } from '../src/eval/evaluar-confirmacion';
import { evaluarPasos } from '../src/eval/evaluar-pasos';
import { evaluarReparacion } from '../src/eval/evaluar-reparacion';
import {
  cargarContexto,
  cargarContextoOnboarding,
  cargarGolden,
  cargarGoldenConfirmacion,
  cargarGoldenPasos,
  cargarGoldenReparacion,
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
  'Uso: pnpm eval:nlu --nivel reglas | --nivel nube --proveedor anthropic|openai|google [--modelo M] [--grabar] [--limite N] [--concurrencia N] [--por-minuto N] [--solo-nube] [--solo G01,G02] [--permitir-caro] | --offline | --pasos | --confirmacion | --reparacion';

interface ReporteCobertura {
  casos: ResultadoCaso[];
  marcados: number;
  marcadosCubiertos: number;
  respondidos: number;
  respondidosCorrectos: number;
  aprobado: boolean;
}

function imprimirCobertura(titulo: string, reporte: ReporteCobertura, marcados = 'reglas: true'): number {
  console.log(titulo);
  console.log(
    `Cobertura (${marcados}): ${reporte.marcadosCubiertos}/${reporte.marcados} ` +
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

function confirmacionPorVoz(): number {
  const casos = cargarGoldenConfirmacion();
  const reporte = evaluarConfirmacion(casos, cargarContexto().contexto);
  return imprimirCobertura(
    `Nivel 0 · confirmación por voz — ${casos.length} casos de golden-confirmacion`,
    reporte,
    'con lectura esperada',
  );
}

function reparacion(): number {
  const casos = cargarGoldenReparacion();
  const reporte = evaluarReparacion(casos, cargarContexto().contexto);
  return imprimirCobertura(
    `Nivel 0 · reparación de «No entendí» — ${casos.length} casos de golden-reparacion`,
    reporte,
    'todos los casos',
  );
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
  // Igual que la Edge Function: modo por omisión del adaptador (herramienta) y raíz configurable (puerta única).
  const urlBase = process.env.ANTHROPIC_BASE_URL?.trim();
  // Un solo proveedor, sin alterno: cada grabación mide un modelo.
  const adaptador = CREADORES[proveedor]({
    llave,
    modelo,
    fetch: (u, i) => fetch(u, i),
    modoAnthropic: leerModoAnthropic(process.env.NLU_ANTHROPIC_MODO?.trim()),
    ...(urlBase ? { urlBase } : {}),
  });
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
      tokens_cache_leidos: r.tokens_cache_leidos,
      tokens_cache_escritos: r.tokens_cache_escritos,
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

async function enParalelo<T, R>(
  lista: readonly T[],
  n: number,
  fn: (x: T) => Promise<R>,
  porMinuto = 0,
): Promise<R[]> {
  const salida: R[] = new Array(lista.length);
  let siguiente = 0;
  // `--por-minuto`: la puerta limita las peticiones por minuto de cada proyecto (pruebas: 60, compartidas con otros
  // evals); cada inicio espera su turno para no recibir 429 (que el adaptador reintenta y se cuenta como falla).
  const inicio = performance.now();
  const espaciado = porMinuto > 0 ? 60_000 / porMinuto : 0;
  const trabajador = async () => {
    while (siguiente < lista.length) {
      const i = siguiente++;
      const espera = inicio + i * espaciado - performance.now();
      if (espera > 0) await new Promise((r) => setTimeout(r, espera));
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
  // Costo de pruebas (regla de Adam, 23-10): solo el modelo de producción (Haiku) salvo que se pida otro a propósito;
  // los jueces y comparaciones con Sonnet u Opus se llevaron casi todo el gasto de pruebas.
  if (nombre === 'anthropic' && !/haiku/.test(modelo) && !argumentos.includes('--permitir-caro')) {
    console.error(
      `eval:nlu: ${modelo} cuesta de 20 a 40 veces lo que Haiku. Si de verdad hace falta, agrega --permitir-caro ` +
        'y usa --solo con los casos que cambiaste.',
    );
    return 2;
  }
  const soloNube = argumentos.includes('--solo-nube');
  const soloIds = new Set(
    (opcion(argumentos, '--solo') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  );

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
  const filtrados = cargarGolden().filter(
    (c) => (!soloNube || c.reglas !== true) && (soloIds.size === 0 || soloIds.has(c.id)),
  );
  const casos = limite > 0 ? filtrados.slice(0, limite) : filtrados;
  if ((soloNube || soloIds.size > 0) && grabar) {
    console.error('eval:nlu: --grabar exige el golden set completo (sin --solo ni --solo-nube); no se escribió nada.');
    return 2;
  }
  const base = nombre === 'anthropic' ? process.env.ANTHROPIC_BASE_URL?.trim() : undefined;
  const via = url && jwt ? 'proxy' : (base ?? 'API directa');
  console.error(`eval:nlu: ${casos.length} casos con ${nombre}/${modelo} vía ${via}`);
  const porMinuto = Number(opcion(argumentos, '--por-minuto') ?? '0');
  const grabaciones = await enParalelo(
    casos,
    concurrencia,
    (c) => llamar(c, solicitud.contexto_min),
    porMinuto,
  );

  const reporte = evaluarNube(casos, grabaciones, precioDe(nombre, modelo));
  console.log(formatearReporte(reporte));
  // Desenlaces que cuestan de más: un reintento por validación es una segunda llamada; `no_entendi` es una salida
  // inválida dos veces.
  const desenlaces = new Map<string, number>();
  for (const g of grabaciones) desenlaces.set(g.codigo, (desenlaces.get(g.codigo) ?? 0) + 1);
  console.log(
    `  desenlaces      ${[...desenlaces].map(([k, v]) => `${k} ${v}`).join(' · ')}` +
      (reporte.costo_total === null || casos.length === 0
        ? ''
        : ` · US$${(reporte.costo_total / casos.length).toFixed(6)} por frase`),
  );
  const fallidos = reporte.resultados.filter((c) => !c.correcto).map((c) => `${c.id} (${c.fallas.join(', ')})`);
  if (fallidos.length > 0) console.log(`  fallan          ${fallidos.join(' · ')}`);
  // --ver: lo que contestó el modelo en los que fallan (solo frases del golden set; nada de usuarios).
  if (argumentos.includes('--ver')) {
    const porId = new Map(grabaciones.map((g) => [g.id, g]));
    for (const r of reporte.resultados.filter((c) => !c.correcto)) {
      console.log(`  ${r.id}: ${JSON.stringify(porId.get(r.id)?.interpretacion ?? null)}`);
    }
  }
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
  if (argumentos.includes('--confirmacion')) return confirmacionPorVoz();
  if (argumentos.includes('--reparacion')) return reparacion();
  const nivel = opcion(argumentos, '--nivel');
  if (nivel === 'reglas') return nivelReglas();
  if (nivel === 'nube') return nivelNube(argumentos);
  console.error(USO);
  return 2;
}

process.exitCode = await main(process.argv.slice(2));
