# CUEVA-002D: prueba local de invitación

Estado: **BLOCKED para habilitar acceso**, investigación local parcial.
La elección de producto es invitación por correo para establecer una contraseña,
en lugar de entregar una temporal. El acceso de la aplicación permanece
deshabilitado y no se realizaron cambios en servicios alojados.

## Observación

En GoTrue v2.197.0, con `GOTRUE_DISABLE_SIGNUP=true`, un POST directo de alta
de un usuario sintético respondió 422 con `signup_disabled`. Esta observación
se limita a esa configuración y endpoint: no verifica todas las rutas de alta ni
la configuración alojada. Tras corregir el error de laboratorio detallado abajo,
una invitación administrativa llegó al Mailpit local, el token fue verificado por
API, el usuario estableció contraseña y luego inició sesión. El segundo uso del
token fue rechazado; un usuario autenticado sin privilegios y una solicitud
anónima no pudieron invitar, y una contraseña incorrecta fue rechazada. Resultado
completo y redactado: [evidence.json](evidence.json).

La verificación de invitación **emitió un token de acceso antes de establecer la
contraseña**. Por tanto la invitación por sí sola no impone la finalización del
primer acceso en los datos: es imprescindible probar un control en servidor y RLS.
Sin pruebas de recuperación, SSR, RLS, roles de la aplicación, revocación, flujo
de enlace en navegador ni envío efectivo de correo a usuarios. No se afirma que un usuario
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
seguridad detectó inicialmente `secret-assignment` en la construcción interpolada
de una URL local con contraseña aleatoria. Se cambió a un objeto URL y asignación
de propiedades en memoria; el escáner, sin cambios ni exclusiones, pasó en la
ejecución posterior. La salida y evidencia solo contienen resultados redactados;
la comprobación por patrones no demuestra ausencia de todos los secretos posibles.
La sintaxis Node y `git diff --check` pasaron.

En el primer intento una red interna no permitió verificar el mapeo; se cambió a
bridge con bind loopback. Después faltaba el esquema `auth` en Postgres genérico;
se agregó su creación solo dentro de la base desechable. GoTrue inició pero la
invitación daba 500: el diagnóstico redactado identificó `relation users does not
exist`. La base genérica carecía del `search_path` al esquema `auth`; configurar
`auth, public` para su rol local eliminó el fallo en la prueba original. Este
ajuste es exclusivo del laboratorio y no describe una modificación alojada.
La prueba anterior se reprodujo antes de la corrección y el mismo escenario pasó
después. Ninguno de esos intentos permite concluir nada sobre Auth remoto.

La siguiente investigación debe verificar un control de incorporación en servidor
y RLS, enlace de invitación en navegador, recuperación y aislamiento de sesiones.
RLS y roles necesitan además un entorno de datos aislado real; pruebas con mocks
no sustituyen esos controles. La clave administrativa y permisos de invitación
deben quedar solo en un servidor autorizado.

Fuentes: [Supabase Auth](https://github.com/supabase/auth),
[usuarios e invitación](https://supabase.com/docs/guides/auth/users),
[configuración de Auth](https://supabase.com/docs/guides/self-hosting/auth/config).
