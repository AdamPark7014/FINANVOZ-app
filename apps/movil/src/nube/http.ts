/** Petición mínima para Supabase (Auth, Edge Functions y URLs firmadas de Storage); `fetch` la cumple. */
export interface PeticionNube {
  readonly method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  readonly headers: Record<string, string>;
  readonly body?: string | Uint8Array;
  readonly signal?: AbortSignal;
}

export interface RespuestaNube {
  readonly status: number;
  json(): Promise<unknown>;
  arrayBuffer(): Promise<ArrayBuffer>;
}

/** `fetch` inyectable: el de la plataforma en la app; uno falso en las pruebas de Node. */
export type FetchNube = (url: string, peticion: PeticionNube) => Promise<RespuestaNube>;

export const fetchPlataforma: FetchNube = (url, peticion) =>
  globalThis.fetch(url, peticion as unknown as RequestInit);

/** Corre `hacer` con una señal que se aborta, y rechaza, si pasa de `ms` (una red lenta no cuelga la app). */
export async function conTiempo<T>(ms: number, hacer: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const control = new AbortController();
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<never>((_, rechazar) => {
    temporizador = setTimeout(() => {
      control.abort();
      rechazar(new Error('tiempo_agotado'));
    }, ms);
  });
  try {
    return await Promise.race([hacer(control.signal), limite]);
  } finally {
    clearTimeout(temporizador);
  }
}

/** Cuerpo JSON de una respuesta, o `null` si no lo es. */
export async function jsonDe(r: RespuestaNube): Promise<unknown> {
  return r.json().catch(() => null);
}
