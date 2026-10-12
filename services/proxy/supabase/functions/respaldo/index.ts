// Edge Function `respaldo` = `POST /respaldo/url`, `GET /respaldo/lista` y `DELETE /respaldo/cuenta`
// (docs/03-ARQUITECTURA.md §5.7 y §6, M9). URL: https://<ref>.supabase.co/functions/v1/respaldo/<url|lista|cuenta>.
// Se despliega con la verificación de JWT del gateway activa. Solo una sesión de correo (no anónima) la usa.
// Variables (las inyecta Supabase; nunca en el repositorio, regla 8): SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
// El servidor nunca lee el contenido de los respaldos (blobs `.cartera` cifrados en el teléfono, E16).
// Privacidad (regla 9): solo se registran ruta, operación y resultado (`_shared/respaldo/manejador.ts`).
import { createClient } from '@supabase/supabase-js';
import { registrarEnConsola } from '../_shared/nlu/registro.ts';
import {
  type AlmacenRespaldos,
  crearManejadorRespaldo,
  type ObjetoAlmacen,
} from '../_shared/respaldo/manejador.ts';

const BUCKET = 'respaldos';
const PAGINA = 100;

const env = (nombre: string) => Deno.env.get(nombre)?.trim() || undefined;
const url = env('SUPABASE_URL');
const llave = env('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(url ?? '', llave ?? '', {
  auth: { persistSession: false, autoRefreshToken: false },
});
const bucket = () => supabase.storage.from(BUCKET);

const almacen: AlmacenRespaldos = {
  async listar(usuarioId) {
    const objetos: ObjetoAlmacen[] = [];
    for (let offset = 0; ; offset += PAGINA) {
      const { data, error } = await bucket().list(usuarioId, {
        limit: PAGINA,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      });
      if (error || !data) throw new Error('listar');
      for (const o of data) {
        // Las "carpetas" (id null) no son objetos; no debería haber ninguna bajo el prefijo.
        if (o.id === null) continue;
        const tamano = Number((o.metadata as { size?: unknown } | null)?.size ?? 0);
        objetos.push({
          nombre: o.name,
          tamano: Number.isFinite(tamano) ? tamano : 0,
          creado_en: o.created_at,
        });
      }
      if (data.length < PAGINA) return objetos;
    }
  },
  async firmarSubida(ruta) {
    const { data, error } = await bucket().createSignedUploadUrl(ruta);
    if (error || !data) throw new Error('firmar_subida');
    return data.signedUrl;
  },
  async firmarBajada(ruta, segundos) {
    const { data, error } = await bucket().createSignedUrl(ruta, segundos);
    if (error || !data) throw new Error('firmar_bajada');
    return data.signedUrl;
  },
  async borrar(rutas) {
    const { error } = await bucket().remove([...rutas]);
    if (error) throw new Error('borrar');
  },
};

const manejador = crearManejadorRespaldo({
  configurado: url !== undefined && llave !== undefined,
  async verificarUsuario(jwt) {
    const { data, error } = await supabase.auth.getUser(jwt);
    if (error || !data.user) return null;
    const u = data.user;
    return { id: u.id, conCorreo: u.is_anonymous !== true && !!u.email && !!u.email_confirmed_at };
  },
  almacen,
  async borrarUsuario(usuarioId) {
    const { error } = await supabase.auth.admin.deleteUser(usuarioId);
    if (error) throw new Error('borrar_usuario');
  },
  ahora: () => Date.now(),
  registrar: registrarEnConsola,
});

Deno.serve(manejador);
