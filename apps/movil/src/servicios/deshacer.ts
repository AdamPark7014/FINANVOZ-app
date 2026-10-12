import { exigirConsentimiento } from '../privacidad/consentimiento';
import { enTransaccion, type Contexto } from './contexto';
import { deshacerCompromiso, deshacerCorreccion, restaurarAnulado } from './correcciones';
import { anularMovimiento } from './formulario';

/**
 * "Deshacer" (5 s) de todo lo que se hace por voz. El token es una lista separada por comas:
 * - `<id>`: movimiento registrado → se anula.
 * - `r:<corregida>:<original>`: corrección → la corregida se reemplaza por una copia de la original.
 * - `c:<id>`: anulación → se registra de nuevo una copia.
 * - `p:<programado>`: compromiso dictado → se desactiva.
 * El libro nunca se edita: deshacer siempre escribe transacciones nuevas (regla 2).
 */
export function deshacer(ctx: Contexto, token: string): void {
  exigirConsentimiento(ctx);
  enTransaccion(ctx, () => {
    for (const parte of token.split(',')) {
      if (parte === '') continue;
      const [prefijo, a, b] = parte.split(':');
      if (prefijo === 'r' && a && b) deshacerCorreccion(ctx, a, b);
      else if (prefijo === 'c' && a) restaurarAnulado(ctx, a);
      else if (prefijo === 'p' && a) deshacerCompromiso(ctx, a);
      else anularMovimiento(ctx, parte);
    }
  });
}
