-- Onboarding: "En pausa (esperando al cliente)". Saca al cliente de "Atrasado" mientras la demora no es nuestra, con el motivo a la vista.
-- ESTADO: YA APLICADO en el proyecto real (khuavhbraikzreyhptog) el 2026-11-27 (probado antes en una transacción que se deshizo; la prueba detectó
-- que la regla dejaba una pausa sin motivo y se corrigió antes de aplicar).
--
-- pausa_desde: día en que se puso en pausa (null = no está en pausa) · pausa_motivo: por qué (3 a 200 letras) ·
-- pausa_dias_acum: días que ya estuvo en pausa en pausas anteriores (no cuentan para el atraso general de 20 días).
-- Los días en pausa dentro de la etapa actual se descuentan corriendo fecha_entrada_etapa_actual al retomar (lo hace el frontend, ver armarRetomar en onboardingLogic.js).
-- No cambia permisos: la tabla onboarding ya permite leer y escribir a cualquier usuario con sesión.

alter table public.onboarding
  add column if not exists pausa_desde date,
  add column if not exists pausa_motivo text,
  add column if not exists pausa_dias_acum integer not null default 0;

alter table public.onboarding drop constraint if exists onboarding_pausa_check;
alter table public.onboarding add constraint onboarding_pausa_check check (
  pausa_dias_acum >= 0 and (
    (pausa_desde is null and pausa_motivo is null)
    or (pausa_desde is not null and pausa_motivo is not null and char_length(btrim(pausa_motivo)) between 3 and 200)
  )
);
