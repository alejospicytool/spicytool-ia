-- Seguimiento de clientes: registrar que el cliente respondió DESPUÉS del contacto. PENDIENTE DE APLICAR (se aplica con el MCP de Supabase; esto es la referencia).
--
-- Cuando alguien le escribe a un cliente casi nunca responde en el momento, así que el contacto se carga como "sin respuesta por ahora". Si más tarde contesta,
-- el contacto se ACTUALIZA (resultado "respondió" o "queja") y queda anotado CUÁNDO respondió (respondio_en), sin perder cuándo se le escribió (fecha).
--  · client_touches.respondio_en: fecha en que respondió. Solo puede tener valor si el resultado no es "no respondió" y no puede ser anterior al contacto.
--  · Editar un contacto: su autor o un admin (antes solo el autor). Borrar sigue igual (autor o admin).
--  · ultima_respuesta de client_followup pasa a ser la fecha en que respondió (si se sabe) y no la del contacto.
-- Los contactos que ya existen quedan igual (respondio_en vacío).

begin;

alter table public.client_touches add column if not exists respondio_en date;
alter table public.client_touches drop constraint if exists client_touches_respondio_en_check;
alter table public.client_touches add constraint client_touches_respondio_en_check
  check (respondio_en is null or (resultado <> 'no_respondio' and respondio_en >= fecha));

drop policy if exists "Toques: editar solo los propios" on public.client_touches;
drop policy if exists "Toques: editar los propios o admin" on public.client_touches;
create policy "Toques: editar los propios o admin" on public.client_touches for update to authenticated
  using ((public.can_write_ops() and author_id = auth.uid()) or public.is_admin())
  with check ((public.can_write_ops() and author_id = auth.uid()) or public.is_admin());

create or replace function public.client_followup_recalc(cid text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.client_followup f set
    ultimo_toque = (select max(t.fecha) from public.client_touches t where t.company_id = cid),
    ultima_respuesta = (select max(coalesce(t.respondio_en, t.fecha)) from public.client_touches t where t.company_id = cid and t.resultado <> 'no_respondio'),
    sin_respuesta = (
      with r as (select t.resultado, row_number() over (order by t.fecha desc, t.created_at desc) as rn from public.client_touches t where t.company_id = cid),
           cut as (select coalesce(min(rn), 1000000) as m from r where resultado <> 'no_respondio')
      select count(*) from r, cut where r.rn < cut.m
    ),
    updated_at = now()
  where f.company_id = cid;
end $$;

revoke all on function public.client_followup_recalc(text) from public, anon, authenticated;

commit;
