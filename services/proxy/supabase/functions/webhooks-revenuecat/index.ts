// Edge Function `webhooks-revenuecat` = `POST /webhooks/revenuecat` (docs/03-ARQUITECTURA.md §6, M7, CA-M7-01).
// URL: https://<ref>.supabase.co/functions/v1/webhooks-revenuecat (se despliega con `--no-verify-jwt`: RevenueCat
// no tiene sesión de Supabase; la autoriza el secreto compartido).
// Variables (en el proyecto de Supabase, nunca en el repositorio, regla 8): SUPABASE_URL y
// SUPABASE_SERVICE_ROLE_KEY (las inyecta Supabase) y REVENUECAT_WEBHOOK_SECRETO (el mismo valor que va, con
// "Bearer ", en el encabezado Authorization del webhook en el panel de RevenueCat).
// Privacidad (regla 9): solo se registran el tipo de evento y el resultado.
import { createClient } from '@supabase/supabase-js';
import { registrarEnConsola } from '../_shared/nlu/registro.ts';
import { crearManejadorRevenueCat } from '../_shared/revenuecat/manejador.ts';

const env = (nombre: string) => Deno.env.get(nombre)?.trim() || undefined;

const supabase = createClient(env('SUPABASE_URL') ?? '', env('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
  auth: { persistSession: false, autoRefreshToken: false },
});

const manejador = crearManejadorRevenueCat({
  secreto: env('REVENUECAT_WEBHOOK_SECRETO'),
  async aplicar(accion) {
    const { data, error } =
      accion.tipo === 'transferir'
        ? await supabase.rpc('transferir_derecho_revenuecat', {
            p_evento_id: accion.eventoId,
            p_de: accion.de,
            p_a: accion.a,
            p_evento_ms: accion.eventoMs,
          })
        : await supabase.rpc('aplicar_derecho_revenuecat', {
            p_evento_id: accion.eventoId,
            p_usuarios: accion.usuarios,
            p_plan: accion.plan,
            p_vigente_hasta: accion.vigenteHasta,
            p_en_prueba: accion.enPrueba,
            p_evento_ms: accion.eventoMs,
          });
    if (error || typeof data !== 'string') throw new Error('derechos');
    return data;
  },
  registrar: registrarEnConsola,
});

Deno.serve(manejador);
