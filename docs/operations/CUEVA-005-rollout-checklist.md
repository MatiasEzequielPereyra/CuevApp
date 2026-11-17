# CUEVA-005 — Checklist de preflight y puesta en marcha

**Estado:** preflight auditado, 2026-11-16. La activación alojada sigue pendiente.
**Rama:** `codex/cueva-005-rollout-preflight`, base `b1521454854564ac7c64bc47c62a703605ff1e92`.
**Restricción:** no aplicar migraciones, crear secretos, activar extensiones/jobs, cambiar variables, enviar mensajes reales ni desplegar sin autorización operativa explícita.

## 1. Selección y aplicación de migraciones

Implementación integrada por [PR #45](https://github.com/MatiasEzequielPereyra/CuevApp/pull/45)
y [PR #47](https://github.com/MatiasEzequielPereyra/CuevApp/pull/47).
El [manifiesto](CUEVA-005-migration-manifest.json) fija en orden las **doce**
migraciones, sus versiones Git, hashes SHA-256 de los archivos, dependencias y efecto.
La [foto de solo lectura](CUEVA-005-hosted-baseline.json) registra 18 versiones
alojadas, PostgreSQL 17.11, extensiones, contrato y huella financiera. Los doce
nombres del manifiesto están ausentes y el catálogo aloja cero tablas y funciones
de Notificaciones. Ninguna versión alojada futura se asigna por anticipado.

La comparación es por nombre **y** por objetos. Por ejemplo, `cueva_product_access`
es `20261102151526` en Git y `20261103133258` alojada. Vencimientos figura alojado
como `20261111190623 cueva_003b_due_dates`, mientras que la baseline local lo
reproduce mediante los archivos Git `20261107101000` a `20261108100000`.
El contrato comprueba el resultado de esquema, sin afirmar identidad byte a byte
del SQL histórico. `cueva_my_routine_video_ids` ya figura como `20261115154313`
en Hosted y `20261115160000` en Git. Está fuera del manifiesto aunque el job de
CI `hosted-compatible` también lo aplique después del lote.

Antes de aplicar, el Orchestrator debe confirmar proyecto y autorización,
backup/PITR disponible y recuperación revisada. Registrar el historial por
`version,name`, ejecutar [el contrato hosted-compatible](../../supabase/standalone-tests/hosted-schema-compatibility.sql)
con `BEGIN READ ONLY` y `SET LOCAL plpgsql.check_asserts = on`, y volver a tomar
la [huella financiera](CUEVA-005-finance-fingerprint.sql) en la misma transacción.
Comparar con la foto guardada, confirmar el lock compartido, ausencia de todo
objeto parcial de Notificaciones, y que el worker permanezca sin invocaciones.
Un cambio de baseline, nombre ambiguo o estado parcial requiere reconciliación
antes de continuar.

Con autorización, usar `apply_migration` de Supabase MCP o un mecanismo de
aplicación equivalente que registre el historial en el proyecto confirmado.
Procesar una entrada por vez, en el orden del manifiesto, usando el nombre sin
prefijo y los bytes verificados. Antes de cada
aplicación volver a comprobar el SHA-256 con `Get-FileHash -Algorithm SHA256` o
`sha256sum` y confirmar que el nombre siguiente aún falte. Al terminar cada una,
registrar versión alojada real, nombre, hash Git, orden y resultado antes de
continuar. Ante respuesta ambigua o error, detener y consultar si quedaron tanto
el registro como los objetos. Evitar `db push --include-all`, reset, repair,
replay de Vencimientos, scripts Cron y cualquier SQL fuera del manifiesto.

Después, confirmar exactamente doce entradas nuevas por nombre y precedencia,
con las entradas históricas intactas. Ejecutar el
[postflight de esquema](CUEVA-005-schema-postflight.sql) y la huella financiera
en `BEGIN READ ONLY` / `ROLLBACK`. La huella de escritor, wrapper y políticas
debe coincidir con la captura anterior. Verificar por lectura configuración
inicial 12:00 de Buenos Aires, RLS, RPC de worker y permisos de bandeja. El
postflight confirma metadatos; la prueba de usuario confirma comportamiento.

## 2. Criterios de entrada

- [ ] PR revisado y aprobado; CI verde para el SHA exacto que se desplegará.
- [ ] Confirmar alcance del manifiesto y conservar CUEVA-003B Vencimientos como baseline.
- [ ] Reconciliar el historial de migraciones alojado con el repositorio antes de cualquier migración remota. No resolver divergencias con `db reset`, `migration repair` ni SQL manual sin plan aprobado.
- [ ] Confirmar backup/PITR y ventana de mantenimiento/rollback del proyecto Supabase.
- [ ] Confirmar que el dominio remitente de Brevo está autenticado y habilitado para transactional email.
- [ ] Confirmar que el dominio Vercel sirve HTTPS y que la PWA/manifest permite instalarse en los dispositivos objetivo.

## 3. Variables de entorno Vercel

Configurar en los entornos acordados (Production y, si corresponde, Preview) usando el panel seguro de Vercel. Nunca copiar valores secretos a GitHub, tickets, logs o esta guía.

### Acceso de producto / Supabase

- [ ] `CUEVA_PRODUCT_AUTH_ENABLED=1`
- [ ] `CUEVA_EMAIL_TEMPLATE_READY=1` cuando el flujo de invitación/correo de producto esté realmente configurado.
- [ ] `CUEVA_SUPABASE_URL`
- [ ] `CUEVA_PUBLISHABLE_KEY`
- [ ] `CUEVA_SERVICE_KEY` (solo server-side; nunca prefijo `NEXT_PUBLIC_`)
- [ ] `CUEVA_PRODUCT_ORIGIN` igual al origen HTTPS canónico de la aplicación.

No habilitar `CUEVA_PRODUCT_AUTH_LOCAL` en producción. No reutilizar secretos de limpieza de comprobantes.

### Correo Brevo

- [ ] `CUEVA_BREVO_API_KEY`
- [ ] `CUEVA_BREVO_SENDER_EMAIL`
- [ ] `CUEVA_BREVO_SENDER_NAME`
- [ ] Con la credencial API prevista, consultar `GET https://api.brevo.com/v3/senders`
  con el header `api-key` desde ejecución privada. Exigir HTTP 200 y coincidencia
  exacta del correo configurado con un remitente `active: true`; comprobar el
  dominio autenticado y habilitación transaccional en el panel Brevo. Registrar
  solo coincidencia/estado y fecha. Si la clave no puede leer senders, validarlo
  en el panel de la misma cuenta y confirmar el permiso API antes de enviar.
  El SMTP de invitaciones usa otra credencial y no acredita esta validación.
  El remitente real queda NOT_VERIFIED en este preflight.
  [Contrato Brevo](https://developers.brevo.com/reference/get-senders).

### Web Push

- [ ] `CUEVA_VAPID_PUBLIC_KEY`
- [ ] `CUEVA_VAPID_PRIVATE_KEY`
- [ ] `CUEVA_VAPID_SUBJECT` con formato `mailto:...`.
- [ ] Confirmar que la clave pública corresponde a la privada. El endpoint de preferencias solo debe informar Push disponible si el par completo es válido.

### Worker

- [ ] `CUEVA_NOTIFICATIONS_CRON_SECRET`: secreto aleatorio de alta entropía
  (mínimo 32 caracteres, sin espacios ni caracteres de control para este runbook).
- [ ] Cargar el mismo valor en Vault con nombre `cueva_notifications_worker_secret`.
  Completar primero el control de permisos de la sección 4 en ese entorno.
  Cargar la URL canónica exacta en `cueva_notifications_worker_url`.
  Usar panel seguro o proceso privado sin argumentos, historial, SQL literal,
  registros de request ni valores en el reporte. Verificar metadatos y realizar
  la comprobación de igualdad por un POST autorizado solo en el entorno aislado.
- [ ] Verificar que las variables estén disponibles en el deployment que se probará; cambios de variables requieren nuevo deployment.

## 4. Supabase: disparador y comprobación de infraestructura

- [ ] Confirmar proyecto, región, versión PostgreSQL y entorno exactos.
- [ ] Confirmar disponibilidad y estado de `pg_cron`, `pg_net` y `supabase_vault`.
- [ ] Revisar jobs existentes para evitar duplicar el dispatcher o interferir con limpieza de comprobantes.
- [ ] Revisar `cron.job_run_details` y errores previos antes de activar el nuevo job.
- [ ] Crear/validar en Vault el endpoint HTTPS del worker y el secreto dedicado, con acceso restringido.
- [ ] Revisar URL, headers, timeout y política de retención de respuestas de pg_net.
- [ ] Programar únicamente después de validar el endpoint manualmente y aprobar el cambio operativo: intervalo cada 5 minutos. Vercel Hobby no debe recibir una configuración Vercel Cron cada 5 minutos.
- [ ] Confirmar que el job solo dispara el endpoint; no debe transportar PII, importes ni lógica de negocio.

No asumir que las extensiones están instaladas ni que la historia remota de migraciones coincide con el repositorio.

Tras la prueba controlada y con autorización operativa, habilitar `pg_cron` y
`pg_net` mediante el panel de extensiones. Vault 0.3.1 ya estaba instalado al
consultar. Verificar las firmas reales de `cron.schedule`, `cron.alter_job` y
`net.http_post` y los permisos del rol programador. Usar `psql -X` desde la
raíz del repo con conexión TLS y credenciales privadas configuradas fuera de
los comandos del runbook.

### Cola de pg_net antes de Vault

1. Confirmar el rol real que programará el job. Inspeccionar los grants de
   tabla y columna con `\dp net.http_request_queue` en `psql` y revisar los
   consumidores existentes.
   El SQL de pg_net 0.20.4 concede acceso a las tablas de `net` a `PUBLIC` de
   origen. [SQL de pg_net 0.20.4](https://github.com/supabase/pg_net/blob/v0.20.4/sql/pg_net.sql#L1480-L1484).
2. Ejecutar [queue-preflight](CUEVA-005-queue-preflight.sql) con
   `cueva_queue_mode=check`. Si indica acceso de los roles API, y con el cambio
   de permisos autorizado tras revisar consumidores, ejecutar en modo
   `restrict` y repetir `check`. El ejemplo usa `postgres`; indicar el rol
   programador aprobado para el proyecto.

   ```powershell
   psql -X -v cueva_queue_mode=check -v cueva_cron_role=postgres -f docs/operations/CUEVA-005-queue-preflight.sql
   psql -X -v cueva_queue_mode=restrict -v cueva_cron_role=postgres -f docs/operations/CUEVA-005-queue-preflight.sql
   ```

3. Exigir `PASS`. El script verifica los permisos efectivos de `anon` y
   `authenticated`. El modo `restrict` revoca grants directos de tabla y
   columnas a `PUBLIC` y a esos dos roles, solo en la cola. Preserva el mínimo
   `INSERT` y el `SELECT(id)` que antes tenía el escritor efectivo de
   `net.http_post`. Si persiste acceso por membresía, hay grants dependientes o
   la prueba de encolado falla, aborta y revierte el cambio. No quita membresías
   ni cambia permisos de secuencias, funciones, esquemas o la tabla de respuestas.
   La prueba hace `SET LOCAL ROLE` al rol programador y revierte el encolado de
   un POST sintético a loopback antes del commit. Puede avanzar la secuencia de
   IDs de la cola y no deja una solicitud visible al worker.
4. Verificar que `anon` y `authenticated` carezcan de `SELECT` efectivo sobre
   `vault.decrypted_secrets`, por tabla y por columna. El rol programador debe
   poder leer los dos valores aprobados mediante Vault. Resolver cualquier
   diferencia antes de guardar el secreto. Revalidar grants tras una actualización
   de extensiones y antes de reanudar el job.

### Activación y observabilidad

Revisar todos los jobs, incluidos los inactivos y los de otros roles, con una
identidad autorizada que tenga visibilidad completa. `cron.job` aplica RLS por
propietario. Detectar consumo indirecto del endpoint. Ejecutar [cron-control](CUEVA-005-cron-control.sql)
como el rol que será dueño del job. Registrar el `jobid` devuelto, rol y base
para parada y reanudación. El script valida URL HTTPS, formato del secreto,
ausencia de duplicados visibles y permisos. Programa un único job
`cueva-notifications-worker` a `*/5 * * * *`.

```powershell
psql -X -v cueva_operation=activate -v cueva_job_id=0 -f docs/operations/CUEVA-005-cron-control.sql
```

En cada ejecución lee Vault y envía `POST`, `Authorization: Bearer …` y cuerpo
`{}` a `https://cueva-gym.vercel.app/api/notifications/worker`.
El timeout de pg_net es 65 s, por encima de los 60 s del handler.

La finalización del job representa el encolado asíncrono, no el HTTP ni una
entrega. Correlacionar job/horario con el `request_id` registrado por el comando
y consultar solo `id,status_code,timed_out,created` de `net._http_response`
para ese ID con acceso restringido, antes de que expire el registro pg_net.
HTTP 200 requiere revisar contadores y ledger; 403 exige comprobar afinidad de
deployment/secreto; 503, timeout, o respuesta ausente exigen verificar ejecución
y ledger antes de repetir. La cola de pg_net contiene el header mientras está
pendiente; nunca inspeccionar o exportar esa columna. Confirmar frecuencia,
rol y destino exacto sin volcar comandos ajenos o headers.
[Cron](https://supabase.com/docs/guides/cron/quickstart),
[pg_net](https://supabase.com/docs/guides/database/extensions/pg_net) y
[Vault](https://supabase.com/docs/guides/database/vault).

## 5. Prueba aislada por canal antes del cron

La autorización del worker habilita el snapshot de **todo** el proyecto y la
reserva de entregas elegibles. Un UUID en el POST no limita la ejecución.
Usar un Supabase aislado con datos sintéticos y un deployment de prueba
protegido vinculado a ese proyecto. Comprobar afinidad de URL, proyecto,
credencial servidor, origen, VAPID y secreto antes de cada invocación. Si no
existe ese entorno, dejar el ensayo NOT_RUN hasta disponer de él o auditar
un mecanismo de alcance que restrinja snapshot, claims y reintentos.

1. Preparar alumno A habilitado con buzón autorizado y una suscripción Push de
   prueba, más alumno B con sesión habilitada sin período ni suscripción. Usar
   un único período de A con saldo y `due_on` exactamente cinco días de
   calendario después de la fecha local de Buenos Aires. Invocar después de
   la hora efectiva de hoy: D−5 ya es elegible y D−1 sigue en el futuro.
   Con vencimiento mañana ambos recordatorios podrían enviarse, porque el
   worker recupera D−5 atrasado mientras el período sigue siendo elegible.
   Usar flujo de alta local y operaciones financieras normales. No copiar datos
   de producción ni ajustar filas de entregas para forzar el resultado.
2. Antes de invocar, en el aislado confirmar que solo hay ese período abierto,
   cero entregas o leases anteriores reclamables (incluido Push por dispositivo),
   un único destino por canal, cero jobs y ninguna ejecución concurrente.
   Usar al segundo alumno solo para probar aislamiento. Solicitar el POST sin
   secreto y con uno incorrecto, comprobar 403 y ausencia de efectos.
3. Hacer una invocación autenticada única y esperar su resultado. Una corrida
   puede crear también D−1 como pendiente futuro. Registrar UTC, fecha local,
   SHA/entorno, período de prueba y resumen agregado en evidencia privada.
   Verificar que D−1 siga sin intento y que D−5 cumpla:

   | Canal | Evidencia de éxito | Aislamiento |
   | --- | --- | --- |
   | Email | Un intento aceptado en ledger y, cuando exista, referencia Brevo. Registrar aparte evento de entrega/rebote en Brevo y observación del buzón. | Un solo destinatario autorizado. Sin correo para B. |
   | Interna | Un aviso persistido. A lo abre, marca leído mediante la UI/PATCH y conserva `read_at` tras recargar o iniciar otra sesión. | B no lista ni modifica el aviso de A por UI, API o PostgREST. |
   | Push | Un intento por el único dispositivo de A, entrega aceptada y aviso observado en la PWA. Registrar aceptación del servicio separada de la observación del dispositivo. | B sin suscripción no genera entrega de dispositivo. Revocar la suscripción de prueba cuando termine. |

4. Solo con la primera corrida concluida y sin resultados ambiguos, invocar
   una segunda vez para comprobar que no aumenta el conteo de aceptación ni se
   duplica el aviso. El backoff de fallos conocidos es 15/30/60/180 minutos con
   máximo cinco intentos. Los resultados externos inciertos son terminales para
   reintentos automáticos, también cuando se recupera un lease iniciado.
   Usar el [procedimiento de conciliación](../architecture/notifications-reconciliation.md)
   si falta confirmación. Probar simulado fallos, pagos concurrentes y recuperación.

- [ ] Endpoint worker sin Authorization: responde 403 y no inicia procesamiento.
- [ ] Authorization incorrecta, corta o con espacios: responde 403.
- [ ] Authorization válida: ejecuta una única corrida controlada y devuelve solo el resumen agregado.
- [ ] Sin configuración Brevo: el canal queda fallido de forma segura; no filtra secretos.
- [ ] Sin configuración VAPID válida: Push figura no disponible; email e inbox continúan independientes.
- [ ] Alumno sin permiso/suscripción Push: no se intenta envío Push; email e inbox siguen activos.
- [ ] Alumno con Push habilitado: registrar y retirar una suscripción de prueba; comprobar aislamiento por alumno y límite de dispositivos.
- [ ] Confirmar en un entorno de prueba que el correo de prueba se entrega una sola vez y que su referencia queda registrada.
- [ ] Confirmar que el worker no procesa períodos saldados, inactivos ni vencidos.
- [ ] Confirmar que el horario efectivo inicial es 12:00 `America/Argentina/Buenos_Aires`, aunque el worker se invoque cada 5 minutos.
- [ ] Confirmar que una corrida repetida no duplica eventos ni entregas.
- [ ] Confirmar reintentos y alertas con proveedores simulados; no provocar fallos artificiales en cuentas reales.
- [ ] Confirmar que /alertas solo expone el resumen administrativo y no datos técnicos, tokens, endpoints ni claves.

## 6. Activación gradual, portal y observabilidad

- [ ] Activar primero en un entorno de prueba con destinatarios internos autorizados.
- [ ] Revisar el resumen, ledger y alertas de la corrida aislada con acceso restringido.
- [ ] Antes del primer cron de producción, estimar en solo lectura el volumen
  agregado de períodos activos con saldo y vencimiento futuro en los próximos
  cinco días. Evaluar ambas fechas de recordatorio a la hora efectiva. Una
  primera corrida puede recuperar D−5 y D−1 elegibles de un mismo período.
  El Orchestrator aprueba el alcance de ese arranque conociendo ese volumen.
- [ ] Activar el job cada cinco minutos solo después de aprobar la prueba controlada.
- [ ] Supervisar ejecuciones de cron, respuestas HTTP, registros de worker, errores parciales y alertas.
- [ ] Verificar por separado email, inbox y Push; el éxito de un canal no demuestra el éxito de los otros.
- [ ] No registrar headers Authorization, claves, endpoints Push, payloads ni PII en logs.
- [ ] Revisar las primeras ejecuciones y confirmar que no haya duplicados ni entregas fuera de ventana.

El [PR #53](https://github.com/MatiasEzequielPereyra/CuevApp/pull/53) se integró
en `640324bc0fbf97b0777ddd7080c33ff13c378e45`, verificado en el alias de
producción el 2026-11-16. La pestaña de Notificaciones ya está publicada.
La lectura de Hosted confirmó que la tabla `cueva_notification_inbox` aún falta.
Tras aplicar el lote, verificar la bandeja con sesión de alumno y distinguir
esa disponibilidad de la activación de correo y Push. La función
`cueva_student_assigned_exercises()` también falta y tiene su propia migración
y prueba fuera de este lote.

## 7. Rollback seguro

1. Ejecutar `stop` con el ID registrado y el rol que programó el job.
   Comprobar que solo ese job queda inactivo. Una llamada ya encolada o
   en vuelo puede terminar. Revisar respuestas y leases sin repetir envíos.
2. Mantener tablas, ledger, alertas y evidencia; no borrar ni reiniciar estados.
3. Si el problema está en el deployment, volver al deployment Vercel previamente validado.
4. No reenviar entregas con resultado `unknown`; seguir el procedimiento de conciliación manual.
5. No revertir migraciones con pérdida de datos. Toda reversión de esquema requiere análisis específico y autorización.
6. Confirmar que la limpieza de comprobantes y otros cron existentes sigan intactos.

### Reanudación del mismo job

Con la causa del incidente resuelta, revisar leases y resultados inciertos y
repetir el control `check` de la cola. Reconfirmar alcance de la siguiente
corrida, la afinidad del deployment y el secreto por el canal privado, y la
ausencia de otros jobs que disparen el endpoint. Usar el ID registrado
(`$cuevaJobId` en el ejemplo) y el rol original.

```powershell
psql -X -v cueva_operation=stop -v "cueva_job_id=$cuevaJobId" -f docs/operations/CUEVA-005-cron-control.sql
psql -X -v cueva_operation=resume -v "cueva_job_id=$cuevaJobId" -f docs/operations/CUEVA-005-cron-control.sql
```

`resume` exige job inactivo, coincidencia de ID, nombre, propietario, base,
nodo, puerto, comando y frecuencia. Revalida destino, valores de Vault y
permisos y vuelve a comprobar el encolado con rollback. Si hay diferencias,
aborta sin reactivar. Conserva el `jobid` y `cron.job_run_details`. Revisar la
primera ejecución y sus entregas con el procedimiento de la sección 4.

## 8. Cierre de puesta en marcha

- [ ] SHA desplegado registrado.
- [ ] Migraciones aplicadas y verificadas contra el historial remoto.
- [ ] Variables y secretos validados sin exponer sus valores.
- [ ] Job pg_cron activo, frecuencia comprobada y sin duplicados.
- [ ] Pruebas de email, inbox y Push documentadas.
- [ ] Responsable operativo y procedimiento de incidentes confirmados.
- [ ] No quedan errores críticos ni alertas sin triage.

## Referencias

- [Arquitectura CUEVA-005](../architecture/notifications.md)
- [Conciliación manual de resultados externos](../architecture/notifications-reconciliation.md)

## Evidencia de preparación · 2026-11-16

- Hosted (solo lectura): contrato `hosted-schema-compatibility.sql` PASS en
  transacción de solo lectura con asserts activos. Huella de Vencimientos y
  lock coinciden con la [foto](CUEVA-005-hosted-baseline.json). Se consultaron
  extensiones y esquema. El primer enlace del conector denegó acceso y el
  proyecto se verificó en el enlace que sí lo lista.
- CI existente [43869687372](https://github.com/MatiasEzequielPereyra/CuevApp/actions/runs/43869687372)
  del SHA `3822520c41b6fe9fb4eb870f22fb69fb420bca66`: fresh, upgrade y
  hosted-compatible PASS. Los archivos de esquema, tests bajo `supabase/` y
  runtime de Notificaciones son iguales en la base actual. En el artefacto
  hosted-compatible se observó el orden del lote, 223 pgTAP aprobadas,
  concurrencia de claims/reintento aprobada y preservación de comprobantes,
  pagos y auditoría de vencimientos. Es evidencia previa de CI local aislado.
- `96f7da8` no requiere cherry-pick. Main ya difiere el retry Push antes del
  claim del canal interno y lo vuelve elegible en el escenario Push, mediante
  el cambio integrado en `a1d2da6`. El commit de Facu no está en la ascendencia
  pero la protección equivalente ya está en `supabase/tests/cueva_notifications.test.sql`.
- Prueba anterior, PGlite 0.3.15 con Auth y Storage sintéticos: replay de baseline,
  contrato, exactamente doce archivos con hashes verificados, postflight
  PASS y huella financiera idéntica. La auditoría ya reprodujo este replay.
  [Prueba reproducible](../../tests/cueva-005-rollout-preflight.mjs), desde la raíz:

  ```powershell
  $cuevaFixture = Join-Path $env:TEMP ('cueva-005-fixture-' + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Path $cuevaFixture | Out-Null
  npm install --prefix $cuevaFixture --no-save --ignore-scripts @electric-sql/pglite@0.3.15
  node --experimental-strip-types tests/cueva-005-rollout-preflight.mjs $cuevaFixture
  ```

- Prueba nativa del ciclo Cron PASS con PostgreSQL 17.6, `pg_cron` 1.6.4,
  `pg_net` 0.20.4 y Vault 0.3.1. La restricción directa dejó bloqueados a
  los roles API y conservó el encolado del rol Cron. El caso de acceso heredado
  abortó y revirtió la operación de permisos. El `jobid` de laboratorio `2`
  produjo dos POST con HTTP 204 a cinco minutos de intervalo, con la parada y
  reanudación entre ambos. El primer registro de `cron.job_run_details` y el
  job ajeno se conservaron. El script rechazó duplicado, reanudación activa,
  ID ajeno y cambios de horario, comando, destino en Vault o permisos.

  El runner usa un rol de cron sin superusuario y
  reemplaza solo la URL de producción por un receptor HTTP local en dos
  contenedores sin red externa ni puertos publicados. La frecuencia queda en
  cinco minutos. Ejecutar desde la raíz con PowerShell 7 y Docker.

  ```powershell
  docker pull public.ecr.aws/supabase/postgres@sha256:658d1c9b09ae4f61b8e95087b6859181b4b7d6940d769cf7b605609c8aad43e9
  docker pull docker.io/library/python@sha256:9ef1a599f863231c3d91e941389bfdc4a2d6070557243d54df1a4e57015b960e
  ./tests/cueva-005-cron-native.ps1
  ```

  [Runner nativo](../../tests/cueva-005-cron-native.ps1). Espera dos disparos
  reales del cron y retira solo sus contenedores. La prueba alojada sigue
  NOT_RUN.

- Prueba nueva de Node: 57/57 en autorización de worker, dispatcher,
  worker, Brevo, Push, bandeja y HTTP Push con respuestas sintéticas.
- Pendientes operativos: aprobación, respaldo, habilitar extensiones,
  acceso privado a las credenciales y comprobación del remitente Brevo
  con la clave API real, entorno aislado y verificación de los tres canales,
  revisión del alcance del primer arranque y verificación de la bandeja del portal.

SKILLS_SELECTED / SKILLS_APPLIED: `cueva-feature-development`,
`cueva-supabase-security`, `supabase:supabase`.
SKILL_SOURCES: [desarrollo](../../.agents/skills/cueva-feature-development/SKILL.md),
[seguridad](../../.agents/skills/cueva-supabase-security/SKILL.md) y guía
Supabase de host `supabase/1.0.0/skills/supabase/SKILL.md`.
