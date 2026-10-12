-- M9 · Respaldo en la nube (docs/03-ARQUITECTURA.md §5.7 y §6, docs/08-CUMPLIMIENTO.md §2.2).
-- El servidor guarda blobs `.cartera` cifrados en el teléfono (E16) que no puede abrir: ningún dato financiero,
-- ningún nombre de archivo elegido por el usuario (el proxy pone `<usuario>/<AAAAMMDDTHHMMSSZ>-v<version>.cartera`).
-- Bucket privado `respaldos`; la app no lo toca con su JWT: usa URLs firmadas que emite la Edge Function
-- `respaldo` (service role). Las políticas de abajo son la segunda barrera para quien llame a Storage directo con
-- su JWT: solo una sesión de correo (no anónima) ve, sube o borra objetos bajo su propio prefijo. No hay política
-- de UPDATE: un respaldo no se sobrescribe (cada uno es un archivo nuevo; se conservan los 4 más recientes).
-- Límite: 12.5 MB por archivo (4 × 12.5 MB = 50 MB por usuario, 03 §6).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('respaldos', 'respaldos', false, 13107200, array['application/octet-stream'])
on conflict (id) do nothing;

-- Sesión de correo: el JWT trae `is_anonymous = false`. Si falta el claim se trata como anónima (lo conservador).
create or replace function public.respaldo_sesion_correo() returns boolean
language sql stable
set search_path = ''
as $$
  select auth.uid() is not null
     and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, true) = false
$$;

revoke all on function public.respaldo_sesion_correo() from public;
grant execute on function public.respaldo_sesion_correo() to authenticated;

create policy respaldo_leer_propio on storage.objects
  for select to authenticated
  using (
    bucket_id = 'respaldos'
    and public.respaldo_sesion_correo()
    and split_part(name, '/', 1) = (select auth.uid())::text
  );

create policy respaldo_subir_propio on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'respaldos'
    and public.respaldo_sesion_correo()
    and name ~ ('^' || (select auth.uid())::text || '/[0-9]{8}T[0-9]{6}Z-v[0-9]{1,3}\.cartera$')
  );

create policy respaldo_borrar_propio on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'respaldos'
    and public.respaldo_sesion_correo()
    and split_part(name, '/', 1) = (select auth.uid())::text
  );
