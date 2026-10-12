// Servidor de gastos compartidos para pruebas: la migración real en PGlite (con dobles mínimos de `auth.*` y de los
// roles de Supabase) y el manejador de la Edge Function conectado a ella, como lo conecta `compartido/index.ts`
// con `supabase.rpc`. Los JWT de prueba son `jwt-<uuid>`.
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import type { EventoRegistro } from '../../nlu/registro.ts';
import { crearManejadorCompartido, type FuncionCompartido } from '../manejador.ts';

export const MIGRACION_COMPARTIDO = readFileSync(
  new URL('../../../../migrations/20261201000000_compartido.sql', import.meta.url),
  'utf8',
);

export const BASE_URL = 'https://abc.supabase.co/functions/v1';

/** Tipo SQL de cada parámetro `p_*` de las funciones `compartido_*`. */
const TIPOS: Record<string, string> = {
  p_usuario: 'uuid',
  p_grupo: 'uuid',
  p_codigo_hash: 'text',
  p_vence_en: 'timestamptz',
  p_desde: 'timestamptz',
  p_eventos: 'jsonb',
  p_limite: 'integer',
};

export interface ServidorPrueba {
  readonly db: PGlite;
  readonly manejador: (req: Request) => Promise<Response>;
  readonly registros: EventoRegistro[];
  /** Usuario de Auth nuevo (sesión anónima); su JWT es `jwt-<id>`. */
  usuario(): Promise<string>;
  /** Corre el reloj del manejador (vencimiento de códigos). */
  fijarAhora(ms: number): void;
  /** Ejecuta SQL como el rol `authenticated` con el JWT de `usuario` (PostgREST directo). */
  como<T>(usuario: string | null, sql: string, params?: unknown[]): Promise<T[]>;
}

let n = 0;

export async function abrirServidor(): Promise<ServidorPrueba> {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    grant usage on schema auth to authenticated, anon, service_role;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public to authenticated, anon, service_role;
  `);
  await db.exec(MIGRACION_COMPARTIDO);
  const registros: EventoRegistro[] = [];
  let ahora = Date.now();
  const usuarios = new Set<string>();

  async function llamar(funcion: FuncionCompartido, parametros: Record<string, unknown>): Promise<unknown> {
    const nombres = Object.keys(parametros);
    const valores = nombres.map((k) => {
      const v = parametros[k];
      return TIPOS[k] === 'jsonb' ? JSON.stringify(v) : v;
    });
    const argumentos = nombres.map((k, i) => `${k} => $${i + 1}::${TIPOS[k] ?? 'text'}`).join(', ');
    // Como lo llama la Edge Function: con el rol service_role (las funciones no se pueden llamar con otro).
    await db.exec('set role service_role;');
    try {
      const r = await db.query<{ r: unknown }>(`select public.${funcion}(${argumentos}) as r`, valores);
      return r.rows[0]?.r;
    } finally {
      await db.exec('reset role;');
    }
  }

  const manejador = crearManejadorCompartido({
    configurado: true,
    verificarUsuario: async (jwt) => {
      const id = jwt.startsWith('jwt-') ? jwt.slice(4) : '';
      return usuarios.has(id) ? id : null;
    },
    llamar,
    aleatorio: (k) => new Uint8Array(randomBytes(k)),
    ahora: () => ahora,
    registrar: (e) => registros.push(e),
  });

  return {
    db,
    manejador,
    registros,
    async usuario() {
      const id = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
      await db.query('insert into auth.users values ($1)', [id]);
      usuarios.add(id);
      return id;
    },
    fijarAhora(ms) {
      ahora = ms;
    },
    async como<T>(usuario: string | null, sql: string, params: unknown[] = []) {
      await db.exec(
        usuario === null
          ? 'set role anon;'
          : `set role authenticated; set request.jwt.claim.sub = '${usuario}';`,
      );
      try {
        return (await db.query<T>(sql, params)).rows;
      } finally {
        await db.exec('reset role; reset request.jwt.claim.sub;');
      }
    },
  };
}

/** Petición a la Edge Function con el JWT de `usuario`. */
export function peticion(
  usuario: string | null,
  ruta: string,
  cuerpo?: unknown,
  metodo: 'GET' | 'POST' = cuerpo === undefined && ruta.startsWith('eventos?') ? 'GET' : 'POST',
): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (usuario !== null) headers.authorization = `Bearer jwt-${usuario}`;
  return new Request(`${BASE_URL}/compartido/${ruta}`, {
    method: metodo,
    headers,
    ...(metodo === 'POST' ? { body: cuerpo === undefined ? '' : JSON.stringify(cuerpo) } : {}),
  });
}
