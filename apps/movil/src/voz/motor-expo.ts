import { requireOptionalNativeModule } from 'expo';
import type { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import type { CodigoErrorMotor, MotorDictado } from './motor';

type ModuloNativo = typeof ExpoSpeechRecognitionModule;

let cache: ModuloNativo | null | undefined;

/**
 * Carga perezosa del módulo nativo: importar este archivo no exige que exista (Jest, web,
 * builds sin el plugin). Si falta, el motor se reporta no disponible y la UI ofrece escribir.
 */
function modulo(): ModuloNativo | null {
  if (cache === undefined) {
    cache = requireOptionalNativeModule<ModuloNativo>('ExpoSpeechRecognition');
  }
  return cache;
}

/** Reconocedor real sobre expo-speech-recognition. */
export const motorExpo: MotorDictado = {
  disponible() {
    const m = modulo();
    return m !== null && m.isRecognitionAvailable();
  },
  soportaEnDispositivo() {
    return modulo()?.supportsOnDeviceRecognition() ?? false;
  },
  async solicitarPermiso() {
    const m = modulo();
    if (!m) return false;
    const r = await m.requestPermissionsAsync();
    return r.granted;
  },
  iniciar({ idioma, resultadosParciales, enDispositivo }) {
    modulo()?.start({
      lang: idioma,
      interimResults: resultadosParciales,
      requiresOnDeviceRecognition: enDispositivo,
      continuous: false,
      addsPunctuation: false,
      maxAlternatives: 1,
    });
  },
  detener() {
    modulo()?.stop();
  },
  abortar() {
    modulo()?.abort();
  },
  suscribir(alEvento) {
    const m = modulo();
    if (!m) return () => {};
    const subs = [
      m.addListener('start', () => alEvento({ tipo: 'inicio' })),
      m.addListener('result', (e) =>
        alEvento({ tipo: 'resultado', texto: e.results[0]?.transcript ?? '', final: e.isFinal }),
      ),
      m.addListener('nomatch', () => alEvento({ tipo: 'sin_coincidencia' })),
      m.addListener('error', (e) => alEvento({ tipo: 'error', codigo: e.error as CodigoErrorMotor })),
      m.addListener('end', () => alEvento({ tipo: 'fin' })),
    ];
    return () => subs.forEach((s) => s.remove());
  },
};
