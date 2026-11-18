# Gestión segura de contraseñas de cuenta

## Revalidación sobre el portal publicado — 2026-11-18

Base combinada `38420710c4cdfb1e5a82ecce5fa13cdbf473c508`, PR #64.
Cuenta conserva el inicio del alumno y el panel administrativo publicados.
Mi perfil conserva su encabezado, avatar y tarjeta de datos, y agrega la tarjeta
de seguridad usando los mismos tokens. Ambos resultados de contraseña conservan
sus mensajes; `searchParams` se espera como promesa antes de consultarlo.

Verificación nueva del resultado combinado: 11 pruebas de API, seis de roles y
perfil, tipos, build y lint afectados aprobados. GoTrue, PostgreSQL y Mailpit
reales aislados repitieron el cambio propio de admin y alumno, el rechazo de
contraseña actual incorrecta/anterior y la recuperación desde el enlace real.
La contraseña elegida habilitó la sesión. Ante SMTP 550: HTTP 503, ningún correo,
gate cerrado, reset reservado y segundo pedido HTTP 409. El ensayo verifica el
formulario protegido real en vez de buscar el texto anterior de la pantalla.

Entorno local con CLI `2.122.1`, nombres y red exclusivos de CUEVA y puertos
publicados explícitamente en `127.0.0.1`. Credenciales efímeras y correos
`example.test`; no se conservan en evidencia ni Git. No se interviene en los
contenedores de Vendify. La integración alojada de los flujos continúa
`NOT_VERIFIED`; el HEAD definitivo, CI y auditoría se registran en el PR.

SKILLS_SELECTED / SKILLS_APPLIED: `cueva-feature-development`,
`cueva-supabase-security`, `supabase:supabase`, `resolving-merge-conflicts`,
`vercel:react-best-practices`, `cueva-acceptance-audit`, `code-review` y `pr`.
SKILL_SOURCES: `.agents/skills/<nombre>/SKILL.md` y guías del host.

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

El ensayo `tests/e2e/account-password-management.integration.mjs` usa Next.js,
GoTrue y PostgreSQL locales. Confirmó el cambio propio de ambos roles, el rechazo
de una contraseña actual incorrecta, el rechazo de la contraseña anterior y el
inicio de sesión con la nueva. La recuperación tomó el token y los parámetros del
correo real de GoTrue recibido en Mailpit, los presentó al POST de CUEVA y
completó la elección de contraseña. El alumno quedó habilitado y la credencial
anterior dejó de autenticar. Las cinco pruebas existentes de navegación y roles
del portal pasaron con y sin `searchParams` según sus respectivas rutas.

En una segunda corrida, Mailpit devolvió SMTP 550 al destinatario después de
adquirir el reset. GoTrue respondió 500 y CUEVA devolvió 503. El correo no llegó,
la ficha continuó vinculada, el gate quedó cerrado con la operación `reset`
reservada y el reintento recibió 409. La sesión anterior perdió acceso al portal.
El procedimiento existente deja esta generación cerrada para conciliación
operativa. Requiere determinar el resultado del envío y confirmar que no queden
llamadas de Auth en curso antes de decidir cómo recuperar el acceso.

Para reproducir, configurar el stack de integración del repositorio con Mailpit
aislado y exportar `API_URL`, `DB_URL`, `CUEVA_SERVICE_KEY`,
`CUEVA_PRODUCT_ORIGIN` y `MAILPIT_URL` por el entorno privado. Ejecutar
`node tests/e2e/account-password-management.integration.mjs`. Para el caso de
rechazo, configurar el SMTP de ese GoTrue para usar un receptor Mailpit aislado
con `MP_CHAOS_TRIGGERS=Recipient:550:100` y repetir con
`CUEVA_TEST_RECOVERY_REJECTED=1`. Mantener el API HTTP de Mailpit accesible para
comprobar que la bandeja no recibió el mensaje. El ensayo usa usuarios efímeros
y no envía mensajes a proveedores reales.
