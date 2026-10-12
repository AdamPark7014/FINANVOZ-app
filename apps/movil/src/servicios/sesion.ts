/**
 * Arranque de la app (solo en el teléfono: importa módulos nativos vía `db/expo`). Abre la base cifrada, aplica
 * migraciones y arma el `Contexto` con reloj del dispositivo y UUIDv7. Las pruebas arman su contexto con
 * `db/node` y `relojFijo`.
 */
import type { BaseAbierta } from '../db/abrir';
import { abrirBaseApp, aleatorioExpo, almacenExpo, puertoExpo } from '../db/expo';
import { borrarTodo } from '../privacidad/borrar';
import { crearContexto, type Contexto, type Reloj } from './contexto';
import { crearGeneradorUuidV7 } from './ids';
import { relojDispositivo } from './reloj';

export interface Sesion {
  readonly ctx: Contexto;
  readonly base: BaseAbierta;
}

/** `reloj` se inyecta solo en builds de desarrollo (escenarios semilla); en producción es el del teléfono. */
export function abrirSesion(reloj: Reloj = relojDispositivo()): Sesion {
  const base = abrirBaseApp();
  const ctx = crearContexto({
    db: base.db,
    reloj,
    generarId: crearGeneradorUuidV7(() => reloj.ahora(), aleatorioExpo),
  });
  return { ctx, base };
}

/** "Borrar todo": la app queda como recién instalada; abre una sesión nueva después. */
export async function borrarTodoApp(sesion: Sesion | null): Promise<void> {
  await borrarTodo({ base: sesion?.base ?? null, puerto: puertoExpo, almacen: almacenExpo });
}
