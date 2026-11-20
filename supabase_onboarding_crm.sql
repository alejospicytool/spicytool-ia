-- CRM → Onboarding automático: cuando un deal del CRM pasa a una etapa "Ganado" se crea solo su fila de Onboarding.
-- ESTADO: PENDIENTE DE APLICAR (probado en una transacción que se deshace el 2026-11-20).
--
-- Cómo se unen: el onboarding guarda el id del deal (deal_id), NO el email (el email del CRM suele ser distinto al de la cuenta
-- de Spicytool). Un índice único evita duplicados: un deal tiene como mucho un onboarding.
-- El vínculo con la cuenta de Spicytool (spicy_company_id) es aparte: lo elige una persona desde la pantalla de Onboarding.
--
-- Qué hace el disparador (crm_deals, al guardar un deal):
--   1) Si el deal ENTRA a una etapa de tipo "won" (la lista de etapas sale de crm_config) → crea el onboarding en 'Crear cuenta'
--      con la empresa, la fecha de cierre y el estado de pago, más su primer registro de historial. Si ya había uno, no hace nada.
--   2) Si el deal ya tiene onboarding y cambia su estado de cobro en el CRM, actualiza el 'Estado de pago' del onboarding.
-- Mover un deal fuera de Ganado NO borra el onboarding. Borrar un onboarding a mano tampoco se vuelve a crear solo
-- hasta que el deal vuelva a entrar a Ganado.
-- El responsable queda vacío a propósito: el vendedor del deal no es necesariamente quien hace el onboarding.

begin;

alter table public.onboarding add column if not exists deal_id text;
alter table public.onboarding add column if not exists spicy_company_id text;
alter table public.onboarding add column if not exists spicy_company_name text;
create unique index if not exists onboarding_deal_id_uniq on public.onboarding (deal_id) where deal_id is not null;

-- ¿La etapa (id) es de tipo 'won' según la configuración del CRM?
create or replace function public.crm_stage_is_won(stage_id text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(bool_or(s->>'kind' = 'won'), false)
  from public.crm_config c, jsonb_array_elements(coalesce(c.data->'stages', '[]'::jsonb)) s
  where c.id = 1 and s->>'id' = stage_id
$$;

-- Estado de pago que corresponde según el CRM (misma regla que isUnpaid en src/crm/crmLogic.js)
create or replace function public.crm_deal_pago(d jsonb) returns text
language sql immutable as $$
  select case when coalesce(d->>'estado', '') in ('pago', 'agendado', 'nopago') then 'No Cobrado' else 'Cobrado' end
$$;

create or replace function public.crm_deal_to_onboarding() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  was_won boolean := false;
  is_won boolean;
  ob_id text;
  fecha date;
begin
  is_won := public.crm_stage_is_won(new.data->>'stage');
  if tg_op = 'UPDATE' then was_won := public.crm_stage_is_won(old.data->>'stage'); end if;

  if is_won and not was_won then
    fecha := case when coalesce(new.data->>'cerradoEn', '') ~ '^\d{4}-\d{2}-\d{2}$' then (new.data->>'cerradoEn')::date else current_date end;
    ob_id := 'ob_' || replace(gen_random_uuid()::text, '-', '');
    insert into public.onboarding (id, client_name, etapa_actual, fecha_registro, fecha_entrada_etapa_actual, estado_de_pago, deal_id)
    values (ob_id, coalesce(nullif(trim(new.data->>'empresa'), ''), 'Sin nombre'), 'Crear cuenta', fecha, fecha, public.crm_deal_pago(new.data), new.id)
    on conflict (deal_id) where deal_id is not null do nothing;
    if found then
      insert into public.onboarding_stage_history (id, onboarding_id, etapa, fecha_entrada)
      values ('oh_' || replace(gen_random_uuid()::text, '-', ''), ob_id, 'Crear cuenta', fecha);
    end if;
  elsif tg_op = 'UPDATE' and public.crm_deal_pago(new.data) is distinct from public.crm_deal_pago(old.data) then
    update public.onboarding set estado_de_pago = public.crm_deal_pago(new.data) where deal_id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists crm_deal_to_onboarding on public.crm_deals;
create trigger crm_deal_to_onboarding after insert or update of data on public.crm_deals
  for each row execute function public.crm_deal_to_onboarding();

revoke all on function public.crm_stage_is_won(text), public.crm_deal_pago(jsonb), public.crm_deal_to_onboarding() from public, anon;

commit;
