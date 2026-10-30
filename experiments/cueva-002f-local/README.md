# CUEVA-002F: coordinación local de incorporación y reset

Estado **REVIEW de investigación local; implementación y acceso BLOCKED**.
Ensayo con GoTrue 2.197.0, PostgreSQL y PostgREST reales, datos sintéticos y
solo recursos locales. No es código de aplicación ni una migración desplegable.

## Propuesta de laboratorio

El prototipo aplica un bloqueo advisory de sesión por usuario en PostgreSQL,
compartido por activación y reset coordinados. Hay una fila privada con estado
`ready` y generación. Para activar, el coordinador consulta identidad a GoTrue,
adquiere el bloqueo, vuelve a consultar sesión, actualiza contraseña como usuario,
vuelve a consultar sesión y activa únicamente si sigue pendiente, la generación
no cambió y existe la sesión en `auth.sessions`. El RLS del único recurso de prueba
exige propiedad, `ready` y coincidencia de usuario y `session_id` vivo en la base.

El reset coordinado obtiene el mismo bloqueo y **persiste** `ready=false` y una
nueva generación antes de llamar al endpoint administrativo de Auth. Si el llamado
falla o se interrumpe en el punto simulado, la fila permanece cerrada. El bloqueo
de sesión vive en una conexión PostgreSQL dedicada durante las llamadas HTTP;
un pool que cambie de conexión no garantiza este comportamiento. El harness usa
superusuario local y procesa contraseñas en memoria: no representa un diseño de
privilegios, observabilidad ni despliegue aceptable para producción.

## Resultados observados

En la ejecución redactada, antes de elegir contraseña la sesión no vio registros;
modificar metadata no abrió el acceso. Al completar el flujo coordinado se vio
solo la fila propia y una inserción con otro propietario fue rechazada. Dos
activaciones concurrentes produjeron un único DONE y un NOT_PENDING; un replay
secuencial se rechazó. Se identificó la sesión PostgreSQL del reset y se observó
en `pg_locks` una solicitud advisory no concedida mientras la activación mantenía
el bloqueo. Entonces se permitió continuar: la activación terminó DONE antes de
que el reset adquiriera el bloqueo, el reset terminó RESET y el JWT anterior no
vio registros. Una excepción simulada antes de activar dejó el acceso cerrado.
Para la falla HTTP del proveedor se comprobó que una sesión válida veía una fila
antes de comenzar y ninguna después. La prueba separada de interrupción usa una
reactivación privilegiada del fixture local y verifica el mismo antes y después.
[Resultados redactados](evidence.json).

Estas pruebas son un número limitado de secuencias: no acreditan toda carrera,
un proceso terminado abruptamente, caídas de red ambiguas, recuperación tras un
resultado desconocido, locks bajo pool real, sesiones expiradas no eliminadas,
cancelaciones, reintentos concurrentes de reset, ni administración de privilegios.
La emisión de una sesión antes de elegir contraseña sigue observándose. No se
probó SSR, enlace en navegador, correo real, Storage, otras tablas, funciones,
acceso de servicio ni el proyecto alojado. La simple existencia de una fila en
`auth.sessions` no constituye por sí sola verificación completa de expiración o
de todas las políticas de sesión. Un cero de salida solo significa que pasaron
los casos automatizados; no certifica el mecanismo ni la aplicación.

## Frontera de confianza

Cuando un operador con **credencial administrativa directa de GoTrue** evitó el
coordinador y cambió la contraseña, la sesión vieja dejó de ver la fila en este
ensayo, pero una sesión nueva obtuvo acceso porque `ready` no se invalidó. Esto
es una limitación reproducida, no una capacidad atribuida al alumno ni al
administrador de producto. El ensayo sí comprobó que la sesión sintética de
alumno no puede invitar usuarios por el endpoint administrativo; todavía no hay
roles del producto ni control de que su administrador use solo vías coordinadas.

La alternativa presupone que todos los resets autorizados pasan por el coordinador
y que el administrador de producto no dispone de credenciales privilegiadas del
proveedor o base. Deben diseñarse y verificarse esas restricciones, incluido soporte
y recuperación. No se promete defensa ante un operador raíz que controla el IdP,
secretos o base; ese actor puede alterar los controles. Tampoco se ha comprobado
que el entorno alojado permita imponer esta separación operativa.

## Reproducción

Ejecutar `node lab.mjs` desde esta carpeta con Node 22 y Docker ya disponible.
Las cuatro imágenes están fijadas por digest en el código y pueden descargarse si
faltan. Se crean red bridge y contenedores `cueva-002f-*` exclusivos sin volúmenes
persistentes; Auth, Mailpit y PostgREST escuchan en loopback y PostgreSQL no publica
puertos. Se generan cuentas y claves sintéticas efímeras. Una persona con control
privilegiado de Docker puede inspeccionarlas durante la prueba; los logs temporales
de Auth se eliminan junto con el contenedor y no se imprimen. `results.json` está
ignorado y la evidencia solo contiene estados. No se utiliza el entorno alojado.

El `finally` elimina únicamente recursos propios. Tras una interrupción forzada,
comprobar su pertenencia antes de limpiar solo los nombres correspondientes;
no reiniciar Docker ni tocar otros proyectos. El RLS usa `SECURITY DEFINER` en
esquema privado, path fijo y permisos restringidos únicamente en esta base de
prueba. La tabla de prueba y los objetos Auth se crean localmente.

Referencias: [sesiones de Supabase](https://supabase.com/docs/guides/auth/sessions),
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[bloqueos PostgreSQL](https://www.postgresql.org/docs/current/explicit-locking.html).
