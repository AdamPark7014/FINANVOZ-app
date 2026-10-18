/** Redacción de la calculadora M0 (`02 §14`, `08 §2.1`). */

export const LISTA_ESPERA_TITULO_EXITO = 'Listo: ya estás en la lista.';

export function listaEsperaTextoExito(marca: string): string {
  return `Te escribimos cuando abramos la beta de ${marca}. Puedes darte de baja con el enlace de cada correo.`;
}
