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
