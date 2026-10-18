/** Redacción de la calculadora M0 (`02 §14`, `08 §2.1`). */

export const LISTA_ESPERA_TITULO = '¿Quieres saber cuánto puedes gastar cada día?';

export function listaEsperaIntro(marca: string): string {
  return `${marca} te dice cuánto puedes gastar hoy: registras con voz o notificaciones y te avisa si llegas a la quincena. Anótate para la beta.`;
}

export const LISTA_ESPERA_ARIA_FORMULARIO = 'Formulario para anotarte en la lista de espera';
export const LISTA_ESPERA_ETIQUETA_CORREO = 'Tu correo';

/** Mismo contrato que `services/proxy/supabase/functions/_shared/lista-espera.ts`. */
export const LISTA_ESPERA_PREGUNTAS = [
  {
    clave: 'telefono',
    texto: '¿Usas Android o iPhone?',
    opciones: [
      ['android', 'Android'],
      ['iphone', 'iPhone'],
    ],
  },
  {
    clave: 'notificaciones',
    texto: '¿Tu banco te avisa con una notificación en cada compra?',
    opciones: [
      ['si', 'Sí, siempre'],
      ['a_veces', 'A veces'],
      ['no', 'No'],
      ['no_se', 'No sé'],
    ],
  },
  {
    clave: 'precio',
    texto: '¿Cuánto pagarías al mes por una app que te diga cuánto puedes gastar hoy?',
    opciones: [
      ['0', 'Solo la usaría gratis'],
      ['hasta_49', 'Hasta $49'],
      ['50_99', 'De $50 a $99'],
      ['100_mas', '$100 o más'],
    ],
  },
  {
    clave: 'uso',
    texto: '¿Para qué la usarías?',
    opciones: [
      ['personal', 'Personal'],
      ['negocio', 'Mi negocio o freelance'],
      ['contador', 'Soy contador'],
    ],
  },
] as const;

export type ListaEsperaClave = (typeof LISTA_ESPERA_PREGUNTAS)[number]['clave'];

export const LISTA_ESPERA_ERROR_CORREO = 'Revisa tu correo: le falta algo, como la @ o el dominio.';

export function listaEsperaErrorFaltaUna(textoPregunta: string): string {
  return `Falta contestar: ${textoPregunta}`;
}

export function listaEsperaErrorFaltanVarias(cantidad: number, textoPrimera: string): string {
  return `Faltan ${cantidad} preguntas por contestar. Empieza por: ${textoPrimera}`;
}

export const LISTA_ESPERA_ERROR_CONSENTIMIENTO =
  'Marca que leíste y aceptas el aviso de privacidad para anotarte.';

export const LISTA_ESPERA_ERROR_NO_ABIERTA = 'La lista de espera todavía no está abierta. Vuelve pronto.';

export const LISTA_ESPERA_ERROR_OPCION = 'Elige una respuesta.';

export const LISTA_ESPERA_TRAMPA_ETIQUETA = 'No llenes este campo';

export interface ResponsableListaEspera {
  nombre: string;
  domicilio: string;
  correo: string;
}

export function listaEsperaAvisoBreve(
  responsableDefinido: boolean,
  responsable: ResponsableListaEspera,
): string {
  const prefijo = responsableDefinido
    ? `${responsable.nombre}, con domicilio en ${responsable.domicilio}, `
    : 'El responsable ';
  const baja = responsableDefinido
    ? ` Te das de baja con el enlace de cada correo o escribiendo a ${responsable.correo}.`
    : ' Te das de baja con el enlace de cada correo.';
  return `${prefijo}usa tu correo y respuestas para avisarte del lanzamiento, invitarte a la beta y entender qué necesita la gente. Los guarda Supabase como encargado.${baja}`;
}

export const LISTA_ESPERA_ENLACE_AVISO = 'Aviso de privacidad completo';

export const LISTA_ESPERA_CONSENTIMIENTO =
  'Leí el aviso de privacidad y acepto que usen mis datos para esto.';

export const LISTA_ESPERA_ERROR_RED =
  'No pude anotarte. Revisa tu conexión e intenta de nuevo.';

export const LISTA_ESPERA_ERROR_LIMITE =
  'Recibimos varios intentos desde tu conexión. Intenta de nuevo en una hora.';

export const LISTA_ESPERA_CTA = 'Anotarme';
export const LISTA_ESPERA_CTA_ENVIANDO = 'Anotando…';

export const LISTA_ESPERA_ARIA_CTA = 'Anotarme en la lista de espera de la beta';
export const LISTA_ESPERA_ARIA_CTA_ENVIANDO = 'Enviando tu solicitud a la lista de espera';

export const LISTA_ESPERA_TITULO_EXITO = 'Listo: ya estás en la lista.';

export function listaEsperaTextoExito(marca: string): string {
  return `Te escribimos cuando abramos la beta de ${marca}. Puedes darte de baja con el enlace de cada correo.`;
}
