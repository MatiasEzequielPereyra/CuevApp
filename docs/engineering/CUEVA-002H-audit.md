# Auditoría CUEVA-002H

Base `eb612fadaada9919c4cd5ff1876e2d6a8690a036`, HEAD ejecutor
`f24b95f2230c19e53b5144b41f5d09443c8d25ba`. Se acepta integración experimental
local de Next, no acceso de producción. Las rutas del laboratorio exigen
desarrollo, opt-in y destinos loopback; el despliegue permanece cerrado.

La revisión de seguridad halló un límite de cuerpo incompleto: Content-Length
solo no acotaba req.formData. Corregido con conteo real de bytes, cancelación y
parseo limitado a 8192. Revisión final sin nuevos hallazgos accionables.

El Orchestrator repitió el laboratorio con Next, Auth, PostgREST, Postgres y
Chromium reales: invitación, cambio de contraseña, dos alumnos con aislamiento,
logout/login, sesión inválida, replay, origen cruzado y límites chunked/multipart
PASS. Limpieza de recursos propios PASS. Documentos 2/2, escáner por patrones
y diff check PASS; ausencia absoluta de secretos no demostrada. Ejecutor informa
build y 24 pruebas navegador PASS, incluido bloqueo productivo aun con bandera.

Npm reporta 16 moderadas en cadena de desarrollo y ninguna alta/crítica en la
entrega. No se forzaron actualizaciones. Reset coordinado no está implementado
en la app. SQL y privilegios siguen experimentales; correo real, HTTPS, recuperación,
sesiones en todas sus variantes y entorno alojado siguen pendientes. El operador
con credenciales privilegiadas es frontera de confianza, no un alumno del gimnasio.

Antes de acceso real hace falta un incremento productivo revisado, configurar
altas cerradas, envío de invitaciones, URLs, privilegios y probar datos alojados.
No basta configurar variables ni cambiar una bandera de este laboratorio.
