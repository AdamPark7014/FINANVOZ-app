import { randomBytes, randomUUID } from 'node:crypto';
import { crearCriptoNoble } from '@cartera/sincronizacion/noble';
import type { ClienteCompartido, EventoRemoto } from '../../nube/compartido-nube';
import type { DependenciasCompartido } from '../compartido';
import type { Prueba } from './base';

/**
 * Doble en memoria de `/compartido/*` con las reglas de `03 §6` que importan a la app: código de un solo uso para
 * el otro lugar, `no_miembro`, `grupo_cerrado` al publicar con el grupo cerrado (descargar sigue), idempotencia
 * por `id` y cursor por `recibido_en`. La prueba de punta a punta con el servidor real (PGlite) vive en
 * `services/proxy/.../compartido/dos-telefonos.test.ts`.
 */
export function servidorCompartidoFalso() {
  interface Grupo {
    miembros: { a: string | null; b: string | null };
    codigo: { valor: string; lugar: 'a' | 'b' } | null;
    cerradoEn: string | null;
    eventos: EventoRemoto[];
  }
  const grupos = new Map<string, Grupo>();
  let tic = 0;
  const instante = () => {
    tic += 1;
    return `2026-10-12T00:00:00.${String(tic).padStart(6, '0')}Z`;
  };
  const codigo = () => randomBytes(16).toString('base64url');
  const lugarDe = (g: Grupo, usuario: string): 'a' | 'b' | null =>
    g.miembros.a === usuario ? 'a' : g.miembros.b === usuario ? 'b' : null;

  /** Cliente de una sesión; `red.caida` simula estar sin conexión. */
  function cliente(usuario: string, red = { caida: false }): ClienteCompartido & { red: { caida: boolean } } {
    const conRed = <T>(f: () => T): Promise<T | { ok: false; error: 'sin_red' }> =>
      Promise.resolve(red.caida ? { ok: false as const, error: 'sin_red' as const } : f());
    const miembro = (grupoId: string) => {
      const g = grupos.get(grupoId);
      const lugar = g ? lugarDe(g, usuario) : null;
      return g && lugar ? { g, lugar } : null;
    };
    return {
      red,
      crearGrupo: () =>
        conRed(() => {
          const id = randomUUID();
          const c = codigo();
          grupos.set(id, {
            miembros: { a: usuario, b: null },
            codigo: { valor: c, lugar: 'b' },
            cerradoEn: null,
            eventos: [],
          });
          return { ok: true as const, grupoId: id, codigoUnion: c };
        }),
      pedirCodigo: (grupoId) =>
        conRed(() => {
          const m = miembro(grupoId);
          if (!m) return { ok: false as const, error: 'no_miembro' as const };
          if (m.g.cerradoEn) return { ok: false as const, error: 'grupo_cerrado' as const };
          const c = codigo();
          m.g.codigo = { valor: c, lugar: m.lugar === 'a' ? 'b' : 'a' };
          return { ok: true as const, codigoUnion: c };
        }),
      unirse: (grupoId, codigoUnion) =>
        conRed(() => {
          const g = grupos.get(grupoId);
          if (!g || !g.codigo || g.codigo.valor !== codigoUnion)
            return { ok: false as const, error: 'codigo_invalido' as const };
          if (g.cerradoEn) return { ok: false as const, error: 'grupo_cerrado' as const };
          const lugar = g.codigo.lugar;
          const otro = lugar === 'a' ? 'b' : 'a';
          if (g.miembros[otro] === usuario) return { ok: false as const, error: 'ya_miembro' as const };
          g.miembros[lugar] = usuario;
          g.codigo = null;
          return { ok: true as const, autor: lugar };
        }),
      salir: (grupoId) =>
        conRed(() => {
          const m = miembro(grupoId);
          if (!m) return { ok: false as const, error: 'no_miembro' as const };
          m.g.cerradoEn ??= instante();
          return { ok: true as const, cerradoEn: m.g.cerradoEn };
        }),
      publicar: (grupoId, eventos) =>
        conRed(() => {
          const m = miembro(grupoId);
          if (!m) return { ok: false as const, error: 'no_miembro' as const };
          if (m.g.cerradoEn) return { ok: false as const, error: 'grupo_cerrado' as const };
          const recibidos = eventos.map((e) => {
            const previo = m.g.eventos.find((x) => x.id === e.id);
            if (previo) return { id: e.id, recibidoEn: previo.recibidoEn };
            const fila = { id: e.id, autor: m.lugar, blob: e.blob, recibidoEn: instante() };
            m.g.eventos.push(fila);
            return { id: e.id, recibidoEn: fila.recibidoEn };
          });
          return { ok: true as const, recibidos };
        }),
      descargar: (grupoId, desde) =>
        conRed(() => {
          const m = miembro(grupoId);
          if (!m) return { ok: false as const, error: 'no_miembro' as const };
          const eventos = m.g.eventos.filter((e) => desde === null || e.recibidoEn > desde);
          return {
            ok: true as const,
            eventos,
            cursor: eventos.at(-1)?.recibidoEn ?? desde,
            mas: false,
            cerradoEn: m.g.cerradoEn,
          };
        }),
    };
  }

  return { grupos, cliente };
}

/** Dependencias de un teléfono de prueba: noble con bytes de `node:crypto` y el almacén en memoria. */
export function depsTelefono(p: Prueba, cliente: ClienteCompartido | null): DependenciasCompartido {
  return { cripto: crearCriptoNoble((n) => new Uint8Array(randomBytes(n))), almacen: p.almacen, cliente };
}
