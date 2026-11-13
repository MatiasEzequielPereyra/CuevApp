# CUEVA-005 — Checklist de preflight y puesta en marcha

**Estado:** guía operativa preparada; no autoriza ni ejecuta cambios en servicios alojados.
**Rama:** `feature/cueva-005-notificaciones`
**Restricción:** no aplicar migraciones, crear secretos, activar extensiones/jobs, cambiar variables, enviar mensajes reales ni desplegar sin autorización operativa explícita.

## 1. Criterios de entrada

- [ ] PR revisado y aprobado; CI verde para el SHA exacto que se desplegará.
- [ ] Confirmar que la rama contiene únicamente CUEVA-005. CUEVA-003B Vencimientos permanece como baseline cerrado.
- [ ] Reconciliar el historial de migraciones alojado con el repositorio antes de cualquier migración remota. No resolver divergencias con `db reset`, `migration repair` ni SQL manual sin plan aprobado.
- [ ] Confirmar backup/PITR y ventana de mantenimiento/rollback del proyecto Supabase.
- [ ] Confirmar que el dominio remitente de Brevo está autenticado y habilitado para transactional email.
- [ ] Confirmar que el dominio Vercel sirve HTTPS y que la PWA/manifest permite instalarse en los dispositivos objetivo.

## 2. Variables de entorno Vercel

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
- [ ] Confirmar que el remitente coincide con un remitente/dominio verificado en Brevo.

### Web Push

- [ ] `CUEVA_VAPID_PUBLIC_KEY`
- [ ] `CUEVA_VAPID_PRIVATE_KEY`
- [ ] `CUEVA_VAPID_SUBJECT` con formato `mailto:...`.
- [ ] Confirmar que la clave pública corresponde a la privada. El endpoint de preferencias solo debe informar Push disponible si el par completo es válido.

### Worker

- [ ] `CUEVA_NOTIFICATIONS_CRON_SECRET`: secreto aleatorio de alta entropía (mínimo 32 caracteres), sin espacios al inicio/final.
- [ ] El mismo secreto se almacena en Supabase Vault para la llamada pg_net; nunca se guarda en una migración ni en el repositorio.
- [ ] Verificar que las variables estén disponibles en el deployment que se probará; cambios de variables requieren nuevo deployment.

## 3. Supabase: preflight de infraestructura

- [ ] Confirmar proyecto, región, versión PostgreSQL y entorno exactos.
- [ ] Confirmar disponibilidad y estado de `pg_cron`, `pg_net` y `supabase_vault`.
- [ ] Revisar jobs existentes para evitar duplicar el dispatcher o interferir con limpieza de comprobantes.
- [ ] Revisar `cron.job_run_details` y errores previos antes de activar el nuevo job.
- [ ] Crear/validar en Vault el endpoint HTTPS del worker y el secreto dedicado, con acceso restringido.
- [ ] Revisar URL, headers, timeout y política de retención de respuestas de pg_net.
- [ ] Programar únicamente después de validar el endpoint manualmente y aprobar el cambio operativo: intervalo cada 5 minutos. Vercel Hobby no debe recibir una configuración Vercel Cron cada 5 minutos.
- [ ] Confirmar que el job solo dispara el endpoint; no debe transportar PII, importes ni lógica de negocio.

No asumir que las extensiones están instaladas ni que la historia remota de migraciones coincide con el repositorio.

## 4. Pruebas controladas antes de habilitar el cron

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

## 5. Activación gradual y observabilidad

- [ ] Activar primero en un entorno de prueba con destinatarios internos autorizados.
- [ ] Ejecutar una corrida manual única y revisar resumen, ledger y alertas con acceso restringido.
- [ ] Activar el job cada cinco minutos solo después de aprobar la prueba controlada.
- [ ] Supervisar ejecuciones de cron, respuestas HTTP, registros de worker, errores parciales y alertas.
- [ ] Verificar por separado email, inbox y Push; el éxito de un canal no demuestra el éxito de los otros.
- [ ] No registrar headers Authorization, claves, endpoints Push, payloads ni PII en logs.
- [ ] Revisar las primeras ejecuciones y confirmar que no haya duplicados ni entregas fuera de ventana.

## 6. Rollback seguro

1. Deshabilitar el job pg_cron de notificaciones para detener nuevas invocaciones.
2. Mantener tablas, ledger, alertas y evidencia; no borrar ni reiniciar estados.
3. Si el problema está en el deployment, volver al deployment Vercel previamente validado.
4. No reenviar entregas con resultado `unknown`; seguir el procedimiento de conciliación manual.
5. No revertir migraciones con pérdida de datos. Toda reversión de esquema requiere análisis específico y autorización.
6. Confirmar que la limpieza de comprobantes y otros cron existentes sigan intactos.

## 7. Cierre de puesta en marcha

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
