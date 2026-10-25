/**
 * Opciones de la barra nativa del Stack (`PLAN-UX-VOZ` ola 3 §3): título grande en iOS y chevron atrás,
 * sin botón «Volver» dentro del contenido. Colores los pone el tema del navegador / pantalla.
 */
export function opcionesBarraNativa(titulo: string): {
  readonly headerShown: true;
  readonly title: string;
  readonly headerBackTitle: '';
  readonly headerLargeTitle: true;
  readonly headerShadowVisible: false;
} {
  return {
    headerShown: true,
    title: titulo,
    headerBackTitle: '',
    headerLargeTitle: true,
    headerShadowVisible: false,
  };
}
