-- M16 · Gastos compartidos en pareja (docs/03-ARQUITECTURA.md §5.10 y §6, docs/05-MOTORES.md §E17).
-- El servidor solo guarda eventos cifrados en el teléfono con XChaCha20-Poly1305 (blob) y lo mínimo para repartirlos:
-- `grupo_id`, `id` (UUIDv4 aleatorio) y `autor` ('a' quien creó el grupo, 'b' quien se unió). Nunca la llave del
-- grupo, tipos, montos, descripciones ni nombres. El código de unión de un solo uso se guarda solo como hash
-- SHA-256 y se borra al usarse.
--
-- Acceso: la Edge Function `compartido` (service role) llama a las funciones `compartido_*` de abajo, que verifican la
-- pertenencia y el estado del grupo y devuelven un código (`no_miembro`, `grupo_cerrado`, …). La RLS es la segunda
-- barrera para quien use PostgREST directo con su JWT: un miembro lee los eventos de los dos autores (también con
-- el grupo cerrado) y publica solo con su propio `autor` y solo si el grupo no está cerrado; cualquier otra cuenta
-- no ve filas.

create table public.grupos_compartidos (
  id uuid primary key default gen_random_uuid(),
  codigo_union_hash text check (codigo_union_hash ~ '^[0-9a-f]{64}$'),
  codigo_autor text check (codigo_autor in ('a', 'b')),
  codigo_vence_en timestamptz,
  creado_en timestamptz not null default now(),
  cerrado_en timestamptz,
  check (
    (codigo_union_hash is null and codigo_autor is null and codigo_vence_en is null)
    or (codigo_union_hash is not null and codigo_autor is not null and codigo_vence_en is not null)
  )
);

create table public.miembros_compartidos (
  grupo_id uuid not null references public.grupos_compartidos (id) on delete cascade,
  usuario uuid not null references auth.users (id) on delete cascade,
  autor text not null check (autor in ('a', 'b')),
  primary key (grupo_id, autor),
  unique (grupo_id, usuario)
);

create index miembros_compartidos_usuario on public.miembros_compartidos (usuario);

create table public.eventos_compartidos (
  grupo_id uuid not null references public.grupos_compartidos (id) on delete cascade,
  id uuid not null,
  autor text not null check (autor in ('a', 'b')),
  -- base64(nonce de 24 bytes ‖ texto cifrado ‖ etiqueta de 16 bytes); un evento pesa unos cientos de bytes.
  blob text not null check (char_length(blob) between 56 and 4096 and blob ~ '^[A-Za-z0-9+/]+={0,2}$'),
  recibido_en timestamptz not null default clock_timestamp(),
  primary key (grupo_id, id)
);

create index eventos_compartidos_llegada on public.eventos_compartidos (grupo_id, recibido_en, id);

-- ── Pertenencia (security definer: la usan las políticas sin recursión de RLS) ─────────────────────────────────
create or replace function public.compartido_mi_autor(p_grupo uuid) returns text
language sql stable security definer
set search_path = ''
as $$
  select m.autor from public.miembros_compartidos m where m.grupo_id = p_grupo and m.usuario = auth.uid()
$$;

revoke all on function public.compartido_mi_autor(uuid) from public;
grant execute on function public.compartido_mi_autor(uuid) to authenticated;

alter table public.grupos_compartidos enable row level security;
alter table public.miembros_compartidos enable row level security;
alter table public.eventos_compartidos enable row level security;

create policy grupos_compartidos_leer_miembro on public.grupos_compartidos
  for select to authenticated
  using (public.compartido_mi_autor(id) is not null);

create policy miembros_compartidos_leer_miembro on public.miembros_compartidos
  for select to authenticated
  using (public.compartido_mi_autor(grupo_id) is not null);

create policy eventos_compartidos_leer_miembro on public.eventos_compartidos
  for select to authenticated
  using (public.compartido_mi_autor(grupo_id) is not null);

create policy eventos_compartidos_publicar_propio on public.eventos_compartidos
  for insert to authenticated
  with check (
    autor = public.compartido_mi_autor(grupo_id)
    and exists (
      select 1 from public.grupos_compartidos g where g.id = grupo_id and g.cerrado_en is null
    )
  );

revoke all on public.grupos_compartidos, public.miembros_compartidos, public.eventos_compartidos
  from public, anon, authenticated;
-- El hash del código de unión no se expone ni a los miembros.
grant select (id, creado_en, cerrado_en) on public.grupos_compartidos to authenticated;
grant select on public.miembros_compartidos to authenticated;
grant select on public.eventos_compartidos to authenticated;
grant insert (grupo_id, id, autor, blob) on public.eventos_compartidos to authenticated;

-- ── Funciones de la Edge Function (solo service role) ───────────────────────────────────────────────────────────
-- Todas reciben el usuario ya verificado por la función y devuelven un código; nunca lanzan por un caso esperado.

-- Instante del servidor como texto ISO 8601 en UTC con microsegundos (el cursor de descarga de la app).
create or replace function public.compartido_instante(p timestamptz) returns text
language sql immutable
set search_path = ''
as $$
  select to_char(p at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
$$;

-- POST /compartido/grupos: grupo nuevo con quien lo crea como 'a' y un código para el lugar 'b'.
create or replace function public.compartido_crear(p_usuario uuid, p_codigo_hash text, p_vence_en timestamptz)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_grupo uuid;
begin
  insert into public.grupos_compartidos (codigo_union_hash, codigo_autor, codigo_vence_en)
  values (p_codigo_hash, 'b', p_vence_en)
  returning id into v_grupo;
  insert into public.miembros_compartidos (grupo_id, usuario, autor) values (v_grupo, p_usuario, 'a');
  return jsonb_build_object('codigo', 'ok', 'grupo_id', v_grupo);
end;
$$;

-- POST /compartido/codigo: un miembro pide un código nuevo para el OTRO lugar ("Volver a vincular", E17).
create or replace function public.compartido_codigo(
  p_usuario uuid, p_grupo uuid, p_codigo_hash text, p_vence_en timestamptz
) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_autor text;
  v_cerrado timestamptz;
begin
  select g.cerrado_en into v_cerrado from public.grupos_compartidos g where g.id = p_grupo for update;
  if not found then return jsonb_build_object('codigo', 'no_miembro'); end if;
  select m.autor into v_autor from public.miembros_compartidos m
   where m.grupo_id = p_grupo and m.usuario = p_usuario;
  if v_autor is null then return jsonb_build_object('codigo', 'no_miembro'); end if;
  if v_cerrado is not null then return jsonb_build_object('codigo', 'grupo_cerrado'); end if;
  update public.grupos_compartidos
     set codigo_union_hash = p_codigo_hash,
         codigo_autor = case v_autor when 'a' then 'b' else 'a' end,
         codigo_vence_en = p_vence_en
   where id = p_grupo;
  return jsonb_build_object('codigo', 'ok');
end;
$$;

-- POST /compartido/unirse: con el código vigente, alta en el lugar que indica (o reemplazo de la sesión que lo
-- ocupaba: el teléfono anterior deja de tener acceso). El código deja de servir.
create or replace function public.compartido_unirse(p_usuario uuid, p_grupo uuid, p_codigo_hash text)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  g public.grupos_compartidos%rowtype;
  v_otro text;
begin
  select * into g from public.grupos_compartidos where id = p_grupo for update;
  if not found or g.codigo_union_hash is null or g.codigo_union_hash <> p_codigo_hash
     or g.codigo_vence_en <= now() then
    return jsonb_build_object('codigo', 'codigo_invalido');
  end if;
  if g.cerrado_en is not null then return jsonb_build_object('codigo', 'grupo_cerrado'); end if;
  select m.autor into v_otro from public.miembros_compartidos m
   where m.grupo_id = p_grupo and m.usuario = p_usuario and m.autor <> g.codigo_autor;
  if v_otro is not null then return jsonb_build_object('codigo', 'ya_miembro'); end if;
  insert into public.miembros_compartidos (grupo_id, usuario, autor)
  values (p_grupo, p_usuario, g.codigo_autor)
  on conflict (grupo_id, autor) do update set usuario = excluded.usuario;
  update public.grupos_compartidos
     set codigo_union_hash = null, codigo_autor = null, codigo_vence_en = null
   where id = p_grupo;
  return jsonb_build_object('codigo', 'ok', 'autor', g.codigo_autor);
end;
$$;

-- POST /compartido/salir: cierra el grupo para los dos (idempotente). Desde ahí nadie publica; descargar sigue.
create or replace function public.compartido_salir(p_usuario uuid, p_grupo uuid) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_cerrado timestamptz;
begin
  select g.cerrado_en into v_cerrado from public.grupos_compartidos g where g.id = p_grupo for update;
  if not found or not exists (
    select 1 from public.miembros_compartidos m where m.grupo_id = p_grupo and m.usuario = p_usuario
  ) then
    return jsonb_build_object('codigo', 'no_miembro');
  end if;
  if v_cerrado is null then
    v_cerrado := clock_timestamp();
    update public.grupos_compartidos
       set cerrado_en = v_cerrado, codigo_union_hash = null, codigo_autor = null, codigo_vence_en = null
     where id = p_grupo;
  end if;
  return jsonb_build_object('codigo', 'ok', 'cerrado_en', public.compartido_instante(v_cerrado));
end;
$$;

-- POST /compartido/eventos: publica blobs con el `autor` del miembro, idempotente por `id`. Toma el grupo en modo
-- compartido: un cierre espera a que termine y todo lo publicado queda antes de `cerrado_en`.
create or replace function public.compartido_publicar(p_usuario uuid, p_grupo uuid, p_eventos jsonb)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_autor text;
  v_cerrado timestamptz;
  e jsonb;
  v_fila public.eventos_compartidos%rowtype;
  v_salida jsonb := '[]'::jsonb;
begin
  select g.cerrado_en into v_cerrado from public.grupos_compartidos g where g.id = p_grupo for share;
  if not found then return jsonb_build_object('codigo', 'no_miembro'); end if;
  select m.autor into v_autor from public.miembros_compartidos m
   where m.grupo_id = p_grupo and m.usuario = p_usuario;
  if v_autor is null then return jsonb_build_object('codigo', 'no_miembro'); end if;
  if v_cerrado is not null then return jsonb_build_object('codigo', 'grupo_cerrado'); end if;
  for e in select * from jsonb_array_elements(p_eventos) loop
    insert into public.eventos_compartidos (grupo_id, id, autor, blob)
    values (p_grupo, (e ->> 'id')::uuid, v_autor, e ->> 'blob')
    on conflict (grupo_id, id) do nothing;
    select * into v_fila from public.eventos_compartidos where grupo_id = p_grupo and id = (e ->> 'id')::uuid;
    -- El mismo `id` con otro contenido u otro autor no se acepta (un evento es inmutable).
    if v_fila.autor <> v_autor or v_fila.blob <> e ->> 'blob' then
      return jsonb_build_object('codigo', 'conflicto');
    end if;
    v_salida := v_salida || jsonb_build_object('id', v_fila.id, 'recibido_en',
      public.compartido_instante(v_fila.recibido_en));
  end loop;
  return jsonb_build_object('codigo', 'ok', 'eventos', v_salida);
end;
$$;

-- GET /compartido/eventos?desde=: eventos en orden de llegada y `cerrado_en`. El cursor siguiente se queda 30 s
-- atrás del reloj (una publicación que tomó su `recibido_en` y todavía no confirma no se pierde: vuelve a llegar y
-- la app la descarta por `id`); con una página llena, un microsegundo antes de la última fila.
create or replace function public.compartido_descargar(
  p_usuario uuid, p_grupo uuid, p_desde timestamptz, p_limite integer
) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_cerrado timestamptz;
  v_eventos jsonb;
  v_n integer;
  v_ultimo timestamptz;
  v_cursor timestamptz;
begin
  select g.cerrado_en into v_cerrado from public.grupos_compartidos g where g.id = p_grupo;
  if not found or not exists (
    select 1 from public.miembros_compartidos m where m.grupo_id = p_grupo and m.usuario = p_usuario
  ) then
    return jsonb_build_object('codigo', 'no_miembro');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', x.id, 'autor', x.autor, 'blob', x.blob,
           'recibido_en', public.compartido_instante(x.recibido_en)) order by x.recibido_en, x.id), '[]'::jsonb),
         count(*), max(x.recibido_en)
    into v_eventos, v_n, v_ultimo
    from (
      select e.id, e.autor, e.blob, e.recibido_en from public.eventos_compartidos e
       where e.grupo_id = p_grupo and (p_desde is null or e.recibido_en > p_desde)
       order by e.recibido_en, e.id
       limit p_limite
    ) x;
  if v_n >= p_limite then
    v_cursor := v_ultimo - interval '1 microsecond';
  elsif v_ultimo is null then
    v_cursor := p_desde;
  else
    v_cursor := least(v_ultimo, clock_timestamp() - interval '30 seconds');
    if p_desde is not null and v_cursor < p_desde then v_cursor := p_desde; end if;
  end if;
  return jsonb_build_object(
    'codigo', 'ok',
    'eventos', v_eventos,
    'cursor', case when v_cursor is null then null else public.compartido_instante(v_cursor) end,
    'mas', v_n >= p_limite,
    'cerrado_en', case when v_cerrado is null then null else public.compartido_instante(v_cerrado) end
  );
end;
$$;

revoke all on function public.compartido_crear(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.compartido_codigo(uuid, uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.compartido_unirse(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.compartido_salir(uuid, uuid) from public, anon, authenticated;
revoke all on function public.compartido_publicar(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.compartido_descargar(uuid, uuid, timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.compartido_crear(uuid, text, timestamptz) to service_role;
grant execute on function public.compartido_codigo(uuid, uuid, text, timestamptz) to service_role;
grant execute on function public.compartido_unirse(uuid, uuid, text) to service_role;
grant execute on function public.compartido_salir(uuid, uuid) to service_role;
grant execute on function public.compartido_publicar(uuid, uuid, jsonb) to service_role;
grant execute on function public.compartido_descargar(uuid, uuid, timestamptz, integer) to service_role;
