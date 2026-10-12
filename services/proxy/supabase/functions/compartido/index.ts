// Edge Function `compartido` = `POST /compartido/grupos|codigo|unirse|salir|eventos` y `GET /compartido/eventos`
// (docs/03-ARQUITECTURA.md §5.10 y §6, M16). URL: https://<ref>.supabase.co/functions/v1/compartido/<ruta>.
// Se despliega con la verificación de JWT del gateway activa (sesión anónima o de correo de la app).
// Variables (las inyecta Supabase; nunca en el repositorio, regla 8): SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
// El servidor solo guarda eventos cifrados en el teléfono (E17); nunca ve la llave del grupo.
// Privacidad (regla 9): solo se registran ruta y código (`_shared/compartido/manejador.ts`).
import { createClient } from '@supabase/supabase-js';
import { crearManejadorCompartido } from '../_shared/compartido/manejador.ts';
import { registrarEnConsola } from '../_shared/nlu/registro.ts';

const env = (nombre: string) => Deno.env.get(nombre)?.trim() || undefined;
const url = env('SUPABASE_URL');
const llave = env('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(url ?? '', llave ?? '', {
  auth: { persistSession: false, autoRefreshToken: false },
});

const manejador = crearManejadorCompartido({
  configurado: url !== undefined && llave !== undefined,
  async verificarUsuario(jwt) {
    const { data, error } = await supabase.auth.getUser(jwt);
    return error || !data.user ? null : data.user.id;
  },
  async llamar(funcion, parametros) {
    const { data, error } = await supabase.rpc(funcion, parametros);
    if (error) throw new Error('rpc');
    return data;
  },
  aleatorio: (n) => crypto.getRandomValues(new Uint8Array(n)),
  ahora: () => Date.now(),
  registrar: registrarEnConsola,
});

Deno.serve(manejador);
