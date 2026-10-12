import type { PlainDate } from '@cartera/core';
import type { AvisoPlaneado, HoraDelDia } from './planificar';

/**
 * Puerto de notificaciones locales. La app lo implementa con `expo-notifications` (`crearPuertoExpo`); las
 * pruebas, con `puertoEnMemoria`. Solo maneja avisos ya planeados: nada de lógica de negocio aquí.
 */
export interface NotificacionLocal {
  readonly id: string;
  readonly fecha: PlainDate;
  readonly hora: HoraDelDia;
  readonly titulo: string;
  readonly cuerpo: string;
}

export interface PuertoNotificaciones {
  /** Las notificaciones que ya están programadas en el teléfono (todas; el sincronizador filtra las suyas). */
  programadas(): Promise<readonly NotificacionLocal[]>;
  programar(n: NotificacionLocal): Promise<void>;
  cancelar(id: string): Promise<void>;
}

export interface ResultadoSincronizacion {
  readonly programadas: readonly string[];
  readonly canceladas: readonly string[];
  readonly sinCambio: readonly string[];
}

function igual(a: NotificacionLocal, b: NotificacionLocal): boolean {
  return a.fecha === b.fecha && a.hora === b.hora && a.titulo === b.titulo && a.cuerpo === b.cuerpo;
}

/**
 * Deja en el teléfono exactamente el plan: cancela las notificaciones con `prefijo` que ya no están (o
 * cambiaron) y programa las nuevas. Idempotente: con el mismo plan, la segunda vez no toca nada.
 */
export async function sincronizarAvisos(
  puerto: PuertoNotificaciones,
  plan: readonly Pick<AvisoPlaneado, 'id' | 'fecha' | 'hora' | 'titulo' | 'cuerpo'>[],
  prefijo: string,
): Promise<ResultadoSincronizacion> {
  const deseadas = new Map<string, NotificacionLocal>(
    plan.map((a) => [a.id, { id: a.id, fecha: a.fecha, hora: a.hora, titulo: a.titulo, cuerpo: a.cuerpo }]),
  );
  const actuales = (await puerto.programadas()).filter((n) => n.id.startsWith(prefijo));
  const canceladas: string[] = [];
  const sinCambio: string[] = [];
  for (const n of actuales) {
    const d = deseadas.get(n.id);
    if (d && igual(d, n)) {
      sinCambio.push(n.id);
      deseadas.delete(n.id);
    } else {
      await puerto.cancelar(n.id);
      canceladas.push(n.id);
    }
  }
  const programadas: string[] = [];
  for (const n of deseadas.values()) {
    await puerto.programar(n);
    programadas.push(n.id);
  }
  return { programadas, canceladas, sinCambio };
}

/** Puerto en memoria para pruebas y para el modo sin permiso de notificaciones. */
export function puertoEnMemoria(): PuertoNotificaciones & { readonly lista: () => NotificacionLocal[] } {
  const mapa = new Map<string, NotificacionLocal>();
  return {
    programadas: async () => [...mapa.values()],
    programar: async (n) => {
      mapa.set(n.id, n);
    },
    cancelar: async (id) => {
      mapa.delete(id);
    },
    lista: () => [...mapa.values()].sort((a, b) => (a.id < b.id ? -1 : 1)),
  };
}

/**
 * La parte de `expo-notifications` que usa el adaptador (tipada aquí para no depender del paquete en servicios
 * ni en pruebas; la app pasa el módulo real: `crearPuertoExpo(await import('expo-notifications'))`).
 */
export interface ModuloNotificaciones {
  scheduleNotificationAsync(solicitud: {
    identifier: string;
    content: { title: string; body: string; data: Record<string, unknown> };
    trigger: { type: 'date'; date: Date };
  }): Promise<string>;
  cancelScheduledNotificationAsync(id: string): Promise<void>;
  getAllScheduledNotificationsAsync(): Promise<
    readonly {
      identifier: string;
      content: { title: string | null; body: string | null; data?: Record<string, unknown> | null };
    }[]
  >;
}

/** Fecha civil y hora local → instante del teléfono (frontera con el sistema, como `relojDispositivo`). */
function instanteLocal(fecha: PlainDate, hora: HoraDelDia): Date {
  const [a = 0, m = 1, d = 1] = fecha.split('-').map(Number);
  const [hh = 0, mm = 0] = hora.split(':').map(Number);
  return new Date(a, m - 1, d, hh, mm, 0, 0);
}

/** Adaptador real con `expo-notifications`. Guarda la fecha y la hora en `data` para comparar al sincronizar. */
export function crearPuertoExpo(modulo: ModuloNotificaciones): PuertoNotificaciones {
  return {
    async programadas() {
      const todas = await modulo.getAllScheduledNotificationsAsync();
      return todas.map((n) => ({
        id: n.identifier,
        fecha: String(n.content.data?.fecha ?? ''),
        hora: String(n.content.data?.hora ?? ''),
        titulo: n.content.title ?? '',
        cuerpo: n.content.body ?? '',
      }));
    },
    async programar(n) {
      await modulo.scheduleNotificationAsync({
        identifier: n.id,
        content: { title: n.titulo, body: n.cuerpo, data: { fecha: n.fecha, hora: n.hora } },
        trigger: { type: 'date', date: instanteLocal(n.fecha, n.hora) },
      });
    },
    async cancelar(id) {
      await modulo.cancelScheduledNotificationAsync(id);
    },
  };
}

/** Hora local actual del teléfono (`'HH:MM'`), para `planificarAvisosTarjetas`. */
export function horaDispositivo(): HoraDelDia {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
