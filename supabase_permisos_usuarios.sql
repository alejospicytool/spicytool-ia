-- Permisos de visibilidad por sección + alta de usuarios desde la app.
-- YA APLICADO en el proyecto real (khuavhbraikzreyhptog) vía Supabase MCP el 2026-09-18.
-- Este archivo queda solo como referencia/documentación del esquema.
--
-- Modelo: por usuario individual, a nivel de sección del menú (Finanzas,
-- Referidos, Operaciones, Dashboard Producto, Configuración). Los admins
-- siempre ven todo — este mecanismo solo restringe a los reader.
-- Ausencia de fila en hidden_sections = sección visible (default: todo
-- visible, igual que el comportamiento previo a esta feature).

create table if not exists public.hidden_sections (
  user_id uuid not null references auth.users(id) on delete cascade,
  section text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, section)
);

alter table public.hidden_sections enable row level security;

create policy "Los usuarios leen sus propias restricciones" on public.hidden_sections
  for select to authenticated using (user_id = auth.uid());

create policy "Los admins gestionan todas las restricciones" on public.hidden_sections
  for all to authenticated using (get_my_role() = 'admin') with check (get_my_role() = 'admin');

-- Datos de perfil sumados a user_roles (nombre/apellido, para mostrar en
-- la pantalla de Usuarios en vez de solo el email).
alter table public.user_roles add column if not exists first_name text;
alter table public.user_roles add column if not exists last_name text;

-- El alta de usuario sigue siendo manual (Authentication → Users → Add
-- user, con contraseña que se comunica por fuera de la app — Claude no
-- puede crear cuentas ni definir contraseñas). Esta función resuelve el
-- email al user_id de auth.users para que el admin pueda cargar
-- nombre/apellido/rol en user_roles sin tener que copiar el UUID a mano.
-- SECURITY DEFINER porque auth.users no es visible desde el cliente,
-- pero valida adentro que quien llama sea admin antes de devolver nada.
create or replace function public.get_user_id_by_email(lookup_email text)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  caller_role text;
  result uuid;
begin
  select role into caller_role from public.user_roles where user_id = auth.uid();
  if caller_role is distinct from 'admin' then
    raise exception 'not authorized';
  end if;
  select id into result from auth.users where email = lookup_email limit 1;
  return result;
end;
$$;

revoke all on function public.get_user_id_by_email(text) from public;
revoke execute on function public.get_user_id_by_email(text) from anon;
grant execute on function public.get_user_id_by_email(text) to authenticated;
