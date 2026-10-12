// Edge Function `nlu-interpretar` = `POST /nlu/interpretar` (docs/03-ARQUITECTURA.md §6, M3).
// URL: https://<ref>.supabase.co/functions/v1/nlu-interpretar
// Variables (en el proyecto de Supabase, nunca en el repositorio, regla 8): SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY (las inyecta Supabase), NLU_PROVEEDORES (p. ej. "anthropic,openai": principal y
// alterno), ANTHROPIC_API_KEY / OPENAI_API_KEY / GOOGLE_API_KEY (las de los proveedores elegidos),
// NLU_MODELO_ANTHROPIC / NLU_MODELO_OPENAI / NLU_MODELO_GOOGLE (opcionales), NLU_ANTHROPIC_MODO (opcional:
// json_schema | herramienta), NLU_TOPE_GLOBAL_DIARIO y NLU_SAL_USUARIO (sal del hash de usuario en los registros).
// Privacidad (regla 9): solo se registran metadatos (`_shared/nlu/registro.ts`).
import { createClient } from '@supabase/supabase-js';
import { interpretar } from '../_shared/nlu/interpretar.ts';
import { esResultadoCupo, leerTopeGlobal } from '../_shared/nlu/limites.ts';
import { crearManejador } from '../_shared/nlu/manejador.ts';
import {
  type Adaptador,
  CREADORES,
  NOMBRES_PROVEEDOR,
  type NombreProveedor,
} from '../_shared/nlu/proveedores.ts';
import { hashUsuario, registrarEnConsola } from '../_shared/nlu/registro.ts';
import { validarInterpretacion } from '../_shared/nlu/validar.ts';

const env = (nombre: string) => Deno.env.get(nombre)?.trim() || undefined;

const LLAVE: Record<NombreProveedor, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  google: 'GOOGLE_API_KEY',
};

function adaptadores(): Adaptador[] {
  const nombres = (env('NLU_PROVEEDORES') ?? 'anthropic,openai')
    .split(',')
    .map((n) => n.trim())
    .filter((n): n is NombreProveedor => (NOMBRES_PROVEEDOR as readonly string[]).includes(n))
    .slice(0, 2);
  const lista: Adaptador[] = [];
  for (const nombre of nombres) {
    const llave = env(LLAVE[nombre]);
    if (!llave) continue;
    const modelo = env(`NLU_MODELO_${nombre.toUpperCase()}`);
    const modo = env('NLU_ANTHROPIC_MODO') === 'herramienta' ? 'herramienta' : 'json_schema';
    lista.push(
      CREADORES[nombre]({
        llave,
        fetch: (url, init) => fetch(url, init),
        ...(modelo ? { modelo } : {}),
        modoAnthropic: modo,
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

const manejador = crearManejador({
  configurado: lista.length > 0 && topeGlobal !== null && sal !== undefined,
  async verificarUsuario(jwt) {
    const { data, error } = await supabase.auth.getUser(jwt);
    return error || !data.user ? null : data.user.id;
  },
  async consumirCupo(usuarioId) {
    const { data, error } = await supabase.rpc('consumir_interpretacion', {
      p_usuario: usuarioId,
      p_tope_global: topeGlobal,
    });
    if (error || !esResultadoCupo(data)) throw new Error('cupo');
    return data;
  },
  async devolverCupo(usuarioId) {
    await supabase.rpc('devolver_interpretacion', { p_usuario: usuarioId });
  },
  interpretar: (texto, contexto) =>
    interpretar(texto, contexto, {
      adaptadores: lista,
      validar: validarInterpretacion,
      ahora: () => Date.now(),
    }),
  hashUsuario: (id) => hashUsuario(id, sal ?? ''),
  registrar: registrarEnConsola,
});

Deno.serve(manejador);
