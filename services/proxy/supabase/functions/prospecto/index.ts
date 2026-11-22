// Edge Function `prospecto`. Captación desde la página de venta.
// Variables (nunca en el repositorio): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// PROSPECTO_SAL, WEB_ORIGEN.
// Privacidad (regla 9): no se registra nombre, correo, teléfono, IP ni mensaje.
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  huellaIp,
  ipCliente,
  responder as responderCon,
  validarProspecto,
} from '../_shared/admin/prospecto.ts';

const LIMITE_POR_HORA = 5;
const TAMANO_MAXIMO = 4096;

const origen = Deno.env.get('WEB_ORIGEN') ?? '';
const sal = Deno.env.get('PROSPECTO_SAL') ?? '';
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false } },
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

  const v = validarProspecto(cuerpo);
  if (v.tipo === 'bot') return responder(200, { ok: true });
  if (v.tipo === 'invalida') return responder(400, { codigo: v.codigo });

  const { data, error } = await supabase.rpc('admin_registrar_prospecto', {
    p_huella_ip: await huellaIp(ipCliente(req.headers), sal),
    p_nombre: v.solicitud.nombre,
    p_contacto: v.solicitud.contacto,
    p_telefono: v.solicitud.telefono,
    p_correo: v.solicitud.correo,
    p_interes: v.solicitud.interes,
    p_mensaje: v.solicitud.mensaje,
    p_limite_por_hora: LIMITE_POR_HORA,
  });
  if (error) {
    console.error('prospecto: error de base', error.code);
    return responder(500, { codigo: 'error' });
  }
  if (data === 'limite') return responder(429, { codigo: 'limite' });
  if (data === 'invalido') return responder(400, { codigo: data });
  // Sin nadie activo en el equipo no hay a quién asignarlo: es configuración nuestra, no un error de quien escribe.
  if (data === 'sin_vendedor') return responder(503, { codigo: 'sin_configurar' });
  return responder(200, { ok: true });
});
