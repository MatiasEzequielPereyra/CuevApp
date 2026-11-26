# Avisos de rutinas y comunicados

Una nueva publicación de rutina genera un aviso para el alumno de esa ficha. El
disparador ejecuta el alta de bandeja y Push en la transacción de publicación.
La misma revisión guardada como borrador no dispara avisos. El comunicado de
Alertas congela título, mensaje y audiencia al confirmar. Su UUID permite repetir
una petición cuyo resultado se perdió sin crear otro comunicado.

La audiencia de un comunicado incluye las fichas con una cuenta de alumno
habilitada, tanto invitadas como de registro personal. La bandeja es permanente.
Push usa las suscripciones existentes con permiso dado y preferencia activa. La
cola vuelve a comprobar vínculo, acceso, preferencia y vigencia antes de reservar.
Separa `accepted` por el proveedor del resultado `unknown`. Una reserva abandonada
queda incierta y no se reenvía. Solo HTTP 429 admite reintento automático, hasta
tres intentos. El texto viaja como texto plano, sin URLs de destino editables.

## Activación acordada por separado

1. Validar el PR y cotejar la única migración nueva
   `20261126190000_cueva_student_notices.sql` con el esquema alojado. Aplicarla
   antes de publicar el código para que las nuevas funciones estén disponibles.
   Desde ese momento las publicaciones nuevas pueden encolar Push. No hay
   recuperación retroactiva de publicaciones ni cambios al historial de cuotas.
2. Confirmar el deployment exacto y las tres variables VAPID ya existentes.
   Generar un secreto nuevo y aleatorio de al menos 32 caracteres y cargarlo en
   Production como `CUEVA_STUDENT_NOTICES_SECRET` por un canal privado. Conservar
   el secreto disponible para la carga privada posterior en Vault. Configurar
   la variable antes del despliegue que deba leerla. Usar un secreto distinto
   al de cuotas, sin imprimirlo ni descargar variables de producción.
3. En un Supabase aislado con fixture consentida, probar una publicación y un
   comunicado. Verificar que se leen desde Avisos, que el otro alumno no puede
   leer la actualización de rutina y que tocar cada Push abre su pantalla. La
   prueba individual alojada debe usar una rutina del alumno autorizado. El
   worker procesa la cola del proyecto, por lo que es requisito verificar que
   no existan otros trabajos pendientes antes de esa prueba. No publicar un
   comunicado a todos para hacer una prueba.
4. Habilitar `pg_cron` y `pg_net` si corresponde y verificar el rol programador.
   Ejecutar el [preflight de la cola](CUEVA-005-queue-preflight.sql) antes de
   cargar `cueva_student_notices_worker_secret` en Vault con el mismo valor del
   paso 2. `anon` y `authenticated` deben quedar sin acceso a headers
   de la cola ni a `vault.decrypted_secrets`. Revisar que no haya un job existente
   para esa ruta y que la cola solo contenga avisos que deban salir. Agendar un
   único job independiente con el SQL siguiente como el rol aprobado.

```sql
select cron.schedule(
  'cueva-student-notices-worker', '* * * * *',
  $job$
  select net.http_post(
    url := 'https://cueva-gym.vercel.app/api/notifications/student-notices/worker',
    headers := jsonb_build_object('Authorization', 'Bearer ' || decrypted_secret,
                                  'Content-Type', 'application/json'),
    body := '{}'::jsonb, timeout_milliseconds := 65000
  ) from vault.decrypted_secrets where name='cueva_student_notices_worker_secret';
  $job$
);
```

Verificar el ID del job, periodicidad, rol y estado. Correlacionar el HTTP 200 de
la solicitud encolada y los resultados por estado. No exponer headers, endpoints
ni claves. Un `accepted` solo acredita la aceptación del proveedor. Registrar la
recepción en el celular como evidencia separada.

```sql
select status, count(*) from cueva_private.student_notice_push group by status;
```

Para detener, ejecutar `cron.alter_job` con el ID comprobado del job propio y
`active := false`. Si había un POST en vuelo, esperar que termine antes de juzgar
el estado. Conservar la cola y las copias leídas. Para reanudar, comprobar el mismo
ID, destino, frecuencia, acceso a Vault y trabajos pendientes antes de activarlo.
El rollback de aplicación conserva el esquema aditivo y la bandeja existente. Con
el job detenido los avisos en cola no saldrán hasta que se decida reanudar.

[Supabase Cron](https://supabase.com/docs/guides/cron) ·
[pg_net](https://supabase.com/docs/guides/database/extensions/pg_net)
