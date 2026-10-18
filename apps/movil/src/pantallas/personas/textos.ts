import { formatearCentavos } from '../../ui';

/** Redacción de cuentas divididas, cobros y personas (`02 §17`, `02 §14`): solo presentación. */

/** "Registré: la cena $1,200 · te deben $900". */
export function mensajeCuentaDividida(
  descripcion: string | null,
  total: number,
  porCobrarTotal: number,
): string {
  const que = descripcion ?? 'Cuenta dividida';
  return `Registré: ${que} ${formatearCentavos(total)} · te deben ${formatearCentavos(porCobrarTotal)}`;
}

/** "Elige 3 personas (llevas 1)." */
export function textoFaltanPersonas(faltan: number, llevas: number): string {
  const personas = faltan === 1 ? '1 persona' : `${faltan} personas`;
  return `Elige ${personas} (llevas ${llevas}).`;
}

export const TITULO_CONFIRMAR_DIVISION = '¿Con quién dividiste la cuenta?';

export const MENSAJES_DATOS_COBRO: Record<string, string> = {
  datos_cobro_vacios: 'Escribe tu celular o tu CLABE.',
  celular_invalido: 'El celular debe tener 10 dígitos.',
  clabe_invalida: 'Esa CLABE no es válida. Revisa los 18 dígitos.',
};

export const AYUDA_DATOS_COBRO =
  'Se guardan solo en este teléfono y van en el mensaje cuando cobras. No los mandamos a ningún lado.';

/** Saldo de la persona en palabras: "Te debe" / "Le debes" / "Están a mano". */
export function etiquetaSaldoPersona(saldo: number): string {
  if (saldo > 0) return 'Te debe';
  if (saldo < 0) return 'Le debes';
  return 'Están a mano';
}

export const MENSAJE_COMPARTIR_NO_DISPONIBLE = 'No pude abrir la hoja de compartir. Intenta de nuevo.';

/** Detalle: id que ya no existe en el libro (`02 §17`). */
export const TEXTO_PERSONA_NO_ENCONTRADA = 'No encontré a esa persona.';

/** Detalle: aún no hay préstamos ni cuentas divididas con ella. */
export const TEXTO_MOVIMIENTOS_PERSONA_VACIO = 'Todavía no hay movimientos con esta persona.';

/** Cuenta dividida: aún no hay contactos guardados. */
export const TEXTO_CONTACTOS_VACIO =
  'Todavía no tienes contactos. Escribe abajo a quien te debe y elige a cada uno.';
