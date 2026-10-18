-- Pendiente 57 · Listar usuarios anónimos huérfanos candidatos a borrar en Auth (solo lectura).
-- Criterios (conservadores, alineados con `_shared/auth/anonimo-sin-uso.ts`):
--   · sesión anónima (`auth.users.is_anonymous`)
--   · sin correo confirmado (no cuenta de respaldo)
--   · sin archivos en bucket `respaldos`
--   · sin Plus/Negocio vigente en `derechos`
--   · sin membresía en grupo compartido abierto
--   · inactivo más de N días (`last_sign_in_at`, o `created_at` si nunca entró)
-- Solo service_role ejecuta; la app y los JWT no ven esta función.

create or replace function public.anonimos_sin_uso_candidatos(p_inactivo_dias integer)
returns table (usuario_id uuid, inactivo_desde timestamptz)
language sql
security definer
set search_path = public, auth, storage
stable
as $$
  select
    u.id as usuario_id,
    coalesce(u.last_sign_in_at, u.created_at) as inactivo_desde
  from auth.users u
  where coalesce(u.is_anonymous, false) = true
    and u.email_confirmed_at is null
    and coalesce(u.last_sign_in_at, u.created_at)
      < now() - make_interval(days => greatest(p_inactivo_dias, 1))
    and not exists (
      select 1
      from storage.objects o
      where o.bucket_id = 'respaldos'
        and o.name like u.id::text || '/%'
    )
    and not exists (
      select 1
      from public.derechos d
      where d.usuario_id = u.id
        and d.plan in ('plus', 'negocio')
        and (d.vigente_hasta is null or d.vigente_hasta > now())
    )
    and not exists (
      select 1
      from public.miembros_compartidos m
      join public.grupos_compartidos g on g.id = m.grupo_id
      where m.usuario = u.id
        and g.cerrado_en is null
    );
$$;

revoke all on function public.anonimos_sin_uso_candidatos(integer) from public;
grant execute on function public.anonimos_sin_uso_candidatos(integer) to service_role;
