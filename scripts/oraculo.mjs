#!/usr/bin/env node
// Ejecuta el oráculo de motores con el Python que haya en la máquina (Linux, macOS o Windows).
//
//   node scripts/oraculo.mjs --verificar   # CI y /verificar: falla si vectores.json no coincide con el oráculo
//   node scripts/oraculo.mjs --escribir    # regenera fixtures/motores/vectores.json
//
// Requiere Python 3.10 o superior (solo biblioteca estándar).
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const oraculo = join(raiz, 'fixtures', 'motores', 'oraculo.py');
const args = process.argv.slice(2);
const candidatos = process.platform === 'win32'
  ? [['py', ['-3']], ['python', []], ['python3', []]]
  : [['python3', []], ['python', []]];

for (const [comando, previos] of candidatos) {
  const version = spawnSync(comando, [...previos, '-c', 'import sys; print(sys.version_info >= (3, 10))'], { encoding: 'utf8' });
  if (version.status !== 0 || version.stdout.trim() !== 'True') continue;
  const r = spawnSync(comando, [...previos, oraculo, ...args], { stdio: 'inherit', cwd: raiz });
  process.exit(r.status ?? 1);
}
console.error('No encontré Python 3.10 o superior (probé: ' + candidatos.map(([c, p]) => [c, ...p].join(' ')).join(', ') + ').');
console.error('Instálalo desde https://www.python.org/downloads/ y vuelve a intentar.');
process.exit(1);
