// Validación con el esquema Zod completo (copia generada de `packages/nlu/src/esquema.ts`).
import { Interpretacion } from './esquema.generado.ts';
import { describirErrorZod, type Validador } from './interpretar.ts';

export const validarInterpretacion: Validador = (valor) => {
  const r = Interpretacion.safeParse(valor);
  return r.success ? { ok: true, valor: r.data } : { ok: false, error: describirErrorZod(r.error.issues) };
};
