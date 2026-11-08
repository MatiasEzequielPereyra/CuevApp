# CUEVA-005 — Notificaciones de vencimientos

**TASK_ID:** CUEVA-005
**Estado:** implementación aislada en curso
**BASE_SHA:** 5761d61be1eb3cf8cea1a9c543ea393bf9b9e514
**Rama:** feature/cueva-005-notificaciones
**Fecha de inicio:** 2026-11-08

## Skills seleccionadas y aplicadas

- cueva-architecture: límites Supabase/Vercel, dependencias y recuperación.
- cueva-finance: saldo, pagos parciales, vencimientos e idempotencia.
- cueva-supabase-security: inspección de solo lectura, Vault, RLS y privilegios.
- cueva-feature-development: rama aislada, alcance y entrega verificable.
- Skill Supabase: documentación vigente de Cron, pg_cron, pg_net y Vault.

## Alcance

Implementar en esta rama el servicio de notificaciones aprobado: recordatorios por período, canales email/interno/push, preferencias push por alumno, reintentos, idempotencia, recuperación tras interrupciones, auditoría y protección de la llamada del scheduler.

Supabase Cron solo dispara cada cinco minutos. Vercel realiza todo el procesamiento y envío. Brevo es el proveedor de email. Se conserva la configuración inicial de 12:00 en America/Argentina/Buenos_Aires.

## Exclusiones

- No modificar main, ramas de otros ejecutores ni PR ajenos.
- No aplicar migraciones ni SQL de escritura en Supabase alojado.
- No crear ni activar jobs remotos, ni provisionar secretos en Vault.
- No modificar variables de entorno de Vercel ni desplegar.
- No enviar emails, push o notificaciones reales durante pruebas.
- No cambiar el motor financiero existente ni el flujo de comprobantes.
- No integrar ni hacer merge desde el ejecutor.

## Criterios de aceptación

1. Un período genera como máximo un recordatorio por tipo y vencimiento.
2. El saldo se calcula desde el ledger existente; saldo cero cancela pendientes y pagos parciales conservan recordatorios.
3. Los períodos se procesan de forma independiente.
4. La frecuencia del disparador es cinco minutos y no altera el horario efectivo.
5. Los canales se procesan independientemente; las fallas tienen cuatro reintentos y luego alerta.
6. Las notificaciones internas persisten hasta que el alumno las marca como leídas.
7. Push está habilitado por defecto, requiere permiso del navegador y puede desactivarse por alumno.
8. Cambios de vencimiento/horario no reescriben notificaciones ya procesadas.
9. La recuperación envía solo si sigue siendo relevante y el vencimiento no pasó; los descartes quedan auditados.
10. Los endpoints, funciones y tablas respetan el modelo de roles/sesiones y no exponen secretos ni datos de otros alumnos.
11. Las migraciones pasan pruebas fresh y upgrade; la aplicación pasa lint, typecheck, build y tests.
12. No se declara integración ni validación alojada sin evidencia específica.

## Inspección inicial

- La rama estaba idéntica a main en BASE_SHA; no había cambios que preservar dentro de la rama.
- El proyecto alojado tiene Vault instalado; pg_cron y pg_net no están instalados.
- No existen tablas/jobs de notificaciones en el proyecto alojado.
- La secuencia de migraciones alojada no coincide exactamente con los nombres/versiones del repositorio. Requiere reconciliación antes de cualquier operación remota.
- Brevo SMTP figura en el checkpoint para invitaciones; no se considera prueba de que las variables/credenciales de envío transaccional estén disponibles para este nuevo servicio.
- No existen aún manifest PWA ni service worker en el repositorio.

## Limitaciones del entorno de ejecución

El ejecutor no tiene checkout local ni Supabase CLI instalado, y no dispone de conectividad para clonar el repositorio. La documentación instalada exige generar nuevas migraciones con supabase migration new; por lo tanto, no se inventará ni se escribirá una migración SQL hasta contar con ese flujo de generación. La inspección de código y del proyecto remoto se realizó mediante GitHub/Supabase connectors; las consultas remotas fueron de solo lectura.
