#!/usr/bin/env node
// Genera los secretos del backend propio de FinanVoz en C:\dev\secrets\finanvoz-backend\ (un archivo por valor;
// otra carpeta con FINANVOZ_SECRETOS). No sobrescribe los que ya existen: correrlo de nuevo no cambia nada.
// ANON_KEY y SERVICE_ROLE_KEY son JWT HS256 con `role` anon / service_role firmados con JWT_SECRET (10 años), como
// pide la guía de self-hosting de Supabase. Imprime solo nombres y los últimos 4 caracteres (regla 8: nunca en git).
//
//   node services/proxy/scripts/generar-secretos-backend.mjs
import { createHmac, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.env.FINANVOZ_SECRETOS ?? 'C:/dev/secrets/finanvoz-backend';
mkdirSync(dir, { recursive: true });
const alfanum = (n) => {
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const b = randomBytes(n * 2);
  let s = '';
  for (let i = 0; s.length < n; i++) if (b[i] < 248) s += abc[b[i] % 62];
  return s;
};
const hex = (n) => randomBytes(n).toString('hex');
const b64u = (x) => Buffer.from(x).toString('base64url');
function obtener(nombre, crear) {
  const ruta = join(dir, nombre);
  if (existsSync(ruta)) return readFileSync(ruta, 'utf8').trim();
  const v = crear();
  writeFileSync(ruta, v, { mode: 0o600 });
  return v;
}
const jwtSecret = obtener('JWT_SECRET', () => alfanum(64));
const firmar = (rol) => {
  const iat = Math.floor(Date.now() / 1000);
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64u(JSON.stringify({ role: rol, iss: 'supabase', iat, exp: iat + 10 * 365 * 24 * 3600 }));
  const s = createHmac('sha256', jwtSecret).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${s}`;
};
const valores = {
  JWT_SECRET: jwtSecret,
  ANON_KEY: obtener('ANON_KEY', () => firmar('anon')),
  SERVICE_ROLE_KEY: obtener('SERVICE_ROLE_KEY', () => firmar('service_role')),
  POSTGRES_PASSWORD: obtener('POSTGRES_PASSWORD', () => alfanum(40)),
  NLU_SAL_USUARIO: obtener('NLU_SAL_USUARIO', () => alfanum(64)),
  LISTA_ESPERA_SAL: obtener('LISTA_ESPERA_SAL', () => alfanum(64)),
  REVENUECAT_WEBHOOK_SECRET: obtener('REVENUECAT_WEBHOOK_SECRET', () => alfanum(64)),
  S3_PROTOCOL_ACCESS_KEY_ID: obtener('S3_PROTOCOL_ACCESS_KEY_ID', () => hex(16)),
  S3_PROTOCOL_ACCESS_KEY_SECRET: obtener('S3_PROTOCOL_ACCESS_KEY_SECRET', () => hex(32)),
};
for (const [k, v] of Object.entries(valores)) console.log(`${k}: …${v.slice(-4)} (${v.length})`);
