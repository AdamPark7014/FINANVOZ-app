import { useColorScheme } from 'react-native';
import { colores, type Colores, type EsquemaColor } from './tokens';

export interface Tema {
  esquema: EsquemaColor;
  c: Colores;
}

/** Tema según la preferencia del sistema (modo oscuro desde v1, 02-UX §16). */
export function useTema(): Tema {
  const esquema: EsquemaColor = useColorScheme() === 'dark' ? 'oscuro' : 'claro';
  return { esquema, c: colores[esquema] };
}
