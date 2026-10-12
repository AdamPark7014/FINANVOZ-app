/** Nombre comercial propuesto; "Cartera" sigue siendo el nombre de trabajo del repositorio (ESTADO, pendiente 5). */
export const MARCA = 'Finanvoz';

/** Cambia cuando cambie el texto del aviso; se guarda con cada consentimiento. */
export const VERSION_AVISO = '2026-10-12';

export const LISTA_ESPERA_URL = import.meta.env.VITE_LISTA_ESPERA_URL ?? '';

export const RESPONSABLE = {
  nombre: import.meta.env.VITE_RESPONSABLE_NOMBRE ?? '',
  domicilio: import.meta.env.VITE_RESPONSABLE_DOMICILIO ?? '',
  correo: import.meta.env.VITE_RESPONSABLE_CORREO ?? '',
};

export const RESPONSABLE_DEFINIDO = Boolean(
  RESPONSABLE.nombre && RESPONSABLE.domicilio && RESPONSABLE.correo,
);
