/**
 * Arranque de la app (solo en el teléfono: importa módulos nativos vía `db/expo`). Abre la base cifrada, aplica
 * migraciones y arma el `Contexto` con reloj del dispositivo y UUIDv7. Las pruebas arman su contexto con
 * `db/node` y `relojFijo`.
 */
import type { BaseAbierta } from '../db/abrir';
import { abrirBaseApp, aleatorioExpo, almacenExpo, puertoExpo } from '../db/expo';
import { borrarTodo } from '../privacidad/borrar';
import { dependenciasRespaldoExpo } from '../respaldo/expo';
import { crearContexto, type Contexto, type Reloj } from './contexto';
import { crearGeneradorUuidV7 } from './ids';
import { relojDispositivo } from './reloj';
import { restaurarRespaldo, type RespaldoListo } from './respaldo';
import { registrarRespaldoRestaurado } from './respaldo-nube';

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

/**
 * Restaurar (M9): con la base anterior ya cerrada y borrada, importa el respaldo ensayado en una base nueva y
 * abre la sesión sobre ella. La llave del respaldo queda guardada para el respaldo automático.
 */
export function restaurarSesion(listo: RespaldoListo, reloj: Reloj = relojDispositivo()): Sesion {
  const base = restaurarRespaldo(dependenciasRespaldoExpo, listo);
  const ctx = crearContexto({
    db: base.db,
    reloj,
    generarId: crearGeneradorUuidV7(() => reloj.ahora(), aleatorioExpo),
  });
  // El respaldo restaurado cuenta como el último: el aviso de 14 días y el automático siguen desde su fecha.
  try {
    registrarRespaldoRestaurado(ctx, listo.fecha);
  } catch {
    // No impide abrir la sesión: la fecha se corrige con el siguiente respaldo.
  }
  return { ctx, base };
}

/** "Borrar todo": la app queda como recién instalada; abre una sesión nueva después. */
export async function borrarTodoApp(
  sesion: Sesion | null,
  opciones: { readonly conservarSesionNube?: boolean } = {},
): Promise<void> {
  await borrarTodo({
    base: sesion?.base ?? null,
    puerto: puertoExpo,
    almacen: almacenExpo,
    conservarSesionNube: opciones.conservarSesionNube ?? false,
  });
}
