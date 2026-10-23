import * as Speech from 'expo-speech';
import { AccessibilityInfo, Platform } from 'react-native';
import type { TurnoAsistente } from '../asistente/tipos';
import { olvidarVoces } from './catalogo';
import { motorExpo } from './motor-expo';
import { callarVoz, configurarVoz, CONFIG_VOZ_INICIAL, decirEnVoz, decirTurno, hablar } from './respuesta';
import type { VozSistema } from './voces';

/** Módulo nativo falso de expo-speech-recognition: arranque y sesión de audio de iPhone. */
const mockReconocedor = {
  start: jest.fn(),
  setCategoryIOS: jest.fn(),
  setAudioSessionActiveIOS: jest.fn(),
};
jest.mock('expo', () => ({ requireOptionalNativeModule: () => mockReconocedor }));
jest.mock('expo-speech', () => ({ speak: jest.fn(), stop: jest.fn(), getAvailableVoicesAsync: jest.fn() }));
const mockRed = { isConnected: true, isInternetReachable: true as boolean | null };
jest.mock('expo-network', () => ({ getNetworkStateAsync: jest.fn(async () => mockRed) }));

const voz = (identifier: string, language: string, quality = 'Default'): VozSistema => ({
  identifier,
  name: identifier.split('.').at(-1) ?? identifier,
  language,
  quality,
});
const VOCES_IPHONE = [
  voz('com.apple.voice.compact.es-MX.Paulina', 'es-MX'),
  voz('com.apple.voice.enhanced.es-MX.Paulina', 'es-MX', 'Enhanced'),
];
const VOCES_ANDROID = [
  voz('es-us-x-sfb-network', 'es-US', 'Enhanced'),
  voz('es-us-x-sfb-local', 'es-US', 'Enhanced'),
];

let lector = false;

beforeEach(() => {
  olvidarVoces();
  configurarVoz(CONFIG_VOZ_INICIAL);
  lector = false;
  mockRed.isInternetReachable = true;
  jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockImplementation(async () => lector);
  jest.mocked(Speech.getAvailableVoicesAsync).mockResolvedValue(VOCES_ANDROID as Speech.Voice[]);
});

afterEach(() => {
  callarVoz();
  jest.restoreAllMocks();
  jest.mocked(Speech.speak).mockClear();
  jest.mocked(Speech.stop).mockClear();
  mockReconocedor.setCategoryIOS.mockReset();
  mockReconocedor.setAudioSessionActiveIOS.mockReset();
});

/** `hablar` espera al lector de pantalla, las voces y la red antes de hablar. */
const asentar = async () => {
  for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r));
};

/** Opciones de la última llamada a `Speech.speak`. */
const ultimaHabla = () => {
  const llamada = jest.mocked(Speech.speak).mock.calls.at(-1);
  if (!llamada) throw new Error('no habló');
  return { texto: llamada[0], o: llamada[1] ?? {} };
};

const enIPhone = () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  jest.mocked(Speech.getAvailableVoicesAsync).mockResolvedValue(VOCES_IPHONE as Speech.Voice[]);
};

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

  it('iPhone: la mejor voz (Paulina mejorada), ritmo natural y sesión `ambient` que respeta el modo silencio', async () => {
    enIPhone();
    const fin = hablar('Listo, coca de veinticinco en efectivo.');
    await asentar();
    expect(mockReconocedor.setCategoryIOS).toHaveBeenCalledWith({
      category: 'ambient',
      categoryOptions: [],
      mode: 'default',
    });
    expect(mockReconocedor.setAudioSessionActiveIOS).toHaveBeenCalledWith(true);
    const { texto, o } = ultimaHabla();
    expect(texto).toBe('Listo, coca de veinticinco en efectivo.');
    expect(o).toMatchObject({
      language: 'es-MX',
      voice: 'com.apple.voice.enhanced.es-MX.Paulina',
      rate: 0.95,
      pitch: 1,
      useApplicationAudioSession: true,
    });
    o.onDone?.();
    await expect(fin).resolves.toBe('dicha');
    // Con `ambient` no se baja la música: no hay que soltar la sesión.
    expect(mockReconocedor.setAudioSessionActiveIOS).not.toHaveBeenCalledWith(false, expect.anything());
  });

  it('iPhone con «Hablar aunque esté en silencio»: `playback`, baja la música y la regresa al terminar', async () => {
    enIPhone();
    configurarVoz({ enSilencio: true, velocidad: 'pausada' });
    const fin = hablar('Listo.');
    await asentar();
    expect(mockReconocedor.setCategoryIOS).toHaveBeenCalledWith({
      category: 'playback',
      categoryOptions: ['duckOthers'],
      mode: 'default',
    });
    expect(ultimaHabla().o).toMatchObject({ rate: 0.85 });
    ultimaHabla().o.onDone?.();
    await expect(fin).resolves.toBe('dicha');
    expect(mockReconocedor.setAudioSessionActiveIOS).toHaveBeenLastCalledWith(false, {
      notifyOthersOnDeactivation: true,
    });
  });

  it('iPhone: si iOS no deja cambiar la sesión, habla con la suya propia (como antes)', async () => {
    enIPhone();
    mockReconocedor.setCategoryIOS.mockImplementation(() => {
      throw new Error('ocupada');
    });
    void decirEnVoz('Listo.');
    await asentar();
    expect(ultimaHabla().o).toMatchObject({ useApplicationAudioSession: false });
  });

  it('Android: sin opciones de iOS; con internet la voz de red de Google, sin internet la local', async () => {
    void hablar('Listo.');
    await asentar();
    expect(ultimaHabla().o).toMatchObject({ language: 'es-MX', voice: 'es-us-x-sfb-network', rate: 0.95 });
    expect(ultimaHabla().o).not.toHaveProperty('useApplicationAudioSession');
    expect(mockReconocedor.setCategoryIOS).not.toHaveBeenCalled();
    mockRed.isInternetReachable = false;
    void hablar('Otra vez.');
    await asentar();
    expect(ultimaHabla().o).toMatchObject({ voice: 'es-us-x-sfb-local' });
  });

  it('sin voces ni módulo de voces: habla con la del sistema', async () => {
    jest.mocked(Speech.getAvailableVoicesAsync).mockRejectedValue(new Error('sin motor'));
    void hablar('Listo.');
    await asentar();
    expect(ultimaHabla().o).not.toHaveProperty('voice');
    expect(ultimaHabla().o).toMatchObject({ language: 'es-MX', rate: 0.9, pitch: 1 });
  });
});

describe('Una frase a la vez, y se corta al tocar o al volver a hablar', () => {
  it('con VoiceOver o TalkBack no habla, salvo que la persona lo pida («Escuchar»)', async () => {
    lector = true;
    await expect(hablar('Listo.')).resolves.toBe('omitida');
    expect(Speech.speak).not.toHaveBeenCalled();
    void hablar('Listo.', { forzar: true });
    await asentar();
    expect(Speech.speak).toHaveBeenCalledTimes(1);
  });

  it('callarVoz corta la que suena (quien la esperaba recibe «cortada») y la que iba a empezar', async () => {
    const primera = hablar('Listo, coca de veinticinco.');
    await asentar();
    callarVoz();
    await expect(primera).resolves.toBe('cortada');
    expect(Speech.stop).toHaveBeenCalled();
    const segunda = hablar('Esta no alcanza a sonar.');
    callarVoz();
    await expect(segunda).resolves.toBe('cortada');
    await asentar();
    expect(Speech.speak).toHaveBeenCalledTimes(1);
  });

  it('una frase nueva corta la anterior', async () => {
    const primera = hablar('Primera.');
    await asentar();
    const segunda = hablar('Segunda.');
    await expect(primera).resolves.toBe('cortada');
    await asentar();
    expect(ultimaHabla().texto).toBe('Segunda.');
    ultimaHabla().o.onDone?.();
    await expect(segunda).resolves.toBe('dicha');
  });

  it('decirTurno dice la frase del turno (no el texto de la pantalla); los de la persona no', async () => {
    const turno: TurnoAsistente = {
      id: 'r',
      de: 'asistente',
      clase: 'registro',
      texto: 'Registré Coca $25 · Antojos · Efectivo.',
      cambioDia: 'Tu día pasa de $214 a $189.',
    };
    void decirTurno(turno);
    await asentar();
    expect(ultimaHabla().texto).toBe(
      'Listo, coca de veinticinco en efectivo. Te quedan ciento ochenta y nueve para hoy.',
    );
    await expect(decirTurno({ de: 'persona' })).resolves.toBe('omitida');
  });
});
