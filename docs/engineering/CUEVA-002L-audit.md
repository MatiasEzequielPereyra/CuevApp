# Auditoría CUEVA-002L

2026-11-03. Base `8bab2cb2f245da4919d9dc54d8b43e661c51b2ab`, ejecutor
`a18cd60bb9f23264f5a5e8d94606665230ba6e3c`. **ACCEPTED LOCAL para integrar
apagado**, compatibilidad temporal con el correo integrado solo para el propietario.
La aplicación alojada se decide mediante el plan controlado ya autorizado.

## Standards

Revisión final estática sin nuevos defectos concretos. Se corrigió escritura de
cookies antes de confirmar bind: buffer exclusivo por solicitud, commit solo con
bind=true. Rechazos, HTTP503, caída de conexión y excepciones no publican cookies.
Las fallas inyectadas ocurren antes de llegar al bind real; no demuestran qué
sucede si la respuesta se pierde después de ejecutarlo. Esa ambigüedad permanece
cerrada y exige inspección, no reintento automático.

AMR otp se documenta como genérico, sin afirmar que prueba tipo invite. El servidor
valida el JWT exacto con Auth antes de leer claims, compara owner y sesión que el
SDK devuelve, exige nonce privado/generación1 y bind existente. No confía en type
del navegador ni metadata editable. Tokens solo en ref, fragment eliminado,
POST explícito mismo origen y límites/no-store conservados; ninguna cfg con claves
se pasa al cliente. Sin migración, permisos o bootstrap K nuevos.

## Spec

Revisión independiente sobre HEAD fijado: sin faltantes bloqueantes para el
alcance temporal. Gate y contraseña propia permanecen; alumno ve cero datos
antes de completarla. Las acciones de correo administrativas quedan bloqueadas
en modo owner-only y la UI explica que el correo del gimnasio está pendiente.
La excepción requiere flag explícita y correo esperado por entorno, además de
PRODUCT_AUTH_ENABLED; no se afirma lista una plantilla custom al usar default.

## Verificación

Orchestrator repitió laboratorio L: exit0, 22 PASS/1 NOT_RUN, con Auth/PostgREST,
correo estándar y navegador reales locales. Negativos de password AMR con nonce
válido, JWT alterado, propietario distinto con OTP, nonce/generación/origen,
replay, bind503/conexión cortada sin cookies; primer acceso completo y cierre con
flag apagada PASS. Recursos exclusivos limpiados.

Ejecutor: regresión J25 PASS/1 NOT_RUN; lint/tipos/build, docs2/e2e25, fuentes4,
seguridad/diff PASS. Orchestrator: docs2 y escaneo190archivos PASS; regresión J
independiente exit0, 25 PASS/1 NOT_RUN con flag temporal apagada. CI remoto
obligatorio para HEAD final. No contar un NOT_RUN como PASS.

## Aplicación separada

El usuario ya autorizó cuenta de Nico, invitación, prueba y promoción condicionada;
eligió el correo integrado temporal después del bloqueo de Google. Team del
proyecto confirmó esa cuenta como Owner/destinatario permitido. El panel avisó
que volver al SMTP integrado resetea templates: todavía se conserva custom,
confirmación cancelada. Versiones custom están guardadas en Git para restauración.

Después de CI/merge: verificar SHA/READY apagado, cambiar al mailer integrado,
comprobar template ConfirmationURL stock y mantener Site URL/allowlist exactas.
Habilitar la ventana con PRODUCT_AUTH_ENABLED1, DEFAULT_MAIL_OWNER_TEST1,
FIRST_ADMIN_EMAIL esperado y EMAIL_TEMPLATE_READY0; actualizar el SHA guard de K.
Comprobar modo y estado vacío antes de un único apply privado desde ese SHA,
restaurando buildCommand:null como en K. Ante error/ambigüedad, inspeccionar y
mantener cierre. No repetir envíos por límite/SMTP ni crear otra cuenta para probar.

Si el envío confirma UUID, verificar estado preparado sin publicar tokens. Nico
elige contraseña en el sitio; luego se comprueba cuenta exacta/gate activo y se
promueve una única fila mediante operación administrativa revisada. No marcar
ready a mano. Correo alojado, HTTPS autenticado y primer alta real NOT_RUN al
aceptar este código. Esta aceptación no certifica incorporación general de alumnos.
