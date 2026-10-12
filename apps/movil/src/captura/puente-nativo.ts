import { requireOptionalNativeModule } from 'expo';
import type { ModuloCapturaNativo } from './puente';

/**
 * Carga el módulo nativo `CapturaAndroid` (modules/captura-android). Devuelve `null` donde no
 * existe: Jest, Expo Go, iOS, web o un build sin el plugin. Separado de `puente.ts` para que las
 * pruebas en Node no importen `expo`.
 */
export function cargarModuloNativo(): ModuloCapturaNativo | null {
  return requireOptionalNativeModule<ModuloCapturaNativo>('CapturaAndroid');
}
