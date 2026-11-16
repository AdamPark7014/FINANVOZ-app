/** Precios públicos iniciales (centavos). Adam los ajusta en Ajustes del admin. */
export const PRECIOS_PUBLICOS = {
  plusMensualCentavos: 9900,
  plusAnualCentavos: 99000,
  licenciaMesCentavos: 2000,
} as const;

export const MARCA = 'Finanvoz';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
export const PROSPECTO_URL = import.meta.env.VITE_PROSPECTO_URL ?? '';
export const APP_STORE_URL = import.meta.env.VITE_APP_STORE_URL ?? '';
export const PLAY_STORE_URL = import.meta.env.VITE_PLAY_STORE_URL ?? '';
