-- Tests de supabase_revenue_v2.sql (segmento y pagos fallidos). Corre TODO dentro de una transacción que termina
-- en ROLLBACK (no persiste nada) y se ejecuta completo de una vez. Nico = admin, Lucas = empleado.

begin;

do $$
declare
  admin_id constant uuid := 'efb96fac-a64b-4318-9001-a3d96c2d460e';
  emp_id   constant uuid := '2c021c70-fdcd-4253-912f-eda35d0be711';
  n int; caught boolean; s text; m numeric;
begin
  insert into rev_customers (key, source, mrr) values ('t:a','stripe', 100), ('t:b','stripe', 0);
  insert into rev_payment_failures (invoice_id, customer_key, amount_due, attempt_count, status)
    values ('in_1', 't:a', 100, 2, 'open'), ('in_2', 't:b', 50, 1, 'recovered');

  -- admin: ve los pagos fallidos y puede asignar segmento
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from rev_payment_failures;
  if n <> 2 then raise exception 'V1 el admin no ve los pagos fallidos (%)', n; end if;
  update rev_customers set segment = 'inmobiliaria' where key = 't:a';
  select segment into s from rev_customers where key = 't:a';
  if s is distinct from 'inmobiliaria' then raise exception 'V2 el admin no pudo asignar segmento (%)', s; end if;
  update rev_customers set segment = null where key = 't:a';  -- y volver a "sin segmento"

  -- pero NO puede tocar el MRR ni otras columnas desde el front
  caught := false;
  begin update rev_customers set mrr = 999999 where key = 't:a'; exception when insufficient_privilege then caught := true; end;
  if not caught then raise exception 'V3 el admin pudo cambiar el MRR de un cliente'; end if;
  caught := false;
  begin update rev_customers set name = 'x' where key = 't:a'; exception when insufficient_privilege then caught := true; end;
  if not caught then raise exception 'V3 el admin pudo cambiar el nombre de un cliente'; end if;

  -- segmento inválido
  caught := false;
  begin update rev_customers set segment = 'otra-cosa' where key = 't:a'; exception when check_violation then caught := true; end;
  if not caught then raise exception 'V4 aceptó un segmento inválido'; end if;

  -- no puede escribir pagos fallidos desde el front
  caught := false;
  begin insert into rev_payment_failures (invoice_id, customer_key, amount_due) values ('in_x','t:a',1); exception when others then caught := true; end;
  if not caught then raise exception 'V5 el admin pudo escribir pagos fallidos'; end if;
  -- sin política de UPDATE, Postgres no da error: simplemente no toca ninguna fila
  update rev_payment_failures set status = 'recovered' where invoice_id = 'in_1';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'V5 el admin pudo modificar pagos fallidos (% filas)', n; end if;

  -- empleado: no ve nada ni puede asignar segmento
  perform set_config('request.jwt.claims', json_build_object('sub', emp_id, 'role', 'authenticated')::text, true);
  select count(*) into n from rev_payment_failures;
  if n <> 0 then raise exception 'V6 un empleado ve pagos fallidos (%)', n; end if;
  update rev_customers set segment = 'otro' where key = 't:b';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'V6 un empleado pudo actualizar clientes (% filas)', n; end if;
  execute 'reset role';
  select segment into s from rev_customers where key = 't:b';
  if s is not null then raise exception 'V6 un empleado pudo asignar segmento (%)', s; end if;

  raise notice 'revenue_v2_test: OK';
end $$;

rollback;
