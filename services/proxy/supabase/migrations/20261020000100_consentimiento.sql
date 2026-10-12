-- M7 · Evidencia mínima del consentimiento en el servidor (docs/08-CUMPLIMIENTO.md §2, checklist §7.1):
-- `{usuario_anonimo, version_aviso, aceptado_en}` para poder demostrar que la persona aceptó el aviso.
-- Privacidad (regla 9): ningún dato financiero; el usuario es el anónimo de Supabase Auth.
-- La app (rol `authenticated`, sesión anónima) solo puede insertar su propia evidencia: no puede leerla,
-- cambiarla ni borrarla. Si el usuario de Auth se elimina, su evidencia se va con él.

create table public.consentimiento (
  usuario_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  version_aviso text not null check (char_length(version_aviso) between 1 and 40),
  aceptado_en timestamptz not null,
  recibido_en timestamptz not null default now(),
  primary key (usuario_id, version_aviso)
);

alter table public.consentimiento enable row level security;

create policy consentimiento_insertar_propio on public.consentimiento
  for insert to authenticated
  with check (usuario_id = auth.uid());

revoke all on public.consentimiento from public, anon, authenticated;
grant insert (version_aviso, aceptado_en) on public.consentimiento to authenticated;
