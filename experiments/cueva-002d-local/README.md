# CUEVA-002D: prueba local de invitación

Estado: **BLOCKED**, investigación parcial; no es una implementación de acceso.
La elección de producto es invitación por correo para establecer una contraseña,
en lugar de entregar una temporal. El acceso de la aplicación permanece
deshabilitado y no se realizaron cambios en servicios alojados.

## Observación

En GoTrue v2.197.0, con `GOTRUE_DISABLE_SIGNUP=true`, un POST directo de alta
de un usuario sintético respondió 422 con `signup_disabled`. Esta observación
se limita a esa configuración y endpoint: no verifica todas las rutas de alta ni
la configuración alojada. La invitación administrativa respondió HTTP 500 con
`unexpected_failure`. La causa no se estableció; no se atribuye a la opción de
cerrar altas. Por ello no se obtuvo correo, sesión ni prueba de establecer clave.
Resultado completo y redactado: [evidence.json](evidence.json).

Sin pruebas reales de invitación, recuperación, SSR, RLS, autorización por rol,
revocación, ni envío efectivo de correo a usuarios. No se afirma que un usuario
sin sesión no pueda acceder a datos en Supabase alojado. La comprobación real de
estos controles bloquea la habilitación del acceso.

## Reproducción y seguridad

Con Node 22 y Docker ya operativo, ejecutar `node lab.mjs` desde este directorio.
Usa exclusivamente imágenes locales fijadas por digest para GoTrue 2.197.0,
Postgres 17 Alpine y Mailpit 1.30.2; si faltan, Docker podría descargarlas. Crea
una red bridge y tres contenedores de nombres aleatorios `cueva-002d-*`, sin
volúmenes persistentes; Postgres no publica puertos y las interfaces de Mailpit
y Auth se publican solo en `127.0.0.1`. Confirma el bind antes de usarlos.
Las cuentas, claves y JWT son aleatorios de laboratorio y no pertenecen al
proyecto real. La firma JWT de prueba sirve solo para el endpoint administrativo
de esta instancia desechable; no es código de autenticación de la aplicación.

Los datos viven en memoria del proceso o en los contenedores temporales. Docker
local privilegiado puede inspeccionar su entorno mientras están activos. El
contenedor de Auth usa el driver local para diagnóstico de arranque y falla;
solo se informan categorías, no los logs, y se elimina el contenedor al terminar.
Los otros contenedores no generan logs Docker. No guardar ni compartir correo,
tokens, contraseñas, logs o URLs de confirmación. `results.json` está ignorado.

El script elimina solamente los tres contenedores y su red propios. Una interrupción
forzada puede impedir esa limpieza: comprobar nombres y pertenencia antes de
eliminar exclusivamente los recursos de esa ejecución. No reiniciar Docker ni
alterar otros proyectos. La prueba fallida sale con código distinto de cero.

La comprobación documental y las fuentes originales pasaron. El escáner de
seguridad reporta `secret-assignment` en `lab.mjs`: corresponde a la URL de la
base local construida con una contraseña generada aleatoriamente en memoria,
no a una clave literal. Se conserva el resultado **FAIL** del escaneo por patrón;
la revisión manual no sustituye un escaneo sin hallazgos ni demuestra ausencia
de todos los secretos posibles. La sintaxis Node y `git diff --check` pasaron.

En el primer intento una red interna no permitió verificar el mapeo; se cambió a
bridge con bind loopback. Después faltaba el esquema `auth` en Postgres genérico;
se agregó su creación solo dentro de la base desechable. Ninguno de esos intentos
permitió concluir nada sobre Auth remoto. El fallo 500 persiste tras el ajuste.

La siguiente investigación debe diagnosticar el fallo sin exponer logs y verificar
con GoTrue real: invitación con alta pública cerrada, validación del enlace una
sola vez, selección de contraseña, acceso, recuperación y aislamiento de sesiones.
RLS y roles necesitan además un entorno de datos aislado real; pruebas con mocks
no sustituyen esos controles. La clave administrativa y permisos de invitación
deben quedar solo en un servidor autorizado.

Fuentes: [Supabase Auth](https://github.com/supabase/auth),
[usuarios e invitación](https://supabase.com/docs/guides/auth/users),
[configuración de Auth](https://supabase.com/docs/guides/self-hosting/auth/config).
