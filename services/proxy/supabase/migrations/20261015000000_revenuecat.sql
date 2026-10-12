-- M7 · Derechos desde RevenueCat (CA-M7-01, docs/01-PRD.md §11, docs/03-ARQUITECTURA.md §6
-- `POST /webhooks/revenuecat`). La Edge Function `webhooks-revenuecat` traduce cada evento firmado y llama a estas
-- funciones con el service role. `consumir_interpretacion` (20261013000000_nlu_uso.sql) ya lee `derechos` con su
-- `vigente_hasta`: un Plus vencido cuenta como Gratis aunque el evento de vencimiento no llegue.
-- Privacidad (regla 9): solo plan, vigencia y el id del evento; nada de precios, productos ni tiendas.

alter table public.derechos
  -- La prueba de 14 días cuenta como Plus (con su vencimiento); se guarda para saber si se pagó.
  add column en_prueba boolean not null default false,
  -- Instante del último evento aplicado (ms UTC): un evento más viejo que llega tarde no pisa a uno más nuevo.
  add column evento_ms bigint;

-- Ids de eventos ya procesados: RevenueCat reintenta y puede mandar el mismo evento más de una vez.
create table public.revenuecat_eventos (
  id text primary key check (length(id) between 1 and 200),
  recibido_en timestamptz not null default now()
);
alter table public.revenuecat_eventos enable row level security;

-- Aplica un plan a los usuarios del evento (app_user_id y sus alias que sean usuarios de Supabase).
-- Devuelve 'aplicado', 'duplicado' (el evento ya se procesó), 'antiguo' (todos tenían un evento más nuevo) o
-- 'sin_usuario' (ningún id existe en auth.users). Atómica: si algo falla no queda marcado el evento.
create function public.aplicar_derecho_revenuecat(
  p_evento_id text,
  p_usuarios uuid[],
  p_plan text,
  p_vigente_hasta timestamptz,
  p_en_prueba boolean,
  p_evento_ms bigint
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario uuid;
  v_aplicados integer := 0;
  v_existentes integer := 0;
begin
  if p_plan not in ('gratis', 'plus') then
    raise exception 'plan inválido';
  end if;
  insert into revenuecat_eventos (id) values (p_evento_id) on conflict (id) do nothing;
  if not found then
    return 'duplicado';
  end if;

  for v_usuario in
    select distinct u.id from auth.users u where u.id = any (p_usuarios) order by u.id
  loop
    v_existentes := v_existentes + 1;
    perform pg_advisory_xact_lock(hashtext('nlu:' || v_usuario::text));
    insert into derechos as d (usuario_id, plan, vigente_hasta, en_prueba, evento_ms, actualizado_en)
    values (v_usuario, p_plan, p_vigente_hasta, p_en_prueba, p_evento_ms, now())
    on conflict (usuario_id) do update
      set plan = excluded.plan,
          vigente_hasta = excluded.vigente_hasta,
          en_prueba = excluded.en_prueba,
          evento_ms = excluded.evento_ms,
          actualizado_en = now()
      where d.evento_ms is null or d.evento_ms <= excluded.evento_ms;
    if found then
      v_aplicados := v_aplicados + 1;
    end if;
  end loop;

  if v_existentes = 0 then
    return 'sin_usuario';
  end if;
  if v_aplicados = 0 then
    return 'antiguo';
  end if;
  return 'aplicado';
end;
$$;

-- TRANSFER: las compras pasaron de unos usuarios a otros (p. ej. la sesión anónima cambió y se restauraron).
-- El mejor derecho vigente de origen pasa a los destinos; los de origen vuelven a Gratis.
create function public.transferir_derecho_revenuecat(
  p_evento_id text,
  p_de uuid[],
  p_a uuid[],
  p_evento_ms bigint
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_origen derechos%rowtype;
  v_usuario uuid;
  v_destinos integer := 0;
begin
  insert into revenuecat_eventos (id) values (p_evento_id) on conflict (id) do nothing;
  if not found then
    return 'duplicado';
  end if;

  select d.* into v_origen
  from derechos d
  where d.usuario_id = any (p_de)
    and d.plan <> 'gratis'
    and (d.vigente_hasta is null or d.vigente_hasta > now())
  order by d.vigente_hasta desc nulls first
  limit 1;

  for v_usuario in
    select distinct u.id from auth.users u where u.id = any (p_a) order by u.id
  loop
    v_destinos := v_destinos + 1;
    perform pg_advisory_xact_lock(hashtext('nlu:' || v_usuario::text));
    if v_origen.usuario_id is not null then
      insert into derechos as d (usuario_id, plan, vigente_hasta, en_prueba, evento_ms, actualizado_en)
      values (v_usuario, v_origen.plan, v_origen.vigente_hasta, v_origen.en_prueba, p_evento_ms, now())
      on conflict (usuario_id) do update
        set plan = excluded.plan,
            vigente_hasta = excluded.vigente_hasta,
            en_prueba = excluded.en_prueba,
            evento_ms = excluded.evento_ms,
            actualizado_en = now()
        where d.evento_ms is null or d.evento_ms <= excluded.evento_ms;
    end if;
  end loop;

  update derechos d
  set plan = 'gratis', vigente_hasta = null, en_prueba = false, evento_ms = p_evento_ms, actualizado_en = now()
  where d.usuario_id = any (p_de)
    and not (d.usuario_id = any (p_a))
    and (d.evento_ms is null or d.evento_ms <= p_evento_ms);

  if v_destinos = 0 then
    return 'sin_usuario';
  end if;
  return 'aplicado';
end;
$$;

revoke all on function public.aplicar_derecho_revenuecat(text, uuid[], text, timestamptz, boolean, bigint)
  from public, anon, authenticated;
revoke all on function public.transferir_derecho_revenuecat(text, uuid[], uuid[], bigint)
  from public, anon, authenticated;
grant execute on function public.aplicar_derecho_revenuecat(text, uuid[], text, timestamptz, boolean, bigint)
  to service_role;
grant execute on function public.transferir_derecho_revenuecat(text, uuid[], uuid[], bigint) to service_role;
