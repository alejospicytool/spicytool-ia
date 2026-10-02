-- Reemplaza el disparador viejo (Notion → webhook → Make → Discord): ahora
-- Postgres le pega directo a Make (vía pg_net, ya habilitado en el proyecto)
-- cuando un ticket entra a la etapa "Inicio". OJO: "Inicio" es distinto de
-- "Inicio por OPS" (donde nace todo ticket nuevo) — el aviso a Discord se
-- dispara recién cuando pasa a "Inicio", no antes. YA APLICADO en el
-- proyecto real (khuavhbraikzreyhptog) vía Supabase MCP el 2026-10-02
-- (primera versión del 2026-10-01 apuntaba por error a "Inicio por OPS").
-- Este archivo queda solo como referencia — reemplazar MAKE_WEBHOOK_URL por
-- el valor real antes de reaplicar (no se deja el valor real en git).
--
-- El body que recibe Make es el ticket completo (to_jsonb(new)): id,
-- client_id, client_name, category, priority, status, channel, message,
-- assigned_to, resolution_note, fibonacci_score, created_at,
-- first_response_at, resolved_at. Hay que actualizar el mapeo de campos en
-- el escenario de Make, que antes venía con las propiedades de Notion.

create or replace function public.notify_ticket_inicio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'Inicio' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    perform net.http_post(
      url := 'MAKE_WEBHOOK_URL',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := to_jsonb(new)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_ticket_inicio on public.tickets;
create trigger trg_notify_ticket_inicio
  after insert or update on public.tickets
  for each row
  execute function public.notify_ticket_inicio();
