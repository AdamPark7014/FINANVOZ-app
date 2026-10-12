import { exigirConsentimiento } from '../privacidad/consentimiento';
import { deshacerCicloTarjeta } from './config-tarjetas';
import { enTransaccion, type Contexto } from './contexto';
import { deshacerCompromiso, deshacerCorreccion, restaurarAnulado } from './correcciones';
import { anularMovimiento } from './formulario';
import { deshacerLiquidacion, deshacerPasarAMeses } from './msi';

/**
 * "Deshacer" (5 s) de todo lo que se hace por voz. El token es una lista separada por comas:
 * - `<id>`: movimiento registrado → se anula.
 * - `r:<corregida>:<original>`: corrección → la corregida se reemplaza por una copia de la original.
 * - `c:<id>`: anulación → se registra de nuevo una copia.
 * - `p:<programado>`: compromiso dictado → se desactiva.
 * - `m:<compra_msi>:<cargo>`: pasar a meses → vuelve el cargo original y se anulan sus cuotas facturadas.
 * - `l:<plan>:<liquidación>`: liquidar meses → se anula la liquidación y el plan vuelve a estar activo.
 * - `t:<tarjeta>:<corte>:<límite>:<días>`: cambio de ciclo de una tarjeta → vuelve al ciclo anterior.
 * Una compra a meses se deshace con su id (anularla anula también el plan y sus cuotas facturadas).
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
      else if (prefijo === 'm' && a && b) deshacerPasarAMeses(ctx, a, b);
      else if (prefijo === 'l' && a && b) deshacerLiquidacion(ctx, a, b);
      else if (prefijo === 't' && a) deshacerCicloTarjeta(ctx, parte);
      else anularMovimiento(ctx, parte);
    }
  });
}
