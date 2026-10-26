import { Appearance, useColorScheme } from 'react-native';
import { colores, type Colores, type EsquemaColor } from './tokens';

export interface Tema {
  esquema: EsquemaColor;
  c: Colores;
}

/**
 * Tema de la pantalla. Lo decide `aplicarApariencia` (claro por omisión, oscuro o como el teléfono; `02 §16`):
 * `useColorScheme` ya trae el esquema fijado, así que aquí solo se lee.
 */
export function useTema(): Tema {
  const esquema: EsquemaColor = useColorScheme() === 'dark' ? 'oscuro' : 'claro';
  return { esquema, c: colores[esquema] };
}

/** Lo que se elige en Ajustes › Apariencia: un esquema fijo o `sistema` («Como el teléfono»). */
export type PreferenciaApariencia = EsquemaColor | 'sistema';

/**
 * Fija la apariencia de toda la app, también lo nativo (teclado, alertas, barra de estado y hojas): claro u oscuro
 * aunque el teléfono diga otra cosa, o `sistema` para seguir al teléfono. Para que «Como el teléfono» funcione en
 * iPhone, `app.json` se queda con `userInterfaceStyle: "automatic"`.
 */
export function aplicarApariencia(preferencia: PreferenciaApariencia): void {
  Appearance.setColorScheme(
    preferencia === 'oscuro' ? 'dark' : preferencia === 'sistema' ? 'unspecified' : 'light',
  );
}
