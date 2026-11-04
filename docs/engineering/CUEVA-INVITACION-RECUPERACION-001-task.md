# CUEVA-INVITACION-RECUPERACION-001 — encargo

Fuente: ORCHESTRATOR_TO_CODEX_HANDOFF_V1 del usuario, 2026-11-04.
Base `a0dabf081a82867eb93d9f177f42e3c3cceb1a41`, rama
`codex/cueva-invitacion-recuperacion-001`. Implementación local para REVIEW.

PR25 integrado y publicado, migración aplicada. Un envío alojado autorizado falló
por rechazo Gmail SMTP 535 BadCredentials después de crear/preparar la identidad;
ficha conservada, trabajo review, UUID capturado, correo sin confirmar, sin login,
ready=false. Credencial reemplazada después por el usuario; todavía no probada.
El registro actualizado se conserva en [PR25](https://github.com/MatiasEzequielPereyra/CuevApp/pull/25).

Entregar el mecanismo mínimo de operador para ese caso: ficha/trabajo/UUID y
generación/estado explícitos, relación exacta, perfil alumno, correo congelado,
sin confirmación/login/sesión/gate activo/operación concurrente; rechazo acreditado.
Ante identidad distinta, estado pendiente, aceptación SMTP o incertidumbre previas,
detener sin enviar ni mutar acceso. Reservar transaccionalmente un intento exclusivo,
renovar nonce/generación e invalidar enlaces anteriores sin recrear cuentas ni
activar ready. Usar invitación y contraseña propias existentes, sin sustituir por
recuperación. Exigir mismo UUID devuelto. Replays/concurrencia no envían otra vez;
fallos e interrupciones conservan acceso cerrado, sin reintentos automáticos.

Probar solo casos afectados en laboratorio reutilizado: 535/reparación/reconciliación,
un correo aceptado/enlace real/contraseña/sesión; replay/concurrencia, identidades
incorrectas/confirmadas, estados ambiguos, permisos, invalidación y conservación.
Contar SMTP local. Lint/tipos/build/documentos/fuentes/seguridad/diff y árbol limpio.
Documentar operación, aplicación, rollback y handoff con SHAs, archivos y riesgos.

Sin push/PR/merge/deploy, migración alojada, envío real, secretos/SMTP/flags alojados,
datos reales, administrador, nuevos permisos ni edición de migraciones históricas.
No incluir identificadores, correos personales, credenciales, sesiones, nonces ni
enlaces de ensayo en Git. El Orchestrator aplicará solo lo aprobado y hará el único
reintento autorizado después; entrega y primer acceso alojados NOT_VERIFIED.
