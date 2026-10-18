/** Copy del botón de dictado y de lo que se oyó (02-UX §5 y §14): tuteo, frases cortas. */

export const TEXTO_HABLAR = 'Toca para hablar';
export const TEXTO_TERMINAR = 'Toca para terminar';
export const ETIQUETA_ESCUCHANDO = 'Escuchando. Toca para terminar';
export const PISTA_HABLAR =
  'Di tu gasto. Cuando dejes de hablar, termino solo. También puedes mantener presionado y soltar.';
export const PISTA_ESCUCHANDO = 'Toca otra vez cuando termines de hablar.';
export const TEXTO_TE_ESCUCHO = 'Te escucho…';

/** Lo dictado que no se entendió vuelve al campo "Escribir" para corregirlo (no se pierde). */
export const mensajeEstoOi = (frase: string) =>
  `Esto oí: «${frase}». ¿Lo arreglas? Corrígelo aquí abajo y toca Registrar.`;
