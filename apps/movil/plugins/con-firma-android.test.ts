import { createRequire } from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';

interface ModResults {
  path: string;
  language: 'groovy' | 'kt';
  contents: string;
}
interface Config {
  name: string;
  slug: string;
  mods?: {
    android?: {
      appBuildGradle?: (
        c: Config & { modRequest: object; modResults: ModResults },
      ) => Promise<Config & { modResults: ModResults }>;
    };
  };
}
interface Plugin {
  (config: Config): Config;
  agregarFirma(gradle: string): string;
  firmaConfigurada(entorno?: Record<string, string | undefined>): boolean;
  VARIABLES: Record<'storeFile' | 'storePassword' | 'keyAlias' | 'keyPassword', string>;
  MARCA_INICIO: string;
}

const plugin = createRequire(import.meta.url)('./con-firma-android.js') as Plugin;

/** Recorte del android/app/build.gradle que genera `expo prebuild` (plantilla de RN 0.86 / SDK 57). */
const GRADLE = `android {
    namespace 'com.finanvoz.app'
    defaultConfig {
        applicationId 'com.finanvoz.app'
        versionCode 1
        versionName "1.0.0"
    }
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug
            def enableShrinkResources = findProperty('android.enableShrinkResourcesInReleaseBuilds') ?: 'false'
            shrinkResources enableShrinkResources.toBoolean()
            minifyEnabled enableMinifyInReleaseBuilds
            proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"
        }
    }
    packagingOptions {
        jniLibs {
            useLegacyPackaging false
        }
    }
}
`;

const ENTORNO_COMPLETO: Record<string, string> = {
  FINANVOZ_KEYSTORE_PATH: 'C:/llaves/finanvoz-upload.jks',
  FINANVOZ_KEYSTORE_PASSWORD: 'secreto-almacen',
  FINANVOZ_KEY_ALIAS: 'finanvoz-upload',
  FINANVOZ_KEY_PASSWORD: 'secreto-llave',
};

function bloque(texto: string, inicio: RegExp): string {
  const m = inicio.exec(texto);
  if (!m) throw new Error(`no hay ${inicio}`);
  let nivel = 0;
  for (let i = m.index + m[0].length - 1; i < texto.length; i++) {
    if (texto[i] === '{') nivel++;
    if (texto[i] === '}' && --nivel === 0) return texto.slice(m.index, i + 1);
  }
  throw new Error('bloque sin cerrar');
}

afterEach(() => vi.unstubAllEnvs());

describe('agregarFirma (texto de build.gradle)', () => {
  it('agrega signingConfigs.release leyendo las cuatro variables con System.getenv, sin valores literales', () => {
    const g = plugin.agregarFirma(GRADLE);
    const firmas = bloque(g, /\bsigningConfigs\s*\{/);
    const release = bloque(firmas, /\brelease\s*\{/);
    for (const variable of Object.values(plugin.VARIABLES)) {
      expect(release).toContain(`System.getenv('${variable}')`);
    }
    expect(release).toMatch(/storeFile file\(/);
    expect(release).toMatch(/storePassword System\.getenv/);
    expect(release).toMatch(/keyAlias System\.getenv/);
    expect(release).toMatch(/keyPassword System\.getenv/);
    // El bloque debug sigue intacto.
    expect(bloque(firmas, /\bdebug\s*\{/)).toContain("storeFile file('debug.keystore')");
  });

  it('apunta buildTypes.release a signingConfigs.release y deja debug con la de depuración', () => {
    const g = plugin.agregarFirma(GRADLE);
    const tipos = bloque(g, /\bbuildTypes\s*\{/);
    const release = bloque(tipos, /\brelease\s*\{/);
    const debug = bloque(tipos, /\bdebug\s*\{/);
    expect(release).toContain('signingConfig signingConfigs.release');
    expect(release).not.toContain('signingConfigs.debug');
    expect(release).toContain('minifyEnabled enableMinifyInReleaseBuilds');
    expect(debug).toContain('signingConfig signingConfigs.debug');
    // Fuera de los bloques tocados, el archivo es el mismo.
    expect(g).toContain("namespace 'com.finanvoz.app'");
    expect(bloque(g, /\bpackagingOptions\s*\{/)).toBe(bloque(GRADLE, /\bpackagingOptions\s*\{/));
  });

  it('es idempotente: aplicarlo dos veces da el mismo texto', () => {
    const una = plugin.agregarFirma(GRADLE);
    expect(plugin.agregarFirma(una)).toBe(una);
    expect(una.split(plugin.MARCA_INICIO)).toHaveLength(2);
  });

  it('si la plantilla no trae signingConfigs, crea el bloque antes de buildTypes', () => {
    const sinFirmas = GRADLE.replace(bloque(GRADLE, /\bsigningConfigs\s*\{/), '');
    const g = plugin.agregarFirma(sinFirmas);
    expect(g.indexOf('signingConfigs {')).toBeGreaterThan(-1);
    expect(g.indexOf('signingConfigs {')).toBeLessThan(g.indexOf('buildTypes {'));
    expect(bloque(bloque(g, /\bbuildTypes\s*\{/), /\brelease\s*\{/)).toContain(
      'signingConfig signingConfigs.release',
    );
  });

  it('falla claro si no hay buildTypes', () => {
    expect(() => plugin.agregarFirma("android {\n    namespace 'x'\n}\n")).toThrow(/buildTypes/);
  });
});

describe('firmaConfigurada (variables de entorno)', () => {
  it('true solo con las cuatro variables no vacías', () => {
    expect(plugin.firmaConfigurada(ENTORNO_COMPLETO)).toBe(true);
    expect(plugin.firmaConfigurada({})).toBe(false);
    expect(plugin.firmaConfigurada({ ...ENTORNO_COMPLETO, FINANVOZ_KEY_PASSWORD: '' })).toBe(false);
    expect(plugin.firmaConfigurada({ ...ENTORNO_COMPLETO, FINANVOZ_KEYSTORE_PATH: '   ' })).toBe(false);
    const { FINANVOZ_KEY_ALIAS: _alias, ...sinAlias } = ENTORNO_COMPLETO;
    void _alias;
    expect(plugin.firmaConfigurada(sinAlias)).toBe(false);
  });
});

describe('plugin completo (withAppBuildGradle)', () => {
  it('sin variables devuelve la config tal cual y no registra ningún mod', () => {
    for (const nombre of Object.values(plugin.VARIABLES)) vi.stubEnv(nombre, '');
    const config: Config = { name: 'Finanvoz', slug: 'finanvoz' };
    const resultado = plugin(config);
    expect(resultado).toBe(config);
    expect(resultado.mods).toBeUndefined();
  });

  it('con variables registra el mod de android/app/build.gradle y éste inyecta la firma', async () => {
    for (const [nombre, valor] of Object.entries(ENTORNO_COMPLETO)) vi.stubEnv(nombre, valor);
    const config = plugin({ name: 'Finanvoz', slug: 'finanvoz' });
    const mod = config.mods?.android?.appBuildGradle;
    expect(mod).toBeTypeOf('function');
    if (!mod) return;
    const salida = await mod({
      ...config,
      modRequest: {},
      modResults: { path: 'android/app/build.gradle', language: 'groovy', contents: GRADLE },
    });
    expect(salida.modResults.contents).toContain('signingConfig signingConfigs.release');
    expect(salida.modResults.contents).toContain("System.getenv('FINANVOZ_KEYSTORE_PATH')");
    // Los valores del entorno jamás acaban en el gradle.
    for (const valor of Object.values(ENTORNO_COMPLETO))
      expect(salida.modResults.contents).not.toContain(valor);
  });

  it('rechaza un build.gradle.kts', async () => {
    for (const [nombre, valor] of Object.entries(ENTORNO_COMPLETO)) vi.stubEnv(nombre, valor);
    const config = plugin({ name: 'Finanvoz', slug: 'finanvoz' });
    const mod = config.mods?.android?.appBuildGradle;
    if (!mod) throw new Error('el mod no se registró');
    await expect(
      mod({
        ...config,
        modRequest: {},
        modResults: { path: 'build.gradle.kts', language: 'kt', contents: '' },
      }),
    ).rejects.toThrow(/Groovy/);
  });
});
