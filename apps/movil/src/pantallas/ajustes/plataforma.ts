/**
 * Textos por plataforma (iPhone o Android) sin mentir en ninguna: como `Platform.select`, pero leído en cada llamada
 * y con la plataforma inyectable, para que las pruebas revisen la redacción de iPhone desde jest (cuyo preset de
 * Android deja `Platform.select` fijo en `android`).
 *
 * `react-native` se carga perezosamente: los `textos.ts` que usan esto también corren en Vitest (Node), donde
 * `react-native` no se puede cargar; ahí cuenta como Android, igual que el preset de jest.
 */
export type Plataforma = 'ios' | 'android';

function osDelTelefono(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- carga perezosa (ver arriba)
    return (require('react-native') as typeof import('react-native')).Platform.OS;
  } catch {
    return 'android';
  }
}

export function plataformaActual(): Plataforma {
  return osDelTelefono() === 'ios' ? 'ios' : 'android';
}

export function segunPlataforma<T>(opciones: { ios: T; android: T }, os: string = osDelTelefono()): T {
  return os === 'ios' ? opciones.ios : opciones.android;
}
