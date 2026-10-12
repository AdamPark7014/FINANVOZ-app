import { sincronizarPlan, type Contexto, type VistaPlan } from '../servicios';
import type { AdaptadorCompras } from './tipos';

/**
 * Pendiente 58 (M9): después de "entrar" con el correo en un teléfono nuevo, o de borrar la cuenta de respaldo
 * (queda un anónimo nuevo), las compras deben seguir al usuario correcto del proxy. `logIn` con el usuario nuevo y
 * "restaurar compras" (RevenueCat transfiere la compra de esta cuenta de Google al usuario nuevo, evento
 * `TRANSFER`); el plan resultante se guarda en la base. Sin usuario no hace nada. No registra nada (regla 9).
 */
export async function reidentificarCompras(
  compras: AdaptadorCompras,
  usuarioId: string | null,
  ctx: Contexto,
): Promise<VistaPlan | null> {
  if (!usuarioId) return null;
  await compras.identificar(usuarioId);
  return sincronizarPlan(ctx, await compras.restaurar());
}
