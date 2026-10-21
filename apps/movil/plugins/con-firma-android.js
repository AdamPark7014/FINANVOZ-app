// Config plugin: firma de release con la llave de subida de Google Play (flujo «Android · Play»).
//
// En `expo prebuild`, si el entorno trae las cuatro variables FINANVOZ_KEYSTORE_PATH,
// FINANVOZ_KEYSTORE_PASSWORD, FINANVOZ_KEY_ALIAS y FINANVOZ_KEY_PASSWORD, inyecta en
// android/app/build.gradle un `signingConfigs.release` que las lee con `System.getenv(...)` cuando
// Gradle compila (nunca el valor literal en el archivo) y apunta `buildTypes.release` a esa firma.
// Sin las variables no toca nada: el APK de apk.yml sigue firmado con la llave de depuración.
//
// `@expo/config-plugins` no es dependencia directa de apps/movil; se toma por `expo/config-plugins`,
// que es el mismo paquete reexportado por el SDK.
const { withAppBuildGradle } = require('expo/config-plugins');

/** Variables de entorno que alimentan la firma (nombre de cada campo de Gradle → variable). */
const VARIABLES = Object.freeze({
  storeFile: 'FINANVOZ_KEYSTORE_PATH',
  storePassword: 'FINANVOZ_KEYSTORE_PASSWORD',
  keyAlias: 'FINANVOZ_KEY_ALIAS',
  keyPassword: 'FINANVOZ_KEY_PASSWORD',
});

const MARCA_INICIO = '// @generated begin finanvoz-firma';
const MARCA_FIN = '// @generated end finanvoz-firma';

/** `true` si las cuatro variables existen y no están vacías. */
function firmaConfigurada(entorno = process.env) {
  return Object.values(VARIABLES).every((nombre) => {
    const valor = entorno[nombre];
    return typeof valor === 'string' && valor.trim() !== '';
  });
}

/** Índice de la llave que cierra el bloque abierto en `indiceLlaveAbre`. */
function finDeBloque(texto, indiceLlaveAbre) {
  let nivel = 0;
  for (let i = indiceLlaveAbre; i < texto.length; i++) {
    const c = texto[i];
    if (c === '{') nivel++;
    else if (c === '}') {
      nivel--;
      if (nivel === 0) return i;
    }
  }
  throw new Error('con-firma-android: build.gradle tiene un bloque sin cerrar');
}

function bloqueRelease() {
  return [
    `        ${MARCA_INICIO} — llave de subida de Play; los valores se leen del entorno al compilar (apps/movil/plugins/con-firma-android.js)`,
    '        release {',
    `            def rutaLlaveSubida = System.getenv('${VARIABLES.storeFile}')`,
    `            if (!rutaLlaveSubida) throw new GradleException('Falta ${VARIABLES.storeFile}: exporta las variables FINANVOZ_KEYSTORE_* o vuelve a correr expo prebuild sin ellas.')`,
    '            storeFile file(rutaLlaveSubida)',
    `            storePassword System.getenv('${VARIABLES.storePassword}')`,
    `            keyAlias System.getenv('${VARIABLES.keyAlias}')`,
    `            keyPassword System.getenv('${VARIABLES.keyPassword}')`,
    '        }',
    `        ${MARCA_FIN}`,
  ].join('\n');
}

/** Devuelve el build.gradle (Groovy) con `signingConfigs.release` y `buildTypes.release` apuntando a él. */
function agregarFirma(gradle) {
  if (gradle.includes(MARCA_INICIO)) return gradle; // ya inyectado

  const buildTypes = /\bbuildTypes\s*\{/.exec(gradle);
  if (!buildTypes) throw new Error('con-firma-android: build.gradle no tiene bloque buildTypes');

  // 1) signingConfigs.release (dentro del bloque existente o en uno nuevo antes de buildTypes).
  let texto;
  const signingConfigs = /\bsigningConfigs\s*\{/.exec(gradle);
  if (signingConfigs) {
    const cierre = finDeBloque(gradle, signingConfigs.index + signingConfigs[0].length - 1);
    const inicioLineaCierre = gradle.lastIndexOf('\n', cierre) + 1; // el bloque entra en su propia línea
    texto = `${gradle.slice(0, inicioLineaCierre)}${bloqueRelease()}\n${gradle.slice(inicioLineaCierre)}`;
  } else {
    texto = `${gradle.slice(0, buildTypes.index)}signingConfigs {\n${bloqueRelease()}\n    }\n    ${gradle.slice(buildTypes.index)}`;
  }

  // 2) buildTypes.release.signingConfig → signingConfigs.release (solo dentro de release, debug queda igual).
  const inicioBuildTypes = /\bbuildTypes\s*\{/.exec(texto);
  const finBuildTypes = finDeBloque(texto, inicioBuildTypes.index + inicioBuildTypes[0].length - 1);
  const cuerpo = texto.slice(inicioBuildTypes.index, finBuildTypes);
  const release = /\brelease\s*\{/.exec(cuerpo);
  if (!release) throw new Error('con-firma-android: buildTypes no tiene bloque release');
  const inicioRelease = inicioBuildTypes.index + release.index;
  const finRelease = finDeBloque(texto, inicioRelease + release[0].length - 1);
  let bloque = texto.slice(inicioRelease, finRelease);
  const firma = /\bsigningConfig\s+signingConfigs\.\w+/;
  bloque = firma.test(bloque)
    ? bloque.replace(firma, 'signingConfig signingConfigs.release')
    : bloque.replace(release[0], `${release[0]}\n            signingConfig signingConfigs.release`);
  return texto.slice(0, inicioRelease) + bloque + texto.slice(finRelease);
}

function conFirmaAndroid(config) {
  if (!firmaConfigurada()) return config;
  return withAppBuildGradle(config, (c) => {
    if (c.modResults.language !== 'groovy') {
      throw new Error('con-firma-android: solo sabe editar android/app/build.gradle en Groovy');
    }
    c.modResults.contents = agregarFirma(c.modResults.contents);
    return c;
  });
}

module.exports = conFirmaAndroid;
module.exports.agregarFirma = agregarFirma;
module.exports.firmaConfigurada = firmaConfigurada;
module.exports.VARIABLES = VARIABLES;
module.exports.MARCA_INICIO = MARCA_INICIO;
