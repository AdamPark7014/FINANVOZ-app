/**
 * Confirmar una tarjeta «Entendí» hablando (Ola 7 §4): «sí», «dale», «correcto» → confirmar; «no» → cambiar;
 * «no, fue con la Nu» / «eran 40» → cambiar esa fila. **Esqueleto del coordinador**: A-2 lo llena con
 * `packages/nlu/src/pasos/confirmacion.ts` (golden propio) y agrega el hook que escucha un turno de hasta 6 s; la
 * firma de `leerConfirmacion` no cambia.
 */
export type LecturaConfirmacion =
  | { readonly tipo: 'si' }
  | { readonly tipo: 'no' }
  /** Corrige algo: el texto se vuelve a interpretar contra la propuesta (cuenta, monto, categoría). */
  | { readonly tipo: 'cambio'; readonly texto: string }
  | null;

const SI =
  /^(s[ií]|sip|sale|dale|va|ok|okay|correcto|as[ií] es|exacto|reg[ií]stralo|gu[aá]rdalo|agr[eé]gala?)\b/i;
const NO = /^(no|nop|nel|para|cancela)\b/i;

export function leerConfirmacion(texto: string): LecturaConfirmacion {
  const t = texto
    .trim()
    .toLowerCase()
    .replace(/[.,!¡¿?]+$/g, '');
  if (t === '') return null;
  if (SI.test(t)) return { tipo: 'si' };
  const no = NO.exec(t);
  if (no) {
    const resto = t.slice(no[0].length).replace(/^[\s,]+/, '');
    return resto === '' ? { tipo: 'no' } : { tipo: 'cambio', texto: resto };
  }
  return { tipo: 'cambio', texto: t };
}
