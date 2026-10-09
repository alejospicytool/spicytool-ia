-- Tracker de tiempo (control de jornada). YA APLICADO en el proyecto real
-- (khuavhbraikzreyhptog) vía Supabase MCP el 2026-10-09 en 4 migraciones:
-- time_tracking_enable_pg_cron, time_tracking_tables, time_tracking_core_functions,
-- time_tracking_reports_admin_functions y time_tracking_schedule_sweep.
-- Este archivo queda solo como referencia. Tests: supabase_tests/time_tracking_test.sql.
--
-- Diseño:
--  * No hay backend propio: el "backend" son estas funciones SECURITY DEFINER + RLS.
--    El cliente NO puede escribir en estas tablas (se revocó INSERT/UPDATE/DELETE):
--    todo pasa por RPCs que usan auth.uid() y validan admin con get_my_role().
--  * El cálculo de horas es 100% SQL (time_jornada_segundos / time_horas_esperadas_dia).
--  * Zona horaria America/Argentina/Buenos_Aires (time_settings.timezone).
--  * Umbrales en un solo lugar: time_settings (inactividad 20 min, modal 120 s,
--    heartbeat 60 s, stale_hours 12). Se cambian con un UPDATE sobre esa fila.
--  * Un heartbeat llega con "segundos de inactividad" del cliente; ultima_actividad
--    = ahora − idle (máx. 120 s). El corte por inactividad usa SIEMPRE el valor del
--    servidor, nunca un timestamp del cliente. Límite de frecuencia: 20 s.
--  * Barrido (pg_cron cada 5 min + cada RPC del usuario sobre sus jornadas):
--      1) "trabajando" sin actividad por > inactividad + modal + 60 s → el tramo se cierra
--         en la última actividad y queda "en pausa" (origen sin_heartbeat). Se espera un
--         poco más que los 20 min para no pisar al modal "¿Seguís trabajando?"; el corte
--         es el mismo (la última actividad), así que las horas no cambian.
--      2) "en pausa" olvidada (cambió el día en Buenos Aires o > stale_hours sin actividad)
--         → se cierra en la última actividad con auto_cerrada = true (origen auto_cierre).
--  * Los tramos tienen espacio para un ticket_id opcional en fase 2: alcanza con
--    `alter table tramos add column ticket_id text references tickets(id)` (nullable).
--  * Reloj inyectable para tests: time_now() lee app.time_now si está seteado.

create extension if not exists pg_cron with schema pg_catalog;

-- ═══ Tablas ═══════════════════════════════════════════════════════════════
create table public.time_settings (
  id int primary key default 1 check (id = 1),
  inactivity_minutes int not null default 20 check (inactivity_minutes between 1 and 240),
  modal_response_seconds int not null default 120 check (modal_response_seconds between 10 and 3600),
  heartbeat_seconds int not null default 60 check (heartbeat_seconds between 10 and 600),
  stale_hours int not null default 12 check (stale_hours between 1 and 72),
  timezone text not null default 'America/Argentina/Buenos_Aires'
);
insert into public.time_settings (id) values (1);

create table public.jornadas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fecha date not null,
  inicio timestamptz not null,
  fin timestamptz,
  estado text not null check (estado in ('trabajando','pausa','finalizada')),
  auto_cerrada boolean not null default false,
  revisada_por uuid references auth.users(id) on delete set null,
  revisada_at timestamptz,
  ultima_actividad timestamptz not null,
  ultimo_heartbeat timestamptz not null,
  session_id text,
  total_segundos integer,
  created_at timestamptz not null default now(),
  check (fin is null or fin >= inicio)
);
create unique index jornadas_una_abierta_por_usuario on public.jornadas (user_id) where estado <> 'finalizada';
create index jornadas_user_fecha on public.jornadas (user_id, fecha);

create table public.tramos (
  id uuid primary key default gen_random_uuid(),
  jornada_id uuid not null references public.jornadas(id) on delete cascade,
  tipo text not null check (tipo in ('trabajo','pausa')),
  inicio timestamptz not null,
  fin timestamptz,
  origen_cierre text check (origen_cierre in ('manual','inactividad','sin_heartbeat','auto_cierre','correccion')),
  check (fin is null or fin >= inicio)
);
create unique index tramos_un_abierto_por_jornada on public.tramos (jornada_id) where fin is null;
create index tramos_jornada on public.tramos (jornada_id);

create table public.contratos_usuario (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  horas_diarias numeric(4,2) not null check (horas_diarias > 0 and horas_diarias <= 24),
  dias_laborales int[] not null check (cardinality(dias_laborales) > 0 and dias_laborales <@ array[1,2,3,4,5,6,7]),
  vigente_desde date not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, vigente_desde)
);

create table public.dias_no_laborables (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  user_id uuid references auth.users(id) on delete cascade,
  motivo text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index dias_no_laborables_unico on public.dias_no_laborables (fecha, coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid));

create table public.solicitudes_correccion (
  id uuid primary key default gen_random_uuid(),
  jornada_id uuid references public.jornadas(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  fecha date not null,
  inicio_propuesto timestamptz not null,
  fin_propuesto timestamptz not null,
  motivo text not null,
  estado text not null default 'pendiente' check (estado in ('pendiente','aprobada','rechazada')),
  resuelta_por uuid references auth.users(id) on delete set null,
  resuelta_at timestamptz,
  resolucion_motivo text,
  created_at timestamptz not null default now(),
  check (fin_propuesto > inicio_propuesto)
);
create index solicitudes_estado on public.solicitudes_correccion (estado, created_at);

create table public.auditoria_tiempo (
  id uuid primary key default gen_random_uuid(),
  entidad text not null,
  entidad_id text not null,
  campo text not null,
  valor_anterior text,
  valor_nuevo text,
  usuario uuid,
  usuario_email text,
  fecha timestamptz not null default now(),
  motivo text
);
create index auditoria_tiempo_fecha on public.auditoria_tiempo (fecha desc);

-- ═══ RLS: lectura propia o admin; ninguna escritura directa desde el cliente ═══
alter table public.time_settings enable row level security;
alter table public.jornadas enable row level security;
alter table public.tramos enable row level security;
alter table public.contratos_usuario enable row level security;
alter table public.dias_no_laborables enable row level security;
alter table public.solicitudes_correccion enable row level security;
alter table public.auditoria_tiempo enable row level security;

create policy "Leer settings" on public.time_settings for select to authenticated using (true);
create policy "Leer jornadas propias o admin" on public.jornadas for select to authenticated
  using (user_id = auth.uid() or get_my_role() = 'admin');
create policy "Leer tramos propios o admin" on public.tramos for select to authenticated
  using (exists (select 1 from public.jornadas j where j.id = jornada_id and (j.user_id = auth.uid() or get_my_role() = 'admin')));
create policy "Leer contratos propios o admin" on public.contratos_usuario for select to authenticated
  using (user_id = auth.uid() or get_my_role() = 'admin');
create policy "Leer días no laborables propios, generales o admin" on public.dias_no_laborables for select to authenticated
  using (user_id is null or user_id = auth.uid() or get_my_role() = 'admin');
create policy "Leer solicitudes propias o admin" on public.solicitudes_correccion for select to authenticated
  using (user_id = auth.uid() or get_my_role() = 'admin');
create policy "Solo admin lee auditoría" on public.auditoria_tiempo for select to authenticated
  using (get_my_role() = 'admin');

revoke all on public.time_settings, public.jornadas, public.tramos, public.contratos_usuario,
  public.dias_no_laborables, public.solicitudes_correccion, public.auditoria_tiempo from anon, authenticated;
grant select on public.time_settings, public.jornadas, public.tramos, public.contratos_usuario,
  public.dias_no_laborables, public.solicitudes_correccion, public.auditoria_tiempo to authenticated;

-- ═══ Funciones núcleo ═══════════════════════════════════════════════════════
create or replace function public.time_now() returns timestamptz
language sql volatile set search_path = public as $$
  select coalesce(nullif(current_setting('app.time_now', true), '')::timestamptz, clock_timestamp())
$$;

create or replace function public.time_ba_date(p_ts timestamptz) returns date
language sql stable set search_path = public as $$
  select (p_ts at time zone (select timezone from public.time_settings where id = 1))::date
$$;

create or replace function public.time_require_admin() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.get_my_role() is distinct from 'admin' then
    raise exception 'no_autorizado';
  end if;
end $$;

create or replace function public.time_audit(p_entidad text, p_id text, p_campo text, p_ant text, p_nuevo text, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.auditoria_tiempo (entidad, entidad_id, campo, valor_anterior, valor_nuevo, usuario, usuario_email, motivo)
  values (p_entidad, p_id, p_campo, p_ant, p_nuevo, auth.uid(),
          (select email from public.user_roles where user_id = auth.uid()), p_motivo);
end $$;

-- Segundos trabajados de una jornada. Un tramo de trabajo todavía abierto se
-- cuenta hasta ahora, pero nunca más allá de ultima_actividad + umbral de inactividad.
create or replace function public.time_jornada_segundos(j public.jornadas) returns integer
language sql security definer set search_path = public as $$
  select coalesce(sum(greatest(0, extract(epoch from (
           coalesce(t.fin, least(public.time_now(), j.ultima_actividad + make_interval(mins => s.inactivity_minutes))) - t.inicio
         )))), 0)::integer
  from public.tramos t cross join public.time_settings s
  where t.jornada_id = j.id and t.tipo = 'trabajo' and s.id = 1
$$;

create or replace function public.time_cerrar_tramo_abierto(p_jornada uuid, p_fin timestamptz, p_origen text)
returns void language sql security definer set search_path = public as $$
  update public.tramos set fin = greatest(p_fin, inicio), origen_cierre = p_origen
  where jornada_id = p_jornada and fin is null;
$$;

create or replace function public.time_finalizar(p_jornada uuid, p_fin timestamptz, p_origen text, p_auto boolean)
returns void language plpgsql security definer set search_path = public as $$
declare j public.jornadas;
begin
  perform public.time_cerrar_tramo_abierto(p_jornada, p_fin, p_origen);
  delete from public.tramos where jornada_id = p_jornada and tipo = 'pausa' and fin is not null and fin <= inicio;
  update public.jornadas set estado = 'finalizada', fin = greatest(p_fin, inicio), auto_cerrada = p_auto where id = p_jornada;
  select * into j from public.jornadas where id = p_jornada;
  update public.jornadas set total_segundos = public.time_jornada_segundos(j) where id = p_jornada;
end $$;

create or replace function public.time_barrido(p_user uuid default null) returns integer
language plpgsql security definer set search_path = public as $$
declare
  cfg public.time_settings;
  v_now timestamptz := public.time_now();
  stale interval;
  j public.jornadas;
  n integer := 0;
begin
  select * into cfg from public.time_settings where id = 1;
  stale := make_interval(secs => cfg.inactivity_minutes * 60 + cfg.modal_response_seconds + 60);

  for j in
    select * from public.jornadas
    where estado = 'trabajando' and ultima_actividad < v_now - stale and (p_user is null or user_id = p_user)
    for update skip locked
  loop
    perform public.time_cerrar_tramo_abierto(j.id, j.ultima_actividad, 'sin_heartbeat');
    insert into public.tramos (jornada_id, tipo, inicio) values (j.id, 'pausa', j.ultima_actividad);
    update public.jornadas set estado = 'pausa' where id = j.id;
    n := n + 1;
  end loop;

  for j in
    select * from public.jornadas
    where estado = 'pausa'
      and (fecha < public.time_ba_date(v_now) or ultima_actividad < v_now - make_interval(hours => cfg.stale_hours))
      and (p_user is null or user_id = p_user)
    for update skip locked
  loop
    perform public.time_finalizar(j.id, j.ultima_actividad, 'auto_cierre', true);
    n := n + 1;
  end loop;

  return n;
end $$;

create or replace function public.time_estado() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  v_now timestamptz;
  cfg public.time_settings;
  j public.jornadas;
  v_hoy integer; v_count integer; v_ext integer := 0;
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  v_now := public.time_now();
  perform public.time_barrido(uid);
  select * into cfg from public.time_settings where id = 1;
  select * into j from public.jornadas where user_id = uid and estado <> 'finalizada';
  select coalesce(sum(public.time_jornada_segundos(x)), 0)::integer, count(*)::integer
    into v_hoy, v_count
    from public.jornadas x
    where x.user_id = uid and (x.fecha = public.time_ba_date(v_now) or x.estado <> 'finalizada');
  if j.id is not null and j.estado = 'trabajando' then
    v_ext := greatest(0, extract(epoch from (j.ultima_actividad + make_interval(mins => cfg.inactivity_minutes) - v_now)))::integer;
  end if;
  return jsonb_build_object(
    'server_now', v_now,
    'settings', jsonb_build_object(
      'inactivity_minutes', cfg.inactivity_minutes,
      'modal_response_seconds', cfg.modal_response_seconds,
      'heartbeat_seconds', cfg.heartbeat_seconds),
    'jornada', case when j.id is null then null else jsonb_build_object(
      'id', j.id, 'estado', j.estado, 'inicio', j.inicio, 'session_id', j.session_id,
      'ultima_actividad', j.ultima_actividad,
      'owner_vivo', j.ultimo_heartbeat > v_now - make_interval(secs => cfg.heartbeat_seconds * 3)) end,
    'hoy_segundos', v_hoy,
    'jornadas_hoy', v_count,
    'puede_extender_segundos', v_ext
  );
end $$;

create or replace function public.iniciar_jornada(p_session text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); v_now timestamptz; j_id uuid;
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  v_now := public.time_now();
  perform public.time_barrido(uid);
  if exists (select 1 from public.jornadas where user_id = uid and estado <> 'finalizada') then
    raise exception 'ya_hay_jornada_abierta';
  end if;
  insert into public.jornadas (user_id, fecha, inicio, estado, ultima_actividad, ultimo_heartbeat, session_id)
  values (uid, public.time_ba_date(v_now), v_now, 'trabajando', v_now, v_now, p_session)
  returning id into j_id;
  insert into public.tramos (jornada_id, tipo, inicio) values (j_id, 'trabajo', v_now);
  return public.time_estado();
end $$;

create or replace function public.pausar(p_session text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); v_now timestamptz; j public.jornadas;
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  v_now := public.time_now();
  perform public.time_barrido(uid);
  select * into j from public.jornadas where user_id = uid and estado <> 'finalizada' for update;
  if not found then raise exception 'sin_jornada_abierta'; end if;
  if j.estado = 'trabajando' then
    perform public.time_cerrar_tramo_abierto(j.id, v_now, 'manual');
    insert into public.tramos (jornada_id, tipo, inicio) values (j.id, 'pausa', v_now);
    update public.jornadas set estado = 'pausa', ultima_actividad = v_now, ultimo_heartbeat = v_now, session_id = p_session where id = j.id;
  end if;
  return public.time_estado();
end $$;

create or replace function public.reanudar(p_session text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); v_now timestamptz; j public.jornadas;
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  v_now := public.time_now();
  perform public.time_barrido(uid);
  select * into j from public.jornadas where user_id = uid and estado <> 'finalizada' for update;
  if not found then raise exception 'sin_jornada_abierta'; end if;
  if j.estado = 'pausa' then
    perform public.time_cerrar_tramo_abierto(j.id, v_now, 'manual');
    insert into public.tramos (jornada_id, tipo, inicio) values (j.id, 'trabajo', v_now);
    update public.jornadas set estado = 'trabajando', ultima_actividad = v_now, ultimo_heartbeat = v_now, session_id = p_session where id = j.id;
  end if;
  return public.time_estado();
end $$;

create or replace function public.terminar() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); v_now timestamptz; j public.jornadas;
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  v_now := public.time_now();
  perform public.time_barrido(uid);
  select * into j from public.jornadas where user_id = uid and estado <> 'finalizada' for update;
  if found then
    perform public.time_finalizar(j.id, v_now, 'manual', false);
  end if;
  return public.time_estado();
end $$;

create or replace function public.heartbeat(p_session text, p_idle_seconds integer default 0) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); v_now timestamptz; cfg public.time_settings; j public.jornadas; v_act timestamptz;
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  v_now := public.time_now();
  select * into cfg from public.time_settings where id = 1;
  perform public.time_barrido(uid);
  select * into j from public.jornadas where user_id = uid and estado <> 'finalizada' for update;
  if not found or j.estado <> 'trabajando' then
    return jsonb_build_object('ok', false, 'reason', 'no_trabajando', 'estado', public.time_estado());
  end if;
  -- Una sola sesión de seguimiento por usuario: otra pestaña no pisa a la dueña mientras esté viva.
  if j.session_id is distinct from p_session then
    if j.ultimo_heartbeat > v_now - make_interval(secs => cfg.heartbeat_seconds * 3) then
      return jsonb_build_object('ok', false, 'reason', 'otra_sesion', 'estado', public.time_estado());
    end if;
    update public.jornadas set session_id = p_session where id = j.id;
  end if;
  -- Límite de frecuencia: se ignoran heartbeats más seguidos que 20 s.
  if v_now - j.ultimo_heartbeat >= interval '20 seconds' then
    v_act := v_now - make_interval(secs => least(greatest(coalesce(p_idle_seconds, 0), 0), 120));
    update public.jornadas
       set ultimo_heartbeat = v_now, ultima_actividad = greatest(ultima_actividad, v_act)
     where id = j.id;
  end if;
  return jsonb_build_object('ok', true, 'estado', public.time_estado());
end $$;

-- El modal "¿Seguís trabajando?" venció sin respuesta: se corta en la última
-- actividad que registró el SERVIDOR (no un valor que mande el cliente).
create or replace function public.pausar_por_inactividad(p_session text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); v_now timestamptz; cfg public.time_settings; j public.jornadas;
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  v_now := public.time_now();
  select * into cfg from public.time_settings where id = 1;
  perform public.time_barrido(uid);
  select * into j from public.jornadas where user_id = uid and estado <> 'finalizada' for update;
  if found and j.estado = 'trabajando'
     and j.ultima_actividad <= v_now - make_interval(mins => cfg.inactivity_minutes) + interval '30 seconds' then
    perform public.time_cerrar_tramo_abierto(j.id, j.ultima_actividad, 'inactividad');
    insert into public.tramos (jornada_id, tipo, inicio) values (j.id, 'pausa', j.ultima_actividad);
    update public.jornadas set estado = 'pausa', session_id = p_session where id = j.id;
  end if;
  return public.time_estado();
end $$;

create or replace function public.tomar_sesion(p_session text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); v_now timestamptz;
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  v_now := public.time_now();
  update public.jornadas set session_id = p_session, ultimo_heartbeat = v_now
   where user_id = uid and estado <> 'finalizada';
  return public.time_estado();
end $$;

-- ═══ Reportes, contratos, feriados, correcciones, ediciones de admin ════════
create or replace function public.time_horas_esperadas_dia(p_user uuid, p_fecha date) returns numeric
language sql stable security definer set search_path = public as $$
  select case
    when c.id is null then 0
    when extract(isodow from p_fecha)::int = any (c.dias_laborales)
         and not exists (select 1 from public.dias_no_laborables d
                         where d.fecha = p_fecha and (d.user_id is null or d.user_id = p_user))
      then c.horas_diarias
    else 0 end
  from (select 1) x
  left join lateral (
    select * from public.contratos_usuario c2
    where c2.user_id = p_user and c2.vigente_desde <= p_fecha
    order by c2.vigente_desde desc limit 1
  ) c on true
$$;

create or replace function public.time_reporte(p_desde date, p_hasta date, p_user uuid default null)
returns table (
  usuario_id uuid, email text, nombre text,
  horas_esperadas numeric, horas_esperadas_a_hoy numeric, horas_registradas numeric, diferencia numeric,
  jornadas integer, jornadas_auto_cerradas integer
)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare uid uuid := auth.uid(); v_hoy date;
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  if p_desde is null or p_hasta is null or p_hasta < p_desde or p_hasta - p_desde > 400 then
    raise exception 'rango_invalido';
  end if;
  if public.get_my_role() is distinct from 'admin' then p_user := uid; end if;
  v_hoy := public.time_ba_date(public.time_now());
  return query
  select t.usuario_id, t.email, t.nombre, t.esperadas, t.esperadas_hoy, t.registradas,
         round(t.registradas - t.esperadas_hoy, 2), t.njornadas, t.nauto
  from (
    select ur.user_id as usuario_id, ur.email as email,
           coalesce(nullif(trim(coalesce(ur.first_name,'') || ' ' || coalesce(ur.last_name,'')), ''), ur.email) as nombre,
           (select coalesce(sum(public.time_horas_esperadas_dia(ur.user_id, d::date)), 0)
              from generate_series(p_desde::timestamp, p_hasta::timestamp, interval '1 day') d)::numeric as esperadas,
           (select coalesce(sum(public.time_horas_esperadas_dia(ur.user_id, d::date)), 0)
              from generate_series(p_desde::timestamp, least(p_hasta, v_hoy)::timestamp, interval '1 day') d)::numeric as esperadas_hoy,
           round(coalesce((select sum(public.time_jornada_segundos(j)) from public.jornadas j
                           where j.user_id = ur.user_id and j.fecha between p_desde and p_hasta), 0) / 3600.0, 2) as registradas,
           (select count(*) from public.jornadas j where j.user_id = ur.user_id and j.fecha between p_desde and p_hasta)::integer as njornadas,
           (select count(*) from public.jornadas j where j.user_id = ur.user_id and j.fecha between p_desde and p_hasta and j.auto_cerrada)::integer as nauto
    from public.user_roles ur
    where p_user is null or ur.user_id = p_user
  ) t
  order by t.nombre;
end $$;

create or replace function public.time_jornadas(p_desde date, p_hasta date, p_user uuid default null)
returns table (
  id uuid, usuario_id uuid, email text, fecha date, inicio timestamptz, fin timestamptz, estado text,
  auto_cerrada boolean, revisada_at timestamptz, total_segundos integer, pausa_segundos integer, tramos jsonb
)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  if p_desde is null or p_hasta is null or p_hasta < p_desde or p_hasta - p_desde > 400 then
    raise exception 'rango_invalido';
  end if;
  if public.get_my_role() is distinct from 'admin' then p_user := uid; end if;
  return query
  select j.id, j.user_id, ur.email, j.fecha, j.inicio, j.fin, j.estado, j.auto_cerrada, j.revisada_at,
         public.time_jornada_segundos(j),
         coalesce((select sum(extract(epoch from (coalesce(t.fin, least(public.time_now(), j.ultima_actividad)) - t.inicio)))::integer
                   from public.tramos t where t.jornada_id = j.id and t.tipo = 'pausa'), 0),
         coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'tipo', t.tipo, 'inicio', t.inicio, 'fin', t.fin, 'origen_cierre', t.origen_cierre) order by t.inicio)
                   from public.tramos t where t.jornada_id = j.id), '[]'::jsonb)
  from public.jornadas j
  left join public.user_roles ur on ur.user_id = j.user_id
  where j.fecha between p_desde and p_hasta and (p_user is null or j.user_id = p_user)
  order by j.inicio desc;
end $$;

create or replace function public.admin_set_contrato(p_user uuid, p_horas numeric, p_dias integer[], p_desde date)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_prev public.contratos_usuario; v_id uuid;
begin
  perform public.time_require_admin();
  if p_user is null or p_horas is null or p_desde is null or p_dias is null or cardinality(p_dias) = 0 then
    raise exception 'datos_invalidos';
  end if;
  select * into v_prev from public.contratos_usuario where user_id = p_user and vigente_desde = p_desde;
  if found then
    update public.contratos_usuario set horas_diarias = p_horas, dias_laborales = p_dias, created_by = auth.uid() where id = v_prev.id returning id into v_id;
    perform public.time_audit('contrato', v_id::text, 'horas_diarias', v_prev.horas_diarias::text, p_horas::text, 'vigente desde ' || p_desde);
    perform public.time_audit('contrato', v_id::text, 'dias_laborales', v_prev.dias_laborales::text, p_dias::text, 'vigente desde ' || p_desde);
  else
    insert into public.contratos_usuario (user_id, horas_diarias, dias_laborales, vigente_desde, created_by)
    values (p_user, p_horas, p_dias, p_desde, auth.uid()) returning id into v_id;
    perform public.time_audit('contrato', v_id::text, 'creado', null, p_horas || 'h ' || p_dias::text, 'usuario ' || p_user || ' desde ' || p_desde);
  end if;
  return v_id;
end $$;

create or replace function public.admin_set_dia_no_laborable(p_fecha date, p_user uuid, p_motivo text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.time_require_admin();
  if p_fecha is null then raise exception 'datos_invalidos'; end if;
  insert into public.dias_no_laborables (fecha, user_id, motivo, created_by)
  values (p_fecha, p_user, nullif(trim(p_motivo), ''), auth.uid()) returning id into v_id;
  perform public.time_audit('dia_no_laborable', v_id::text, 'creado', null, p_fecha::text || coalesce(' / usuario ' || p_user, ' / todos'), p_motivo);
  return v_id;
end $$;

create or replace function public.admin_borrar_dia_no_laborable(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare d public.dias_no_laborables;
begin
  perform public.time_require_admin();
  select * into d from public.dias_no_laborables where id = p_id;
  if not found then return; end if;
  delete from public.dias_no_laborables where id = p_id;
  perform public.time_audit('dia_no_laborable', p_id::text, 'borrado', d.fecha::text || coalesce(' / usuario ' || d.user_id, ' / todos'), null, d.motivo);
end $$;

create or replace function public.time_hay_superposicion(p_user uuid, p_excluir uuid, p_inicio timestamptz, p_fin timestamptz)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.jornadas o
    where o.user_id = p_user and (p_excluir is null or o.id <> p_excluir)
      and tstzrange(o.inicio, coalesce(o.fin, o.ultima_actividad)) && tstzrange(p_inicio, p_fin)
  )
$$;

create or replace function public.time_editar_jornada_interna(p_jornada uuid, p_inicio timestamptz, p_fin timestamptz, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare j public.jornadas; v_total integer;
begin
  if p_inicio is null or p_fin is null or p_fin <= p_inicio then raise exception 'rango_invalido'; end if;
  select * into j from public.jornadas where id = p_jornada for update;
  if not found then raise exception 'jornada_inexistente'; end if;
  if j.estado <> 'finalizada' then raise exception 'jornada_abierta'; end if;
  if public.time_hay_superposicion(j.user_id, j.id, p_inicio, p_fin) then raise exception 'se_superpone'; end if;
  v_total := extract(epoch from (p_fin - p_inicio))::integer;
  perform public.time_audit('jornada', j.id::text, 'inicio', j.inicio::text, p_inicio::text, p_motivo);
  perform public.time_audit('jornada', j.id::text, 'fin', j.fin::text, p_fin::text, p_motivo);
  perform public.time_audit('jornada', j.id::text, 'total_segundos', j.total_segundos::text, v_total::text, p_motivo);
  delete from public.tramos where jornada_id = j.id;
  insert into public.tramos (jornada_id, tipo, inicio, fin, origen_cierre) values (j.id, 'trabajo', p_inicio, p_fin, 'correccion');
  update public.jornadas set inicio = p_inicio, fin = p_fin, fecha = public.time_ba_date(p_inicio), total_segundos = v_total where id = j.id;
end $$;

create or replace function public.time_crear_jornada_interna(p_user uuid, p_inicio timestamptz, p_fin timestamptz, p_motivo text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_total integer;
begin
  if p_inicio is null or p_fin is null or p_fin <= p_inicio then raise exception 'rango_invalido'; end if;
  if public.time_hay_superposicion(p_user, null, p_inicio, p_fin) then raise exception 'se_superpone'; end if;
  v_total := extract(epoch from (p_fin - p_inicio))::integer;
  insert into public.jornadas (user_id, fecha, inicio, fin, estado, ultima_actividad, ultimo_heartbeat, total_segundos)
  values (p_user, public.time_ba_date(p_inicio), p_inicio, p_fin, 'finalizada', p_fin, p_fin, v_total) returning id into v_id;
  insert into public.tramos (jornada_id, tipo, inicio, fin, origen_cierre) values (v_id, 'trabajo', p_inicio, p_fin, 'correccion');
  perform public.time_audit('jornada', v_id::text, 'creada', null, p_inicio::text || ' → ' || p_fin::text, p_motivo);
  return v_id;
end $$;

create or replace function public.admin_editar_jornada(p_jornada uuid, p_inicio timestamptz, p_fin timestamptz, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.time_require_admin();
  if p_motivo is null or length(trim(p_motivo)) = 0 then raise exception 'motivo_requerido'; end if;
  perform public.time_editar_jornada_interna(p_jornada, p_inicio, p_fin, p_motivo);
end $$;

create or replace function public.admin_editar_tramo(p_tramo uuid, p_inicio timestamptz, p_fin timestamptz, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare t public.tramos; j public.jornadas; m record;
begin
  perform public.time_require_admin();
  if p_motivo is null or length(trim(p_motivo)) = 0 then raise exception 'motivo_requerido'; end if;
  if p_inicio is null or p_fin is null or p_fin <= p_inicio then raise exception 'rango_invalido'; end if;
  select * into t from public.tramos where id = p_tramo;
  if not found then raise exception 'tramo_inexistente'; end if;
  select * into j from public.jornadas where id = t.jornada_id for update;
  if j.estado <> 'finalizada' then raise exception 'jornada_abierta'; end if;
  perform public.time_audit('tramo', t.id::text, 'inicio', t.inicio::text, p_inicio::text, p_motivo);
  perform public.time_audit('tramo', t.id::text, 'fin', t.fin::text, p_fin::text, p_motivo);
  update public.tramos set inicio = p_inicio, fin = p_fin, origen_cierre = 'correccion' where id = t.id;
  select min(inicio) as mi, max(fin) as ma into m from public.tramos where jornada_id = j.id;
  update public.jornadas set inicio = m.mi, fin = m.ma, fecha = public.time_ba_date(m.mi) where id = j.id;
  select * into j from public.jornadas where id = j.id;
  perform public.time_audit('jornada', j.id::text, 'total_segundos', j.total_segundos::text, public.time_jornada_segundos(j)::text, p_motivo);
  update public.jornadas set total_segundos = public.time_jornada_segundos(j) where id = j.id;
end $$;

create or replace function public.admin_marcar_revisada(p_jornada uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.time_require_admin();
  update public.jornadas set revisada_por = auth.uid(), revisada_at = public.time_now() where id = p_jornada;
  perform public.time_audit('jornada', p_jornada::text, 'revisada', null, 'sí', null);
end $$;

create or replace function public.solicitar_correccion(p_jornada uuid, p_fecha date, p_inicio timestamptz, p_fin timestamptz, p_motivo text)
returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); j public.jornadas; v_fecha date := p_fecha; v_id uuid;
begin
  if uid is null then raise exception 'no_autenticado'; end if;
  if p_motivo is null or length(trim(p_motivo)) = 0 or length(p_motivo) > 1000 then raise exception 'motivo_requerido'; end if;
  if p_inicio is null or p_fin is null or p_fin <= p_inicio or p_fin > public.time_now() then raise exception 'rango_invalido'; end if;
  if p_jornada is not null then
    select * into j from public.jornadas where id = p_jornada;
    if not found or j.user_id <> uid then raise exception 'no_autorizado'; end if;
    v_fecha := j.fecha;
  end if;
  if v_fecha is null then v_fecha := public.time_ba_date(p_inicio); end if;
  insert into public.solicitudes_correccion (jornada_id, user_id, fecha, inicio_propuesto, fin_propuesto, motivo)
  values (p_jornada, uid, v_fecha, p_inicio, p_fin, trim(p_motivo)) returning id into v_id;
  return v_id;
end $$;

create or replace function public.resolver_correccion(p_id uuid, p_aprobar boolean, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare s public.solicitudes_correccion; v_nuevo uuid;
begin
  perform public.time_require_admin();
  select * into s from public.solicitudes_correccion where id = p_id for update;
  if not found then raise exception 'solicitud_inexistente'; end if;
  if s.estado <> 'pendiente' then raise exception 'solicitud_ya_resuelta'; end if;
  if not p_aprobar and (p_motivo is null or length(trim(p_motivo)) = 0) then raise exception 'motivo_requerido'; end if;
  if p_aprobar then
    if s.jornada_id is not null then
      perform public.time_editar_jornada_interna(s.jornada_id, s.inicio_propuesto, s.fin_propuesto, 'Corrección aprobada: ' || s.motivo);
    else
      v_nuevo := public.time_crear_jornada_interna(s.user_id, s.inicio_propuesto, s.fin_propuesto, 'Corrección aprobada: ' || s.motivo);
      update public.solicitudes_correccion set jornada_id = v_nuevo where id = s.id;
    end if;
  end if;
  update public.solicitudes_correccion
     set estado = case when p_aprobar then 'aprobada' else 'rechazada' end,
         resuelta_por = auth.uid(), resuelta_at = public.time_now(), resolucion_motivo = nullif(trim(p_motivo), '')
   where id = s.id;
  perform public.time_audit('solicitud', s.id::text, 'estado', 'pendiente', case when p_aprobar then 'aprobada' else 'rechazada' end, p_motivo);
end $$;

-- ═══ Permisos de ejecución: solo la API pública, para usuarios autenticados ═══
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig, p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (p.proname like 'time\_%' or p.proname like 'admin\_%' or p.proname in
           ('iniciar_jornada','pausar','reanudar','terminar','heartbeat','pausar_por_inactividad','tomar_sesion','solicitar_correccion','resolver_correccion'))
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
    if r.proname in ('time_estado','time_reporte','time_jornadas','iniciar_jornada','pausar','reanudar','terminar','heartbeat',
                     'pausar_por_inactividad','tomar_sesion','solicitar_correccion','resolver_correccion',
                     'admin_set_contrato','admin_set_dia_no_laborable','admin_borrar_dia_no_laborable',
                     'admin_editar_jornada','admin_editar_tramo','admin_marcar_revisada') then
      execute format('grant execute on function %s to authenticated', r.sig);
    end if;
  end loop;
end $$;

-- ═══ Barrido automático cada 5 minutos ═══════════════════════════════════════
select cron.schedule('time-barrido', '*/5 * * * *', $$select public.time_barrido(null)$$);
