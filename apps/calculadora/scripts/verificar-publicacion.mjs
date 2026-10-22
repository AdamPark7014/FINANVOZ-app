#!/usr/bin/env node
// Bloquea el despliegue mientras el aviso de privacidad no identifique al responsable (CA-M0-07)
// o falte la URL de la lista de espera. Lo corre el flujo de despliegue antes de `vite build`.
// Con `--sin-lista-espera` (GitHub Pages provisional para las tiendas: aviso y soporte) solo exige al
// responsable; la lista de espera muestra «todavía no está abierta» hasta que exista su URL.
import { readFileSync } from 'node:fs';

const sinListaEspera = process.argv.includes('--sin-lista-espera');
const base = JSON.parse(readFileSync(new URL('../src/responsable.json', import.meta.url), 'utf8'));
const responsable = {
  nombre: process.env.VITE_RESPONSABLE_NOMBRE || base.nombre,
  domicilio: process.env.VITE_RESPONSABLE_DOMICILIO || base.domicilio,
  correo: process.env.VITE_RESPONSABLE_CORREO || base.correo,
};
const faltan = Object.entries(responsable)
  .filter(([, v]) => !v?.trim())
  .map(([k]) => `responsable.${k}`);
if (!sinListaEspera && !process.env.VITE_LISTA_ESPERA_URL?.trim()) faltan.push('VITE_LISTA_ESPERA_URL');

if (faltan.length) {
  console.error(`No se puede publicar: faltan ${faltan.join(', ')}.`);
  process.exit(1);
}
console.log(
  sinListaEspera
    ? `Listo para publicar (sin lista de espera): responsable ${responsable.nombre}.`
    : `Listo para publicar: responsable ${responsable.nombre}; la lista de espera tiene URL.`,
);
