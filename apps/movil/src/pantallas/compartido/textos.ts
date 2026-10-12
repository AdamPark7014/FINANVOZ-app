import type { Centavos } from '@cartera/core';
import type { ErrorAccionCompartido } from '../../servicios';
import { formatearCentavos } from '../../ui';

/** Mensajes de gastos compartidos (`02 §14`: qué pasó y qué hacer; nunca el detalle técnico). */
export function mensajeErrorCompartido(error: ErrorAccionCompartido): string {
  switch (error) {
    case 'sin_red':
      return 'No hay conexión. Lo que agregues se comparte cuando vuelva.';
    case 'sin_servicio':
      return 'Esta versión de la app no tiene activado compartir gastos.';
    case 'no_miembro':
    case 'sin_llave':
      return 'Este teléfono ya no está vinculado al grupo. Toca "Volver a vincular".';
    case 'grupo_cerrado':
      return 'El grupo ya está cerrado.';
    case 'codigo_invalido':
      return 'Ese código ya venció o ya se usó. Pídele a tu pareja que toque "Mostrar código" otra vez.';
    case 'ya_miembro':
      return 'Ese es tu propio código: tu pareja debe escanearlo desde su teléfono.';
    case 'otro_lugar':
      return 'Ese código es para otro teléfono. Pídele a tu pareja que toque "Mostrar código" otra vez.';
    case 'qr_invalido':
      return 'Ese código no es de Finanvoz. Escanea el que aparece en la app de tu pareja.';
    case 'evento_ilegible':
      return 'Llegó algo que no pude leer. Intenta de nuevo; si sigue, vuelve a vincular.';
    case 'sin_sesion':
    case 'conflicto':
    case 'servidor':
      return 'No pude hablar con el servidor. Intenta de nuevo en un rato.';
  }
}

export const TEXTO_SALIR =
  'Si sales, el grupo se cierra para los dos. Cada quien conserva lo que ya registró.';

export const OPCIONES_REPARTO: readonly { valor: number; etiqueta: string }[] = [
  { valor: 5000, etiqueta: 'Mitad y mitad' },
  { valor: 6000, etiqueta: 'Yo 60 %' },
  { valor: 4000, etiqueta: 'Yo 40 %' },
  { valor: 7000, etiqueta: 'Yo 70 %' },
  { valor: 3000, etiqueta: 'Yo 30 %' },
];

export const MENSAJE_SIN_PAREJA = 'Primero vincúlate con tu pareja en Gastos compartidos.';
export const MENSAJE_COMPARTIDO_GUARDADO = 'Listo: lo agregué a tus gastos compartidos.';

/** Chip de un reparto dictado que no está entre los de siempre: 6500 → "Yo 65 %". */
export const etiquetaReparto = (miParteBp: number): string => `Yo ${miParteBp / 100} %`;

/** "Súper $1,200.00 · pagaste tú · tú 60 % / tu pareja 40 %": lo dictado antes de compartirlo. */
export function resumenGastoCompartido(g: {
  descripcion: string;
  total: Centavos;
  pagueYo: boolean | null;
  miParteBp: number | null;
}): string {
  const partes = [
    `${g.descripcion === '' ? 'Gasto' : g.descripcion} ${formatearCentavos(g.total, 'centavos')}`,
  ];
  partes.push(g.pagueYo === null ? 'falta quién pagó' : g.pagueYo ? 'pagaste tú' : 'pagó tu pareja');
  if (g.miParteBp !== null)
    partes.push(`tú ${g.miParteBp / 100} % / tu pareja ${(10000 - g.miParteBp) / 100} %`);
  return partes.join(' · ');
}

export const OPCIONES_CATEGORIA: readonly { valor: string; etiqueta: string }[] = [
  { valor: 'super', etiqueta: 'Súper' },
  { valor: 'comida_fuera', etiqueta: 'Comida fuera' },
  { valor: 'hogar', etiqueta: 'Hogar' },
  { valor: 'servicios', etiqueta: 'Servicios' },
  { valor: 'entretenimiento', etiqueta: 'Salidas' },
  { valor: 'otros_gastos', etiqueta: 'Otro' },
];
