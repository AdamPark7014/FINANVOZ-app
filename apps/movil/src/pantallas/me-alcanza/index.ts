import type { ConsultaMeAlcanza } from '../../servicios';

export { PantallaMeAlcanza, type CalcularMeAlcanza } from './PantallaMeAlcanza';
export * from './textos';
export { avisoRecordatorio, PREFIJO_RECORDATORIO_COMPRA } from './recordatorio';

/**
 * La consulta de "¿me alcanza para unos tenis de 1,500?" viaja en memoria, no en la ruta: las rutas pueden
 * terminar en breadcrumbs de errores y ningún monto sale del teléfono (regla 9). La pantalla la toma una vez.
 */
let consultaPendiente: ConsultaMeAlcanza | null = null;

export function tomarConsultaPendiente(): ConsultaMeAlcanza | null {
  const c = consultaPendiente;
  consultaPendiente = null;
  return c;
}

/** Abre `/me-alcanza`: con la consulta dicha calcula de inmediato; sin ella muestra el formulario. */
export function abrirMeAlcanza(
  router: { push: (ruta: '/me-alcanza') => void },
  consulta?: ConsultaMeAlcanza,
): void {
  consultaPendiente = consulta ?? null;
  router.push('/me-alcanza');
}
