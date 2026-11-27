# Google Calendar en el backoffice

Las **tareas de Operaciones** y los **próximos pasos de Onboarding** se agregan solos al Google Calendar de cada persona (eventos de día completo, con link para volver al backoffice). Cada persona toca una vez "Calendar → Conectar mi Google Calendar" en la barra de arriba.

## Cómo funciona (resumen)
- El servidor (`backoffice-api`) **concilia**: mira qué hay con fecha, decide qué evento le toca a cada persona conectada y deja el calendario igual a eso (crea, actualiza solo lo que cambió, borra lo que ya no corresponde). Corre cuando se guarda algo en Tareas/Onboarding y cada 10 minutos.
- Solo toca los eventos que él mismo creó (los tiene vinculados en `calendar_links`). Nunca lee ni modifica el resto de tu calendario: el permiso es solo "crear y editar eventos".
- El permiso de Google de cada persona se guarda **cifrado** en `calendar_connections` (clave `GOOGLE_TOKEN_KEY`). Las dos tablas no tienen acceso desde el navegador (RLS sin políticas): solo el servidor, con la clave de servicio.
- Quién recibe qué: una tarea va al calendario de cada **asignado**; un paso de Onboarding, a quien figura como responsable del paso (el nombre se busca entre las personas del backoffice: "Nico" → Nicolás). Si el nombre coincide con más de una persona, no se agenda a nadie (se avisa en el log).
- **CRM comercial** (desde el 27/11/2026): las tareas del CRM (`crm_tasks`) y la próxima acción de cada deal van al calendario del **vendedor** (Hernán, Alejo…, se busca por nombre como en Onboarding), con su **hora** (hora de Argentina). Las reuniones duran 60 min y **bloquean** el horario; seguimientos y tareas duran 15 min y no bloquean. Sin arrastre de vencidas. Respeta la casilla `calOn` de cada tarea (apagada = no se agenda), no incluye deals perdidos, y las vencidas hace más de 14 días que nunca se agendaron no se crean al conectar. El link del evento abre el deal (`?crm=<id>`).
- Para sumar otra sección con fecha (CRM, etc.) alcanza con agregar un armador en `server/calendarEvents.js` y cargarla en `server/calendarSync.js`: la conexión de Google es la misma.

## Puesta en marcha (una sola vez)

### 1) En Google Cloud (con una cuenta administradora de Workspace)
1. Entrar a https://console.cloud.google.com con la cuenta @spicytool.net y **crear un proyecto** ("Backoffice Spicytool").
2. **APIs y servicios → Biblioteca →** buscar **Google Calendar API → Habilitar** (gratis).
3. **APIs y servicios → Pantalla de consentimiento de OAuth →** tipo de usuario **Interno** (solo cuentas @spicytool.net, no requiere revisión de Google). Nombre: "Backoffice Spicytool". En permisos (scopes) agregar `.../auth/calendar.events`.
4. **Credenciales → Crear credenciales → ID de cliente de OAuth →** tipo **Aplicación web**. En **URIs de redireccionamiento autorizados** poner exactamente:
   `https://backoffice.wearespicy.net/api/admin/calendar/callback`
5. Copiar el **ID de cliente** y el **Secreto de cliente**.

### 2) En el servidor (droplet)
Agregar estas líneas a `/etc/spicytool-backoffice.env` (el mismo archivo donde están las otras claves):

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_TOKEN_KEY=una-frase-larga-inventada   # p. ej. el resultado de: openssl rand -base64 32
SUPABASE_SERVICE_ROLE_KEY=...                # Supabase → Project Settings → API → "service_role" (secreta)
```

Opcionales: `APP_URL` (por defecto `https://backoffice.wearespicy.net`) y `GOOGLE_REDIRECT_URI` (por defecto `APP_URL` + `/api/admin/calendar/callback`).

Después: `pm2 restart backoffice-api` y mirar el log: tiene que decir `Google Calendar: activo`.

### 3) Cada persona
Barra de arriba → **Calendar → Conectar mi Google Calendar** → elegir la cuenta @spicytool.net → aceptar. En unos segundos aparecen sus eventos.

## Cosas a saber
- **No cambiar `GOOGLE_TOKEN_KEY`** una vez en uso: con otra clave los permisos guardados no se pueden leer y cada persona tiene que volver a conectar (la pantalla lo avisa).
- Si alguien saca el acceso desde su cuenta de Google, el botón pasa a "Calendar: reconectar".
- **Desconectar** borra de Google los eventos que creó el backoffice y limpia lo guardado.
- **Lo vencido se arrastra:** si pasó la fecha y sigue pendiente, el evento se estira hasta hoy y lleva "Vencido/a" en el título (en rojo). Vale para los pasos de Onboarding y para las tareas de prioridad **Alta**; las demás quedan en su fecha. Al hacerlo/finalizarlo deja de arrastrarse. "Hoy" se calcula con la fecha de Argentina.
- Una tarea finalizada que ya estaba en el calendario queda con ✓; si se archiva, el evento se borra. Las tareas ya finalizadas antes de conectar no se agendan.
- Si Google falla, la tarea o el paso se guardan igual; el motivo del último error se ve en la ventana de Calendar y el servidor reintenta en la próxima corrida.
- Tabla `supabase_calendar.sql` (ya aplicada el 2026-11-27).
