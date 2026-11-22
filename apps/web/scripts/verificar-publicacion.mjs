#!/usr/bin/env node
/**
 * Comprueba el `dist/` de @cartera/web antes de publicar:
 * - Existen index.html, aviso-de-privacidad.html y soporte.html
 * - Ningún .js empaqueta service_role ni cadenas que parezcan llaves privadas
 */
import { readdir, readFile, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(raiz, 'dist');

const obligatorios = ['index.html', 'aviso-de-privacidad.html', 'soporte.html'];

async function listarJs(dir) {
  const out = [];
  let entradas;
  try {
    entradas = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entradas) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await listarJs(p)));
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}

const fallos = [];

for (const f of obligatorios) {
  try {
    await access(join(dist, f));
  } catch {
    fallos.push(`Falta ${f} en dist/`);
  }
}

const anonEsperada = (process.env.VITE_SUPABASE_ANON_KEY ?? '').trim();

for (const archivo of await listarJs(dist)) {
  const texto = await readFile(archivo, 'utf8');
  if (/service_role/i.test(texto)) {
    fallos.push(`${archivo}: contiene «service_role»`);
  }
  if (/\bsk-[A-Za-z0-9_-]{20,}/.test(texto)) {
    fallos.push(`${archivo}: parece contener una llave sk-…`);
  }
  const jwtLargas = texto.match(/eyJ[A-Za-z0-9_-]{100,}/g) ?? [];
  for (const t of jwtLargas) {
    if (anonEsperada && t === anonEsperada) continue;
    if (anonEsperada && anonEsperada.startsWith(t)) continue;
    // La anon pública de Vite puede ir en el bundle; solo fallamos si no coincide con la esperada
    // o si no hay variable y el token es sospechosamente largo (> 200) distinto de un placeholder.
    if (!anonEsperada && t.length > 100) {
      // Sin anon configurada en el entorno: aceptar un solo JWT corto típico de demo; rechazar extras largos.
      if (t.length > 200) fallos.push(`${archivo}: JWT eyJ… demasiado largo (${t.length} caracteres)`);
    } else if (anonEsperada && t !== anonEsperada) {
      fallos.push(`${archivo}: JWT eyJ… que no es la anon pública esperada`);
    }
  }
}

if (fallos.length > 0) {
  console.error('verificar-publicacion: falló\n' + fallos.map((f) => `  - ${f}`).join('\n'));
  process.exit(1);
}
console.log('verificar-publicacion: ok');
