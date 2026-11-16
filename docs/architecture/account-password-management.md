# Gestión segura de contraseñas de cuenta

## Cambio de contraseña propio

Los usuarios con rol `alumno` y `admin` pueden cambiar la contraseña de su propia cuenta desde su área autenticada.

- Se exige sesión vigente, rol permitido y origen de la petición coincidente con el origen configurado.
- Se solicita la contraseña actual, una contraseña nueva de al menos 8 caracteres y su confirmación.
- La contraseña actual se verifica con Supabase Auth mediante un cliente público efímero y sin persistencia automática. Solo si la identidad coincide con la sesión existente, su sesión recién autenticada se transfiere al cliente SSR de la petición para completar el cambio con una autenticación reciente.
- Solo después de esa comprobación, la sesión autenticada actual ejecuta `auth.updateUser({ password })`.
- El flujo no usa service role, no revoca globalmente las sesiones, no modifica tablas de perfiles y no guarda contraseñas en la base de datos.
- Las contraseñas no se escriben en logs ni se devuelven en respuestas.

## Recuperación administrativa de alumnos

La recuperación de la contraseña de un alumno es un flujo separado: el administrador busca la ficha por correo y solicita que Supabase Auth envíe un enlace al correo asociado a la invitación vinculada. La API resuelve la relación ficha-invitación-cuenta Auth y vuelve a comprobar que el usuario destino tenga rol `alumno`. El administrador nunca ve ni define la nueva contraseña; se aplica el mecanismo privado de recuperación de invitaciones.

El envío de invitaciones y recuperaciones continúa sujeto a la configuración de correo del gimnasio. Cuando el entorno está en modo `ownerOnly`, estas operaciones permanecen deshabilitadas hasta completar esa configuración; el cambio de contraseña propio sigue disponible.

## Límites y validaciones

- Longitud nueva: 8 a 1024 caracteres.
- La contraseña actual no puede estar vacía y debe autenticar al mismo usuario.
- La confirmación debe coincidir exactamente con la nueva contraseña.
- No se permite reutilizar la contraseña actual.
- No se modifica correo, rol, ficha de alumno, membresía, pagos ni permisos.
- No requiere migración SQL ni cambios de configuración de Supabase.

## Pruebas

`tests/account-password-change-route.test.mjs` cubre origen, validación de contraseñas, sesión, rol, reautenticación de identidad, cambios para ambos roles y ausencia de uso del service role.
