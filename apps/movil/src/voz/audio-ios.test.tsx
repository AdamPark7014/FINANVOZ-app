import * as Speech from 'expo-speech';
import { AccessibilityInfo, Platform } from 'react-native';
import { motorExpo } from './motor-expo';
import { decirEnVoz } from './respuesta';

/** Módulo nativo falso de expo-speech-recognition: solo lo que usa `motorExpo.iniciar`. */
const mockReconocedor = { start: jest.fn() };
jest.mock('expo', () => ({ requireOptionalNativeModule: () => mockReconocedor }));
jest.mock('expo-speech', () => ({ speak: jest.fn(), stop: jest.fn() }));

afterEach(() => {
  jest.restoreAllMocks();
  jest.mocked(Speech.speak).mockClear();
});

/** `decirEnVoz` espera a saber si hay lector de pantalla. */
const asentar = () => new Promise((r) => setImmediate(r));

describe('Sesión de audio de iPhone tras dictar (la respuesta no debe salir baja ni por el auricular)', () => {
  it('el reconocedor graba y reproduce en modo "default", con bocina y Bluetooth', () => {
    motorExpo.iniciar({ idioma: 'es-MX', resultadosParciales: true, enDispositivo: true });
    expect(mockReconocedor.start).toHaveBeenCalledWith(
      expect.objectContaining({
        lang: 'es-MX',
        iosCategory: {
          category: 'playAndRecord',
          categoryOptions: ['defaultToSpeaker', 'allowBluetooth'],
          mode: 'default',
        },
      }),
    );
  });

  it('iPhone: la respuesta en voz usa su propia sesión de audio', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);
    decirEnVoz('Registré: coca veinticinco pesos.');
    await asentar();
    expect(Speech.speak).toHaveBeenCalledWith('Registré: coca veinticinco pesos.', {
      language: 'es-MX',
      useApplicationAudioSession: false,
    });
  });

  it('Android: sin opciones de iOS', async () => {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);
    decirEnVoz('Listo.');
    await asentar();
    expect(Speech.speak).toHaveBeenCalledWith('Listo.', { language: 'es-MX' });
  });
});
