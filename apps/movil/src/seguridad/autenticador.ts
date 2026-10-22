import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

export type ErrorAutenticacion =
  /** La persona canceló; se le vuelve a ofrecer "Desbloquear". */
  | 'cancelado'
  /** Demasiados intentos fallidos; el sistema la bloqueó un rato. */
  | 'demasiados_intentos'
  /** El teléfono no tiene biometría ni PIN configurado. */
  | 'sin_seguridad'
  | 'fallo';

export type ResultadoAutenticacion = { exito: true } | { exito: false; error: ErrorAutenticacion };

export interface Autenticador {
  /** `true` si el teléfono tiene biometría o PIN/patrón/contraseña para desbloquear. */
  disponible(): Promise<boolean>;
  autenticar(): Promise<ResultadoAutenticacion>;
}

export const MENSAJES_AUTENTICACION: Record<ErrorAutenticacion, string> = {
  cancelado: 'Toca Desbloquear para entrar.',
  demasiados_intentos: 'Hubo muchos intentos. Espera un momento e intenta de nuevo.',
  sin_seguridad:
    Platform.OS === 'ios'
      ? 'Tu iPhone no tiene código. Configúralo en Ajustes › Face ID y código para usar el bloqueo.'
      : 'Tu teléfono no tiene bloqueo de pantalla. Configura un PIN o tu huella en los ajustes del teléfono para entrar.',
  fallo: 'No pude verificar que eres tú. Intenta de nuevo.',
};

/** En iPhone se habla de Face ID y del código, no de huella ni PIN. */
export const MENSAJES_AUTENTICACION_IOS: Record<ErrorAutenticacion, string> = {
  ...MENSAJES_AUTENTICACION,
  sin_seguridad:
    'Tu iPhone no tiene código. Ponle uno en Ajustes › Face ID y código para usar el bloqueo de Finanvoz.',
};

/** Mensaje de un error de autenticación con las palabras de la plataforma (`os` inyectable en pruebas). */
export function mensajeAutenticacion(error: ErrorAutenticacion, os: string = Platform.OS): string {
  return (os === 'ios' ? MENSAJES_AUTENTICACION_IOS : MENSAJES_AUTENTICACION)[error];
}

/** Texto del botón de respaldo cuando falla la biometría: «Usar código» en iPhone, «Usar PIN» en Android. */
export function etiquetaRespaldoAutenticacion(os: string = Platform.OS): string {
  return os === 'ios' ? 'Usar código' : 'Usar PIN';
}

function traducir(error: LocalAuthentication.LocalAuthenticationError): ErrorAutenticacion {
  switch (error) {
    case 'user_cancel':
    case 'system_cancel':
    case 'app_cancel':
    case 'user_fallback':
      return 'cancelado';
    case 'lockout':
      return 'demasiados_intentos';
    case 'not_enrolled':
    case 'passcode_not_set':
    case 'not_available':
      return 'sin_seguridad';
    default:
      return 'fallo';
  }
}

/** Biometría con respaldo del PIN, patrón o contraseña del sistema (RF-CFG-03). */
export const autenticadorExpo: Autenticador = {
  async disponible() {
    const nivel = await LocalAuthentication.getEnrolledLevelAsync();
    return nivel !== LocalAuthentication.SecurityLevel.NONE;
  },
  async autenticar() {
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Desbloquea Finanvoz',
      cancelLabel: 'Cancelar',
      fallbackLabel: etiquetaRespaldoAutenticacion(),
      disableDeviceFallback: false,
    });
    return r.success ? { exito: true } : { exito: false, error: traducir(r.error) };
  },
};
