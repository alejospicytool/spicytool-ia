-- Onboarding: "próximo paso" por cliente (qué hay que hacer y para cuándo), para que aparezca como recordatorio en Inicio y en el Kanban.
-- ESTADO: YA APLICADO en el proyecto real (khuavhbraikzreyhptog) el 2026-11-26 (probado antes en una transacción que se deshizo).
--
-- Un solo paso por cliente: texto corto + fecha + quién lo hace. Los tres van juntos o no va ninguno (así nunca hay un recordatorio sin fecha).
-- Cuando se marca como hecho, el frontend lo deja anotado en las notas del cliente (tabla comments) y vacía estas tres columnas.
-- No cambia permisos: la tabla onboarding ya permite leer y escribir a cualquier usuario con sesión.

begin;

alter table public.onboarding
  add column if not exists proximo_paso text,
  add column if not exists proximo_paso_fecha date,
  add column if not exists proximo_paso_quien text;

alter table public.onboarding drop constraint if exists onboarding_proximo_paso_check;
alter table public.onboarding add constraint onboarding_proximo_paso_check check (
  (proximo_paso is null and proximo_paso_fecha is null and proximo_paso_quien is null)
  or (proximo_paso is not null and proximo_paso_fecha is not null and char_length(btrim(proximo_paso)) between 3 and 200)
);

commit;
