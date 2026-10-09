-- Tests del tracker de tiempo (control de jornada). Corren TODO dentro de una
-- transacción que termina en ROLLBACK: no persisten nada. Ejecutar completo, de
-- una sola vez (Supabase SQL editor o MCP execute_sql). Si algún assert falla, el
-- bloque DO corta con un mensaje "Txx ...". Si termina bien, devuelve
-- 'ALL TIME TRACKING TESTS PASSED'.
--
-- NO ejecutar sin el ROLLBACK final: los tests borran/crean jornadas y contratos
-- de los usuarios de prueba (Nico = admin, Lucas y Hernán = empleados).
--
-- El reloj se simula con set_config('app.time_now', ...) (ver time_now()); el
-- usuario autenticado, con request.jwt.claims (lo que lee auth.uid()).
-- Fechas usadas: lunes 2026-10-12 en adelante (UTC-3 en Buenos Aires).

begin;

do $$
declare
  admin_id constant uuid := 'efb96fac-a64b-4318-9001-a3d96c2d460e';
  e1       constant uuid := '2c021c70-fdcd-4253-912f-eda35d0be711';
  e2       constant uuid := '56dc77e3-6b54-4ad7-b51e-bb4018b84638';
  r jsonb; n integer; v numeric; jid uuid; sid uuid; other uuid; s text; rec record; t_id uuid;
  caught boolean;
begin
  -- Sanidad de los usuarios de prueba
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  if get_my_role() <> 'admin' then raise exception 'T0 el usuario admin de prueba ya no es admin'; end if;

  delete from jornadas where user_id in (e1, e2);
  delete from contratos_usuario where user_id in (e1, e2);
  delete from dias_no_laborables;
  delete from solicitudes_correccion where user_id in (e1, e2);

  ------------------------------------------------------------------------
  -- T1 cálculo de horas: 09:00-10:00 trabaja, 10:00-10:30 pausa, 10:30-12:30 trabaja
  perform set_config('request.jwt.claims', json_build_object('sub', e1, 'role', 'authenticated')::text, true);
  perform set_config('app.time_now', '2026-10-12T12:00:00Z', true);
  perform iniciar_jornada('A');
  perform set_config('app.time_now', '2026-10-12T12:15:00Z', true); perform heartbeat('A', 0);
  perform set_config('app.time_now', '2026-10-12T12:30:00Z', true); perform heartbeat('A', 0);
  perform set_config('app.time_now', '2026-10-12T12:45:00Z', true); perform heartbeat('A', 0);
  perform set_config('app.time_now', '2026-10-12T13:00:00Z', true); perform pausar('A');
  perform set_config('app.time_now', '2026-10-12T13:30:00Z', true); perform reanudar('A');
  perform set_config('app.time_now', '2026-10-12T13:45:00Z', true); perform heartbeat('A', 0);
  perform set_config('app.time_now', '2026-10-12T14:00:00Z', true); perform heartbeat('A', 0);
  perform set_config('app.time_now', '2026-10-12T14:15:00Z', true); perform heartbeat('A', 0);
  perform set_config('app.time_now', '2026-10-12T14:30:00Z', true); perform heartbeat('A', 0);
  perform set_config('app.time_now', '2026-10-12T14:45:00Z', true); perform heartbeat('A', 0);
  perform set_config('app.time_now', '2026-10-12T15:00:00Z', true); perform heartbeat('A', 0);
  perform set_config('app.time_now', '2026-10-12T15:15:00Z', true); perform heartbeat('A', 0);
  perform set_config('app.time_now', '2026-10-12T15:30:00Z', true); perform terminar();
  select id, total_segundos into jid, n from jornadas where user_id = e1 and fecha = '2026-10-12';
  if n is distinct from 10800 then raise exception 'T1 total esperado 10800 s, fue %', n; end if;
  select sum(extract(epoch from (fin - inicio)))::integer into n from tramos where jornada_id = jid and tipo = 'pausa';
  if n <> 1800 then raise exception 'T1 pausa esperada 1800 s, fue %', n; end if;
  select count(*) into n from tramos where jornada_id = jid;
  if n <> 3 then raise exception 'T1 se esperaban 3 tramos, hubo %', n; end if;

  ------------------------------------------------------------------------
  -- T2 inactividad: el modal vence sin respuesta → corta en la última actividad
  perform set_config('request.jwt.claims', json_build_object('sub', e2, 'role', 'authenticated')::text, true);
  perform set_config('app.time_now', '2026-10-13T12:00:00Z', true);
  perform iniciar_jornada('A');
  perform set_config('app.time_now', '2026-10-13T12:10:00Z', true); perform heartbeat('A', 0);
  -- a los 5 min de la última actividad NO debe pausar (el cliente se equivocó de momento)
  perform set_config('app.time_now', '2026-10-13T12:15:00Z', true);
  r := pausar_por_inactividad('A');
  if r #>> '{jornada,estado}' <> 'trabajando' then raise exception 'T2 pausó antes de tiempo'; end if;
  perform set_config('app.time_now', '2026-10-13T12:31:00Z', true);
  r := pausar_por_inactividad('A');
  if r #>> '{jornada,estado}' <> 'pausa' then raise exception 'T2 no pausó por inactividad'; end if;
  select id into jid from jornadas where user_id = e2 and fecha = '2026-10-13';
  select origen_cierre into s from tramos where jornada_id = jid and tipo = 'trabajo';
  if s <> 'inactividad' then raise exception 'T2 origen esperado inactividad, fue %', s; end if;
  if (select fin from tramos where jornada_id = jid and tipo = 'trabajo') <> '2026-10-13T12:10:00Z'::timestamptz then
    raise exception 'T2 el tramo debía cortar en la última actividad (12:10Z)';
  end if;
  perform set_config('app.time_now', '2026-10-13T13:00:00Z', true);
  perform terminar();
  select total_segundos into n from jornadas where id = jid;
  if n <> 600 then raise exception 'T2 total esperado 600 s, fue %', n; end if;

  ------------------------------------------------------------------------
  -- T3 sin heartbeats (pestaña cerrada) → tramo cerrado en el último heartbeat
  perform set_config('app.time_now', '2026-10-14T12:00:00Z', true);
  perform iniciar_jornada('A');
  perform set_config('app.time_now', '2026-10-14T12:05:00Z', true); perform heartbeat('A', 0);
  perform set_config('app.time_now', '2026-10-14T13:00:00Z', true);
  perform time_barrido(null);
  select id into jid from jornadas where user_id = e2 and fecha = '2026-10-14';
  if (select estado from jornadas where id = jid) <> 'pausa' then raise exception 'T3 debía quedar en pausa'; end if;
  if (select fin from tramos where jornada_id = jid and tipo = 'trabajo') <> '2026-10-14T12:05:00Z'::timestamptz then
    raise exception 'T3 el tramo debía cerrar en el último heartbeat (12:05Z)';
  end if;
  if (select origen_cierre from tramos where jornada_id = jid and tipo = 'trabajo') <> 'sin_heartbeat' then
    raise exception 'T3 origen esperado sin_heartbeat';
  end if;
  r := heartbeat('A', 0);
  if (r ->> 'ok')::boolean then raise exception 'T3 un heartbeat tardío no debía reactivar la jornada'; end if;

  ------------------------------------------------------------------------
  -- T4 cierre automático: la jornada olvidada se cierra sola y queda auto_cerrada
  perform set_config('app.time_now', '2026-10-15T15:00:00Z', true);
  perform time_barrido(null);
  select estado, auto_cerrada, total_segundos, fin into rec from jornadas where id = jid;
  if rec.estado <> 'finalizada' or not rec.auto_cerrada then raise exception 'T4 debía cerrarse como auto_cerrada'; end if;
  if rec.total_segundos <> 300 then raise exception 'T4 total esperado 300 s, fue %', rec.total_segundos; end if;
  if rec.fin <> '2026-10-14T12:05:00Z'::timestamptz then raise exception 'T4 debía cerrar en la última actividad'; end if;
  select count(*) into n from tramos where jornada_id = jid;
  if n <> 1 then raise exception 'T4 el tramo de pausa de largo cero debía borrarse (hay % tramos)', n; end if;

  -- T4b mismo día, más de stale_hours sin actividad en pausa
  perform set_config('request.jwt.claims', json_build_object('sub', e1, 'role', 'authenticated')::text, true);
  perform set_config('app.time_now', '2026-10-16T12:00:00Z', true);
  perform iniciar_jornada('A');
  perform set_config('app.time_now', '2026-10-16T12:05:00Z', true); perform heartbeat('A', 0);
  perform set_config('app.time_now', '2026-10-16T12:10:00Z', true); perform pausar('A');
  perform set_config('app.time_now', '2026-10-17T00:30:00Z', true);  -- 21:30 BA del mismo día, >12 h
  perform time_barrido(null);
  select estado, auto_cerrada, total_segundos into rec from jornadas where user_id = e1 and fecha = '2026-10-16';
  if rec.estado <> 'finalizada' or not rec.auto_cerrada or rec.total_segundos <> 600 then
    raise exception 'T4b cierre por stale_hours falló (%, %, %)', rec.estado, rec.auto_cerrada, rec.total_segundos;
  end if;

  ------------------------------------------------------------------------
  -- T5 varias pestañas: no se duplica el tiempo y una sola sesión manda
  perform set_config('app.time_now', '2026-10-19T12:00:00Z', true);
  perform iniciar_jornada('A');
  begin
    perform iniciar_jornada('B');
    raise exception 'T5 permitió dos jornadas abiertas';
  exception when others then
    if sqlerrm <> 'ya_hay_jornada_abierta' then raise; end if;
  end;
  perform set_config('app.time_now', '2026-10-19T12:00:30Z', true);
  r := heartbeat('B', 0);
  if r ->> 'reason' is distinct from 'otra_sesion' then raise exception 'T5 la pestaña B no debía poder mandar heartbeats'; end if;
  perform set_config('app.time_now', '2026-10-19T12:04:00Z', true);
  r := heartbeat('B', 0);   -- A lleva >3 min sin latir: B toma el control
  if not (r ->> 'ok')::boolean then raise exception 'T5 B debía tomar el control cuando A dejó de latir'; end if;
  perform set_config('app.time_now', '2026-10-19T12:04:30Z', true);
  r := heartbeat('A', 0);
  if r ->> 'reason' is distinct from 'otra_sesion' then raise exception 'T5 A no debía pisar a B'; end if;
  perform set_config('app.time_now', '2026-10-19T12:10:00Z', true);
  perform terminar();
  select id, total_segundos into sid, n from jornadas where user_id = e1 and fecha = '2026-10-19';
  if n <> 600 then raise exception 'T5 el total debía ser 600 s (sin duplicar), fue %', n; end if;

  ------------------------------------------------------------------------
  -- T6 contratos con vigencia + feriados/licencias (como admin)
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  perform admin_set_contrato(e1, 6, array[1,2,3,4,5], '2026-10-01');
  perform admin_set_contrato(e1, 8, array[1,2,3,4,5], '2026-10-15');
  perform admin_set_contrato(e2, 8, array[1,2,3,4,5], '2026-10-01');
  if time_horas_esperadas_dia(e1, '2026-10-14') <> 6 then raise exception 'T6 el 14/10 se esperaban 6 h'; end if;
  if time_horas_esperadas_dia(e1, '2026-10-15') <> 8 then raise exception 'T6 el 15/10 se esperaban 8 h'; end if;
  if time_horas_esperadas_dia(e1, '2026-10-17') <> 0 then raise exception 'T6 el sábado no debía tener horas'; end if;
  if time_horas_esperadas_dia(e1, '2026-09-30') <> 0 then raise exception 'T6 antes del contrato no debía haber horas'; end if;
  perform set_config('app.time_now', '2026-10-25T15:00:00Z', true);
  select horas_esperadas into v from time_reporte('2026-10-12', '2026-10-18', e1);
  if v <> 34 then raise exception 'T6 semana de e1 sin feriados: esperado 34, fue %', v; end if;
  perform admin_set_dia_no_laborable('2026-10-13', null, 'Feriado');
  perform admin_set_dia_no_laborable('2026-10-16', e1, 'Licencia');
  select horas_esperadas into v from time_reporte('2026-10-12', '2026-10-18', e1);
  if v <> 20 then raise exception 'T6 e1 con feriado y licencia: esperado 20, fue %', v; end if;
  select horas_esperadas into v from time_reporte('2026-10-12', '2026-10-18', e2);
  if v <> 32 then raise exception 'T6 e2 (solo feriado general): esperado 32, fue %', v; end if;
  -- un contrato nuevo posterior NO reescribe el período anterior
  perform admin_set_contrato(e1, 10, array[1,2,3,4,5], '2026-10-20');
  select horas_esperadas into v from time_reporte('2026-10-12', '2026-10-18', e1);
  if v <> 20 then raise exception 'T6 un contrato nuevo cambió un período anterior (%)', v; end if;

  ------------------------------------------------------------------------
  -- T7 permisos
  perform set_config('request.jwt.claims', json_build_object('sub', e1, 'role', 'authenticated')::text, true);
  select count(*) into n from time_reporte('2026-10-01', '2026-10-31', e2);
  if n <> 1 then raise exception 'T7 un empleado recibió % filas del reporte', n; end if;
  select usuario_id into other from time_reporte('2026-10-01', '2026-10-31', e2);
  if other <> e1 then raise exception 'T7 el reporte devolvió datos de otro usuario'; end if;
  if exists (select 1 from time_jornadas('2026-10-01', '2026-10-31', e2) where usuario_id <> e1) then
    raise exception 'T7 time_jornadas devolvió jornadas de otro usuario';
  end if;
  caught := false;
  begin perform admin_set_contrato(e1, 1, array[1], '2026-11-01'); exception when others then caught := sqlerrm = 'no_autorizado'; end;
  if not caught then raise exception 'T7 un empleado pudo cambiar contratos'; end if;
  caught := false;
  begin perform admin_editar_jornada(jid, now(), now() + interval '1 hour', 'x'); exception when others then caught := sqlerrm = 'no_autorizado'; end;
  if not caught then raise exception 'T7 un empleado pudo editar una jornada'; end if;
  caught := false;
  begin perform admin_set_dia_no_laborable('2026-12-24', null, 'x'); exception when others then caught := sqlerrm = 'no_autorizado'; end;
  if not caught then raise exception 'T7 un empleado pudo crear un feriado'; end if;
  -- RLS y privilegios directos sobre las tablas
  execute 'set local role authenticated';
  select count(*) into n from jornadas where user_id = e2;
  if n <> 0 then raise exception 'T7 RLS: un empleado ve jornadas ajenas (%)', n; end if;
  select count(*) into n from auditoria_tiempo;
  if n <> 0 then raise exception 'T7 RLS: un empleado ve la auditoría'; end if;
  caught := false;
  begin insert into jornadas (user_id, fecha, inicio, estado, ultima_actividad, ultimo_heartbeat)
        values (e1, '2026-10-30', now(), 'finalizada', now(), now());
  exception when insufficient_privilege then caught := true; end;
  if not caught then raise exception 'T7 un empleado pudo insertar jornadas directo'; end if;
  caught := false;
  begin update jornadas set total_segundos = 99999 where user_id = e1;
  exception when insufficient_privilege then caught := true; end;
  if not caught then raise exception 'T7 un empleado pudo editar jornadas directo'; end if;
  execute 'reset role';
  -- el admin sí ve todo
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  select count(*) into n from time_reporte('2026-10-01', '2026-10-31', null) where usuario_id in (e1, e2);
  if n <> 2 then raise exception 'T7 el admin debía ver a ambos empleados'; end if;
  execute 'set local role authenticated';
  select count(*) into n from jornadas where user_id in (e1, e2);
  if n < 4 then raise exception 'T7 RLS: el admin no ve las jornadas (%)', n; end if;
  execute 'reset role';

  ------------------------------------------------------------------------
  -- T8 correcciones: solicitud → aprobación/rechazo → auditoría
  perform set_config('app.time_now', '2026-10-26T12:00:00Z', true);
  perform set_config('request.jwt.claims', json_build_object('sub', e1, 'role', 'authenticated')::text, true);
  -- jid (T5, 19/10) es de e1; la jornada del 12/10 es la de T1
  select id into jid from jornadas where user_id = e1 and fecha = '2026-10-12';
  t_id := solicitar_correccion(jid, null, '2026-10-12T11:30:00Z', '2026-10-12T15:30:00Z', 'Olvidé iniciar a tiempo');
  caught := false;
  begin perform resolver_correccion(t_id, true, null); exception when others then caught := sqlerrm = 'no_autorizado'; end;
  if not caught then raise exception 'T8 un empleado pudo resolver su propia solicitud'; end if;
  caught := false;
  begin perform solicitar_correccion(jid, null, '2026-10-12T11:30:00Z', '2030-01-01T00:00:00Z', 'futuro'); exception when others then caught := sqlerrm = 'rango_invalido'; end;
  if not caught then raise exception 'T8 aceptó una corrección en el futuro'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', e2, 'role', 'authenticated')::text, true);
  caught := false;
  begin perform solicitar_correccion(jid, null, '2026-10-12T11:30:00Z', '2026-10-12T15:30:00Z', 'ajena'); exception when others then caught := sqlerrm = 'no_autorizado'; end;
  if not caught then raise exception 'T8 pudo pedir corrección sobre la jornada de otro'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  perform resolver_correccion(t_id, true, null);
  select inicio, total_segundos into rec from jornadas where id = jid;
  if rec.inicio <> '2026-10-12T11:30:00Z'::timestamptz or rec.total_segundos <> 14400 then
    raise exception 'T8 la corrección aprobada no se aplicó (% / %)', rec.inicio, rec.total_segundos;
  end if;
  if (select estado from solicitudes_correccion where id = t_id) <> 'aprobada' then raise exception 'T8 estado de solicitud'; end if;
  if not exists (select 1 from auditoria_tiempo where entidad = 'jornada' and entidad_id = jid::text and campo = 'inicio'
                 and valor_anterior is not null and valor_nuevo is not null and motivo like 'Corrección aprobada%') then
    raise exception 'T8 falta la auditoría de la corrección';
  end if;
  -- rechazo: exige motivo y no toca la jornada
  perform set_config('request.jwt.claims', json_build_object('sub', e1, 'role', 'authenticated')::text, true);
  t_id := solicitar_correccion(jid, null, '2026-10-12T10:00:00Z', '2026-10-12T15:30:00Z', 'otra');
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  caught := false;
  begin perform resolver_correccion(t_id, false, ''); exception when others then caught := sqlerrm = 'motivo_requerido'; end;
  if not caught then raise exception 'T8 el rechazo no exigió motivo'; end if;
  perform resolver_correccion(t_id, false, 'No corresponde');
  if (select total_segundos from jornadas where id = jid) <> 14400 then raise exception 'T8 un rechazo modificó la jornada'; end if;
  -- superposición con otra jornada (la del 19/10 12:00-12:10Z)
  perform set_config('request.jwt.claims', json_build_object('sub', e1, 'role', 'authenticated')::text, true);
  t_id := solicitar_correccion(jid, null, '2026-10-19T11:50:00Z', '2026-10-19T15:30:00Z', 'pisa otra');
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  caught := false;
  begin perform resolver_correccion(t_id, true, null); exception when others then caught := sqlerrm = 'se_superpone'; end;
  if not caught then raise exception 'T8 aprobó una corrección que se superpone'; end if;
  -- día sin jornada: la aprobación crea una
  perform set_config('request.jwt.claims', json_build_object('sub', e2, 'role', 'authenticated')::text, true);
  t_id := solicitar_correccion(null, null, '2026-10-20T12:00:00Z', '2026-10-20T16:00:00Z', 'no pude iniciar');
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  perform resolver_correccion(t_id, true, null);
  select total_segundos into n from jornadas where user_id = e2 and fecha = '2026-10-20';
  if n is distinct from 14400 then raise exception 'T8 no se creó la jornada pedida (%)', n; end if;

  ------------------------------------------------------------------------
  -- T9 edición directa de un tramo por admin → auditoría
  select id into t_id from tramos where jornada_id = sid and tipo = 'trabajo';
  caught := false;
  begin perform admin_editar_tramo(t_id, '2026-10-19T12:00:00Z', '2026-10-19T12:30:00Z', ''); exception when others then caught := sqlerrm = 'motivo_requerido'; end;
  if not caught then raise exception 'T9 la edición no exigió motivo'; end if;
  perform admin_editar_tramo(t_id, '2026-10-19T12:00:00Z', '2026-10-19T12:30:00Z', 'Se quedó trabajando');
  if (select total_segundos from jornadas where id = sid) <> 1800 then raise exception 'T9 no se recalculó el total'; end if;
  if not exists (select 1 from auditoria_tiempo where entidad = 'tramo' and entidad_id = t_id::text and campo = 'fin'
                 and valor_anterior is not null and valor_nuevo is not null and motivo = 'Se quedó trabajando') then
    raise exception 'T9 falta la auditoría del tramo';
  end if;

  ------------------------------------------------------------------------
  -- T10 zona horaria: 23:30 en Buenos Aires del 27/10 es 02:30Z del 28/10
  perform set_config('request.jwt.claims', json_build_object('sub', e2, 'role', 'authenticated')::text, true);
  perform set_config('app.time_now', '2026-10-28T02:30:00Z', true);
  perform iniciar_jornada('A');
  if (select fecha from jornadas where user_id = e2 and inicio = '2026-10-28T02:30:00Z') <> '2026-10-27' then
    raise exception 'T10 la fecha de la jornada debía ser la de Buenos Aires (27/10)';
  end if;

  ------------------------------------------------------------------------
  -- T11 el tiempo en vivo nunca pasa del último heartbeat + umbral de inactividad
  perform set_config('app.time_now', '2026-10-28T02:52:00Z', true);   -- 22 min sin latir (aún no lo barre el job)
  r := time_estado();
  if (r ->> 'hoy_segundos')::integer > 1200 then raise exception 'T11 el tiempo en vivo superó el tope de inactividad (%)', r ->> 'hoy_segundos'; end if;
end $$;

select 'ALL TIME TRACKING TESTS PASSED' as result;

rollback;
