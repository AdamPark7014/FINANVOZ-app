// Config plugin de la captura (docs/07-CAPTURA.md §2.1). Inyecta en el manifiesto de la app:
// - el NotificationListenerService con BIND_NOTIFICATION_LISTENER_SERVICE;
// - <queries> con un <package> por cada paquete del catálogo de bancos, para poder saber qué
//   apps de banco están instaladas sin QUERY_ALL_PACKAGES (permiso restringido en Google Play).
const fs = require('node:fs');
const path = require('node:path');
const { withAndroidManifest } = require('@expo/config-plugins');

const SERVICIO = 'com.finanvoz.captura.CapturaListenerService';
const PERMISO_ENLACE = 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE';
const ACCION = 'android.service.notification.NotificationListenerService';
const PERMISOS_PROHIBIDOS = ['android.permission.QUERY_ALL_PACKAGES'];
const RUTA_CATALOGO = path.join(__dirname, '..', 'android', 'src', 'main', 'assets', 'captura.bancos.json');

/** Paquetes del catálogo embebido (sin repetir, en orden). */
function paquetesDelCatalogo(ruta = RUTA_CATALOGO) {
  const catalogo = JSON.parse(fs.readFileSync(ruta, 'utf8'));
  const paquetes = [];
  for (const banco of catalogo.bancos) {
    for (const p of banco.paquetes_android) if (!paquetes.includes(p)) paquetes.push(p);
  }
  return paquetes;
}

/** Modifica el manifiesto (formato xml2js de @expo/config-plugins) y lo devuelve. */
function agregarCaptura(manifiesto, paquetes) {
  const raiz = manifiesto.manifest;
  const aplicacion = raiz.application?.[0];
  if (!aplicacion) throw new Error('captura-android: el manifiesto no tiene <application>');

  aplicacion.service = (aplicacion.service ?? []).filter((s) => s.$?.['android:name'] !== SERVICIO);
  aplicacion.service.push({
    $: {
      'android:name': SERVICIO,
      'android:label': '@string/captura_nombre_servicio',
      'android:permission': PERMISO_ENLACE,
      'android:exported': 'true',
    },
    'intent-filter': [{ action: [{ $: { 'android:name': ACCION } }] }],
  });

  raiz.queries = raiz.queries ?? [];
  const yaDeclarados = new Set(
    raiz.queries.flatMap((q) => (q.package ?? []).map((p) => p.$?.['android:name'])),
  );
  const nuevos = paquetes.filter((p) => !yaDeclarados.has(p));
  if (nuevos.length > 0) {
    raiz.queries.push({ package: nuevos.map((p) => ({ $: { 'android:name': p } })) });
  }

  if (raiz['uses-permission']) {
    raiz['uses-permission'] = raiz['uses-permission'].filter(
      (u) => !PERMISOS_PROHIBIDOS.includes(u.$?.['android:name']),
    );
  }
  return manifiesto;
}

function conCaptura(config) {
  return withAndroidManifest(config, (c) => {
    c.modResults = agregarCaptura(c.modResults, paquetesDelCatalogo());
    return c;
  });
}

module.exports = conCaptura;
module.exports.agregarCaptura = agregarCaptura;
module.exports.paquetesDelCatalogo = paquetesDelCatalogo;
module.exports.SERVICIO = SERVICIO;
