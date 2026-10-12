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
  r jsonb; n integer; s text; jid uuid; caught boolean; rec record;
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
end $$;

select 'ALL EXTRAS TESTS PASSED' as result;

rollback;
