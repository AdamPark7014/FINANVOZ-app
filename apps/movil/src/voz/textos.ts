import type { ClaveMensajeDictado } from './estado';

/** Copy del botón de dictado y de lo que se oyó (02-UX §5 y §14): tuteo, frases cortas. */

export const TEXTO_HABLAR = 'Toca para hablar';
export const TEXTO_TERMINAR = 'Toca para terminar';
export const ETIQUETA_ESCUCHANDO = 'Escuchando. Toca para terminar';
export const PISTA_HABLAR =
  'Di tu gasto. Cuando dejes de hablar, termino solo. También puedes mantener presionado y soltar.';
export const PISTA_ESCUCHANDO = 'Toca otra vez cuando termines de hablar.';
export const TEXTO_TE_ESCUCHO = 'Te escucho…';

/** Con el permiso negado, iOS no vuelve a preguntar: solo queda ir a Ajustes. */
export const BTN_ABRIR_AJUSTES_DICTADO = 'Abrir Ajustes';
export const PISTA_ABRIR_AJUSTES_DICTADO = 'Abre los ajustes del teléfono para permitir el dictado.';

/** Lo dictado que no se entendió vuelve al campo "Escribir" para corregirlo (no se pierde). */
export const mensajeEstoOi = (frase: string) =>
  `Esto oí: «${frase}». ¿Lo arreglas? Corrígelo aquí abajo y toca Registrar.`;

// --- Dictar una cifra en un campo de dinero (CampoMonto) ---

/** Botón con texto para dictar en formularios. */
export const TEXTO_DIMELO = 'Dímelo';

/** Etiqueta del micrófono junto a un campo; sin cifras (02-UX §15). */
export const etiquetaMicrofonoCampo = (campo: string) => `Dictar en voz: ${campo}`;
export const PISTA_MICROFONO_CAMPO =
  'Di la cifra y la escribo en el campo. Cuando dejes de hablar, termino solo.';
/** Pista del campo mientras se escucha: nunca lleva lo que se va oyendo (puede traer cifras a medias). */
export const PISTA_CAMPO_ESCUCHANDO = 'Te escucho. Cuando termines, escribo la cifra aquí.';
/** Lo que se va oyendo, solo a la vista. */
export const textoOyendoCampo = (parcial: string) => (parcial === '' ? TEXTO_TE_ESCUCHO : `«${parcial}»`);

/** `monto` ya formateado para la UI (`$8,500`). */
export const mensajeMontoOido = (frase: string, monto: string) => `Oí «${frase}»: puse ${monto}.`;

/** Marcas de cifra aproximada que reconoce el intérprete (`06`, `reglas/montos`). */
const MARCA_APROXIMADO = /\b(m[aá]s o menos|aproximadamente|aprox|como|unos|unas|y feria|y pico)\b/i;

/** «Como 500»: se escribe la cifra, pero se pide corregirla si se sabe la exacta. */
export const mensajeMontoAproximado = (frase: string) => {
  const marca = MARCA_APROXIMADO.exec(frase)?.[1] ?? frase;
  return `Dijiste «${marca}»: corrígelo si sabes la cifra exacta.`;
};

export const mensajeMontoNoEntendido = (frase: string) =>
  `No entendí la cifra en «${frase}». Dila otra vez o escríbela.`;

/** Errores del dictado en un campo de dinero: como `MENSAJES_DICTADO`, sin "di tu gasto" ni "lo registro". */
export const MENSAJES_DICTADO_CAMPO = {
  sin_permiso:
    'Para dictar, permite el micrófono en los ajustes del teléfono. También puedes escribir la cifra.',
  sin_permiso_ios:
    'Para dictar, permite el micrófono y el reconocimiento de voz en Ajustes. También puedes escribir la cifra.',
  no_disponible: 'Tu teléfono no tiene dictado disponible. Escribe la cifra.',
  sin_voz: 'No te escuché. Toca el micrófono y di la cifra, o escríbela.',
  red: 'El dictado necesita internet en este teléfono. Escribe la cifra o inténtalo de nuevo.',
  ocupado: 'El micrófono está ocupado. Intenta de nuevo en un momento.',
  audio: 'No pude usar el micrófono. Intenta de nuevo o escribe la cifra.',
  desconocido: 'Algo falló con el dictado. Intenta de nuevo o escribe la cifra.',
} as const satisfies Record<ClaveMensajeDictado, string>;
