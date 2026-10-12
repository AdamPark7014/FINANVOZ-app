import { CryptoDigestAlgorithm, CryptoEncoding, digestStringAsync } from 'expo-crypto';
import type { Sha256Hex } from './tipos';

/** SHA-256 en hexadecimal para la huella de captura (`07 §2.4`), en el teléfono. */
export const sha256Expo: Sha256Hex = (texto) =>
  digestStringAsync(CryptoDigestAlgorithm.SHA256, texto, { encoding: CryptoEncoding.HEX });
