-- Módulo de Onboarding (sección Operaciones).
-- YA APLICADO en el proyecto real (khuavhbraikzreyhptog) vía Supabase MCP el 2026-09-23.
-- Este archivo queda solo como referencia/documentación del esquema.
--
-- Migra el TRACKING que hoy vive en una base de Notion (migración de datos
-- históricos fuera de alcance por ahora, se carga vacío).
--
-- Mismo criterio de RLS que tickets/tasks: cualquier usuario autenticado
-- (admin o reader) puede leer/escribir, sin gate de admin.
--
-- `fecha_entrada_etapa_actual` nunca se edita a mano: se pisa automáticamente
-- (junto con un insert en onboarding_stage_history) cada vez que cambia
-- `etapa_actual`, desde el frontend (ver moveEtapa() en OnboardingView).
--
-- La lista de 8 etapas, el orden, el mapeo "quién ejecuta" (Cliente/Equipo)
-- y la lógica de `estado` viven en src/onboardingLogic.js (con tests en
-- src/onboardingLogic.test.js) — no están hardcodeados acá ni en ningún
-- otro lado del frontend.

create table if not exists public.onboarding (
  id text primary key,
  client_name text not null,
  etapa_actual text not null default 'Crear cuenta',
  fecha_registro date not null default current_date,
  fecha_entrada_etapa_actual date not null default current_date,
  responsable text,
  bloqueado boolean not null default false,
  fuente_de_leads text[] not null default '{}',           -- subset de: Meta Ads, Tokko, EasyBroker, WhatsApp, Tera
  integraciones_pendientes text[] not null default '{}',  -- mismas opciones
  estado_de_pago text not null default 'No Cobrado',      -- 'Cobrado' | 'No Cobrado'
  created_at timestamptz not null default now()
);

-- Historial de cambios de etapa — para poder medir cuánto tardó cada una.
create table if not exists public.onboarding_stage_history (
  id text primary key,
  onboarding_id text not null references public.onboarding(id) on delete cascade,
  etapa text not null,
  fecha_entrada date not null,
  created_at timestamptz not null default now()
);

alter table public.onboarding enable row level security;
alter table public.onboarding_stage_history enable row level security;

create policy "Todos los auth pueden gestionar onboarding" on public.onboarding
  for all to authenticated using (true) with check (true);

create policy "Todos los auth pueden gestionar historial de onboarding" on public.onboarding_stage_history
  for all to authenticated using (true) with check (true);

-- ─────────────────────────────────────────────────────────────────────────
-- Webhooks (agregado 2026-09-23)
-- ─────────────────────────────────────────────────────────────────────────
--
-- ENTRANTE: supabase/functions/create-onboarding/index.ts — crea un cliente
-- nuevo desde afuera (n8n, chatbot, formulario). Mismo patrón que
-- create-ticket/create-task: secret compartido en header x-webhook-secret,
-- usa el service role key que Supabase inyecta automático en la función.
--
-- SALIENTE: a diferencia de los webhooks entrantes, este NO es una Edge
-- Function — es un trigger de Postgres (con pg_net) que dispara un POST
-- cada vez que se inserta una fila en onboarding_stage_history, EXCEPTO la
-- primera (la de creación del registro — esa no cuenta como "cambio de
-- etapa"). Así funciona sin importar si el cambio vino del Kanban, del
-- detalle, o del webhook de creación, sin depender del frontend ni exponer
-- ninguna URL/secret al navegador.
--
-- La URL de n8n vive en integration_config (no en el código, no en git) —
-- para cargarla/cambiarla:
--   update public.integration_config set value = 'https://...' where key = 'onboarding_webhook_url';
-- Mientras esté en null, el trigger no dispara nada (no falla, solo no hace nada).

create extension if not exists pg_net;

create table if not exists public.integration_config (
  key text primary key,
  value text
);
alter table public.integration_config enable row level security;
-- Sin policies a propósito: ni anon ni authenticated pueden leer/escribir esta
-- tabla desde el cliente. Solo accesible vía funciones SECURITY DEFINER o SQL directo.

insert into public.integration_config (key, value)
values ('onboarding_webhook_url', null)
on conflict (key) do nothing;

create or replace function public.notify_onboarding_stage_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  es_primera boolean;
  reg record;
  webhook_url text;
begin
  select count(*) = 1 into es_primera
  from public.onboarding_stage_history
  where onboarding_id = new.onboarding_id;

  if es_primera then
    return new;
  end if;

  select value into webhook_url from public.integration_config where key = 'onboarding_webhook_url';
  if webhook_url is null or webhook_url = '' then
    return new;
  end if;

  select * into reg from public.onboarding where id = new.onboarding_id;

  perform net.http_post(
    url := webhook_url,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'onboarding_id', new.onboarding_id,
      'client_name', reg.client_name,
      'etapa_nueva', new.etapa,
      'fecha_entrada', new.fecha_entrada,
      'responsable', reg.responsable,
      'bloqueado', reg.bloqueado,
      'estado_de_pago', reg.estado_de_pago,
      'fuente_de_leads', reg.fuente_de_leads,
      'integraciones_pendientes', reg.integraciones_pendientes
    )
  );

  return new;
end;
$$;

revoke execute on function public.notify_onboarding_stage_change() from public, anon, authenticated;

drop trigger if exists onboarding_stage_change_webhook on public.onboarding_stage_history;
create trigger onboarding_stage_change_webhook
after insert on public.onboarding_stage_history
for each row execute function public.notify_onboarding_stage_change();
