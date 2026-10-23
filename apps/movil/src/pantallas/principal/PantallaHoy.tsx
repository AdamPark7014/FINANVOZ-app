import type { OpcionesBloques } from '../../servicios';
import type { MotorDictado } from '../../voz';
import { PantallaAsistente } from '../asistente/PantallaAsistente';
import type { NavegacionAsistente } from '../asistente/useAsistente';

/** Nombre anterior de la navegación de Hoy: es la del asistente. */
export type NavegacionHoy = NavegacionAsistente;

/**
 * Hoy ya es el asistente (Ola 7, `src/pantallas/asistente`): esta envoltura queda para lo que todavía importa
 * `PantallaHoy` (pruebas de otras pantallas). Sus piezas viven como turnos o en el desglose.
 */
export function PantallaHoy({
  navegacion,
  motor,
  bloques,
}: {
  navegacion: NavegacionHoy;
  motor?: MotorDictado;
  /** Opciones del cálculo por bloques de la probabilidad (pruebas). */
  bloques?: Omit<OpcionesBloques, 'senal'>;
}) {
  return (
    <PantallaAsistente
      navegacion={navegacion}
      {...(motor ? { motor } : {})}
      {...(bloques ? { bloques } : {})}
    />
  );
}
