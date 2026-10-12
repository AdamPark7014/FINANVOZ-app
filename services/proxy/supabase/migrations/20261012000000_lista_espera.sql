-- M0 · Lista de espera (docs/08-CUMPLIMIENTO.md §2.1). Solo la Edge Function (service role) escribe;
-- RLS activo y sin políticas: nadie con la llave anónima puede leer ni escribir.

create table public.lista_espera (
  correo text primary key check (correo = lower(correo) and length(correo) <= 254),
  respuestas jsonb not null,
  version_aviso text not null,
  aceptado_en timestamptz not null default now(),
  creado_en timestamptz not null default now()
);

-- Huella irreversible de la IP para limitar envíos; se borra a las 24 horas.
create table public.lista_espera_intentos (
  huella_ip text not null,
  creado_en timestamptz not null default now()
);
create index lista_espera_intentos_huella on public.lista_espera_intentos (huella_ip, creado_en);

alter table public.lista_espera enable row level security;
alter table public.lista_espera_intentos enable row level security;

create function public.registrar_lista_espera(
  p_huella_ip text,
  p_correo text,
  p_respuestas jsonb,
  p_version_aviso text,
  p_limite_por_hora integer
) returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from lista_espera_intentos where creado_en < now() - interval '24 hours';

  if (select count(*) from lista_espera_intentos
      where huella_ip = p_huella_ip and creado_en > now() - interval '1 hour') >= p_limite_por_hora then
    return 'limite';
  end if;
  insert into lista_espera_intentos (huella_ip) values (p_huella_ip);

  -- Volver a anotarse actualiza respuestas y consentimiento (evidencia: versión y fecha más recientes).
  insert into lista_espera (correo, respuestas, version_aviso)
  values (p_correo, p_respuestas, p_version_aviso)
  on conflict (correo) do update
    set respuestas = excluded.respuestas,
        version_aviso = excluded.version_aviso,
        aceptado_en = now();
  return 'ok';
end;
$$;

revoke all on function public.registrar_lista_espera(text, text, jsonb, text, integer) from public, anon, authenticated;
grant execute on function public.registrar_lista_espera(text, text, jsonb, text, integer) to service_role;

-- Conteo para decidir M11 (docs/10-NEGOCIO.md §1): cuántos eligieron "Mi negocio o freelance".
create view public.lista_espera_resumen with (security_invoker = true) as
select respuestas ->> 'uso' as uso, count(*) as personas
from public.lista_espera
group by 1;
