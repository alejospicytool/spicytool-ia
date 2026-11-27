-- Google Calendar: conexión por persona + vínculo entre cada tarea/paso y su evento.
-- Lo usa SOLO el servidor del backoffice (server/calendar*.js) con la clave de servicio: las dos tablas tienen RLS activado
-- y ninguna política, así que el navegador (ni siquiera con sesión) no puede leerlas ni escribirlas.
-- El refresh token de Google se guarda CIFRADO (AES-256-GCM, clave GOOGLE_TOKEN_KEY del servidor): en la base nunca está en claro.

create table if not exists public.calendar_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,                         -- mail del backoffice de esa persona
  google_email text,                  -- cuenta de Google conectada
  refresh_token_enc text not null,    -- cifrado
  status text not null default 'active' check (status in ('active', 'revoked')),
  connected_at timestamptz not null default now(),
  last_sync_at timestamptz,
  last_error text
);

create table if not exists public.calendar_links (
  entity_type text not null check (entity_type in ('task', 'onboarding')),
  entity_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  google_event_id text not null,
  payload_hash text,
  updated_at timestamptz not null default now(),
  primary key (entity_type, entity_id, user_id)
);

alter table public.calendar_connections enable row level security;
alter table public.calendar_links enable row level security;
revoke all on public.calendar_connections from anon, authenticated;
revoke all on public.calendar_links from anon, authenticated;
