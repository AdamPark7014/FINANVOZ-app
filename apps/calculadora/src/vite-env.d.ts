/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL de la Edge Function `lista-espera` de Supabase. */
  readonly VITE_LISTA_ESPERA_URL?: string;
  /** Responsable del aviso de privacidad (08 §2.1). Sin estos tres valores la publicación se bloquea. */
  readonly VITE_RESPONSABLE_NOMBRE?: string;
  readonly VITE_RESPONSABLE_DOMICILIO?: string;
  readonly VITE_RESPONSABLE_CORREO?: string;
}
