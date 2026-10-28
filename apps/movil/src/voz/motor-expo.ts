import { requireOptionalNativeModule } from 'expo';
import type { ExpoSpeechRecognitionModule, SetCategoryOptions } from 'expo-speech-recognition';
import { nivelDeVolumen, type CodigoErrorMotor, type MotorDictado } from './motor';

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

/**
 * Sesión de audio de iPhone mientras se dicta. La de omisión de expo-speech-recognition usa el modo
 * `measurement`, que apaga el procesamiento de salida, y su `reset()` no la desactiva al terminar: la respuesta
 * en voz salía muy baja. Con `default` (y la bocina por omisión) lo que se dice después se oye normal.
 * Android lo ignora. Pendiente de probar en un iPhone real (TestFlight).
 */
export const CATEGORIA_AUDIO_IOS: Readonly<SetCategoryOptions> = {
  category: 'playAndRecord',
  categoryOptions: ['defaultToSpeaker', 'allowBluetooth'],
  mode: 'default',
};

/**
 * Sesión de audio de iPhone para la respuesta hablada. `ambient` respeta el interruptor de silencio (el sistema la
 * calla) y se mezcla con la música sin cortarla. Siempre por la bocina, nunca por el auricular.
 */
export const CATEGORIA_RESPUESTA_IOS: Readonly<SetCategoryOptions> = {
  category: 'ambient',
  categoryOptions: [],
  mode: 'default',
};

/**
 * Para hablar aunque el iPhone esté en silencio (Ajustes › Voz, o al tocar «Escuchar»): `playback` no obedece al
 * interruptor; `duckOthers` baja la música mientras habla y `soltarAudioRespuestaIOS` la regresa al terminar.
 */
export const CATEGORIA_RESPUESTA_SILENCIO_IOS: Readonly<SetCategoryOptions> = {
  category: 'playback',
  categoryOptions: ['duckOthers'],
  mode: 'default',
};

/**
 * Prepara la sesión de audio de la app antes de hablar en iPhone. `true`: la respuesta debe usar la sesión de la
 * app (`useApplicationAudioSession: true`); `false` (Android, sin módulo nativo o si iOS no lo permitió): que
 * `expo-speech` use su propia sesión, como antes.
 */
export function prepararAudioRespuestaIOS(enSilencio: boolean): boolean {
  const m = modulo();
  if (!m) return false;
  const c = enSilencio ? CATEGORIA_RESPUESTA_SILENCIO_IOS : CATEGORIA_RESPUESTA_IOS;
  try {
    m.setCategoryIOS({ ...c, categoryOptions: [...c.categoryOptions] });
    m.setAudioSessionActiveIOS(true);
    return true;
  } catch {
    return false;
  }
}

/** Tras hablar con `duckOthers`: suelta la sesión para que la música vuelva a su volumen. */
export function soltarAudioRespuestaIOS(): void {
  try {
    modulo()?.setAudioSessionActiveIOS(false, { notifyOthersOnDeactivation: true });
  } catch {
    // Otra parte de la app sigue usando el audio (p. ej. el micrófono ya empezó): se queda activa.
  }
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
      iosCategory: { ...CATEGORIA_AUDIO_IOS, categoryOptions: [...CATEGORIA_AUDIO_IOS.categoryOptions] },
      // La onda de «Te escucho» (D2) sigue el volumen; solo el nivel, cada 100 ms.
      volumeChangeEventOptions: { enabled: true, intervalMillis: 100 },
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
  suscribirVolumen(alNivel) {
    const m = modulo();
    if (!m) return () => {};
    const sub = m.addListener('volumechange', (e) => alNivel(nivelDeVolumen(e.value)));
    return () => sub.remove();
  },
};
