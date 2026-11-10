-- Tests de la base de métricas de revenue (supabase_revenue.sql). Igual que los otros tests:
-- corre TODO dentro de una transacción que termina en ROLLBACK (no persiste nada) y se ejecuta
-- completo de una vez. Usuarios de prueba: Nico = admin, Lucas = empleado.

begin;

do $$
declare
  admin_id constant uuid := 'efb96fac-a64b-4318-9001-a3d96c2d460e';
  emp_id   constant uuid := '2c021c70-fdcd-4253-912f-eda35d0be711';
  t0 constant timestamptz := '2026-11-10T12:00:00Z';
  r jsonb; ev record; n int; caught boolean; c record;
begin
  insert into rev_customers (key, source) values ('t:a','stripe'),('t:b','stripe'),('t:c','stripe'),('t:d','stripe'),('t:e','stripe');

  -- C1 clasificación
  if rev_classify(0,100,false) <> 'new' or rev_classify(0,100,true) <> 'reactivation'
     or rev_classify(100,0,true) <> 'churn' or rev_classify(100,150,true) <> 'expansion'
     or rev_classify(150,100,true) <> 'contraction' or rev_classify(100,100,true) is not null then
    raise exception 'C1 rev_classify devuelve cualquier cosa';
  end if;

  -- M1 alta, expansión, churn y reactivación (cada uno fuera de la ventana de 1 hora)
  perform rev_apply_mrr('t:a', 100, 's', false, t0);
  perform rev_apply_mrr('t:a', 150, 's', false, t0 + interval '2 hours');
  perform rev_apply_mrr('t:a', 0,   's', false, t0 + interval '4 hours');
  perform rev_apply_mrr('t:a', 80,  's', false, t0 + interval '6 hours');
  if (select string_agg(type, ',' order by date) from rev_mrr_events where customer_key = 't:a')
     <> 'new,expansion,churn,reactivation' then
    raise exception 'M1 secuencia de movimientos mal: %', (select string_agg(type, ',' order by date) from rev_mrr_events where customer_key = 't:a');
  end if;
  select * into c from rev_customers where key = 't:a';
  if c.mrr <> 80 or not c.ever_paid or c.first_paid_at <> t0 then raise exception 'M1 cliente mal: %', c; end if;

  -- M2 mismo MRR: no hace nada
  if rev_apply_mrr('t:a', 80, 's', false, t0 + interval '7 hours') is not null then raise exception 'M2 devolvió algo sin cambios'; end if;

  -- M3 consolidación: alta y cambio dentro de 1 hora = un solo movimiento "new" con el MRR final
  perform rev_apply_mrr('t:b', 100, 's', false, t0);
  perform rev_apply_mrr('t:b', 150, 's', false, t0 + interval '30 minutes');
  select count(*) into n from rev_mrr_events where customer_key = 't:b';
  select * into ev from rev_mrr_events where customer_key = 't:b';
  if n <> 1 or ev.type <> 'new' or ev.mrr_after <> 150 or ev.delta <> 150 then raise exception 'M3 no consolidó: % filas, %', n, ev; end if;

  -- M4 se anula: alta y baja dentro de 1 hora → no queda movimiento y no cuenta como que pagó
  perform rev_apply_mrr('t:c', 100, 's', false, t0);
  perform rev_apply_mrr('t:c', 0,   's', false, t0 + interval '20 minutes');
  select count(*) into n from rev_mrr_events where customer_key = 't:c';
  select * into c from rev_customers where key = 't:c';
  if n <> 0 or c.ever_paid or c.first_paid_at is not null or c.mrr <> 0 then raise exception 'M4 no se anuló: % eventos, %', n, c; end if;

  -- M5 baja y vuelta dentro de 1 hora (cliente que ya había pagado): se anula, no queda churn
  perform rev_apply_mrr('t:d', 100, 's', false, t0);
  perform rev_apply_mrr('t:d', 0,   's', false, t0 + interval '2 hours');   -- churn
  perform rev_apply_mrr('t:d', 100, 's', false, t0 + interval '2 hours 30 minutes');
  if (select string_agg(type, ',' order by date) from rev_mrr_events where customer_key = 't:d') <> 'new' then
    raise exception 'M5 quedó un churn fantasma: %', (select string_agg(type, ',' order by date) from rev_mrr_events where customer_key = 't:d');
  end if;
  if not (select ever_paid from rev_customers where key = 't:d') then raise exception 'M5 perdió ever_paid'; end if;

  -- M6 carga inicial: tipo baseline (no cuenta como new) y un cambio real posterior NO se funde con ella
  r := rev_apply_mrr('t:e', 200, 'carga_inicial', true, t0);
  select * into ev from rev_mrr_events where customer_key = 't:e';
  if ev.type <> 'baseline' or not ev.baseline or r is null then raise exception 'M6 baseline mal: %', ev; end if;
  perform rev_apply_mrr('t:e', 250, 's', false, t0 + interval '10 minutes');
  if (select string_agg(type, ',' order by date) from rev_mrr_events where customer_key = 't:e') <> 'baseline,expansion' then
    raise exception 'M6 el cambio se fundió con el baseline';
  end if;

  -- M7 cliente inexistente
  caught := false;
  begin perform rev_apply_mrr('t:no-existe', 10, 's', false, t0); exception when others then caught := sqlerrm like 'cliente_inexistente%'; end;
  if not caught then raise exception 'M7 aceptó un cliente inexistente'; end if;

  -- P1 permisos: admin lee; empleado no ve nada; nadie desde el front puede ejecutar rev_apply_mrr
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from rev_customers;
  if n <> 5 then raise exception 'P1 el admin no ve los clientes (%)', n; end if;
  update rev_plans set category = category;   -- el admin puede clasificar planes (no falla)
  caught := false;
  begin perform rev_apply_mrr('t:a', 1, 'x', false, t0); exception when insufficient_privilege then caught := true; end;
  if not caught then raise exception 'P1 el admin pudo ejecutar rev_apply_mrr desde el front'; end if;
  caught := false;
  begin insert into rev_customers (key, source) values ('t:hack','manual'); exception when others then caught := true; end;
  if not caught then raise exception 'P1 el admin pudo escribir clientes desde el front'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', emp_id, 'role', 'authenticated')::text, true);
  select count(*) into n from rev_customers;
  if n <> 0 then raise exception 'P2 un empleado ve clientes (%)', n; end if;
  select count(*) into n from rev_mrr_events;
  if n <> 0 then raise exception 'P2 un empleado ve movimientos (%)', n; end if;
  select count(*) into n from rev_history_monthly;
  if n <> 0 then raise exception 'P2 un empleado ve el histórico (%)', n; end if;
  execute 'reset role';

  raise notice 'revenue_test: OK';
end $$;

rollback;
