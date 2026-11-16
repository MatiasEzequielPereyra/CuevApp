# Cambio de correo del alumno

Estado: implementación en la rama \`feature/student-portal-polish\`; pendiente de
CI, auditoría independiente, integración y aplicación local/hosted autorizada.

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

## Validación y límites

La prueba SQL cubre el vínculo Auth-ficha-invitación, permisos internos, cambio
efectivo y rechazo de edición administrativa ordinaria. La prueba de API cubre
origen, formato, rol, normalización, URL de retorno y errores genéricos.

Pendiente antes de aceptar:
1. Ejecutar fresh, upgrade y hosted-compatible con la migración y los tests.
2. Ejecutar lint, typecheck, build, suite completa, seguridad y manifiesto.
3. Verificar que \`/mi-perfil?correo=confirmado\` esté permitido en Redirect URLs
   del proyecto Supabase; no se modifica la configuración alojada desde esta tarea.
4. Probar el envío y confirmación real en un entorno aislado, con Secure email
   change tal como esté configurado.
5. Auditar grants, trigger, errores de unicidad y rollback antes de merge.

No aplicar la migración a Supabase alojado ni cambiar plantillas, SMTP, flags de
Auth o configuración de Redirect URLs desde esta entrega.
