# Cambio de correo del alumno

Estado REVIEW. El flujo y la migración se probaron en el entorno local aislado.
La integración y aplicación alojada quedan a cargo del Orchestrator.

## Contrato

- Solo una cuenta autenticada con rol \`alumno\` puede solicitar el cambio desde
  \`/mi-perfil\`.
- La API valida el origen, valida el formato y vuelve a comprobar identidad y rol.
  Usa la sesión del alumno con \`auth.updateUser({ email }, { emailRedirectTo })\`;
  no utiliza la clave de servicio ni acepta un identificador de alumno del cliente.
- La dirección actual permanece como correo de acceso hasta que Supabase Auth
  complete la verificación y cambie \`auth.users.email\`.
- El modo Secure email change de Supabase puede exigir confirmación tanto en la
  dirección actual como en la nueva. La aplicación no cambia esa configuración.
- La pantalla muestra el éxito solo si `getUser()` devuelve el correo
  confirmado que se solicitó para esa identidad. La solicitud aceptada genera
  un comprobante firmado, `HttpOnly`, acotado a Mi perfil y con vigencia de
  24 horas. El parámetro `correo=confirmado` por sí solo jamás acredita el
  cambio. Si se abre el correo en otro navegador, el visitante debe ingresar
  con su dirección vigente para ver el correo actual en el perfil.
- Nombre, apellido y DNI siguen siendo de administración. No se agrega teléfono,
  contraseña editable ni permiso de actualización general sobre \`cueva_students\`.

## Sincronización de identidad

La migración \`20261116130000_cueva_student_email_sync.sql\` agrega un trigger
interno sobre el cambio efectivo de \`auth.users.email\`. Solo entonces actualiza,
en la misma transacción, \`cueva_students.email\` y
\`cueva_student_invitations.email\` para el \`user_id\` ya vinculado.

La función está en \`cueva_private\`, usa \`SECURITY DEFINER\` con
\`search_path = ''\`, no concede ejecución a roles de aplicación y no permite
asociar una cuenta por coincidencia de correo. La protección existente que
congela el correo de una invitación sigue bloqueando ediciones ordinarias; el
trigger usa una marca de transacción acotada y la restaura antes de finalizar.
Si la sincronización falla (por ejemplo, una colisión con otra ficha), la
transacción de Auth también falla: no se acepta una identidad desincronizada.

## Evidencia local

La prueba SQL cubre el vínculo Auth-ficha-invitación, permisos internos, cambio
efectivo y rechazo de edición administrativa ordinaria. La prueba de API cubre
origen, formato, rol, normalización, URL de retorno y errores genéricos.

Con GoTrue y PostgreSQL reales, confirmaciones habilitadas y Secure email change,
Mailpit recibió los dos enlaces. El primero dejó las tres direcciones anteriores
vigentes y la UI sin mensaje de éxito. El segundo actualizó `auth.users`, la ficha
y la invitación vinculada en la misma transacción. La UI mostró la confirmación
y se pudo ingresar con el correo nuevo. Visitas manuales a la URL y un
comprobante adulterado omitieron el mensaje. La prueba SQL pasó 8/8.

Para repetir el flujo real usar el stack local del repositorio con
`auth.email.enable_confirmations=true`, `auth.email.double_confirm_changes=true`
y el origen local en Redirect URLs. Aplicar la migración local y ejecutar
`node tests/e2e/student-email-change.integration.mjs` con `API_URL`, `DB_URL`,
`CUEVA_SERVICE_KEY`, `CUEVA_PRODUCT_ORIGIN` y `MAILPIT_URL` en el entorno privado.

## Orden operativo para publicación

1. Integrar el #64 y actualizar esta rama desde `main`. Verificar en el HEAD
   resultante las pruebas de roles, confirmación y contraseña, el build y la
   matriz de migraciones. Auditar el trigger y los grants antes del release.
2. Verificar en el proyecto alojado el historial, las migraciones base de acceso,
   alumnos e invitaciones, el backup, la plantilla de cambio de correo y la URL
   canónica permitida `/mi-perfil?correo=confirmado`. Confirmar si se requieren
   ambas confirmaciones. La URL puede llevar parámetros adicionales de Auth.
3. Con autorización de operación, aplicar únicamente
   `20261116130000_cueva_student_email_sync.sql` registrando la versión alojada real.
   El SHA-256 del SQL es
   `3dc84045aec40ba292bb07ca7c9427d26f9f24591a6bcf6c7c667e8df0293bcb`.
   Comprobar que el trigger `cueva_sync_student_email_after_auth_change` está
   activo, que los roles de aplicación carecen de ejecución sobre su función
   privada y que una colisión no deja la identidad a medio sincronizar.
4. Publicar el código del #63 después del postflight de esquema. Coordinar el
   merge si el branch `main` publica automáticamente. Probar dos enlaces con una
   ficha autorizada y comprobar la dirección en Auth, ficha e invitación.
5. Ante un incidente, volver al deployment previo y conservar los correos ya
   sincronizados. Antes de retirar el trigger, conciliar verificaciones que aún
   puedan completarse. Una reversión de esquema requiere una migración revisada
   que también restaure el guard de ficha anterior.

No aplicar la migración a Supabase alojado ni cambiar plantillas, SMTP, flags de
Auth o configuración de Redirect URLs desde esta entrega.
