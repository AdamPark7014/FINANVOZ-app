/**
 * Spike de M9 (`docs/09-ROADMAP.md §M9`, `03 §3`): tiempo de scrypt (r = 8, p = 1, 32 bytes) con `node:crypto`
 * (nativo, referencia de lo que daría react-native-quick-crypto) y con `@noble/hashes` (JS puro, lo que corre en
 * Hermes). Para aproximar Hermes, que no tiene JIT, córrelo también con `node --jitless`:
 *
 *   pnpm --filter @cartera/respaldo medir:scrypt            # n = 2^17 y 2^16, con JIT
 *   node --jitless --import tsx scripts/medir-scrypt.ts     # intérprete puro (cota pesimista de Hermes)
 *
 * Imprime solo tiempos y si la llave coincide con el vector E16-04; ningún dato del usuario.
 */
import { scrypt as scryptNode } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { scrypt as scryptNoble } from '@noble/hashes/scrypt.js';

const vectores = JSON.parse(
  readFileSync(new URL('../../../fixtures/motores/vectores.json', import.meta.url), 'utf8'),
) as { E16: { kdf: { id: string; contrasena: string; sal_hex: string; esperado_hex: string }[] } };
const e1604 = vectores.E16.kdf.find((v) => v.id === 'E16-04');
if (!e1604) throw new Error('falta E16-04');
const esperado = e1604.esperado_hex;

const contrasena = new TextEncoder().encode(e1604.contrasena.normalize('NFKC'));
const sal = Uint8Array.from(Buffer.from(e1604.sal_hex, 'hex'));
const MAXMEM = 256 * 1024 * 1024;
const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');

async function medir(nombre: string, n: number, fn: () => Promise<Uint8Array> | Uint8Array) {
  const tiempos: number[] = [];
  let llave: Uint8Array = new Uint8Array();
  for (let i = 0; i < 3; i++) {
    const t0 = performance.now();
    llave = await fn();
    tiempos.push(performance.now() - t0);
  }
  tiempos.sort((a, b) => a - b);
  const vector = n === 2 ** 17 ? (hex(llave) === esperado ? ' (E16-04 ok)' : ' (E16-04 NO coincide)') : '';
  console.log(`${nombre} n=2^${Math.log2(n)}: mediana ${Math.round(tiempos[1] ?? 0)} ms${vector}`);
}

const jitless = process.execArgv.includes('--jitless');
for (const n of [2 ** 17, 2 ** 16]) {
  if (!jitless)
    await medir('node:crypto', n, () => {
      return new Promise((ok, mal) =>
        scryptNode(contrasena, sal, 32, { N: n, r: 8, p: 1, maxmem: MAXMEM }, (e, k) =>
          e ? mal(e) : ok(new Uint8Array(k)),
        ),
      );
    });
  await medir(`@noble/hashes${jitless ? ' (--jitless)' : ''}`, n, () =>
    scryptNoble(contrasena, sal, { N: n, r: 8, p: 1, dkLen: 32, maxmem: MAXMEM }),
  );
}
