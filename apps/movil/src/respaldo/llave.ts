import { z } from 'zod';
import { ErrorDominio } from '@cartera/core';
import { aBase64, deBase64, validarParametros, type LlaveRespaldo } from '@cartera/respaldo';
import type { AlmacenSeguro } from '../db/llave';

/**
 * Llave del respaldo en el almacén seguro (`05 §E16`): la llave derivada (32 bytes) y su sal, con los parámetros
 * de scrypt. Mismas opciones que la llave de la base (`04 §7`: sin autenticación, después del primer desbloqueo),
 * para que el respaldo automático cifre con el teléfono bloqueado y sin pedir la contraseña.
 */
export const CLAVE_LLAVE_RESPALDO = 'cartera.respaldo.llave.v1';

const Guardada = z.strictObject({
  v: z.literal(1),
  llave_b64: z.string(),
  sal_b64: z.string(),
  n: z.int(),
  r: z.int(),
  p: z.int(),
});

export function guardarLlaveRespaldo(almacen: AlmacenSeguro, llave: LlaveRespaldo): void {
  validarParametros({ n: llave.n, r: llave.r, p: llave.p, sal: llave.sal });
  almacen.guardar(
    CLAVE_LLAVE_RESPALDO,
    JSON.stringify({
      v: 1,
      llave_b64: aBase64(llave.llave),
      sal_b64: aBase64(llave.sal),
      n: llave.n,
      r: llave.r,
      p: llave.p,
    }),
  );
}

/** `null` si todavía no hay contraseña de respaldo. Una llave guardada ilegible es un error (no se reemplaza sola). */
export function leerLlaveRespaldo(almacen: AlmacenSeguro): LlaveRespaldo | null {
  const texto = almacen.obtener(CLAVE_LLAVE_RESPALDO);
  if (texto === null) return null;
  let crudo: unknown;
  try {
    crudo = JSON.parse(texto);
  } catch {
    crudo = null;
  }
  const r = Guardada.safeParse(crudo);
  const llave = r.success ? deBase64(r.data.llave_b64) : null;
  const sal = r.success ? deBase64(r.data.sal_b64) : null;
  if (!r.success || !llave || !sal || llave.length !== 32)
    throw new ErrorDominio('llave_respaldo_invalida', 'la llave de respaldo guardada no es válida');
  validarParametros({ n: r.data.n, r: r.data.r, p: r.data.p, sal });
  return { llave, sal, n: r.data.n, r: r.data.r, p: r.data.p };
}
