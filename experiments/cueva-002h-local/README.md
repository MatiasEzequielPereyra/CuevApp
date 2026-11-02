# CUEVA-002H: integración local de acceso en Next.js

**REVIEW local; acceso productivo BLOCKED.** La aplicación Next real incorpora
una ruta de laboratorio para ensayar Auth y RLS con servicios descartables. El
acceso público existente `/ingresar` continúa deshabilitado. El laboratorio
requiere simultáneamente `NODE_ENV=development`, `CUEVA_LOCAL_AUTH=1` y URLs
HTTP estrictamente en 127.0.0.1; en producción responde 404 aun con la bandera.
No es una función lista para activar ni una migración desplegable.

## Prueba y reproducción

Ejecutar `npm ci` en la raíz, instalar Chromium de Playwright si falta y ejecutar
`node lab.mjs` en este directorio con Docker ya disponible. Se reutiliza la base
del harness 002G para crear Auth, PostgREST, PostgreSQL y Mailpit fijados por
digest; el servidor ensayado es Next.js real en loopback, no el servidor 002G.
Se crean dos usuarios sintéticos independientes y dos registros con propietarios
distintos, correo y credenciales efímeros. `results.json` es ignorado; la
[evidencia](evidence.json) solo guarda resultados redactados.

Chromium carga y recarga la invitación sin consumirla, luego la acepta por POST.
El enlace del correo local se traduce para la prueba: plantilla y entrega real
no fueron probadas. La sesión recibida antes de elegir contraseña no ve filas;
el cambio de contraseña se hace en Auth, bajo coordinación experimental, y RLS
permite la lectura propia solo tras activar. Se comprueban dos alumnos reales,
aislamiento bidireccional de lectura, origen cruzado rechazado, cookie inválida,
clave errónea, replay de invitación y cierre de sesión. Cookies SSR observadas
HttpOnly y SameSite=Lax en HTTP local; HTTPS real no fue probado. La verificación
de producción prueba que las rutas devuelven 404 aun al configurar la bandera.

La ruta de mutación lee como máximo 8192 bytes reales antes de interpretar el
formulario, preservando su tipo de contenido; al excederlos cancela la lectura
y devuelve 413. Se ensayaron dos solicitudes `chunked` sin Content-Length: una
mayor al límite fue rechazada y otra menor llegó al procesamiento de ingreso;
un formulario multipart también llegó a dicho procesamiento.

El primer ensayo encontró logout denegado por Origin ausente bajo `no-referrer`.
El laboratorio usa ahora `strict-origin`: no comparte la ruta de invitación y
conserva el Origin para verificar el POST. La repetición observó logout 303,
cookie retirada y acceso posterior 401. Esto no acredita todos los escenarios
CSRF ni la seguridad del flujo en producción.

## Privilegios y límites

El coordinador usa un rol local sin superusuario ni BYPASSRLS, sin acceso directo
a la tabla privada, con ejecución de funciones acotadas; la configuración y los
fixtures son creados por un superusuario descartable. El servidor coordinador y
sus credenciales son confiables: su compromiso permite llamar a esas funciones y
no prueba por sí mismo el cambio de contraseña. El operador del proveedor que
controla Auth o la base puede alterar los controles; no se atribuye esa facultad
al alumno o al administrador del gimnasio. La secuencia de reset coordinado no
está implementada ni ensayada aquí. El ensayo de operador directo reproduce que
una sesión nueva obtiene acceso tras un cambio directo de clave: no demuestra
una vía del administrador del gimnasio ni una protección frente al operador raíz.

Sin Supabase alojado, correos reales, Storage, HTTPS, refresh y expiración en
todas sus variantes, permisos reales del gimnasio, política de recuperación,
concurrencia de producto o aplicación de migraciones. El SQL es exclusivamente
experimental y usa SECURITY DEFINER restringido; no está aceptado para producción.
La contraseña pasa transitoriamente por el servidor; no se registra ni persiste
en el repositorio. No se han probado exhaustivamente logs, despliegue y operación
reales. La verificación de sesiones y el rol coordinador necesitan revisión
adicional antes de conectar datos o usuarios reales.

El script crea exclusivamente red y contenedores `cueva-002h-*`, con puertos de
host en loopback, y los elimina en `finally`. Una terminación forzada puede dejar
recursos: verificar su pertenencia y limpiar solo los propios, sin reiniciar Docker
ni tocar otros proyectos. El controlador local de Docker puede ver variables mientras
los contenedores están activos. Las imágenes y Chromium permanecen en caché.

## Verificaciones

Laboratorio: PASS en las condiciones limitadas descritas; no habilita acceso.
Lint, tipos, build, pruebas documentales y 24 pruebas de navegador existentes:
PASS. Prueba de bloqueo del laboratorio bajo producción: PASS. Fuentes 4/4 y
escaneo por patrones: PASS; el escaneo no demuestra ausencia total de secretos.
`npm audit` reportó 16 vulnerabilidades moderadas en la cadena de desarrollo
ESLint/minimatch, cero altas o críticas; no se aplicaron cambios forzados.

Referencias: [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs),
[plantillas de correo](https://supabase.com/docs/guides/auth/auth-email-templates),
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
y guías de Next.js 16 incluidas en `node_modules/next/dist/docs/`.
