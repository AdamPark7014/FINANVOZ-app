// Edge Function `llm-turno` = `POST /llm/turno` (docs/03-ARQUITECTURA.md §6, docs/06-NLU.md §6, M10).
// URL: https://<ref>.supabase.co/functions/v1/llm-turno
// Usa las mismas variables que `nlu-interpretar` (regla 8: solo en el proyecto de Supabase): SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY, NLU_PROVEEDORES, ANTHROPIC_API_KEY / OPENAI_API_KEY / GOOGLE_API_KEY,
// NLU_MODELO_<PROVEEDOR> (opcionales), NLU_TOPE_GLOBAL_DIARIO y NLU_SAL_USUARIO. Opcional:
// LLM_MODELO_<PROVEEDOR> para usar otro modelo solo en el modo explicar; ANTHROPIC_BASE_URL (raíz compatible con
// la API de Anthropic, p. ej. https://ia.zynoratek.com).
// Privacidad (regla 9): solo se registran metadatos (`_shared/nlu/registro.ts`).
import { createClient } from '@supabase/supabase-js';
import { crearManejadorTurno, esResultadoCupoTurno } from '../_shared/llm/manejador.ts';
import { type AdaptadorTurno, CREADORES_TURNO } from '../_shared/llm/proveedores.ts';
import { fechaCivil } from '../_shared/llm/fecha.ts';
import { turno } from '../_shared/llm/turno.ts';
import { leerTopeGlobal } from '../_shared/nlu/limites.ts';
import { NOMBRES_PROVEEDOR, type NombreProveedor } from '../_shared/nlu/proveedores.ts';
import { hashUsuario, registrarEnConsola } from '../_shared/nlu/registro.ts';

const env = (nombre: string) => Deno.env.get(nombre)?.trim() || undefined;

const LLAVE: Record<NombreProveedor, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  google: 'GOOGLE_API_KEY',
};

function adaptadores(): AdaptadorTurno[] {
  const nombres = (env('NLU_PROVEEDORES') ?? 'anthropic,openai')
    .split(',')
    .map((n) => n.trim())
    .filter((n): n is NombreProveedor => (NOMBRES_PROVEEDOR as readonly string[]).includes(n))
    .slice(0, 2);
  const lista: AdaptadorTurno[] = [];
  for (const nombre of nombres) {
    const llave = env(LLAVE[nombre]);
    if (!llave) continue;
    const sufijo = nombre.toUpperCase();
    const modelo = env(`LLM_MODELO_${sufijo}`) ?? env(`NLU_MODELO_${sufijo}`);
    const urlBase = nombre === 'anthropic' ? env('ANTHROPIC_BASE_URL') : undefined;
    lista.push(
      CREADORES_TURNO[nombre]({
        llave,
        fetch: (url, init) => fetch(url, init),
        ...(modelo ? { modelo } : {}),
        ...(urlBase ? { urlBase } : {}),
      }),
    );
  }
  return lista;
}

const lista = adaptadores();
const topeGlobal = leerTopeGlobal(env('NLU_TOPE_GLOBAL_DIARIO'));
const sal = env('NLU_SAL_USUARIO');
const supabase = createClient(env('SUPABASE_URL') ?? '', env('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
  auth: { persistSession: false, autoRefreshToken: false },
});

const manejador = crearManejadorTurno({
  configurado: lista.length > 0 && topeGlobal !== null && sal !== undefined,
  async verificarUsuario(jwt) {
    const { data, error } = await supabase.auth.getUser(jwt);
    return error || !data.user ? null : data.user.id;
  },
  async consumirCupo(usuarioId) {
    const { data, error } = await supabase.rpc('consumir_turno_llm', {
      p_usuario: usuarioId,
      p_tope_global: topeGlobal,
    });
    if (error || !esResultadoCupoTurno(data)) throw new Error('cupo');
    return data;
  },
  async devolverCupo(usuarioId) {
    await supabase.rpc('devolver_interpretacion', { p_usuario: usuarioId });
  },
  turno: (solicitud) =>
    turno(solicitud, { adaptadores: lista, ahora: () => Date.now(), hoy: () => fechaCivil(Date.now()) }),
  hashUsuario: (id) => hashUsuario(id, sal ?? ''),
  registrar: registrarEnConsola,
});

Deno.serve(manejador);
