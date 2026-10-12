-- M10 · Plantillas remotas firmadas (docs/07-CAPTURA.md §3.1, docs/03-ARQUITECTURA.md §5.8).
-- Bucket público `plantillas` con dos objetos: `plantillas.json` y `plantillas.json.sig` (Ed25519 sobre los bytes
-- exactos del archivo). La app los baja sin sesión de `/storage/v1/object/public/plantillas/plantillas.json` y
-- verifica la firma con las llaves públicas que trae embebidas: el bucket no necesita ser confiable, solo
-- disponible. Lectura pública por la ruta `public`; nadie con JWT (anon ni authenticated) sube, cambia ni borra:
-- no hay políticas de INSERT, UPDATE ni DELETE para este bucket. Se publica desde el panel de Supabase o con la
-- service role, después de firmar fuera del repositorio (scripts/firmar-plantillas.mjs).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'plantillas',
  'plantillas',
  true,
  1048576,
  array['application/json', 'text/plain', 'application/octet-stream']
)
on conflict (id) do nothing;
