# CUEVA-002G: acceso con navegador y servicios locales

**REVIEW de prototipo local. Acceso de aplicación y producción: BLOCKED.** Este
incremento es un servidor HTML desechable fuera de Next.js, junto a un laboratorio
reproducible. No modifica el ingreso publicado, no accede a Supabase alojado y no
incluye una migración de producto.

## Flujo observado

Chromium usa una invitación sintética recibida por Mailpit local. El ensayo extrae
el token del mensaje y lo coloca en el enlace del prototipo; la configuración
real de plantilla y envío **no** se prueba. La página exige pulsar «Aceptar» antes
de verificar el token: cargarla o recargarla por GET no lo consume. El servidor
utiliza `@supabase/ssr` y `@supabase/supabase-js` con GoTrue local real; las cookies
de esta prueba son HttpOnly y SameSite=Lax. Una solicitud de origen diferente para
cambiar contraseña recibió 403. El origen HTTP y las cookies corresponden a
loopback, no demuestran la configuración HTTPS ni las defensas finales de CSRF.

La sesión de invitación pudo consultar la ruta, pero RLS devolvió cero registros
antes de fijar contraseña. El formulario hizo el cambio en GoTrue; solo después
de una respuesta exitosa y nueva verificación de usuario el coordinador ejecutó
la función privada de activación. La página mostró una fila propia de prueba;
una segunda fila de otro ID quedó oculta. Cerrar sesión impidió el acceso; clave
incorrecta fue rechazada e ingreso con la elegida volvió a mostrar una fila. La
repetición de la invitación fue rechazada. Auth rechazó el alta pública y un
intento anónimo de invitar. Ver [evidencia redactada](evidence.json).

## Privilegios y límites

La base usa un rol `cueva_coordinator` separado, sin superusuario ni BYPASSRLS,
con ejecución de funciones privadas acotadas y sin lectura ni escritura directa
de la tabla de incorporación. El rol autenticado no puede ejecutar la función
de activación. La configuración inicial y los fixtures usan superusuario local;
el proceso de solicitud usa el rol coordinador, no el superusuario. Las funciones
son `SECURITY DEFINER` con `search_path` fijo y permisos restringidos solo en el
laboratorio. El rol coordinador y el servidor siguen siendo componentes confiables:
una credencial comprometida con acceso a sus funciones no prueba por sí misma que
el alumno haya cambiado la contraseña. Hay que diseñar y auditar los privilegios
y la rotación reales antes de producción.

Se usa el bloqueo advisory y la generación candidata de CUEVA-002F para activar,
pero este prototipo **no implementa ni prueba un endpoint de reset coordinado**,
ni el conjunto completo de escenarios concurrentes de aquella investigación. Un
operador con credencial administrativa directa de GoTrue cambió la contraseña;
la sesión anterior fue rechazada por el servidor, pero una nueva sesión obtuvo
la fila porque la activación no fue invalidada. Esto requiere autoridad del
proveedor: no es una acción atribuida al alumno ni al administrador de producto.
La restricción de vías de operador y el modelo de confianza siguen pendientes;
no se promete defensa frente a quien controla la base o el proveedor.

No se verificaron las rutas y permisos de otros recursos, Storage, revocación y
expiración en todas sus variantes, concurrencia real del producto, cookies HTTPS,
tokens tras un cierre inesperado, recuperaciones, rate limiting, más de una cuenta
realmente autenticada, consola del proveedor, correo real o recepción por alumnos.
No se probó Next.js ni un despliegue de este flujo. La existencia de sesiones en
la tabla de Auth no sustituye validar toda la política de expiración. Los casos
ejecutados no habilitan la aplicación ni garantizan seguridad para producción.

## Reproducción y limpieza

Con Node 22, npm, las dependencias de la raíz instaladas (`npm ci`), Chromium de
Playwright y Docker ya disponibles, ejecutar desde esta carpeta
`npm ci --ignore-scripts` y `node lab.mjs`. Los paquetes de este
experimento están fijados en su propio lockfile. El script puede descargar las
imágenes fijadas por digest si faltan; crea cuatro contenedores y una red bridge
`cueva-002g-*`, sin volúmenes persistentes. Auth, Mailpit, PostgREST y PostgreSQL
publican puertos únicamente en loopback; el servidor y el navegador también son
locales. Se usan credenciales y correos sintéticos efímeros; no se imprimen ni se
guardan en la evidencia. El control privilegiado de Docker permite inspeccionar
variables mientras están activos. Auth conserva logs temporales que se eliminan
con el contenedor; no se imprimen. No se activan trazas ni capturas de navegador.

El `finally` limpia los contenedores y la red exclusivos. Ante interrupción forzada
puede ser necesaria limpieza manual: confirmar pertenencia antes de eliminar solo
esos recursos. No reiniciar Docker ni tocar recursos de otros proyectos.
`results.json` se ignora y el informe versionado contiene estados redactados.
Salida 0 indica que pasaron los casos automatizados, no aprobación de seguridad.

Referencias: [SSR Supabase](https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs),
[plantillas de correo](https://supabase.com/docs/guides/auth/auth-email-templates),
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[sesiones](https://supabase.com/docs/guides/auth/sessions).
