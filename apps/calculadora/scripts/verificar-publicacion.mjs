#!/usr/bin/env node
// Bloquea el despliegue mientras el aviso de privacidad no identifique al responsable (CA-M0-07)
// o falte la URL de la lista de espera. Lo corre el flujo de despliegue antes de `vite build`.
import { readFileSync } from 'node:fs';

const base = JSON.parse(readFileSync(new URL('../src/responsable.json', import.meta.url), 'utf8'));
const responsable = {
  nombre: process.env.VITE_RESPONSABLE_NOMBRE || base.nombre,
  domicilio: process.env.VITE_RESPONSABLE_DOMICILIO || base.domicilio,
  correo: process.env.VITE_RESPONSABLE_CORREO || base.correo,
};
const faltan = Object.entries(responsable)
  .filter(([, v]) => !v?.trim())
  .map(([k]) => `responsable.${k}`);
if (!process.env.VITE_LISTA_ESPERA_URL?.trim()) faltan.push('VITE_LISTA_ESPERA_URL');

if (faltan.length) {
  console.error(`No se puede publicar: faltan ${faltan.join(', ')}.`);
  process.exit(1);
}
console.log(`Listo para publicar: responsable ${responsable.nombre}; la lista de espera tiene URL.`);
