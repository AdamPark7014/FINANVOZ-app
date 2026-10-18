/** Copy de captura automática y por revisar (`02 §6`, `02 §14`, tuteo). */

export const TITULO_CAPTURAS_POR_REVISAR = 'Capturas por revisar';
export const INTRO_CAPTURAS_POR_REVISAR =
  'Vienen de avisos de tu banco. Confírmalas o corrige categoría y meses.';
export const TEXTO_CAPTURAS_POR_REVISAR_VACIO =
  'Todo al día. Si un aviso no queda claro, aparece aquí para que lo confirmes.';

export const TITULO_SIN_COMERCIO = 'Movimiento de tu banco';
export const ETIQUETA_SIN_CATEGORIA = 'sin categoría';
export const AVISO_SIN_TEXTO =
  'El aviso no traía detalle. Si fue un gasto o un ingreso, regístralo tú.';

/** Divulgación destacada antes del acceso a notificaciones (`08 §3.1`, RF-PRI-02). */
export const DIVULGACION_CAPTURA = {
  titulo: 'Registrar tus compras automáticamente',
  parrafos: [
    'Finanvoz puede leer las notificaciones de las apps de banco que elijas para registrar tus compras, retiros y transferencias sin que tengas que anotarlas.',
    'Solo leemos las apps que marques. Las demás notificaciones se ignoran en tu teléfono y no se guardan.',
    'El contenido se procesa en tu teléfono y no se envía a nuestros servidores.',
    'Puedes desactivarlo cuando quieras en Ajustes.',
  ],
} as const;

export const ETIQUETA_NO_DISPONIBLE = 'No disponible en este teléfono';
export const CUERPO_NO_DISPONIBLE =
  'Finanvoz anota tus compras con los avisos de tu banco en Android, con la app instalada desde la tienda.';
export const ALTERNATIVA_NO_DISPONIBLE = 'Por ahora, dicta o escribe tus gastos: «tacos 80 en efectivo».';

export const TITULO_PERMISO_NOTIFICACIONES = 'Acceso a notificaciones';
export const PERMISO_INSTRUCCION =
  'En ajustes del teléfono, busca Finanvoz y activa «Permitir acceso a notificaciones». Luego regresa aquí.';
export const PERMISO_DENEGADO =
  'Todavía no tengo permiso para leer tus notificaciones. Revísalo en ajustes y vuelve a intentar.';
export const PERMISO_AYUDA_ANDROID =
  'Si Android no te deja activarlo, abre la información de la app, toca el menú ⋮ y elige «Permitir ajustes restringidos».';

export const TEXTO_SIN_APPS_BANCO =
  'No encontré apps de banco que reconozca en tu teléfono. Cuando instales una, actívala en Ajustes.';
export const TITULO_ELEGIR_APPS = '¿Qué apps de banco leo?';
export const INTRO_ELEGIR_APPS = 'Solo leo las que marques.';

export const LISTA_CAPTURA_ACTIVA = 'La captura automática está activa.';
export const LISTA_CAPTURA_APPS = (nombres: readonly string[]) =>
  `Listo: anotaré lo que avisen ${nombres.join(', ')}.`;
export const LISTA_CAPTURA_POR_REVISAR =
  'Lo que no entienda queda en Movimientos → Por revisar.';
