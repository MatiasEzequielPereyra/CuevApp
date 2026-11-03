# CUEVA-002J — operación candidata del acceso

Paquete para revisión local. **No aplicar por leer este documento.** El acceso
público sigue apagado, sin cuentas reales ni migración alojada aplicadas por el
ejecutor. Las comprobaciones locales no acreditan entrega por Gmail ni Supabase
alojado. No se agrega una ruta web de bootstrap ni una capacidad pública nueva.

## Correo exacto

Los archivos [invite.html](../../supabase/templates/invite.html) y
[recovery.html](../../supabase/templates/recovery.html) contienen las plantillas
exactas, respectivamente para **Invite user** y **Reset password**. No usar
`ConfirmationURL`, pues el producto debe consumir el token en su propio POST.
GoTrue renderiza `.RedirectTo` y `.TokenHash`; el navegador decodifica el escape
HTML sin transformar el enlace en el ensayo.

Configuración candidata para producción:

- Site URL: `https://cueva-gym.vercel.app`.
- Redirect URL: `https://cueva-gym.vercel.app/aceptar-invitacion*`.
- Los enlaces emitidos por el script y la aplicación usan exclusivamente
  `/aceptar-invitacion` con `nonce`, `generation` y `type`; la plantilla agrega
  `token_hash`. El comodín restringe host y prefijo, no constituye un validador
  exacto de todas las rutas. No habilitar comodines de dominio ni previews.
- Un enlace sin alguno de esos parámetros, con otro origen/ruta, o con caída al
  Site URL no demuestra incorporación. Mantener el acceso apagado ante ese fallo.

El ensayo local comprueba la ruta completa, los parámetros, el texto que distingue
la plantilla personalizada y el ingreso desde el `href` realmente renderizado.
La prueba de origen externo verifica que ese origen no se conserva; no demuestra
que GoTrue rechace cualquier otra ruta del mismo dominio. Deben comprobarse otra
vez las dos plantillas en el panel alojado y en el correo entregado, evitando logs,
capturas o archivos con enlaces completos. El correo incluye capacidades de acceso.

## Primer administrador

[access-operations.mjs](../../scripts/access-operations.mjs) es un script de
operador confiable, fuera de la aplicación. Su CLI admite únicamente el proyecto
`vbkzoojkdkcugxhneyzi`, el origen anterior y conexión directa TLS verificada a
`db.vbkzoojkdkcugxhneyzi.supabase.co/postgres`; no admite pooler ni otro
proyecto por inferencia. El procedimiento requiere el puerto 5432; el validador
del script comprueba host/protocolo/ruta, pero no restringe el puerto. El operador
debe verificarlo antes de aplicar. Solo acepta credenciales y correo mediante entorno del
proceso, sin archivos `.env`, contraseñas de argumentos ni valores en el repo.

Comandos sin efectos de red por defecto:

```sh
node scripts/access-operations.mjs invite-first-admin
node scripts/access-operations.mjs promote-first-admin
```

`--apply` permite la acción indicada y exige entorno completo. No ejecutarlo en
producción hasta la revisión y el plan de aplicación del Orchestrator. El script
no conoce el correo real de Nico ni una contraseña de alumno. Cada persona elige
su contraseña desde el correo; no existe contraseña temporal predeterminada.

Variables exclusivas de la sesión del operador:

| Variable | Uso |
| --- | --- |
| `CUEVA_SUPABASE_URL` | URL exacta del proyecto |
| `CUEVA_PRODUCT_ORIGIN` | Origen exacto del producto |
| `CUEVA_SERVICE_KEY` | Secreto de servicio, nunca público |
| `CUEVA_OPERATIONS_DATABASE_URL` | Conexión privilegiada directa con TLS verificado; nunca en Vercel/app |
| `CUEVA_FIRST_ADMIN_EMAIL` | Correo esperado de Nico, verificado fuera del repositorio |
| `CUEVA_FIRST_ADMIN_UUID` | UUID exacto devuelto por la invitación, obligatorio para promoción |

El dry-run valida destinos y formato y describe acción/origen sin consultar red.
La conexión puede declararse sin contraseña para ese plan; apply necesita acceso
real. Introducir secretos mediante el mecanismo seguro del operador, sin historial
del shell, chat ni archivo persistente; retirarlos del proceso al terminar.

Procedimiento:

1. Poner los escritores administrativos en mantenimiento exclusivo: no otras
   ejecuciones, cambios desde dashboard ni altas simultáneas. Signup público
   permanece cerrado. El advisory lock serializa este script, no otros operadores.
2. Ejecutar dry-run y verificar proyecto, origen y acción. Invite exige que tanto
   Auth como perfiles estén vacíos; si hay una cuenta huérfana, se detiene.
3. Ejecutar una sola invitación autorizada. El script no reintenta: devuelve UUID
   cuando confirma creación y estado preparado. Ante error, timeout o resultado
   incierto, comprobar Auth/estado/correo antes de cualquier otra acción. Una segunda
   ejecución sobre una cuenta creada se detiene sin reenviar. No borrar para repetir.
4. Nico acepta y elige contraseña. Verificar que su cuenta activa aún es alumno.
5. Fijar UUID y correo esperado en entorno y revisar el dry-run de promoción.
   La promoción bloquea las filas pertinentes y exige una única cuenta/perfil,
   rol alumno, gate activo, sin operación y una fila de sesión existente creada
   después del corte. No comprueba expiración de esa fila ni acredita por sí sola
   una sesión actualmente válida; eso se verifica mediante Auth y la prueba real.
   Cambia una sola fila a admin dentro de transacción; cualquier
   precondición fallida revierte. Una repetición se rechaza, no duplica roles.
6. Verificar sesión real y perfil admin. Conservar solo UUID, filas afectadas y
   resultado redactado, sin tokens ni contraseña. Terminar mantenimiento y retirar
   la credencial operativa. La cuenta administrador del gimnasio no recibe secretos.

El usuario ya configuró `CUEVA_SERVICE_KEY` como Secret de Production en Vercel,
según el Orchestrator. Eso no entrega la clave al ejecutor ni al Orchestrator local.
No descargarla ni pedir que se comparta; la ejecución alojada deberá realizarse
por un operador autorizado o un procedimiento equivalente revisado con UI/MCP.

## Operaciones interrumpidas

El estado durable no caduca ni se reasigna por tiempo. Un error tras adquirir la
operación mantiene la cuenta cerrada. No ejecutar un `finish` a ciegas ni marcar
ready aunque la contraseña parezca haber cambiado.

Antes de reconciliar hay que detener el ingreso de nuevas solicitudes y demostrar
que ninguna petición anterior a Auth puede seguir escribiendo. Un checkbox o
esperar unos minutos no lo demuestra. El ensayo controla un entorno exclusivo:

1. Crea una operación reset interrumpida antes de enviar una petición a Auth.
2. Detiene el único proceso Next y el contenedor Auth y verifica su estado detenido.
3. En su base desechable exclusiva termina las conexiones postgres restantes del
   proveedor, excluyendo la propia, y verifica que no quedan. PostgREST usa otro rol.
4. Bloquea la fila esperada; elimina sesiones de ese alumno e invalida generación,
   nonce y sesión autorizada. Solo entonces limpia el identificador de operación.
   La cuenta queda cerrada y requiere una recuperación administrativa nueva.
5. Comprueba gate cerrado, generación aumentada y ausencia de perfil para la sesión
   anterior. No se infiere disponibilidad del proveedor ni reapertura automática.

**Esto no es un comando de reconciliación alojada.** El ejecutor no dispone de
control para parar Supabase Auth alojado ni demostrar que sus escritores están
quiescentes. Ese procedimiento permanece **NOT_RUN**. No transportar la técnica
de terminar procesos/conexiones al proyecto alojado. Allí, mantener la cuenta
cerrada y escalar a un operador con control verificable del proveedor; si no puede
acreditar quiescencia, no liberar el lock. El script no incluye opción de saltar
este control, ni timeout de reapertura.

## Plan de aplicación separado

1. Fijar SHA y hash de la migración I; confirmar proyecto exacto, inventario actual
   de tablas/migraciones/usuarios y ausencia de datos de aplicación previos. Si el
   inventario cambió, parar y reevaluar compatibilidad y recuperación.
2. Mantener ambos opt-ins apagados. Aplicar una sola vez la migración revisada por
   el mecanismo de migraciones; ante resultado ambiguo, inspeccionar catálogo e
   historial antes de repetir. No ejecutar SQL experimental.
3. Verificar RLS en perfiles/estado privado, SELECT solo propio del autenticado,
   ausencia de escritura de cliente y RPC privilegiados solo para servicio. Revisar
   advisors y comprobar permisos reales con cuentas sintéticas controladas; ninguna
   bandera sustituye estas pruebas. Retirar cuentas de prueba por procedimiento
   aprobado, sin borrar históricos de usuarios reales.
4. Guardar las plantillas y URLs exactas; verificar SMTP sin leer su contraseña.
   Probar entrega con un correo controlado autorizado. No enviar a alumnos reales
   como prueba ni registrar enlaces completos.
5. Revisar cuenta inicial y bootstrap. La prueba alojada debe validar HTTPS,
   cookies, primer acceso, reset, sesión anterior y aislamiento de dos cuentas;
   las pruebas locales no se contabilizan como aceptación alojada.
6. Solo después de pruebas alojadas aceptadas, decidir habilitación. Ante fallo,
   apagar `CUEVA_PRODUCT_AUTH_ENABLED`, generar un despliegue y verificar que las
   rutas de acceso responden cerradas. Preservar tablas/usuarios/datos y registrar
   SHA de retorno; no usar drops como rollback. La desactivación de aplicación no
   revoca por sí misma los tokens del proveedor: la RLS sigue siendo obligatoria.

## Checklist Vercel

Configurar directamente en Production del proyecto `cueva-app`:

- `CUEVA_SUPABASE_URL`, `CUEVA_PUBLISHABLE_KEY`, `CUEVA_PRODUCT_ORIGIN`: valores
  exactos revisados del proyecto/origen. Las variables `NEXT_PUBLIC_...` anteriores
  no satisfacen esos nombres del candidato.
- `CUEVA_SERVICE_KEY`: Secret servidor; ya guardado por el usuario, no leerlo.
- `CUEVA_PRODUCT_AUTH_ENABLED` y `CUEVA_EMAIL_TEMPLATE_READY`: conservar apagados
  hasta aceptación alojada. No definir `CUEVA_PRODUCT_AUTH_LOCAL` en Vercel.
- No subir `CUEVA_OPERATIONS_DATABASE_URL`, correo/UUID de bootstrap ni claves SMTP
  a la aplicación. El SMTP se configura en Supabase, no en el bundle web.
- Comprobar metadatos sin valores secretos, despliegue/commit exactos y estado
  cerrado. No descargar envs a archivos ni imprimir secretos para verificar.

Fuentes consultadas el 2026-11-03:
[plantillas autoalojadas](https://supabase.com/docs/guides/self-hosting/custom-email-templates),
[plantillas Auth](https://supabase.com/docs/guides/auth/auth-email-templates),
[Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).
Se revisó el changelog; la retirada anunciada de cifrados TLS CBC a partir del
10 de noviembre no altera este ensayo local con Node moderno:
[aviso oficial](https://supabase.com/changelog/cbc-tls-ciphers-deprecated).
