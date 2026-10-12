import { Linking } from 'react-native';
import { crearPuertoExpo } from '../../servicios';
import type { Notificaciones, PermisoAvisos } from './notificaciones';

type ModuloExpo = typeof import('expo-notifications');

function traducir(p: Awaited<ReturnType<ModuloExpo['getPermissionsAsync']>>): PermisoAvisos {
  if (p.granted) return 'concedido';
  return p.status === 'undetermined' || p.canAskAgain ? 'sin_preguntar' : 'denegado';
}

/**
 * Notificaciones locales con `expo-notifications` (solo programadas en el teléfono; nada de push ni tokens).
 * El módulo se carga aquí y no al importar: donde no existe (Expo Go, pruebas) la app sigue sin avisos.
 */
export function crearNotificacionesExpo(): Notificaciones | null {
  let N: ModuloExpo;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- carga perezosa del módulo nativo
    N = require('expo-notifications') as ModuloExpo;
  } catch {
    return null;
  }
  N.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  const puerto = crearPuertoExpo({
    scheduleNotificationAsync: (s) =>
      N.scheduleNotificationAsync({
        identifier: s.identifier,
        content: s.content,
        trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: s.trigger.date },
      }),
    cancelScheduledNotificationAsync: (id) => N.cancelScheduledNotificationAsync(id),
    getAllScheduledNotificationsAsync: async () =>
      (await N.getAllScheduledNotificationsAsync()).map((n) => ({
        identifier: n.identifier,
        content: { title: n.content.title, body: n.content.body, data: n.content.data ?? null },
      })),
  });
  return {
    puerto,
    permiso: async () => traducir(await N.getPermissionsAsync()),
    pedirPermiso: async () => traducir(await N.requestPermissionsAsync()),
    abrirAjustesSistema: () => void Linking.openSettings(),
  };
}
