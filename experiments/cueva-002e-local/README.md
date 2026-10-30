# CUEVA-002E: primer acceso y RLS en laboratorio

**BLOCKED para implementación.** Este experimento compara dos controles de
incorporación con GoTrue, PostgreSQL y PostgREST reales y datos sintéticos. No
contiene una migración desplegable, no habilita el ingreso de la aplicación y no
se conecta a Supabase alojado. Sus dos mecanismos presentan fallas demostradas.

## Política común

La tabla `private.onboarding` tiene una fila por usuario, creada directamente
por el harness como sustituto de un alta administrativa que todavía no existe.
La tabla está fuera del esquema que expone PostgREST; los roles de clientes no
tienen permisos para modificarla. La función de política en esquema privado
comprueba el usuario de `auth.uid()` y el estado vigente de esa fila. La tabla
`public.lab_records` aplica RLS tanto a lectura como escritura, exige propietario
y estado habilitado, y contiene únicamente dos filas sintéticas. La función usa
`SECURITY DEFINER`, search_path explícito y permisos de ejecución restringidos;
el diseño de privilegios es experimental, no aprobación para producción.

La sesión emitida al verificar una invitación vio **cero filas**. Un usuario
anónimo recibió 401; una modificación de `user_metadata` no habilitó el acceso;
un intento de modificar la tabla privada vía PostgREST recibió 404. Después de un
procedimiento de prueba exitoso se obtuvo solo la fila propia, y una inserción
para otro usuario recibió 403. Estas observaciones corresponden únicamente a la
tabla y las rutas probadas, no a todas las APIs o datos futuros.

## Alternativa 1: trigger sobre Auth — rechazada

`node lab-trigger.mjs` instala `trigger-experiment.sql` en la base descartable.
El trigger observa cambios en `auth.users.encrypted_password` y activa el estado
privado. La contraseña de un usuario invitado ya tenía un hash no vacío antes de
que eligiera una, por lo que comprobar solo si está vacío no sirve. La comparación
de cambios sí detectó el cambio legítimo, pero también activó el acceso cuando un
administrador cambió la contraseña mediante GoTrue: con el JWT anterior la fila
pasó de cero a una. El resultado esperado de la prueba de seguridad es **FAIL**;
el proceso sale con código 1. Ver [resultado redactado](trigger-evidence.json).
No demuestra que el alumno haya efectuado la operación. Además, depende de un
campo interno del esquema de Auth cuya compatibilidad futura no está garantizada.
No usar este trigger en producción.

## Alternativa 2: servidor coordinador — no aceptada

`node lab.mjs` no instala el trigger. Una función local simula un servidor
confiable: consulta la identidad a GoTrue, comprueba que esté pendiente, actualiza
la contraseña usando la sesión del usuario, consulta nuevamente GoTrue y solo
después actualiza la fila privada desde una conexión privilegiada. El UID proviene
de GoTrue; no se acepta un identificador del cliente. El harness usa superusuario
local para simplificar pruebas: **no es una implementación de servidor ni un
modelo aceptable de privilegios de producción**.

En secuencia, un cambio directo de contraseña sin pasar por el coordinador no
habilitó datos; el procedimiento simulado sí lo hizo, el segundo intento fue
rechazado y un reset administrativo con sesión revocada no habilitó datos.
Sin embargo, al inyectar un reset administrativo **después de la última consulta
de sesión y antes de actualizar la fila privada**, el reset respondió 200, el
coordinador activó la fila y PostgREST mostró una fila usando el JWT previo. La
prueba `concurrent_admin_reset_must_not_activate` es **FAIL**: el proceso sale 1.
No equivale a una prueba de aceptación. Ver [resultado redactado](evidence.json).

La muestra de falla exige una operación administrativa privilegiada durante esa
ventana; no prueba que un alumno tenga privilegios de reset. El experimento tampoco
demuestra que todos los resets reales revocan todas las sesiones o que el JWT
anterior siga utilizable bajo todas las configuraciones. Ambos resultados usan
GoTrue 2.197.0 y PostgREST v16.3 con las imágenes fijadas por digest del harness.

## Condiciones para seguir

Antes de aceptar un mecanismo hay que diseñar y probar cómo serializar o
correlacionar el cambio de contraseña, los resets y la activación, incluso ante
fallas parciales, duplicados y operaciones concurrentes. Todas las vías de reset
autorizadas deben respetar la misma coordinación; hay que tratar explícitamente
los JWT ya emitidos y la revocación. La aplicación debe usar un servidor con el
menor privilegio posible y cerrar accesos directos a las tablas de estado, sin
considerar metadata editable o una respuesta del navegador como prueba.
También faltan pruebas reales de SSR, otros recursos y métodos de escritura, correo,
recuperación, cuenta inicial y configuración alojada. Operadores con control total
del proveedor o de la base requieren un modelo de confianza separado.

## Reproducción y limpieza

Desde este directorio, con Node 22 y Docker ya disponible, ejecutar `node lab.mjs`
o `node lab-trigger.mjs`. Los scripts requieren imágenes fijadas por digest; Docker
puede descargarlas si faltan. Cada ejecución crea red bridge y cuatro contenedores
`cueva-002e-*` sin volúmenes persistentes; las APIs solo se publican en loopback,
Postgres no publica puertos. No interviene en otros proyectos ni reinicia Docker.
Se generan contraseñas y tokens sintéticos efímeros; se descartan junto con los
contenedores y no se registran en la salida ni evidencia. Docker local privilegiado
puede inspeccionarlos durante la ejecución. Auth usa logs temporales para diagnóstico;
el contenedor se elimina al terminar. `results.json` está ignorado.

El proceso normal limpia solo sus contenedores y red. Tras interrupción forzada,
verificar la pertenencia de los nombres antes de limpiar exclusivamente esos
recursos. Las evidencias contienen solo estados y cantidades; cada ejecución
de laboratorio devuelve 1 si detecta la falla de su alternativa.

Referencias: [RLS Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security),
[datos de usuarios](https://supabase.com/docs/guides/auth/managing-user-data),
[sesiones](https://supabase.com/docs/guides/auth/sessions),
[seguridad de contraseñas](https://supabase.com/docs/guides/auth/password-security).
