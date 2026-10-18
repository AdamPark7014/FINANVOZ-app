import { Linking } from 'react-native';
import { crearPuertoExpo } from '../../servicios';
import type { Notificaciones, PermisoAvisos, RespuestaAviso } from './notificaciones';

type ModuloExpo = typeof import('expo-notifications');
type RespuestaExpo = Parameters<Parameters<ModuloExpo['addNotificationResponseReceivedListener']>[0]>[0];

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
  // Solo el toque al aviso (no los botones de acción): id, ruta guardada y una clave única por toque.
  const aRespuesta = (r: RespuestaExpo): RespuestaAviso | null => {
    if (r.actionIdentifier !== N.DEFAULT_ACTION_IDENTIFIER) return null;
    const { identifier, content } = r.notification.request;
    return {
      id: identifier,
      ruta: content.data?.ruta ?? null,
      clave: `${identifier}@${r.notification.date}`,
    };
  };
  return {
    puerto,
    permiso: async () => traducir(await N.getPermissionsAsync()),
    pedirPermiso: async () => traducir(await N.requestPermissionsAsync()),
    abrirAjustesSistema: () => void Linking.openSettings(),
    respuestas: {
      suscribir: (alTocar) => {
        const s = N.addNotificationResponseReceivedListener((r) => {
          const t = aRespuesta(r);
          if (t) alTocar(t);
        });
        return () => s.remove();
      },
      ultima: async () => {
        const r = N.getLastNotificationResponse();
        return r ? aRespuesta(r) : null;
      },
      olvidarUltima: () => N.clearLastNotificationResponse(),
    },
  };
}
