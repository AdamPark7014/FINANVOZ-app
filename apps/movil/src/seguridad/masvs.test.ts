import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { leerConfigPosthog } from '../analitica/posthog';
import { leerConfigNube } from '../nube/config';

/**
 * OWASP MASVS L1 (`03 §7`, `08 §7.1`): los controles que se pueden comprobar en el código y la configuración.
 * Lo que necesita el teléfono (abrir la base sin llave, `adb backup`, captura de pantalla) queda en ESTADO.
 */
const APP = fileURLToPath(new URL('../..', import.meta.url));
const appJson = JSON.parse(readFileSync(join(APP, 'app.json'), 'utf8')) as {
  expo: {
    android: {
      allowBackup?: boolean;
      permissions?: string[];
      blockedPermissions?: string[];
      usesCleartextTraffic?: boolean;
    };
    plugins: (string | [string, Record<string, unknown>])[];
  };
};

/** Código que va en la app (sin pruebas, dobles ni scripts). */
function codigoDeLaApp(): { ruta: string; texto: string }[] {
  const lista: { ruta: string; texto: string }[] = [];
  const recorrer = (dir: string) => {
    for (const nombre of readdirSync(dir)) {
      const ruta = join(dir, nombre);
      if (statSync(ruta).isDirectory()) {
        if (nombre !== '__pruebas__') recorrer(ruta);
      } else if (/\.tsx?$/.test(nombre) && !/\.test\.tsx?$/.test(nombre) && nombre !== 'secretos.ts') {
        lista.push({ ruta: ruta.slice(APP.length), texto: readFileSync(ruta, 'utf8') });
      }
    }
  };
  recorrer(join(APP, 'src'));
  recorrer(join(APP, 'app'));
  return lista;
}

describe('MASVS L1 verificable en código', () => {
  it('STORAGE: la base no entra en los respaldos del sistema (allowBackup = false)', () => {
    expect(appJson.expo.android.allowBackup).toBe(false);
  });

  it('STORAGE/CRYPTO: SQLCipher activo y la llave en el almacén seguro, solo de este dispositivo', () => {
    const sqlite = appJson.expo.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-sqlite');
    expect(sqlite).toEqual(['expo-sqlite', { useSQLCipher: true }]);
    expect(appJson.expo.plugins).toContain('expo-secure-store');
    const expo = readFileSync(join(APP, 'src/db/expo.ts'), 'utf8');
    expect(expo).toMatch(/keychainAccessible: SecureStore\.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY/);
  });

  it('STORAGE: ningún console.* en el código de la app (nada de datos en logs, regla 9)', () => {
    const conLogs = codigoDeLaApp().filter((a) =>
      /\bconsole\.(log|info|warn|error|debug|trace)\s*\(/.test(a.texto),
    );
    expect(conLogs.map((a) => a.ruta)).toEqual([]);
  });

  it('NETWORK: todo sale por https; nada de tráfico en claro', () => {
    expect(appJson.expo.android.usesCleartextTraffic).not.toBe(true);
    const conHttp = codigoDeLaApp().filter((a) => /['"`]http:\/\//.test(a.texto));
    expect(conHttp.map((a) => a.ruta)).toEqual([]);
    expect(leerConfigNube({ supabaseUrl: 'http://abc.supabase.co', supabaseAnonKey: 'x' })).toBeNull();
    expect(
      leerConfigPosthog({ posthogKey: 'phc_x', posthogHost: 'http://us.i.posthog.com' }, undefined),
    ).toBeNull();
  });

  it('PLATFORM: permisos mínimos y sin acceso al almacenamiento compartido', () => {
    expect(appJson.expo.android.permissions).toEqual([
      'android.permission.RECORD_AUDIO',
      'android.permission.USE_BIOMETRIC',
      // M16: escanear en persona el QR del grupo compartido (02 §27); expo-camera sin micrófono.
      'android.permission.CAMERA',
    ]);
    const camara = appJson.expo.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-camera');
    // La cámara no graba audio en Android. En iOS no se puede dejar `microphonePermission: false`: el plugin de la
    // cámara se aplica después del de dictado y borraría NSMicrophoneUsageDescription (Apple rechazó la carga
    // 1.0.0 (2) con ITMS-90683). Lleva el mismo texto del dictado: un solo propósito para el micrófono.
    const dictado = appJson.expo.plugins.find(
      (p) => Array.isArray(p) && p[0] === 'expo-speech-recognition',
    ) as [string, { microphonePermission: string }] | undefined;
    expect(camara?.[1]).toMatchObject({
      recordAudioAndroid: false,
      microphonePermission: dictado?.[1].microphonePermission,
    });
    expect(appJson.expo.android.blockedPermissions).toEqual(
      expect.arrayContaining([
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
      ]),
    );
  });

  it('PLATFORM: el plugin de tareas en segundo plano está declarado (sin él, iOS no deja registrarlas)', () => {
    // `expo-background-task` escribe UIBackgroundModes `processing` y el identificador de BGTaskScheduler en el
    // Info.plist: sin eso no corren en iPhone la apertura del día ni el respaldo automático (`src/tareas/programar.ts`).
    expect(appJson.expo.plugins).toContain('expo-background-task');
  });

  it('CODE: ninguna llave de proveedor ni secreto en el código ni en la configuración', async () => {
    const { buscarSecretos } = await import('./secretos');
    const hallados = [...codigoDeLaApp(), { ruta: 'app.json', texto: JSON.stringify(appJson) }].filter(
      (a) => buscarSecretos(a.texto).length > 0,
    );
    expect(hallados.map((a) => a.ruta)).toEqual([]);
    expect(JSON.stringify(appJson.expo)).not.toMatch(/posthogKey|sentryDsn|supabaseAnonKey/);
  });
});
