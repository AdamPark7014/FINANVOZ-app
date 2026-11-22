import { AccessibilityInfo, LayoutAnimation, Platform } from 'react-native';

/**
 * Transición suave de la disposición (pase de pulido, 22-11): al abrir o cerrar un detalle, un acordeón o un
 * formulario en línea, lo de abajo se recorre en vez de saltar. 240 ms con curva suave; nada si la persona pidió
 * «Reducir movimiento» en el teléfono (`02 §15`) o en pruebas.
 */
let reducir = false;
let suscrito = false;

function vigilarReducir(): void {
  if (suscrito) return;
  suscrito = true;
  try {
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => {
        reducir = v === true;
      })
      .catch(() => undefined);
    AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v: boolean) => {
      reducir = v === true;
    });
  } catch {
    // Sin el módulo de accesibilidad: se anima.
  }
}

export function animarDisposicion(): void {
  vigilarReducir();
  if (reducir || process.env.NODE_ENV === 'test' || Platform.OS === 'web') return;
  try {
    LayoutAnimation.configureNext({
      duration: 240,
      create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    });
  } catch {
    // Si la plataforma no la soporta, el cambio sucede sin animación.
  }
}
