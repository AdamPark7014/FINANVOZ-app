import { RESPONSABLE } from '../onboarding/aviso';
import type { SeccionAviso } from '../onboarding/aviso';

/**
 * Texto fijo de `08 §1` para "Acerca de" y "¿Me alcanza?". La especificación dice "Cartera" (nombre de
 * trabajo); en la app va la marca Finanvoz (ver ESTADO → Decisiones).
 */
export const TEXTO_NO_ASESORIA =
  'Finanvoz no es una institución financiera ni asesor de inversiones. Las cifras son estimaciones con la información que registras y no garantizan resultados.';

/** Versión de los términos de uso; cambia cuando cambia el texto. Pendiente la revisión legal (ESTADO). */
export const VERSION_TERMINOS = '2026-10-m7';

/** Términos de uso de la beta con el texto de `08 §1` (checklist §7.1). */
export const TERMINOS: readonly SeccionAviso[] = [
  {
    titulo: 'Qué es Finanvoz',
    parrafos: [
      'Una herramienta para registrar y analizar tus finanzas personales con los datos que tú le das o que llegan a tu teléfono. Te da estimaciones con tu propio historial: cuánto puedes gastar, la probabilidad de llegar a tu próximo ingreso y si te alcanza para una compra.',
    ],
  },
  {
    titulo: 'Qué no es',
    parrafos: [
      TEXTO_NO_ASESORIA,
      'Finanvoz no mueve dinero, no ofrece crédito, no recomienda valores ni productos financieros, no se conecta a tus cuentas con tus claves del banco, no emite facturas ni presenta declaraciones.',
      'Las decisiones sobre tu dinero son tuyas. Revisa siempre la información de tu banco antes de pagar o comprar.',
    ],
  },
  {
    titulo: 'Tus datos',
    parrafos: [
      'Tus datos financieros viven cifrados en tu teléfono. Cómo los tratamos está en el aviso de privacidad. Puedes descargarlos o borrarlos cuando quieras desde Ajustes › Privacidad, gratis.',
    ],
  },
  {
    titulo: 'Planes',
    parrafos: [
      'Registrar, ver y descargar tus datos es gratis siempre. Plus agrega funciones de análisis; su precio, periodo, prueba gratuita y forma de cancelar se muestran antes de comprar y el cobro lo hace la tienda. Si cancelas o termina la prueba, vuelves a Gratis sin perder tus datos.',
    ],
  },
  {
    titulo: 'Versión de prueba',
    parrafos: [
      'Esta es una versión beta: puede tener errores. Si algo no cuadra, escríbenos y lo revisamos.',
    ],
  },
  {
    titulo: 'Contacto',
    parrafos: [`${RESPONSABLE.nombre}. ${RESPONSABLE.domicilio}. ${RESPONSABLE.correo}.`],
  },
];
