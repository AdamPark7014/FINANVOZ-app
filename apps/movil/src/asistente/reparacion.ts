import type { ChipRespuesta } from './tipos';

/**
 * «No entendí» con reparación en un toque (Ola 7 §2, mockup «no entendí»): a partir de lo que se oyó, las
 * respuestas más probables primero. **Esqueleto del coordinador**: A-2 lo llena con `packages/nlu/src/pasos/
 * reparacion.ts` y su golden; la firma no cambia.
 *
 * Valores reservados: 'gasto' · 'ingreso' · 'prestamo' · 'me_pagaron' · 'otra' (cada uno abre R2 prellenado con
 * ese tipo, o `registrarTexto` con la frase reescrita).
 */
export function sugerirReparacion(oido: string): readonly ChipRespuesta[] {
  if (oido.trim() === '') return [];
  return [
    { valor: 'gasto', etiqueta: 'Fue un gasto' },
    { valor: 'ingreso', etiqueta: 'Me entró dinero' },
    { valor: 'otra', etiqueta: 'Otra cosa' },
  ];
}
