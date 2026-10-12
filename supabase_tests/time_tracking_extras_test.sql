-- Tests de las ampliaciones del tracker: resumen del día, subtareas y seguimiento por
-- tarea. Igual que time_tracking_test.sql: corre TODO dentro de una transacción que
-- termina en ROLLBACK (no persiste nada) y se ejecuta completo de una vez.
-- Usuarios de prueba: Nico = admin, Lucas y Hernán = empleados.

begin;

do $$
declare
  admin_id constant uuid := 'efb96fac-a64b-4318-9001-a3d96c2d460e';
  e1       constant uuid := '2c021c70-fdcd-4253-912f-eda35d0be711';
  e2       constant uuid := '56dc77e3-6b54-4ad7-b51e-bb4018b84638';
  r jsonb; n integer; s text; jid uuid; caught boolean; rec record; tk text; dt text; tk_title text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  if get_my_role() <> 'admin' then raise exception 'X0 el usuario admin de prueba ya no es admin'; end if;
  delete from jornadas where user_id in (e1, e2);

  ------------------------------------------------------------------------
  -- R1 el resumen del día es obligatorio para terminar
  perform set_config('request.jwt.claims', json_build_object('sub', e1, 'role', 'authenticated')::text, true);
  perform set_config('app.time_now', '2026-10-29T12:00:00Z', true);
  perform iniciar_jornada('A');
  perform set_config('app.time_now', '2026-10-29T12:10:00Z', true); perform heartbeat('A', 0);
  caught := false;
  begin perform terminar(''); exception when others then caught := sqlerrm = 'resumen_requerido'; end;
  if not caught then raise exception 'R1 permitió terminar con resumen vacío'; end if;
  caught := false;
  begin perform terminar('abc'); exception when others then caught := sqlerrm = 'resumen_requerido'; end;
  if not caught then raise exception 'R1 permitió terminar con un resumen de 3 letras'; end if;
  caught := false;
  begin perform terminar(null); exception when others then caught := sqlerrm = 'resumen_requerido'; end;
  if not caught then raise exception 'R1 permitió terminar con resumen nulo'; end if;
  if (select count(*) from jornadas where user_id = e1 and estado <> 'finalizada') <> 1 then
    raise exception 'R1 un intento sin resumen cerró la jornada';
  end if;
  perform terminar('  Hice la integración de pagos  ');
  select resumen into s from jornadas where user_id = e1 and fecha = '2026-10-29';
  if s is distinct from 'Hice la integración de pagos' then raise exception 'R1 resumen guardado mal: %', s; end if;
  select resumen into s from time_jornadas('2026-10-29', '2026-10-29') limit 1;
  if s is distinct from 'Hice la integración de pagos' then raise exception 'R1 time_jornadas no devuelve el resumen'; end if;

  ------------------------------------------------------------------------
  -- R2 jornada auto-cerrada (sin resumen): la propia persona lo agrega una sola vez
  perform set_config('app.time_now', '2026-10-16T12:00:00Z', true);
  perform iniciar_jornada('A');
  perform set_config('app.time_now', '2026-10-16T12:10:00Z', true); perform pausar('A');
  perform set_config('app.time_now', '2026-10-17T00:30:00Z', true);
  perform time_barrido(null);
  select id into jid from jornadas where user_id = e1 and fecha = '2026-10-16';
  if not (select auto_cerrada from jornadas where id = jid) or (select resumen from jornadas where id = jid) is not null then
    raise exception 'R2 la jornada auto-cerrada debía quedar sin resumen';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', e2, 'role', 'authenticated')::text, true);
  caught := false;
  begin perform agregar_resumen(jid, 'Intento de otra persona'); exception when others then caught := sqlerrm = 'no_autorizado'; end;
  if not caught then raise exception 'R2 otra persona pudo cargar el resumen'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', e1, 'role', 'authenticated')::text, true);
  caught := false;
  begin perform agregar_resumen(jid, 'abc'); exception when others then caught := sqlerrm = 'resumen_requerido'; end;
  if not caught then raise exception 'R2 aceptó un resumen demasiado corto'; end if;
  perform agregar_resumen(jid, 'Trabajé en el reporte semanal');
  if (select resumen from jornadas where id = jid) is distinct from 'Trabajé en el reporte semanal' then
    raise exception 'R2 no se guardó el resumen agregado';
  end if;
  caught := false;
  begin perform agregar_resumen(jid, 'Quiero pisarlo'); exception when others then caught := sqlerrm = 'resumen_ya_cargado'; end;
  if not caught then raise exception 'R2 permitió pisar un resumen ya cargado'; end if;

  ------------------------------------------------------------------------
  -- R3 si el barrido ya cerró la jornada, el resumen que escribió la persona no se pierde
  perform set_config('app.time_now', '2026-10-30T12:00:00Z', true);
  perform iniciar_jornada('A');
  perform set_config('app.time_now', '2026-10-31T15:00:00Z', true);
  perform terminar('Resumen escrito tarde');
  select resumen, auto_cerrada into rec from jornadas where user_id = e1 and fecha = '2026-10-30';
  if rec.resumen is distinct from 'Resumen escrito tarde' or not rec.auto_cerrada then
    raise exception 'R3 el resumen no quedó en la jornada auto-cerrada (%, %)', rec.resumen, rec.auto_cerrada;
  end if;

  ------------------------------------------------------------------------
  -- S1 subtareas: cualquier empleado crea, tilda y borra (RLS abierta); valida tipo y título
  perform set_config('request.jwt.claims', json_build_object('sub', e1, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select id into s from tickets limit 1;
  insert into subtasks (id, entity_type, entity_id, title, created_by) values ('st_test_1', 'ticket', s, 'Revisar logs', e1);
  update subtasks set done = true, done_at = now(), done_by = e1 where id = 'st_test_1';
  select count(*) into n from subtasks where id = 'st_test_1' and done and created_by = e1;
  if n <> 1 then raise exception 'S1 no se pudo crear/tildar una subtarea como empleado'; end if;
  caught := false;
  begin insert into subtasks (id, entity_type, entity_id, title) values ('st_test_2', 'otro', s, 'x'); exception when check_violation then caught := true; end;
  if not caught then raise exception 'S1 aceptó un tipo de entidad inválido'; end if;
  caught := false;
  begin insert into subtasks (id, entity_type, entity_id, title) values ('st_test_3', 'ticket', s, '   '); exception when check_violation then caught := true; end;
  if not caught then raise exception 'S1 aceptó un título vacío'; end if;
  delete from subtasks where id = 'st_test_1';
  select count(*) into n from subtasks where id = 'st_test_1';
  if n <> 0 then raise exception 'S1 no se pudo borrar la subtarea'; end if;
  execute 'reset role';

  ------------------------------------------------------------------------
  -- W: seguimiento por tarea ("trabajar en esto")
  select id, title into tk, tk_title from tickets order by created_at limit 1;
  select id into dt from dev_tasks limit 1;
  insert into tasks (id, title, start_date, end_date) values ('task_w_1', 'Tarea de prueba', '2026-11-02', '2026-11-02');
  insert into subtasks (id, entity_type, entity_id, title) values ('st_w_1', 'ticket', tk, 'Revisar logs');
  delete from jornadas where user_id in (e1, e2);

  perform set_config('request.jwt.claims', json_build_object('sub', e1, 'role', 'authenticated')::text, true);
  -- entidad inexistente / tipo inválido
  perform set_config('app.time_now', '2026-11-02T11:59:00Z', true);
  caught := false;
  begin perform trabajar_en('A', 'ticket', 'no_existe'); exception when others then caught := sqlerrm = 'entidad_inexistente'; end;
  if not caught then raise exception 'W1 aceptó un ticket inexistente'; end if;
  caught := false;
  begin perform trabajar_en('A', 'cualquiera', tk); exception when others then caught := sqlerrm = 'datos_invalidos'; end;
  if not caught then raise exception 'W1 aceptó un tipo inválido'; end if;
  if exists (select 1 from jornadas where user_id = e1) then raise exception 'W1 un intento inválido creó una jornada'; end if;

  -- sin jornada: "trabajar en esto" la inicia y etiqueta el tramo
  perform set_config('app.time_now', '2026-11-02T12:00:00Z', true);
  r := trabajar_en('A', 'ticket', tk);
  if r #>> '{jornada,estado}' <> 'trabajando' or r #>> '{tarea,id}' <> tk or r #>> '{tarea,label}' <> left(tk_title, 200) then
    raise exception 'W2 no inició la jornada con la tarea: %', r;
  end if;
  perform set_config('app.time_now', '2026-11-02T12:15:00Z', true); perform heartbeat('A', 0);
  -- elegir la misma tarea otra vez no parte el tramo
  perform trabajar_en('A', 'ticket', tk);
  select count(*) into n from tramos t join jornadas j on j.id = t.jornada_id where j.user_id = e1 and t.entity_id = tk;
  if n <> 1 then raise exception 'W3 repetir la misma tarea creó otro tramo (%)', n; end if;
  -- cambiar de tarea: cierra el tramo anterior (cambio_tarea) y abre otro
  perform set_config('app.time_now', '2026-11-02T12:30:00Z', true);
  r := trabajar_en('A', 'dev_task', dt);
  if r #>> '{tarea,tipo}' <> 'dev_task' then raise exception 'W4 no cambió de tarea'; end if;
  perform set_config('app.time_now', '2026-11-02T12:45:00Z', true); perform heartbeat('A', 0);
  -- pausar: la tarea queda adjunta; al reanudar el tramo vuelve a la misma tarea
  perform set_config('app.time_now', '2026-11-02T13:00:00Z', true);
  r := pausar('A');
  if r #>> '{jornada,estado}' <> 'pausa' or r #>> '{tarea,id}' <> dt then raise exception 'W5 la tarea debía seguir adjunta en pausa: %', r; end if;
  perform set_config('app.time_now', '2026-11-02T13:30:00Z', true);
  r := reanudar('A');
  if r #>> '{tarea,id}' <> dt then raise exception 'W5 al reanudar se perdió la tarea'; end if;
  if (select count(*) from tramos t join jornadas j on j.id = t.jornada_id
      where j.user_id = e1 and t.tipo = 'trabajo' and t.entity_id = dt and t.fin is null) <> 1 then
    raise exception 'W5 el tramo reanudado no quedó etiquetado con la tarea';
  end if;
  perform set_config('app.time_now', '2026-11-02T13:45:00Z', true); perform heartbeat('A', 0);
  -- soltar: la jornada sigue, sin tarea
  perform set_config('app.time_now', '2026-11-02T14:00:00Z', true);
  r := soltar_tarea('A');
  if r #> '{tarea}' is distinct from 'null'::jsonb or r #>> '{jornada,estado}' <> 'trabajando' then raise exception 'W6 soltar debía dejar la jornada sin tarea: %', r; end if;
  perform set_config('app.time_now', '2026-11-02T14:15:00Z', true); perform heartbeat('A', 0);
  -- subtarea: el rótulo incluye al padre
  perform set_config('app.time_now', '2026-11-02T14:30:00Z', true);
  perform trabajar_en('A', 'subtask', 'st_w_1');
  perform set_config('app.time_now', '2026-11-02T14:45:00Z', true); perform heartbeat('A', 0);
  r := time_estado();
  if jsonb_array_length(r -> 'tareas_hoy') <> 3 then raise exception 'W7 tareas_hoy debía tener 3 entradas: %', r -> 'tareas_hoy'; end if;
  perform set_config('app.time_now', '2026-11-02T15:00:00Z', true);
  perform terminar('Resumen de prueba');
  select id, total_segundos into jid, n from jornadas where user_id = e1 and fecha = '2026-11-02';
  if n <> 9000 then raise exception 'W8 el total de la jornada debía ser 9000 s (el etiquetado no cambia el total), fue %', n; end if;
  if (select tarea_tipo from jornadas where id = jid) is not null then raise exception 'W8 al terminar se debía soltar la tarea'; end if;
  if (select count(*) from tramos where jornada_id = jid and origen_cierre = 'cambio_tarea') <> 3 then raise exception 'W8 se esperaban 3 cierres por cambio de tarea'; end if;
  -- tiempo por tarea
  select segundos into n from time_por_tarea('2026-11-02', '2026-11-02') where tipo = 'ticket' and entidad_id = tk;
  if n <> 1800 then raise exception 'W9 el ticket debía sumar 1800 s, fue %', n; end if;
  select segundos into n from time_por_tarea('2026-11-02', '2026-11-02') where tipo = 'dev_task' and entidad_id = dt;
  if n <> 3600 then raise exception 'W9 la tarea de dev debía sumar 3600 s (dos tramos), fue %', n; end if;
  select label into s from time_por_tarea('2026-11-02', '2026-11-02') where tipo = 'subtask';
  if s <> left('Revisar logs · ' || tk_title, 200) then raise exception 'W9 rótulo de subtarea inesperado: %', s; end if;
  r := time_entidad('dev_task', dt);
  if (r ->> 'total_segundos')::integer <> 3600 or (r ->> 'mi_segundos')::integer <> 3600 or jsonb_array_length(r -> 'por_persona') <> 0 then
    raise exception 'W10 time_entidad para el propio empleado: %', r;
  end if;

  -- otra persona: arranca en pausa, "trabajar en esto" reanuda; la pausa por inactividad mantiene la tarea
  perform set_config('request.jwt.claims', json_build_object('sub', e2, 'role', 'authenticated')::text, true);
  perform set_config('app.time_now', '2026-11-02T12:00:00Z', true);
  perform iniciar_jornada('A');
  perform set_config('app.time_now', '2026-11-02T12:10:00Z', true); perform heartbeat('A', 0);
  perform set_config('app.time_now', '2026-11-02T12:20:00Z', true); perform pausar('A');
  perform set_config('app.time_now', '2026-11-02T12:40:00Z', true);
  r := trabajar_en('A', 'task', 'task_w_1');
  if r #>> '{jornada,estado}' <> 'trabajando' or r #>> '{tarea,id}' <> 'task_w_1' then raise exception 'W11 trabajar en una tarea no reanudó la jornada: %', r; end if;
  if (select origen_cierre from tramos t join jornadas j on j.id = t.jornada_id where j.user_id = e2 and t.tipo = 'pausa') <> 'manual' then
    raise exception 'W11 la pausa debía cerrarse como manual';
  end if;
  perform set_config('app.time_now', '2026-11-02T12:50:00Z', true); perform heartbeat('A', 0);
  perform set_config('app.time_now', '2026-11-02T13:12:00Z', true);
  r := pausar_por_inactividad('A');
  if r #>> '{jornada,estado}' <> 'pausa' or r #>> '{tarea,id}' <> 'task_w_1' then raise exception 'W12 la pausa por inactividad debía mantener la tarea: %', r; end if;
  perform set_config('app.time_now', '2026-11-02T13:20:00Z', true);
  perform terminar('Resumen de prueba');

  -- permisos del tiempo por tarea
  select count(*) into n from time_por_tarea('2026-11-02', '2026-11-02', e1);
  if n <> 1 then raise exception 'W13 un empleado vio % tareas de otra persona', n; end if;
  r := time_entidad('dev_task', dt);
  if (r ->> 'total_segundos')::integer <> 3600 or (r ->> 'mi_segundos')::integer <> 0 or jsonb_array_length(r -> 'por_persona') <> 0 then
    raise exception 'W13 time_entidad como otra persona: %', r;
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  select count(*) into n from time_por_tarea('2026-11-02', '2026-11-02', null);
  if n <> 4 then raise exception 'W13 el admin debía ver 4 tareas, vio %', n; end if;
  r := time_entidad('dev_task', dt);
  if jsonb_array_length(r -> 'por_persona') <> 1 or (r #>> '{por_persona,0,usuario_id}')::uuid <> e1 then
    raise exception 'W13 el admin debía ver el desglose por persona: %', r;
  end if;
end $$;

select 'ALL EXTRAS TESTS PASSED' as result;

rollback;
