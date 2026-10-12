#!/usr/bin/env node
// Publica en un teléfono (build de DEPURACIÓN) las notificaciones sintéticas de
// fixtures/notificaciones/*.jsonl con `adb shell cmd notification post`, usando como etiqueta
// el id del banco (banco_a, banco_b, billetera_c, cobros_d). Ver docs/spikes/S1-S2.md y
// docs/07-CAPTURA.md §2.5 (CA-M5-01).
//
//   node modules/captura-android/scripts/publicar-ejemplos.mjs [opciones]
//     --ids N-01,N-04       solo esos ejemplos (por omisión, los 12 de ejemplos.jsonl en orden)
//     --negocio             usa negocio.ejemplos.jsonl (N-20, N-21; M11)
//     --intervalo 5         segundos entre publicaciones (por omisión 3)
//     --serial <id>         teléfono concreto (adb -s)
//     --imprimir            solo imprime los comandos, no publica
//     --autorizar [p1,p2]   detiene la app y escribe la lista blanca: los paquetes dados o, sin
//                           lista, los sintéticos (run-as; solo builds de depuración; reinicia las
//                           demás preferencias de captura). Solo cuentan los que estén en el catálogo.
//     --cola                imprime la cola del teléfono (run-as) y termina
//     --diagnostico <modo>  detiene la app y deja el modo diagnóstico en activo | muestras | apagado
//                           (muestras = también guarda título y texto; solo builds de depuración)
//     --resumen             imprime el resumen de diagnóstico (solo conteos) y termina
//     --muestras            imprime las muestras de texto; redirígelas a un archivo FUERA del repositorio
//
// Sin dependencias: usa adb del PATH (Android SDK Platform Tools). Funciona en Linux, macOS y
// Windows porque no pasa por el shell local; el texto se cita para el shell del teléfono.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = 'com.finanvoz.app';
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const DIR = join(RAIZ, 'fixtures', 'notificaciones');

function opciones(argv) {
  const o = {
    ids: null,
    negocio: false,
    intervalo: 3,
    serial: null,
    imprimir: false,
    autorizar: null,
    cola: false,
    diagnostico: null,
    resumen: false,
    muestras: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--ids') o.ids = argv[++i].split(',').map((s) => s.trim());
    else if (a === '--negocio') o.negocio = true;
    else if (a === '--intervalo') o.intervalo = Number(argv[++i]);
    else if (a === '--serial') o.serial = argv[++i];
    else if (a === '--imprimir') o.imprimir = true;
    else if (a === '--autorizar') {
      const siguiente = argv[i + 1];
      o.autorizar = siguiente && !siguiente.startsWith('--') ? (i++, siguiente.split(',')) : [];
    } else if (a === '--cola') o.cola = true;
    else if (a === '--diagnostico') {
      o.diagnostico = argv[++i];
      if (!['activo', 'muestras', 'apagado'].includes(o.diagnostico)) throw new Error('--diagnostico activo|muestras|apagado');
    } else if (a === '--resumen') o.resumen = true;
    else if (a === '--muestras') o.muestras = true;
    else throw new Error(`Opción desconocida: ${a}`);
  }
  if (!Number.isFinite(o.intervalo) || o.intervalo < 0) throw new Error('--intervalo inválido');
  return o;
}

/** Cita un argumento para /system/bin/sh del teléfono. */
export function citar(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

/** Comando remoto para publicar una notificación con la etiqueta del banco. */
export function comandoPublicar(etiqueta, titulo, texto) {
  return ['cmd', 'notification', 'post', '-S', 'bigtext', '-t', citar(titulo), citar(etiqueta), citar(texto)].join(
    ' ',
  );
}

export function etiquetasPorPaquete() {
  const plantillas = JSON.parse(readFileSync(join(DIR, 'plantillas.ejemplo.json'), 'utf8'));
  const mapa = new Map();
  for (const b of plantillas.bancos) for (const p of b.paquetes_android) mapa.set(p, b.id);
  return mapa;
}

export function leerEjemplos(negocio = false) {
  const archivo = join(DIR, negocio ? 'negocio.ejemplos.jsonl' : 'ejemplos.jsonl');
  return readFileSync(archivo, 'utf8')
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l));
}

function adb(o, args, entrada) {
  const r = spawnSync('adb', [...(o.serial ? ['-s', o.serial] : []), ...args], {
    input: entrada,
    stdio: [entrada === undefined ? 'inherit' : 'pipe', 'inherit', 'inherit'],
  });
  if (r.error) throw new Error(`No se pudo ejecutar adb: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`adb terminó con código ${r.status}`);
}

function listaBlancaXml(paquetes) {
  const cadenas = paquetes.map((p) => `        <string>${p}</string>`).join('\n');
  return `<?xml version='1.0' encoding='utf-8' standalone='yes' ?>\n<map>\n    <set name="lista_blanca">\n${cadenas}\n    </set>\n</map>\n`;
}

const dormir = (s) => new Promise((r) => setTimeout(r, s * 1000));

async function principal() {
  const o = opciones(process.argv.slice(2));
  const leer = (archivo) => adb(o, ['shell', `run-as ${APP} cat no_backup/captura/${archivo}`]);
  if (o.cola) return leer('cola.jsonl');
  if (o.resumen) return leer('diagnostico.json');
  if (o.muestras) return leer('muestras.jsonl');
  if (o.diagnostico) {
    const activo = o.diagnostico !== 'apagado';
    const estado = { activo, muestras: o.diagnostico === 'muestras', desde: activo ? Date.now() : null };
    adb(o, ['shell', `am force-stop ${APP}`]);
    adb(
      o,
      ['shell', `run-as ${APP} sh -c ${citar('mkdir -p no_backup/captura && cat > no_backup/captura/diagnostico.json')}`],
      JSON.stringify(estado),
    );
    console.log(`Diagnóstico: ${o.diagnostico}`);
    return;
  }
  if (o.autorizar) {
    const paquetes = o.autorizar.length > 0 ? o.autorizar : [...etiquetasPorPaquete().keys()];
    adb(o, ['shell', `am force-stop ${APP}`]);
    adb(
      o,
      ['shell', `run-as ${APP} sh -c ${citar('mkdir -p shared_prefs && cat > shared_prefs/finanvoz_captura.xml')}`],
      listaBlancaXml(paquetes),
    );
    console.log(`Lista blanca escrita: ${paquetes.join(', ')}`);
    return;
  }
  const etiquetas = etiquetasPorPaquete();
  let ejemplos = leerEjemplos(o.negocio);
  if (o.ids) ejemplos = ejemplos.filter((e) => o.ids.includes(e.id));
  for (const [i, e] of ejemplos.entries()) {
    const etiqueta = etiquetas.get(e.paquete);
    if (!etiqueta) throw new Error(`${e.id}: paquete sin banco en plantillas.ejemplo.json`);
    const remoto = comandoPublicar(etiqueta, e.titulo, e.texto);
    if (o.imprimir) {
      console.log(`# ${e.id}\nadb shell ${citar(remoto)}`);
      continue;
    }
    console.log(`${e.id} → ${etiqueta}`);
    adb(o, ['shell', remoto]);
    if (i < ejemplos.length - 1) await dormir(o.intervalo);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  principal().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
