# CUEVA-005 — Conciliación manual de resultados de correo inciertos

**Estado:** procedimiento de soporte para la implementación aislada. No habilita operaciones alojadas ni reenvíos.
**Alcance:** alertas `provider_outcome_unknown` generadas por Brevo o por la recuperación de un lease después del inicio del proveedor.

## Objetivo y regla de seguridad

Un resultado incierto significa que CUEVA no pudo confirmar si Brevo aceptó el mensaje. Puede haberlo aceptado antes de un timeout, una desconexión o una interrupción del worker.

- La entrega queda terminal en `failed`; no se reintenta automáticamente.
- La alerta administrativa se conserva aunque la notificación padre se cancele o el vencimiento pase.
- **No reenviar el correo por ausencia de evidencia en Brevo.** La ausencia de un registro visible no demuestra por sí sola que el mensaje no haya sido aceptado.
- No cambiar manualmente `status`, `attempt_count`, `provider_started_at`, el ledger de intentos ni eliminar la alerta para forzar un reenvío.
- La clave de idempotencia enviada a Brevo es el UUID de la notificación lógica (`headers.IdempotencyKey` en el cuerpo de la solicitud). No se debe asumir protección indefinida ni utilizar una repetición manual como mecanismo de recuperación.

## Procedimiento para soporte autorizado

1. **Identificar la alerta.** Desde `/alertas`, registrar alumno, período, recordatorio, canal, contador y hora local del evento. Confirmar que el tipo sea `provider_outcome_unknown`.
2. **Obtener referencias restringidas.** Un operador de soporte autorizado correlaciona la alerta con `delivery_id` y `notification_id` en la base operativa. No solicitar al administrador ni al alumno acceso a la tabla técnica de intentos.
3. **Consultar Brevo.** Con una cuenta autorizada, revisar los registros de email transaccional alrededor de la hora del evento. Correlacionar destinatario y asunto con la notificación; utilizar la referencia de operación/UUID disponible en los registros restringidos cuando el proveedor la muestre. Considerar la diferencia entre hora local de CUEVA y la zona horaria de la consola del proveedor.
4. **Si Brevo confirma aceptación.** Conservar el identificador del mensaje y la evidencia en el registro de soporte autorizado. No reenviar. La alerta y el ledger originales se mantienen como evidencia histórica.
5. **Si Brevo confirma rechazo/no aceptación.** Conservar la evidencia y escalar al responsable operativo. Esta versión no incorpora una acción de reenvío manual ni un RPC para reabrir entregas; no modificar la base directamente.
6. **Si el resultado sigue siendo inconcluso.** Mantener la entrega terminal y escalar. No reenviar automáticamente ni inferir que el mensaje no salió. Si hace falta avisar al alumno, utilizar un canal humano aprobado y evitar duplicar el contenido sin verificar el contexto.

## Alertas por reintentos agotados

Las alertas `retries_exhausted` representan cinco intentos con fallos conocidos. No son resultados inciertos del proveedor. Revisar el código de error técnico mediante el procedimiento de soporte restringido. Esta implementación tampoco ofrece reenvío manual desde el panel.

## Límites de la versión actual

- `/alertas` es una vista administrativa de solo lectura; no tiene acciones de resolver, descartar ni reenviar.
- La tabla de alertas es un registro operativo inmutable desde la interfaz; no tiene estado de acuse/resolución.
- El panel no expone email, tokens, cuerpos de respuesta ni el ledger técnico.
- La conciliación y el registro de evidencia se realizan fuera de la aplicación por soporte autorizado. Una futura herramienta de resolución requerirá diseño, permisos, auditoría append-only y pruebas específicas antes de implementarse.

## Prohibiciones operativas

No ejecutar SQL de escritura en producción, no invocar RPCs con credenciales de servicio desde herramientas manuales, no cambiar secretos ni configuración de Brevo y no activar reintentos desde Vercel/Supabase como parte de esta conciliación. Cualquier cambio de infraestructura o recuperación automatizada requiere una tarea y autorización separadas.
