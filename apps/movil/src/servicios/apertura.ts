import { purgarTextosCaptura } from './capturas';
import type { Contexto } from './contexto';
import { procesarCortes, type CorteCerrado } from './cortes';
import { procesarIntencionesMeses, type PasadoAMeses } from './msi';
import { materializarOcurrencias } from './ocurrencias';
import { procesarSuscripcionesDelDia } from './suscripciones';

export interface ResultadoApertura {
  readonly ocurrenciasCreadas: number;
  readonly cortesCerrados: readonly CorteCerrado[];
  readonly pasadosAMeses: readonly PasadoAMeses[];
}

/**
 * Procesos de sistema al abrir la app y en Hoy (`03 §5.3`, `03 §5.6`), todos idempotentes: materializar
 * ocurrencias, cerrar los cortes pendientes (E5.3, con la reclasificación MSI de E6.2) y convertir en planes las
 * intenciones "pasar a meses" que dejó M3. Repetirlo no duplica nada.
 */
export function procesarApertura(ctx: Contexto): ResultadoApertura {
  const ocurrenciasCreadas = materializarOcurrencias(ctx);
  const cortesCerrados = procesarCortes(ctx);
  const pasadosAMeses = procesarIntencionesMeses(ctx);
  // Texto crudo de capturas: solo 30 días en el teléfono (`04 §6`).
  purgarTextosCaptura(ctx);
  // E14 corre una vez al día, no en cada apertura de Hoy (`03 §7`).
  procesarSuscripcionesDelDia(ctx);
  return { ocurrenciasCreadas, cortesCerrados, pasadosAMeses };
}
