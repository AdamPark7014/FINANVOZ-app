import responsable from './responsable.json';

/** Nombre comercial propuesto; "Cartera" sigue siendo el nombre de trabajo del repositorio (ESTADO, pendiente 5). */
export const MARCA = 'Finanvoz';

/**
 * Cambia cuando cambie el texto del aviso; se guarda con cada consentimiento.
 * Misma convención que `VERSION_CONSENTIMIENTO` en `apps/movil/src/privacidad/consentimiento.ts`.
 */
export const VERSION_CONSENTIMIENTO = '2026-10-m8';

/** Alias histórico de la web (lista de espera envía `version_aviso`). */
export const VERSION_AVISO = VERSION_CONSENTIMIENTO;

export const LISTA_ESPERA_URL = import.meta.env.VITE_LISTA_ESPERA_URL ?? '';

/** Responsable del aviso (08 §2.1): los datos del aviso oficial de NEXARA. Las variables `VITE_RESPONSABLE_*` lo reemplazan. */
export const RESPONSABLE = {
  nombre: import.meta.env.VITE_RESPONSABLE_NOMBRE || responsable.nombre,
  domicilio: import.meta.env.VITE_RESPONSABLE_DOMICILIO || responsable.domicilio,
  correo: import.meta.env.VITE_RESPONSABLE_CORREO || responsable.correo,
};

export const RESPONSABLE_DEFINIDO = Boolean(
  RESPONSABLE.nombre && RESPONSABLE.domicilio && RESPONSABLE.correo,
);
