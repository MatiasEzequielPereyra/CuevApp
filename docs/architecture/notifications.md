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


## Contratos de datos y límites de acceso

### Fuente financiera

- La única fuente de períodos es `public.cueva_periods`; CUEVA-005 no crea períodos ni cuotas.
- El saldo se obtiene como `period.cents - SUM(payments.cents)`, excluyendo pagos presentes en `cueva_reversals`. Los importes se mantienen como enteros en centavos.
- El vencimiento se lee de `cueva_periods.due_on`, ya calculado por el mecanismo de vencimientos individuales. No se recalcula desde `joined_on` ni desde `cueva_due_schedules`.
- Solo se consideran fichas activas, períodos con vencimiento futuro en la fecha local de Buenos Aires y saldo mayor que cero.
- El correo y nombre de destino provienen de `cueva_students`; no se consulta ni se expone el historial completo de pagos.

### Lectura del worker

El endpoint de Vercel usa el `serviceClient()` existente. La lectura financiera se encapsula en una RPC de propósito único, ejecutable únicamente por `service_role`, que devuelve por período: identificadores de alumno/período, nombre y correo de destino, mes, `due_on`, importe, total pagado y saldo en centavos. La función privada debe validar el claim firmado `request.jwt.claims ->> 'role' = 'service_role'`, usar `SECURITY DEFINER` con `search_path = ''`, y revocar ejecución a `PUBLIC`, `anon` y `authenticated`. El wrapper expuesto en `public` será `SECURITY INVOKER` y solo tendrá `EXECUTE` para `service_role`; también se concede `USAGE` sobre `cueva_private` únicamente a ese rol. No se usa `auth.role()`, que está obsoleto. No se otorgan permisos directos de lectura a alumnos ni se reutiliza `cueva_billing_snapshot`.

La clave service-role ya es una autoridad privilegiada del servidor; la RPC limita el contrato de datos utilizado por el worker, pero no se considera una frontera frente a otro código que ya posea esa clave. Nunca se envía la clave al navegador.

### Estado persistente

El esquema se separará por responsabilidad:

- **Configuración común:** una única fila con hora efectiva y zona horaria fija. Ambos administradores pueden cambiar la hora mediante RPC autenticada con sesión vigente y rol admin; la RPC actualiza solo trabajos pendientes y agrega auditoría con actor, hora, valor anterior/nuevo y resultado.
- **Notificación lógica:** identidad única por período, tipo (5 días/1 día) y fecha de vencimiento. Cambiar el vencimiento cancela solo filas aún pendientes y crea la identidad correspondiente al nuevo vencimiento. Las procesadas permanecen inmutables.
- **Entrega por canal:** una fila independiente para email, interna y push, con estado, contador de intentos, próxima ejecución y referencia del proveedor. Una falla de un canal no bloquea los demás.
- **Intentos:** historial append-only por entrega de canal y, para Push, historial separado por dispositivo con número, instante, resultado, código acotado y referencia. No se almacenan cuerpos SMTP, payloads, tokens ni datos personales innecesarios. Los dispositivos ya aceptados, expirados o inciertos no se vuelven a enviar en reintentos posteriores.
- **Bandeja interna:** contenido persistente asociado al alumno y estado de lectura individual; no desaparece por completar una entrega de email o push.
- **Preferencia push y suscripciones:** push se inicializa habilitado por alumno; endpoint y claves de suscripción quedan solo en servidor. Email e internas no tienen interruptor. Cada endpoint tiene una entrega hija única por notificación lógica y lease/token independiente.
- **Ejecuciones y recuperación:** registro separado de inicio/fin, recuperación tras indisponibilidad, decisión (envío tardío o descarte) y motivo.
- **Alertas operativas:** una fila por entrega de canal que transiciona por primera vez a fallo definitivo tras cinco intentos conocidos, o ante un resultado incierto de un proveedor externo. Para Push, cualquier endpoint incierto o que agote sus cinco intentos conocidos genera una alerta agregada única para la entrega padre, aunque otro dispositivo haya recibido el aviso. Si coexisten fallos agotados e incertidumbre, la alerta conserva la prioridad de resultado incierto. Los resultados inciertos generan alerta aunque la notificación padre se haya cancelado o el vencimiento haya pasado; permanecen terminales y nunca se reintentan automáticamente. Triggers transaccionales cubren la finalización normal, la cancelación y la recuperación de leases. La bandeja y su snapshot funcional son exclusivos de administradores con sesión vigente; los intentos y códigos técnicos permanecen fuera del acceso de la interfaz.

### Ventanas y reintentos

El worker se ejecuta cada cinco minutos, pero compara contra la hora local configurada (inicialmente 12:00). La frecuencia del cron no adelanta ni desplaza el horario. Para cada período abierto reconcilia ambas identidades (5 días y 1 día) con el vencimiento actual y saldo actual. El primer intento ocurre al llegar el horario; tras cada fallo se programa el siguiente intento a 15 min, 30 min, 60 min y 3 h. El intento inicial más esos cuatro reintentos son cinco intentos máximos. Agotados, la entrega queda fallida definitivamente y se genera una alerta administrativa.

La recuperación no reintenta indiscriminadamente: solo procesa avisos aún relevantes cuyo vencimiento siga siendo futuro; el resto se marca descartado con motivo. Los períodos se evalúan de forma independiente.


### Exposición explícita del Data API

Desde el cambio de Supabase aplicado en 2026, las tablas nuevas de `public` no deben suponerse accesibles automáticamente por PostgREST. Toda tabla de notificaciones tendrá RLS habilitado y privilegios explícitos. Las tablas operativas (entregas, intentos, ejecuciones, preferencias y suscripciones) no concederán acceso directo a `anon` ni `authenticated`; el worker accederá mediante RPCs estrechas. La bandeja interna concederá únicamente lectura y actualización del estado de lectura bajo RLS ligada a la sesión vigente y al `user_id`. Los wrappers RPC serán `SECURITY INVOKER` y se concederá `EXECUTE` solo a los roles consumidores.


## Conciliación de resultados inciertos

El procedimiento de soporte, las comprobaciones en Brevo y los límites de reenvío están documentados en [CUEVA-005 — Conciliación manual](notifications-reconciliation.md). Para Web Push se concilia cada endpoint con el ledger restringido de dispositivos; la ausencia de una confirmación del servicio push no autoriza reintentos. La interfaz administrativa permanece de solo lectura; no se debe reabrir una entrega manualmente ni reenviar ante evidencia inconclusa.
