#!/usr/bin/env node
// Bloquea el despliegue mientras el aviso de privacidad no identifique al responsable (CA-M0-07)
// o falte la URL de la lista de espera. Lo corre el flujo de despliegue antes de `vite build`.
const faltan = [
  'VITE_RESPONSABLE_NOMBRE',
  'VITE_RESPONSABLE_DOMICILIO',
  'VITE_RESPONSABLE_CORREO',
  'VITE_LISTA_ESPERA_URL',
].filter((v) => !process.env[v]?.trim());

if (faltan.length) {
  console.error(`No se puede publicar: faltan ${faltan.join(', ')} (docs/ESTADO.md, pendiente 1).`);
  process.exit(1);
}
console.log('Listo para publicar: el aviso identifica al responsable y la lista de espera tiene URL.');
