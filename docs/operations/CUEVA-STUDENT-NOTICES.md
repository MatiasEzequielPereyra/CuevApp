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

## Operación alojada — 26/11/2026

La migración del PR #97 está aplicada. El servicio está configurado en Production
y Vault con un secreto dedicado. El job `cueva-student-notices-worker` tiene ID
`1`, rol `postgres`, frecuencia `* * * * *` y llama exclusivamente a
`cueva_private.run_student_notice_worker()`.

La receta anterior con `pg_net` queda reemplazada. El preflight alojado detectó
grants de PUBLIC sobre su cola, propiedad de `supabase_admin`, que el rol
operador no puede revocar. No se cargaron secretos ni solicitudes en esa cola.
Se retiró la extensión recién habilitada después de verificar cero solicitudes,
respuestas, jobs y dependencias. Se utiliza `pg_cron` con la extensión `http`
para llamar al endpoint fijo por HTTPS sin almacenar headers en una cola común.

El worker conserva la cola privada de avisos y sus leases. El cambio afecta solo
al transporte del programador hacia el worker, no al envío Web Push a teléfonos.
El secreto no figura en el comando de cron, definiciones SQL ni documentación.
Las cuentas de API no pueden leer Vault ni ejecutar el programador privado.

Código publicado al activar: `3b9d989bab81d0c417dad39117d025fc03afade8`.
Deployment de activación: `dpl_DhhFxgK5A3AeuNcWpQw9SxsmHUu7`, READY.
El smoke alojado de la llamada autenticada obtuvo HTTP 200, `ok=true` y
cero trabajos procesados. La recepción en un celular sigue siendo una
comprobación separada; no se generó un comunicado masivo de prueba.

## Configuración y recuperación

1. Conservar las tres variables VAPID de Production y el secreto sensible
   `CUEVA_STUDENT_NOTICES_SECRET`. Debe coincidir con
   `cueva_student_notices_worker_secret` en Vault y ser distinto del de cuotas.
   Provisionarlo por canal privado, nunca imprimir ni descargar variables.
   Un cambio en la variable de Vercel requiere un nuevo deployment.
2. Mantener `pg_cron` y `http` habilitados. La función privada siguiente tiene
   permisos de ejecución únicamente para el operador `postgres`.
3. No duplicar el job. Antes de reactivarlo, verificar ID, comando, frecuencia,
   privilegios de Vault y la audiencia de los trabajos pendientes.
4. Para probar, no emitir un comunicado a todos. Con la cola vacía puede llamarse
   al programador sin generar notificaciones. Una prueba con recepción real
   requiere un alumno y una publicación autorizados.
5. Para detener el envío, pausar el job por su ID verificado. Conservar el esquema
   aditivo, la bandeja y la cola privada. Un POST ya iniciado puede terminar.

```sql
-- Inspección sin secretos.
select jobid,jobname,schedule,username,active,command
from cron.job where jobname='cueva-student-notices-worker';

select status,count(*) from cueva_private.student_notice_push group by status;

select status,return_message,start_time,end_time
from cron.job_run_details
where jobid=1 order by runid desc limit 5;

-- Pausa operativa del job propio.
select cron.alter_job(1,active:=false);
```

## Definición operativa del programador

Esta definición se aplicó como migración operativa
`cueva_student_notices_private_scheduler`. Usa un lock para evitar ejecuciones
simultáneas, conexión de hasta 10 segundos y llamada de hasta 65 segundos.
Un HTTP distinto de 200 o una respuesta inválida hace fallar el job para que
quede visible en su historial. No se reintenta un resultado externo incierto
dentro del programador.

```sql
begin;
create function cueva_private.run_student_notice_worker()
returns jsonb language plpgsql security invoker
set search_path = ''
as $worker$
declare
  response extensions.http_response;
  summary jsonb;
begin
  if not pg_try_advisory_xact_lock(hashtextextended('cueva-student-notices-scheduler',0)) then
    return jsonb_build_object('skipped',true);
  end if;
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS','65000');
  perform extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT_MS','10000');
  select reply.* into strict response
  from vault.decrypted_secrets secret
  cross join lateral extensions.http((
    'POST',
    'https://cueva-gym.vercel.app/api/notifications/student-notices/worker',
    array[row('Authorization','Bearer ' || secret.decrypted_secret)::extensions.http_header],
    'application/json',
    '{}'
  )::extensions.http_request) reply
  where secret.name='cueva_student_notices_worker_secret';
  perform extensions.http_reset_curlopt();
  if response.status <> 200 then
    raise exception 'CUEVA student notice worker HTTP %',response.status;
  end if;
  summary := response.content::jsonb;
  if (summary->>'ok')::boolean is distinct from true then
    raise exception 'CUEVA student notice worker response invalid';
  end if;
  return summary;
exception when others then
  perform extensions.http_reset_curlopt();
  raise;
end;
$worker$;
revoke all on function cueva_private.run_student_notice_worker() from public,anon,authenticated,service_role;
grant execute on function cueva_private.run_student_notice_worker() to postgres;
commit;
```

El único comando programado es:

```sql
-- Crear solamente si no existe ya un job con ese nombre.
select cron.schedule(
  'cueva-student-notices-worker','* * * * *',
  'select cueva_private.run_student_notice_worker();'
);
```

[Supabase Cron](https://supabase.com/docs/guides/cron) ·
[HTTP](https://supabase.com/docs/guides/database/extensions/http) ·
[Restricciones de pg_net](https://supabase.com/kb/troubleshooting/revoking-access-to-pg_net-objects-has-no-effect-0bbc16)
