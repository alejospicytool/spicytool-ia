-- Auditoría de Admin Spicy: quién hizo qué desde el backoffice (cambios de plan, links de tarjeta, etc.).
-- Es un registro INMUTABLE: los admins pueden leer e insertar (solo a su propio nombre); nadie puede editar ni borrar filas.
-- El backend (server/audit.js) escribe con el propio token del admin, así que no hace falta ninguna clave secreta.
-- ESTADO: YA APLICADO en el proyecto real (khuavhbraikzreyhptog) vía Supabase MCP el 2026-11-11. Este archivo queda como referencia.

create table if not exists public.admin_audit (
  id           bigint generated always as identity primary key,
  at           timestamptz not null default now(),
  actor        text        not null,
  action       text        not null,
  target_type  text,
  target_id    text,
  target_label text,
  company_id   text,
  detail       jsonb       not null default '{}'::jsonb
);

create index if not exists admin_audit_at_idx      on public.admin_audit (at desc);
create index if not exists admin_audit_company_idx on public.admin_audit (company_id, at desc);

alter table public.admin_audit enable row level security;

drop policy if exists "Admins leen la auditoria" on public.admin_audit;
create policy "Admins leen la auditoria" on public.admin_audit
  for select to authenticated using (get_my_role() = 'admin');

drop policy if exists "Admins registran sus acciones" on public.admin_audit;
create policy "Admins registran sus acciones" on public.admin_audit
  for insert to authenticated
  with check (get_my_role() = 'admin' and lower(actor) = lower(auth.jwt() ->> 'email'));

-- Sin políticas de update/delete, RLS ya los bloquea; además se quitan los permisos de raíz.
revoke update, delete, truncate, references, trigger on public.admin_audit from anon, authenticated;
revoke all on public.admin_audit from anon;
