-- Panel admin/ERP (dueño + vendedores) y captación desde la página de venta.
-- Dinero en centavos (bigint *_centavos). Porcentajes en puntos base (int; 1500 = 15 %).
-- Fechas civiles en date. RLS activo: sin rol = nada; anon = nada.

-- ---------------------------------------------------------------------------
-- Miembros
-- ---------------------------------------------------------------------------
create table public.admin_miembros (
  usuario_id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null check (char_length(nombre) between 1 and 120),
  rol text not null check (rol in ('dueno', 'vendedor')),
  activo boolean not null default true,
  meta_mensual_centavos bigint not null default 0 check (meta_mensual_centavos >= 0),
  -- null = usa admin_parametros.comision_pct
  comision_pb integer null check (comision_pb is null or (comision_pb >= 0 and comision_pb <= 10000)),
  creado_en timestamptz not null default now()
);

create function public.admin_rol()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select m.rol
  from public.admin_miembros m
  where m.usuario_id = auth.uid() and m.activo
$$;

revoke all on function public.admin_rol() from public;
grant execute on function public.admin_rol() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Parámetros (precios en centavos; comision_pct e iva_pct en puntos base)
-- ---------------------------------------------------------------------------
create table public.admin_parametros (
  clave text primary key,
  valor jsonb not null,
  actualizado_en timestamptz not null default now(),
  actualizado_por uuid references auth.users (id)
);

insert into public.admin_parametros (clave, valor) values
  ('precio_plus_mensual', '9900'::jsonb),
  ('precio_plus_anual', '99000'::jsonb),
  ('precio_licencia_mes', '2000'::jsonb),
  ('comision_pct', '1500'::jsonb),
  ('iva_pct', '1600'::jsonb),
  ('dominio_publico', '""'::jsonb);

-- ---------------------------------------------------------------------------
-- Clientes
-- ---------------------------------------------------------------------------
create table public.admin_clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(nombre) between 1 and 200),
  rfc text null check (
    rfc is null or rfc ~ '^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$'
  ),
  tipo text not null check (tipo in ('persona', 'negocio', 'institucion')),
  contacto text not null default '',
  telefono text not null default '',
  correo text not null default '',
  vendedor_id uuid not null references public.admin_miembros (usuario_id),
  notas text not null default '',
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index admin_clientes_vendedor on public.admin_clientes (vendedor_id);
create index admin_clientes_nombre on public.admin_clientes (lower(nombre));

-- ---------------------------------------------------------------------------
-- Prospectos
-- ---------------------------------------------------------------------------
create table public.admin_prospectos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(nombre) between 1 and 200),
  contacto text not null default '',
  telefono text not null default '',
  correo text not null default '',
  origen text not null check (origen in ('pagina', 'referido', 'lista_espera', 'llamada', 'otro')),
  interes text not null check (interes in ('plus', 'licencias', 'otro')),
  etapa text not null default 'nuevo' check (
    etapa in ('nuevo', 'contactado', 'demo', 'propuesta', 'ganado', 'perdido')
  ),
  motivo_perdida text null,
  vendedor_id uuid not null references public.admin_miembros (usuario_id),
  siguiente_paso text not null default '',
  siguiente_paso_en date null,
  cliente_id uuid null references public.admin_clientes (id),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index admin_prospectos_vendedor on public.admin_prospectos (vendedor_id);
create index admin_prospectos_etapa on public.admin_prospectos (etapa);

-- ---------------------------------------------------------------------------
-- Ventas
-- ---------------------------------------------------------------------------
create sequence public.admin_ventas_folio_seq start 1;

create table public.admin_ventas (
  id uuid primary key default gen_random_uuid(),
  folio text not null default '' unique,
  cliente_id uuid not null references public.admin_clientes (id),
  vendedor_id uuid not null references public.admin_miembros (usuario_id),
  producto text not null check (producto in ('plus_mensual', 'plus_anual', 'licencias')),
  cantidad integer not null check (cantidad > 0),
  meses integer not null check (meses > 0),
  -- El BEFORE trigger rellena null con el parámetro; el check requerido corre después.
  precio_unitario_centavos bigint null check (precio_unitario_centavos is null or precio_unitario_centavos >= 0),
  total_centavos bigint generated always as (
    case
      when producto = 'licencias' then cantidad::bigint * meses::bigint * coalesce(precio_unitario_centavos, 0)
      else cantidad::bigint * coalesce(precio_unitario_centavos, 0)
    end
  ) stored,
  estado text not null default 'por_cobrar' check (estado in ('por_cobrar', 'pagada', 'cancelada')),
  vence_en date null,
  pagada_en timestamptz null,
  cancelada_motivo text null,
  creado_en timestamptz not null default now(),
  creado_por uuid null references auth.users (id)
);

create index admin_ventas_vendedor on public.admin_ventas (vendedor_id);
create index admin_ventas_estado on public.admin_ventas (estado);
create index admin_ventas_cliente on public.admin_ventas (cliente_id);

create function public.admin_venta_antes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clave text;
  v_precio bigint;
begin
  if tg_op = 'INSERT' then
    if new.folio is null or new.folio = '' then
      new.folio := 'FV-' || lpad(nextval('public.admin_ventas_folio_seq')::text, 4, '0');
    end if;
    if new.precio_unitario_centavos is null then
      v_clave := case new.producto
        when 'plus_mensual' then 'precio_plus_mensual'
        when 'plus_anual' then 'precio_plus_anual'
        when 'licencias' then 'precio_licencia_mes'
      end;
      select (valor #>> '{}')::bigint into v_precio
      from public.admin_parametros where clave = v_clave;
      if v_precio is null then
        raise exception 'falta parametro %', v_clave;
      end if;
      new.precio_unitario_centavos := v_precio;
    end if;
    -- Con sesión de usuario, el autor es siempre quien inserta (no se puede firmar por otro).
    if auth.uid() is not null then
      new.creado_por := auth.uid();
    end if;
  end if;

  if public.admin_rol() = 'vendedor' then
    if tg_op = 'INSERT' then
      -- Una venta nace por cobrar: solo el dueño cobra o cancela.
      if new.estado <> 'por_cobrar' or new.pagada_en is not null then
        raise exception 'vendedor_no_cobra';
      end if;
    else
      if new.vendedor_id is distinct from old.vendedor_id then
        raise exception 'vendedor_no_reasigna';
      end if;
      if new.estado is distinct from old.estado or new.pagada_en is distinct from old.pagada_en
         or new.cancelada_motivo is distinct from old.cancelada_motivo then
        raise exception 'vendedor_no_cobra';
      end if;
      -- Una venta cobrada o cancelada ya no la cambia el vendedor.
      if old.estado <> 'por_cobrar' then
        raise exception 'venta_cerrada';
      end if;
    end if;
    -- El cliente debe ser suyo (la llave foránea no pasa por RLS).
    if not exists (
      select 1 from public.admin_clientes c
      where c.id = new.cliente_id and c.vendedor_id = new.vendedor_id
    ) then
      raise exception 'cliente_de_otro_vendedor';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    new.folio := old.folio;
    new.creado_por := old.creado_por;
    new.creado_en := old.creado_en;
    if new.estado = 'pagada' and old.estado <> 'pagada' and new.pagada_en is null then
      new.pagada_en := now();
    end if;
    if new.estado <> 'pagada' then
      new.pagada_en := null;
    end if;
    if new.estado = 'cancelada' and coalesce(trim(new.cancelada_motivo), '') = '' then
      raise exception 'falta_motivo';
    end if;
  end if;

  return new;
end;
$$;

create trigger admin_ventas_antes
  before insert or update on public.admin_ventas
  for each row execute function public.admin_venta_antes();

alter table public.admin_ventas
  add constraint admin_ventas_precio_requerido check (precio_unitario_centavos is not null);
alter table public.admin_ventas
  add constraint admin_ventas_creado_por_requerido check (creado_por is not null);
alter table public.admin_ventas
  add constraint admin_ventas_folio_requerido check (folio <> '');

-- ---------------------------------------------------------------------------
-- Bitácora
-- ---------------------------------------------------------------------------
create table public.admin_bitacora (
  id bigserial primary key,
  tabla text not null,
  registro_id text not null,
  accion text not null check (accion in ('insert', 'update', 'delete')),
  antes jsonb null,
  despues jsonb null,
  usuario_id uuid null,
  creado_en timestamptz not null default now()
);

create function public.admin_bitacora_registrar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text;
  v_row jsonb;
begin
  if tg_op = 'DELETE' then
    v_row := to_jsonb(old);
    v_id := case tg_table_name
      when 'admin_miembros' then v_row->>'usuario_id'
      when 'admin_parametros' then v_row->>'clave'
      else v_row->>'id'
    end;
    insert into public.admin_bitacora (tabla, registro_id, accion, antes, despues, usuario_id)
    values (tg_table_name, v_id, 'delete', v_row, null, auth.uid());
    return old;
  end if;

  v_row := to_jsonb(new);
  v_id := case tg_table_name
    when 'admin_miembros' then v_row->>'usuario_id'
    when 'admin_parametros' then v_row->>'clave'
    else v_row->>'id'
  end;

  if tg_op = 'INSERT' then
    insert into public.admin_bitacora (tabla, registro_id, accion, antes, despues, usuario_id)
    values (tg_table_name, v_id, 'insert', null, v_row, auth.uid());
    return new;
  end if;

  insert into public.admin_bitacora (tabla, registro_id, accion, antes, despues, usuario_id)
  values (tg_table_name, v_id, 'update', to_jsonb(old), v_row, auth.uid());
  return new;
end;
$$;

create trigger admin_clientes_bitacora
  after insert or update or delete on public.admin_clientes
  for each row execute function public.admin_bitacora_registrar();

create trigger admin_prospectos_bitacora
  after insert or update or delete on public.admin_prospectos
  for each row execute function public.admin_bitacora_registrar();

create trigger admin_ventas_bitacora
  after insert or update or delete on public.admin_ventas
  for each row execute function public.admin_bitacora_registrar();

create trigger admin_parametros_bitacora
  after insert or update or delete on public.admin_parametros
  for each row execute function public.admin_bitacora_registrar();

create trigger admin_miembros_bitacora
  after insert or update or delete on public.admin_miembros
  for each row execute function public.admin_bitacora_registrar();

create function public.admin_touch_actualizado()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

create trigger admin_clientes_touch
  before update on public.admin_clientes
  for each row execute function public.admin_touch_actualizado();

create trigger admin_prospectos_touch
  before update on public.admin_prospectos
  for each row execute function public.admin_touch_actualizado();

-- Un prospecto solo se liga a un cliente del mismo vendedor (la llave foránea no pasa por RLS).
create function public.admin_prospecto_antes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.cliente_id is not null and public.admin_rol() = 'vendedor' and not exists (
    select 1 from public.admin_clientes c
    where c.id = new.cliente_id and c.vendedor_id = new.vendedor_id
  ) then
    raise exception 'cliente_de_otro_vendedor';
  end if;
  if new.etapa <> 'perdido' then
    new.motivo_perdida := null;
  end if;
  return new;
end;
$$;

create trigger admin_prospectos_antes
  before insert or update on public.admin_prospectos
  for each row execute function public.admin_prospecto_antes();

-- Sin security definer a propósito: `current_user` debe ser el rol de quien llama (service_role o authenticated).
create function public.admin_parametros_antes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if public.admin_rol() is distinct from 'dueno' and current_user <> 'service_role' then
    raise exception 'solo_dueno';
  end if;
  new.actualizado_en := now();
  new.actualizado_por := auth.uid();
  return new;
end;
$$;

create trigger admin_parametros_antes
  before insert or update on public.admin_parametros
  for each row execute function public.admin_parametros_antes();

-- ---------------------------------------------------------------------------
-- Captación pública (página de venta)
-- ---------------------------------------------------------------------------
create table public.admin_prospecto_intentos (
  huella_ip text not null,
  creado_en timestamptz not null default now()
);
create index admin_prospecto_intentos_huella on public.admin_prospecto_intentos (huella_ip, creado_en);

create function public.admin_registrar_prospecto(
  p_huella_ip text,
  p_nombre text,
  p_contacto text,
  p_telefono text,
  p_correo text,
  p_interes text,
  p_mensaje text,
  p_limite_por_hora integer
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vendedor uuid;
  v_nombre text := trim(coalesce(p_nombre, ''));
  v_contacto text := trim(coalesce(p_contacto, ''));
  v_telefono text := trim(coalesce(p_telefono, ''));
  v_correo text := lower(trim(coalesce(p_correo, '')));
  v_interes text := coalesce(p_interes, 'otro');
  v_mensaje text := trim(coalesce(p_mensaje, ''));
  v_paso text;
begin
  delete from public.admin_prospecto_intentos where creado_en < now() - interval '24 hours';

  if (select count(*) from public.admin_prospecto_intentos
      where huella_ip = p_huella_ip and creado_en > now() - interval '1 hour') >= p_limite_por_hora then
    return 'limite';
  end if;
  insert into public.admin_prospecto_intentos (huella_ip) values (p_huella_ip);

  if char_length(v_nombre) < 1 or char_length(v_nombre) > 200 then
    return 'invalido';
  end if;
  if v_interes not in ('plus', 'licencias', 'otro') then
    return 'invalido';
  end if;

  -- Turno: vendedor activo con menos prospectos abiertos; empate = más antiguo.
  select m.usuario_id into v_vendedor
  from public.admin_miembros m
  left join public.admin_prospectos p
    on p.vendedor_id = m.usuario_id and p.etapa not in ('ganado', 'perdido')
  where m.activo and m.rol = 'vendedor'
  group by m.usuario_id, m.creado_en
  order by count(p.id) asc, m.creado_en asc
  limit 1;

  if v_vendedor is null then
    select m.usuario_id into v_vendedor
    from public.admin_miembros m
    where m.activo and m.rol = 'dueno'
    order by m.creado_en asc
    limit 1;
  end if;

  if v_vendedor is null then
    return 'sin_vendedor';
  end if;

  if v_contacto = '' and v_mensaje <> '' then
    v_contacto := left(v_mensaje, 200);
  end if;
  v_paso := case when v_mensaje = '' then '' else left(v_mensaje, 500) end;

  insert into public.admin_prospectos (
    nombre, contacto, telefono, correo, origen, interes, etapa, vendedor_id, siguiente_paso
  ) values (
    v_nombre, v_contacto, v_telefono, v_correo, 'pagina', v_interes, 'nuevo', v_vendedor, v_paso
  );

  return 'ok';
end;
$$;

revoke all on function public.admin_registrar_prospecto(text, text, text, text, text, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.admin_registrar_prospecto(text, text, text, text, text, text, text, integer)
  to service_role;

-- ---------------------------------------------------------------------------
-- Comisiones del mes (security_invoker: respeta RLS de ventas/miembros)
-- ---------------------------------------------------------------------------
-- Vendido y por cobrar cuentan en el mes en que se registró la venta; cobrado y comisión, en el mes en que se
-- cobró (como `admin_resumen`). La comisión se redondea hacia abajo al centavo.
create view public.admin_comisiones_mes with (security_invoker = true) as
with movimientos as (
  select
    date_trunc('month', v.creado_en at time zone 'America/Mexico_City')::date as mes,
    v.vendedor_id,
    case when v.estado <> 'cancelada' then v.total_centavos else 0 end as vendido,
    case when v.estado = 'por_cobrar' then v.total_centavos else 0 end as por_cobrar,
    0::bigint as cobrado
  from public.admin_ventas v
  union all
  select
    date_trunc('month', v.pagada_en at time zone 'America/Mexico_City')::date,
    v.vendedor_id,
    0, 0, v.total_centavos
  from public.admin_ventas v
  where v.estado = 'pagada' and v.pagada_en is not null
)
select
  mv.mes,
  mv.vendedor_id,
  m.nombre as vendedor_nombre,
  sum(mv.vendido)::bigint as vendido_centavos,
  sum(mv.cobrado)::bigint as cobrado_centavos,
  sum(mv.por_cobrar)::bigint as por_cobrar_centavos,
  (
    sum(mv.cobrado)
    * coalesce(
        m.comision_pb,
        (select (p.valor #>> '{}')::int from public.admin_parametros p where p.clave = 'comision_pct'),
        0
      )
    / 10000
  )::bigint as comision_centavos,
  m.meta_mensual_centavos
from movimientos mv
join public.admin_miembros m on m.usuario_id = mv.vendedor_id
group by mv.mes, mv.vendedor_id, m.nombre, m.comision_pb, m.meta_mensual_centavos;

-- ---------------------------------------------------------------------------
-- Resumen del mes
-- ---------------------------------------------------------------------------
create function public.admin_resumen(p_mes date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rol text := public.admin_rol();
  v_uid uuid := auth.uid();
  v_inicio date := date_trunc('month', p_mes::timestamp)::date;
  v_fin date := (v_inicio + interval '1 month')::date;
  v_ingreso_plus bigint;
  v_ingreso_lic bigint;
  v_por_cobrar bigint;
  v_ventas integer;
  v_prospectos jsonb;
  v_cerrados integer;
  v_abiertos_o_cerrados integer;
  v_plus_activos integer := 0;
  v_usuarios_7d integer := 0;
begin
  if v_rol is null then
    return null;
  end if;

  select
    coalesce(sum(total_centavos) filter (
      where estado = 'pagada' and producto in ('plus_mensual', 'plus_anual')
        and (pagada_en at time zone 'America/Mexico_City')::date >= v_inicio
        and (pagada_en at time zone 'America/Mexico_City')::date < v_fin
        and (v_rol = 'dueno' or vendedor_id = v_uid)
    ), 0),
    coalesce(sum(total_centavos) filter (
      where estado = 'pagada' and producto = 'licencias'
        and (pagada_en at time zone 'America/Mexico_City')::date >= v_inicio
        and (pagada_en at time zone 'America/Mexico_City')::date < v_fin
        and (v_rol = 'dueno' or vendedor_id = v_uid)
    ), 0),
    coalesce(sum(total_centavos) filter (
      where estado = 'por_cobrar' and (v_rol = 'dueno' or vendedor_id = v_uid)
    ), 0),
    count(*) filter (
      where estado <> 'cancelada'
        and (creado_en at time zone 'America/Mexico_City')::date >= v_inicio
        and (creado_en at time zone 'America/Mexico_City')::date < v_fin
        and (v_rol = 'dueno' or vendedor_id = v_uid)
    )
  into v_ingreso_plus, v_ingreso_lic, v_por_cobrar, v_ventas
  from public.admin_ventas;

  select coalesce(jsonb_object_agg(etapa, c), '{}'::jsonb)
  into v_prospectos
  from (
    select etapa, count(*)::int as c
    from public.admin_prospectos
    where (v_rol = 'dueno' or vendedor_id = v_uid)
    group by etapa
  ) t;

  select
    count(*) filter (where etapa = 'ganado'),
    count(*) filter (where etapa in ('ganado', 'perdido', 'propuesta', 'demo', 'contactado', 'nuevo'))
  into v_cerrados, v_abiertos_o_cerrados
  from public.admin_prospectos
  where (v_rol = 'dueno' or vendedor_id = v_uid)
    and (creado_en at time zone 'America/Mexico_City')::date >= v_inicio
    and (creado_en at time zone 'America/Mexico_City')::date < v_fin;

  -- Cifras de toda la app: solo para el dueño.
  if v_rol = 'dueno' then
  begin
    select count(*)::int into v_plus_activos from public.derechos
    where plan = 'plus' and (vigente_hasta is null or vigente_hasta > now());
  exception
    when undefined_table then
      v_plus_activos := 0;
  end;

  begin
    select count(distinct usuario_id)::int into v_usuarios_7d from public.nlu_uso_diario
    where dia >= ((now() at time zone 'America/Mexico_City')::date - 7);
  exception
    when undefined_table then
      v_usuarios_7d := 0;
  end;
  end if;

  return jsonb_build_object(
    'mes', v_inicio,
    'ingreso_cobrado_centavos', v_ingreso_plus + v_ingreso_lic,
    'ingreso_plus_centavos', v_ingreso_plus,
    'ingreso_licencias_centavos', v_ingreso_lic,
    'por_cobrar_centavos', v_por_cobrar,
    'ventas', v_ventas,
    'prospectos_por_etapa', v_prospectos,
    'tasa_cierre', case
      when coalesce((v_prospectos->>'ganado')::int, 0) + coalesce((v_prospectos->>'perdido')::int, 0) = 0 then 0
      else round(
        100.0 * coalesce((v_prospectos->>'ganado')::int, 0)
        / (coalesce((v_prospectos->>'ganado')::int, 0) + coalesce((v_prospectos->>'perdido')::int, 0))
      )::int
    end,
    'prospectos_abiertos', (
      coalesce((v_prospectos->>'nuevo')::int, 0)
      + coalesce((v_prospectos->>'contactado')::int, 0)
      + coalesce((v_prospectos->>'demo')::int, 0)
      + coalesce((v_prospectos->>'propuesta')::int, 0)
    ),
    'plus_activos', v_plus_activos,
    'usuarios_activos_7d', v_usuarios_7d
  );
end;
$$;

revoke all on function public.admin_resumen(date) from public, anon;
grant execute on function public.admin_resumen(date) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Prospecto ganado → cliente, en una sola transacción. Security invoker: corre con los permisos (y la RLS) de
-- quien la llama, así un vendedor solo convierte sus prospectos. Si ya tenía cliente, lo reutiliza.
-- ---------------------------------------------------------------------------
create function public.admin_convertir_prospecto(p_prospecto uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_p public.admin_prospectos;
  v_c public.admin_clientes;
begin
  select * into v_p from public.admin_prospectos where id = p_prospecto for update;
  if not found then
    raise exception 'prospecto_no_encontrado';
  end if;

  if v_p.cliente_id is not null then
    select * into v_c from public.admin_clientes where id = v_p.cliente_id;
  end if;
  if v_c.id is null then
    insert into public.admin_clientes (nombre, tipo, contacto, telefono, correo, vendedor_id)
    values (
      v_p.nombre,
      case when v_p.interes = 'plus' then 'persona' else 'negocio' end,
      v_p.contacto, v_p.telefono, v_p.correo, v_p.vendedor_id
    )
    returning * into v_c;
  end if;

  update public.admin_prospectos
    set etapa = 'ganado', cliente_id = v_c.id
    where id = p_prospecto
    returning * into v_p;

  return jsonb_build_object('cliente', to_jsonb(v_c), 'prospecto', to_jsonb(v_p));
end;
$$;

revoke all on function public.admin_convertir_prospecto(uuid) from public, anon;
grant execute on function public.admin_convertir_prospecto(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.admin_miembros enable row level security;
alter table public.admin_parametros enable row level security;
alter table public.admin_clientes enable row level security;
alter table public.admin_prospectos enable row level security;
alter table public.admin_ventas enable row level security;
alter table public.admin_bitacora enable row level security;
alter table public.admin_prospecto_intentos enable row level security;

-- Miembros: dueño todo; vendedor solo se ve a sí mismo. Solo dueño escribe.
create policy admin_miembros_select on public.admin_miembros for select to authenticated
  using (public.admin_rol() = 'dueno' or usuario_id = auth.uid());
create policy admin_miembros_write on public.admin_miembros for all to authenticated
  using (public.admin_rol() = 'dueno')
  with check (public.admin_rol() = 'dueno');

-- Parámetros: ambos leen; solo dueño escribe (también el trigger).
create policy admin_parametros_select on public.admin_parametros for select to authenticated
  using (public.admin_rol() in ('dueno', 'vendedor'));
create policy admin_parametros_write on public.admin_parametros for all to authenticated
  using (public.admin_rol() = 'dueno')
  with check (public.admin_rol() = 'dueno');

-- Clientes
create policy admin_clientes_select on public.admin_clientes for select to authenticated
  using (public.admin_rol() = 'dueno' or vendedor_id = auth.uid());
create policy admin_clientes_insert on public.admin_clientes for insert to authenticated
  with check (
    public.admin_rol() = 'dueno'
    or (public.admin_rol() = 'vendedor' and vendedor_id = auth.uid())
  );
create policy admin_clientes_update on public.admin_clientes for update to authenticated
  using (public.admin_rol() = 'dueno' or vendedor_id = auth.uid())
  with check (
    public.admin_rol() = 'dueno'
    or (public.admin_rol() = 'vendedor' and vendedor_id = auth.uid())
  );
-- Sin delete.

-- Prospectos
create policy admin_prospectos_select on public.admin_prospectos for select to authenticated
  using (public.admin_rol() = 'dueno' or vendedor_id = auth.uid());
create policy admin_prospectos_insert on public.admin_prospectos for insert to authenticated
  with check (
    public.admin_rol() = 'dueno'
    or (public.admin_rol() = 'vendedor' and vendedor_id = auth.uid())
  );
create policy admin_prospectos_update on public.admin_prospectos for update to authenticated
  using (public.admin_rol() = 'dueno' or vendedor_id = auth.uid())
  with check (
    public.admin_rol() = 'dueno'
    or (public.admin_rol() = 'vendedor' and vendedor_id = auth.uid())
  );

-- Ventas
create policy admin_ventas_select on public.admin_ventas for select to authenticated
  using (public.admin_rol() = 'dueno' or vendedor_id = auth.uid());
create policy admin_ventas_insert on public.admin_ventas for insert to authenticated
  with check (
    public.admin_rol() = 'dueno'
    or (public.admin_rol() = 'vendedor' and vendedor_id = auth.uid())
  );
create policy admin_ventas_update on public.admin_ventas for update to authenticated
  using (public.admin_rol() = 'dueno' or vendedor_id = auth.uid())
  with check (
    public.admin_rol() = 'dueno'
    or (public.admin_rol() = 'vendedor' and vendedor_id = auth.uid())
  );

-- Bitácora: solo dueño lee; nadie escribe desde el cliente (solo triggers security definer).
create policy admin_bitacora_select on public.admin_bitacora for select to authenticated
  using (public.admin_rol() = 'dueno');

-- Intentos: nadie con JWT (solo la función service_role).
-- (RLS sin políticas = denegado)

grant usage on schema public to authenticated, anon, service_role;
grant select, insert, update on public.admin_miembros to authenticated;
grant select, insert, update on public.admin_parametros to authenticated;
grant select, insert, update on public.admin_clientes to authenticated;
grant select, insert, update on public.admin_prospectos to authenticated;
grant select, insert, update on public.admin_ventas to authenticated;
grant select on public.admin_bitacora to authenticated;
grant select on public.admin_comisiones_mes to authenticated;
grant usage, select on sequence public.admin_ventas_folio_seq to authenticated, service_role;
grant usage, select on sequence public.admin_bitacora_id_seq to authenticated, service_role;

-- service_role bypasea RLS en Supabase; en PGlite de pruebas se usa set role service_role + grants.
grant all on public.admin_miembros to service_role;
grant all on public.admin_parametros to service_role;
grant all on public.admin_clientes to service_role;
grant all on public.admin_prospectos to service_role;
grant all on public.admin_ventas to service_role;
grant all on public.admin_bitacora to service_role;
grant all on public.admin_prospecto_intentos to service_role;
