/**
 * Contrato con el módulo nativo de captura (`modules/captura-android`, `07 §2.3`, `03 §5.2`): los tipos son los
 * de `puente.ts`. La ingesta y las pantallas dependen solo de esta forma; sin el módulo (Expo Go, pruebas,
 * iPhone) el puente responde `disponible() === false` y la captura aparece como no disponible.
 */
export type {
  AppBancaria,
  EstadoPermiso as EstadoPermisoCaptura,
  NotificacionCruda,
  PuenteCaptura,
} from './puente';

/** SHA-256 en hexadecimal (expo-crypto en la app, node:crypto en pruebas). */
export type Sha256Hex = (texto: string) => Promise<string>;
