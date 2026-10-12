-- M10 · Cupo del modo explicar (`POST /llm/turno`, docs/06-NLU.md §6, docs/01-PRD.md §11: "consultas y modo
-- explicar" son de Plus). Cada turno (cada llamada al modelo) cuenta como una interpretación del mismo cupo que
-- `/nlu/interpretar` (Plus: 60 al día y 300 al mes; tope global). Solo Plus o Negocio vigentes (la prueba gratis
-- cuenta como Plus); Gratis recibe 'solo_plus' sin consumir nada.
-- Privacidad (regla 9): solo conteos.

create function public.consumir_turno_llm(p_usuario uuid, p_tope_global integer)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text;
begin
  select d.plan into v_plan
  from derechos d
  where d.usuario_id = p_usuario and (d.vigente_hasta is null or d.vigente_hasta > now());
  if coalesce(v_plan, 'gratis') = 'gratis' then
    return 'solo_plus';
  end if;
  return public.consumir_interpretacion(p_usuario, p_tope_global);
end;
$$;

revoke all on function public.consumir_turno_llm(uuid, integer) from public, anon, authenticated;
grant execute on function public.consumir_turno_llm(uuid, integer) to service_role;
