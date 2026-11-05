# ORCHESTRATOR_TO_CODEX_HANDOFF_V1

TASK_ID: CUEVA-INVITACION-RECHAZO-SMTP-002
BASE_SHA: 31fcd33c100422ec9a1657ff34bd246f03908920
BRANCH: codex/cueva-invitacion-rechazo-smtp-002
ALCANCE: ampliación operativa local para REVIEW; no nueva UI ni rediseño de identidad.

## Estado acreditado

PR26 y PR28 están integrados, migraciones aplicadas y producción READY. El transporte, TLS1.3 con hostname verificado, afinidad de backend/advisory y ambas credenciales se comprobaron realmente; check devolvió CHECKED_NO_SEND eligible. El Orchestrator ejecutó UN único apply.

Resultado: APPLIED uncertain. Logs del intento identifican un rechazo explícito Gmail SMTP534, 5.7.9 Application-specific password required; no535, plantilla ni rate-limit. La cuenta no se confirmó y no inició sesión. Mismo UUID/ficha/perfil, cuentas/perfiles2/2. Ledger uncertain, trabajo review, generación2, operación invite-resend pendiente. Sin segundo envío ni edición manual de ready.

El expediente concreto con identificadores y log está solo en el directorio privado del operador, fuera de Git. Usar fixtures sintéticos para implementar. Gmail bloqueó al usuario al generar una contraseña de aplicación en el navegador integrado; la reparación del proveedor corresponde al humano desde un dispositivo familiar, no al ejecutor. SMTP general sigue cerrado.

## Incremento mínimo

El mecanismo aprobado de PR26 sacrifica disponibilidad ante cualquier error y no admite un segundo intento. Ampliarlo SOLO para un intento anterior que un operador autorizado acredite como rechazo de autenticación SMTP534/535, solicitud concluida, sin aceptación SMTP y sin ambigüedad residual. Un estado uncertain, tiempo transcurrido o HTTP500 nunca son prueba suficiente.

Conservar el historial del intento previo de forma íntegra y auditable; no borrar/recrear ledger ni cuentas para eludir restricciones. Validar explícitamente ficha, UUID Auth capturado, lease actual, intento previo, generación2 y marcador pendiente exacto. Exigir perfil alumno, correo congelado, cuenta sin confirmar/login/sesión, gate no activo y quiescencia.

Tras prueba de reparación SMTP y evidencia revisada, permitir una nueva reserva exclusiva y durable que sustituya el marcador previo de forma transaccional, invalide el nonce anterior, incremente una vez la generación y vincule la nueva autorización con la historia anterior. Ningún replay de la autorización vieja/nueva ni un attemptId diferente debe eludir la reserva o volver a enviar. Conservar el mismo UUID y exigir contraseña propia por el flujo existente para activar.

Cualquier aceptación anterior, correo con resultado ambiguo, identidad distinta, operación no reconocida o sesión detiene sin enviar. Nuevo error/timeout vuelve a retención segura; sin bucle automático. No agregar liberación genérica, takeover por tiempo, bypass ready ni recuperación silenciosa en lugar de invitación. La SMTP534 observada no autoriza por sí sola cerrar el estado o reenviar desde consola.

## Verificación y operación

Reutilizar el laboratorio, con matriz nueva limitada a: estado exacto gen2/pending/uncertain +534 demostrado; reparación -> una reserva y un correo/UUID conservado; historial intacto; replay/concurrencia; evidencia ausente/adulterada; resultado anterior aceptado/ambiguo; nuevo timeout/rechazo. No repetir matrices visuales, transporte48/13 ni identidad66 sin una modificación que lo justifique.

Documentar preflight SMTP sin enviar correos ni mutar identidades antes de reservar un nuevo intento. Las credenciales nunca van a Git, argumentos, logs o chat. Conexión oficial requiere certificado raíz público de Database Settings mediante NODE_EXTRA_CA_CERTS solo en procesos de operación, manteniendo rejectUnauthorized:true; no instalar confianza global ni bajar TLS. Fuente y fingerprint quedaron registrados en PR28.

Ejecutar checks afectados, fuentes/seguridad/documentos/diff; build solo si cambia runtime/config de la app. Actualizar checkpoint y operación; entregar REVIEW con BASE_SHA/HEAD_SHA/rama/archivos/resultados/limitaciones y árbol limpio.

Sin push/PR/merge/deploy, nuevas migraciones alojadas, SMTP/flags remotos, acceso autenticado o correo real. No tocar administrador, UI aprobada, migraciones históricas ni otros módulos. El Orchestrator audita y realiza únicamente la operación revisada después de verificar el proveedor.

Actualización del proveedor (2026-11-05): el usuario autorizó cambiar a Brevo Free, hasta300 correos/día. Alta iniciada con la cuenta del gimnasio y panel gratuito accesible; verificación de teléfono/remitente, activación SMTP y configuración Supabase aún pendientes. No exigir desbloqueo de Google como precondición: acreditar el nuevo proveedor autorizado antes de operar. No cambia el rechazo534 histórico ni autoriza liberar estados manualmente.

### Brevo configurado — 2026-11-05

Cambio de proveedor autorizado expresamente por el usuario tras bloqueo de identidad de Google. Cuenta Brevo creada por el usuario, teléfono verificado y panel con cuota gratuita300/día. Remitente del gimnasio verificado; nombre actualizado a CUEVA. Se conserva Gmail como dirección de remitente bajo la sustitución de dominio de Brevo ya informada y aceptada; sin compra de dominio ni plan pago.

Supabase SMTP recargado y comprobado: custom SMTP habilitado, smtp-relay.brevo.com, puerto587, remitente CUEVA y login técnico de Brevo. El usuario creó y pegó la nueva clave SMTP directamente en el formulario y guardó. Save changes deshabilitado tras recarga, contraseña almacenada oculta. No se exportaron credenciales de Vercel ni se modificaron flags de acceso general.

Verificación independiente sin credenciales: EHLO + STARTTLS al servidor587, TLS1.3 y certificado válidos; cero autenticaciones y cero emails desde esa comprobación. Brevo muestra onboarding transaccional esperando registros: no acredita todavía autenticación SMTP, aceptación ni entrega de un mensaje. No se solicitó soporte ni activación por mensajes externos.

La invitación existente sigue retenida por el intento SMTP534 anterior. No hubo reenvío ni liberación manual de ledger/gate. CUEVA-INVITACION-RECHAZO-SMTP-002 sigue siendo el encargo de ampliación operativa para una nueva autorización revisada conservando historia e identidad; su precondición usa el nuevo proveedor, no el desbloqueo de Google. Configuración guardada; primer envío y acceso alojados NOT_VERIFIED.