// Edge Function `lista-espera` (M0). Guarda correo y respuestas con consentimiento y limita envíos por IP.
// Variables (en el proyecto de Supabase, nunca en el repositorio): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// (las inyecta Supabase), LISTA_ESPERA_SAL (secreto para la huella de IP) y CALCULADORA_ORIGEN.
// Privacidad (regla 9): no se registra el correo, la IP ni las respuestas en logs.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { huellaIp, ipCliente, responder as responderCon, validarSolicitud } from '../_shared/lista-espera.ts';

const LIMITE_POR_HORA = 5;
const TAMANO_MAXIMO = 2048;

const origen = Deno.env.get('CALCULADORA_ORIGEN') ?? '';
const sal = Deno.env.get('LISTA_ESPERA_SAL') ?? '';
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  {
    auth: { persistSession: false },
  },
);

function responder(estado: number, cuerpo: Record<string, unknown> | null): Response {
  return responderCon(estado, cuerpo, origen);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return responder(204, null);
  if (req.method !== 'POST') return responder(405, { codigo: 'metodo' });
  if (!sal || !origen) return responder(503, { codigo: 'sin_configurar' });

  const texto = await req.text();
  if (texto.length > TAMANO_MAXIMO) return responder(413, { codigo: 'formato' });
  let cuerpo: unknown;
  try {
    cuerpo = JSON.parse(texto);
  } catch {
    return responder(400, { codigo: 'formato' });
  }

  const v = validarSolicitud(cuerpo);
  if (v.tipo === 'bot') return responder(200, { ok: true });
  if (v.tipo === 'invalida') return responder(400, { codigo: v.codigo });

  const { data, error } = await supabase.rpc('registrar_lista_espera', {
    p_huella_ip: await huellaIp(ipCliente(req.headers), sal),
    p_correo: v.solicitud.correo,
    p_respuestas: v.solicitud.respuestas,
    p_version_aviso: v.solicitud.versionAviso,
    p_limite_por_hora: LIMITE_POR_HORA,
  });
  if (error) {
    console.error('lista-espera: error de base', error.code);
    return responder(500, { codigo: 'error' });
  }
  if (data === 'limite') return responder(429, { codigo: 'limite' });
  return responder(200, { ok: true });
});
