# CUEVA-005 — Arquitectura de notificaciones

**Estado:** decisión técnica para implementación aislada; no habilita infraestructura alojada.
**Fecha:** 2026-11-08
**Base:** 5761d61be1eb3cf8cea1a9c543ea393bf9b9e514

## Decisión

Supabase Cron será exclusivamente el disparador recurrente. Cada cinco minutos, pg_cron ejecutará una llamada HTTP asíncrona mediante pg_net al endpoint protegido de CUEVA en Vercel. El procesamiento completo permanecerá en Vercel: detección de vencimientos, cálculo de saldo pendiente, idempotencia, generación de notificaciones, envío por Brevo, Web Push, registro de intentos, reintentos y alertas.

No se adopta Vercel Cron/Schedules para este proceso porque el plan Hobby no admite la frecuencia aprobada de cinco minutos. El cron existente de limpieza de comprobantes permanece independiente y sin cambios.

## Componentes

1. **Supabase Cron (pg_cron):** programa */5 * * * *.
2. **Supabase pg_net:** realiza POST HTTPS asíncrono al endpoint Vercel; el job no contiene lógica de negocio.
3. **Supabase Vault:** conserva el endpoint y el secreto de autenticación del disparador. No se escriben secretos en migraciones, código, logs ni respuestas.
4. **Vercel Route Handler:** valida el secreto con comparación de tiempo constante y ejecuta el procesamiento con el cliente servidor existente.
5. **Brevo:** entrega de correo transaccional desde Vercel.
6. **Web Push:** Vercel firma y cifra los mensajes; el navegador/PWA administra permisos y suscripciones.
7. **Postgres:** mantiene períodos, saldo fuente, idempotencia, bandeja interna, preferencias, suscripciones, intentos y auditoría.

## Reglas funcionales preservadas

- Zona horaria America/Argentina/Buenos_Aires; horario inicial 12:00.
- Recordatorios a 5 y 1 día por cada período con saldo.
- No enviar recordatorios cuando el vencimiento ya pasó.
- Pagos parciales mantienen recordatorios; saldo cero cancela los pendientes.
- Períodos vencidos se procesan independientemente y el mensaje identifica período y saldo.
- Email e internas siempre activos; Push activado por defecto y configurable por alumno.
- Push solo se intenta si existe permiso/suscripción vigente.
- Cuatro reintentos tras el primer intento: 15 min, 30 min, 60 min y 3 h.
- Al agotar reintentos, fallo definitivo y alerta a administradores.
- Una falla de canal no detiene otros canales.
- Idempotencia por período, tipo de recordatorio y fecha de vencimiento.
- Cambios de horario/vencimiento afectan solo notificaciones pendientes/no procesadas; el historial procesado no se reescribe.
- Recuperación: enviar tardíamente solo si el recordatorio sigue siendo relevante y el vencimiento no pasó; en caso contrario registrar descarte y motivo.

## Seguridad y operación

- Se usarán secretos distintos para la limpieza de comprobantes y el endpoint de notificaciones.
- El secreto de llamada se provisionará en Vault y Vercel por un procedimiento operativo separado; nunca se incluye en el repositorio.
- El endpoint será idempotente y tolerará llamadas concurrentes o repetidas.
- El cron no transporta datos de alumnos ni saldos.
- La respuesta HTTP no expondrá información personal ni diagnósticos del proveedor.
- Se registrarán ejecución, recuperación, intentos por canal y referencias de proveedor; los diagnósticos sensibles quedarán restringidos.
- Se deberá monitorear por separado la ejecución del job y el resultado del procesamiento.

## Estado de infraestructura observado (solo lectura)

Proyecto Supabase vbkzoojkdkcugxhneyzi, PostgreSQL 17.11:
- supabase_vault 0.3.1 instalado.
- pg_cron y pg_net disponibles en el catálogo, no instalados.
- No existe cron.job, cron.job_run_details ni net.http_post.
- No hay jobs de notificaciones activos.
- La historia de migraciones alojada presenta versiones/nombres distintos de la secuencia del repositorio; debe reconciliarse antes de aplicar una migración remota.

## Límites de esta decisión

Esta arquitectura no autoriza aplicar migraciones, habilitar extensiones, crear secretos, programar el job alojado, cambiar variables de Vercel, enviar correos/push reales, desplegar ni integrar la rama. Esas operaciones requieren revisión y autorización operativa separada.
