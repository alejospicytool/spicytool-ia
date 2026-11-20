-- Seguimiento de clientes (sección Operaciones): cartera de clientes activos + registro de "toques" (contactos).
-- ESTADO: YA APLICADO en el proyecto real (khuavhbraikzreyhptog) el 2026-11-20 (probado antes en una transacción que se deshizo, incluido el comportamiento por rol).
--
-- client_followup: una fila por cliente de la cartera. La clave es el id de la company de Spicytool (no el email).
--   El contacto (nombre/email/teléfono) y el plan son una copia al momento de sumar al cliente; se pueden editar a mano.
--   Un cliente NUNCA se borra: se da de baja (baja_en / baja_motivo), para conservar su historial de contactos.
--   El próximo toque no se guarda: se calcula en la app (último toque + frecuencia_dias), salvo que alguien fije una fecha (proximo_toque).
-- client_touches: cada intento de contacto (canal, resultado: respondió / queja / no respondió, nota, quién y cuándo).
--   Es la constancia ante una baja: solo su autor puede corregirla o borrarla (o un admin borrarla).
-- Los campos ultimo_toque / ultima_respuesta / sin_respuesta de client_followup los mantiene un disparador a partir de client_touches.
--
-- Permisos (mismo criterio que el resto de Operaciones): leer = cualquier usuario con sesión; crear/editar = admin, dev y editor
-- (can_write_ops). No hay política de borrado en client_followup.

begin;

create table if not exists public.client_followup (
  company_id text primary key,
  company_name text not null,
  contact_name text,
  contact_email text,
  contact_phone text,
  plan text,
  responsable_id uuid references auth.users(id) on delete set null,
  frecuencia_dias int default 7 check (frecuencia_dias is null or frecuencia_dias between 1 and 365),
  semaforo text not null default 'verde' check (semaforo in ('verde', 'amarillo', 'rojo')),
  semaforo_motivo text,
  proximo_toque date,
  ultimo_toque date,
  ultima_respuesta date,
  sin_respuesta int not null default 0,
  baja_en date,
  baja_motivo text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.client_touches (
  id text primary key,
  company_id text not null references public.client_followup(company_id),
  fecha date not null default current_date,
  canal text not null check (canal in ('whatsapp', 'llamada', 'reunion', 'email', 'otro')),
  resultado text not null check (resultado in ('respondio', 'queja', 'no_respondio')),
  nota text,
  author_id uuid not null references auth.users(id),
  author_email text not null,
  created_at timestamptz not null default now()
);
create index if not exists client_touches_company_fecha on public.client_touches (company_id, fecha desc);

alter table public.client_followup enable row level security;
alter table public.client_touches enable row level security;

drop policy if exists "Seguimiento: leer" on public.client_followup;
drop policy if exists "Seguimiento: crear (admin, dev, editor)" on public.client_followup;
drop policy if exists "Seguimiento: editar (admin, dev, editor)" on public.client_followup;
create policy "Seguimiento: leer" on public.client_followup for select to authenticated using (true);
create policy "Seguimiento: crear (admin, dev, editor)" on public.client_followup for insert to authenticated with check (public.can_write_ops());
create policy "Seguimiento: editar (admin, dev, editor)" on public.client_followup for update to authenticated using (public.can_write_ops()) with check (public.can_write_ops());

drop policy if exists "Toques: leer" on public.client_touches;
drop policy if exists "Toques: crear propios (admin, dev, editor)" on public.client_touches;
drop policy if exists "Toques: editar solo los propios" on public.client_touches;
drop policy if exists "Toques: borrar los propios o admin" on public.client_touches;
create policy "Toques: leer" on public.client_touches for select to authenticated using (true);
create policy "Toques: crear propios (admin, dev, editor)" on public.client_touches for insert to authenticated with check (public.can_write_ops() and author_id = auth.uid());
create policy "Toques: editar solo los propios" on public.client_touches for update to authenticated using (public.can_write_ops() and author_id = auth.uid()) with check (public.can_write_ops() and author_id = auth.uid());
create policy "Toques: borrar los propios o admin" on public.client_touches for delete to authenticated using ((public.can_write_ops() and author_id = auth.uid()) or public.is_admin());

-- Recalcula los datos resumidos de un cliente a partir de sus toques.
-- sin_respuesta = cuántos toques SEGUIDOS (los más recientes) fueron "no respondió".
create or replace function public.client_followup_recalc(cid text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.client_followup f set
    ultimo_toque = (select max(t.fecha) from public.client_touches t where t.company_id = cid),
    ultima_respuesta = (select max(t.fecha) from public.client_touches t where t.company_id = cid and t.resultado <> 'no_respondio'),
    sin_respuesta = (
      with r as (select t.resultado, row_number() over (order by t.fecha desc, t.created_at desc) as rn from public.client_touches t where t.company_id = cid),
           cut as (select coalesce(min(rn), 1000000) as m from r where resultado <> 'no_respondio')
      select count(*) from r, cut where r.rn < cut.m
    ),
    updated_at = now()
  where f.company_id = cid;
end $$;

create or replace function public.client_touches_after() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then perform public.client_followup_recalc(new.company_id); end if;
  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and old.company_id <> new.company_id) then perform public.client_followup_recalc(old.company_id); end if;
  return null;
end $$;

drop trigger if exists client_touches_after on public.client_touches;
create trigger client_touches_after after insert or update or delete on public.client_touches
  for each row execute function public.client_touches_after();

revoke all on function public.client_followup_recalc(text), public.client_touches_after() from public, anon, authenticated;

commit;
