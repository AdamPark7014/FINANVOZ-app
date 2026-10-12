-- M3 · Límites del intérprete en la nube (docs/03-ARQUITECTURA.md §6, docs/01-PRD.md §11).
-- Gratis: 30 al mes y 20 al día. Plus (y Negocio): 300 al mes y 60 al día. Tope global diario de todos los
-- usuarios con el valor de NLU_TOPE_GLOBAL_DIARIO. Días y meses en hora de la Ciudad de México.
-- Solo la Edge Function (service role) usa estas tablas: RLS activo y sin políticas.
-- Privacidad (regla 9): solo conteos; nada de texto, montos ni respuestas.

-- Derechos por usuario. Sin fila = gratis. RevenueCat la actualizará en M10 (`/webhooks/revenuecat`).
create table public.derechos (
  usuario_id uuid primary key references auth.users (id) on delete cascade,
  plan text not null default 'gratis' check (plan in ('gratis', 'plus', 'negocio')),
  -- Nulo = sin vencimiento. Vencido = gratis.
  vigente_hasta timestamptz,
  actualizado_en timestamptz not null default now()
);

create table public.nlu_uso_diario (
  usuario_id uuid not null references auth.users (id) on delete cascade,
  dia date not null,
  usos integer not null default 0 check (usos >= 0),
  primary key (usuario_id, dia)
);

create table public.nlu_uso_global (
  dia date primary key,
  usos integer not null default 0 check (usos >= 0)
);

alter table public.derechos enable row level security;
alter table public.nlu_uso_diario enable row level security;
alter table public.nlu_uso_global enable row level security;

-- Consume una interpretación si cabe en los límites. Atómica: un candado por usuario serializa sus peticiones
-- y el tope global se incrementa con una sola sentencia condicional.
-- Devuelve 'ok', 'limite_mensual', 'limite_diario' o 'tope_global' (en ese orden de precedencia).
create function public.consumir_interpretacion(p_usuario uuid, p_tope_global integer)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hoy date := (now() at time zone 'America/Mexico_City')::date;
  v_inicio_mes date := date_trunc('month', (now() at time zone 'America/Mexico_City'))::date;
  v_plan text;
  v_limite_diario integer;
  v_limite_mensual integer;
  v_usos_hoy integer;
  v_usos_mes integer;
begin
  perform pg_advisory_xact_lock(hashtext('nlu:' || p_usuario::text));

  select d.plan into v_plan
  from derechos d
  where d.usuario_id = p_usuario and (d.vigente_hasta is null or d.vigente_hasta > now());
  v_plan := coalesce(v_plan, 'gratis');

  if v_plan = 'gratis' then
    v_limite_diario := 20;
    v_limite_mensual := 30;
  else
    v_limite_diario := 60;
    v_limite_mensual := 300;
  end if;

  select coalesce(sum(u.usos) filter (where u.dia = v_hoy), 0), coalesce(sum(u.usos), 0)
    into v_usos_hoy, v_usos_mes
  from nlu_uso_diario u
  where u.usuario_id = p_usuario and u.dia >= v_inicio_mes and u.dia <= v_hoy;

  if v_usos_mes >= v_limite_mensual then
    return 'limite_mensual';
  end if;
  if v_usos_hoy >= v_limite_diario then
    return 'limite_diario';
  end if;

  if p_tope_global is null or p_tope_global <= 0 then
    return 'tope_global';
  end if;
  insert into nlu_uso_global as g (dia, usos) values (v_hoy, 1)
  on conflict (dia) do update set usos = g.usos + 1 where g.usos < p_tope_global;
  if not found then
    return 'tope_global';
  end if;

  insert into nlu_uso_diario as u (usuario_id, dia, usos) values (p_usuario, v_hoy, 1)
  on conflict (usuario_id, dia) do update set usos = u.usos + 1;
  return 'ok';
end;
$$;

-- Devuelve al usuario una interpretación que no se pudo entregar (502/504). El tope global no se devuelve:
-- la llamada al proveedor ya pudo costar.
create function public.devolver_interpretacion(p_usuario uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update nlu_uso_diario
  set usos = usos - 1
  where usuario_id = p_usuario
    and dia = (now() at time zone 'America/Mexico_City')::date
    and usos > 0;
end;
$$;

revoke all on function public.consumir_interpretacion(uuid, integer) from public, anon, authenticated;
revoke all on function public.devolver_interpretacion(uuid) from public, anon, authenticated;
grant execute on function public.consumir_interpretacion(uuid, integer) to service_role;
grant execute on function public.devolver_interpretacion(uuid) to service_role;

-- Tablero de costos (RNF-07): conteo diario global, sin datos por usuario.
create view public.nlu_uso_resumen with (security_invoker = true) as
select dia, usos from public.nlu_uso_global order by dia desc;
