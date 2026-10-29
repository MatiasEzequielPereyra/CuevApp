# CUEVA-002A — Fuentes técnicas de identidad

Consulta inicial: **2026-10-28**, America/Buenos_Aires; se reconsultaron el
2026-10-29 las guías de Custom OIDC, sesiones/SSR, hook previo al alta y el
changelog. Las versiones latest indicadas abajo corresponden a la consulta
inicial; no se afirma que sean latest perpetuos. Investigación pública documental;
sin conexión al proyecto, SQL, instalación ni prueba de autenticación. Supabase
`vbkzoojkdkcugxhneyzi`: **NOT_VERIFIED**. Este apéndice fundamenta la propuesta;
no constituye aceptación ni una prueba de factibilidad del sistema integrado.

## Versiones y trazabilidad

- [Changelog público](https://supabase.com/changelog.md), obtenido por HTTP como
  Markdown: se revisaron entradas de Auth/OIDC/password y breaking changes. La
  entrada [Developer Update — May 2026](https://supabase.com/changelog/45702-developer-update-may-2026)
  menciona custom OAuth/OIDC. La [retirada de cifrados TLS antiguos](https://supabase.com/changelog/cbc-tls-ciphers-deprecated),
  publicada el 2026-10-12 con efecto anunciado para 2026-11-10, es un requisito
  futuro de transporte; no añade un identificador DNI al grant de contraseña.
- [Supabase Auth v2.197.0](https://github.com/supabase/auth/releases/tag/v2.197.0),
  latest público devuelto por GitHub el día de consulta; publicación 2026-09-09.
  Tag resuelto a `4eee58f296d9698a1c2c0ae14d7a0b379c7622d3`. Se inspeccionaron
  archivos fuente en ese commit, sin ejecutarlos. No es la versión verificada
  del servicio alojado ni una dependencia incorporada a CUEVA.
- [Keycloak 26.8.1](https://github.com/keycloak/keycloak/releases/tag/26.8.1),
  latest público devuelto por GitHub; publicación 2026-10-13. Tag resuelto a
  `24ed1dadf3f246a555adb6d3d4a99e9b3003fb3b`. La guía web `latest` es mutable;
  se contrastaron los puntos indicados con código/documentación del commit.
  No se instaló, contrató ni aprobó como proveedor operativo.

## Hechos documentados y corroboración estática

### S01 — Contraseña nativa Supabase

[Password-based Auth](https://supabase.com/docs/guides/auth/passwords) y
[signInWithPassword](https://supabase.com/docs/reference/javascript/auth-signinwithpassword)
describen email+contraseña o teléfono+contraseña. No documentan DNI/username como
credencial de ese grant. En el
[token.go inspeccionado](https://github.com/supabase/auth/blob/4eee58f296d9698a1c2c0ae14d7a0b379c7622d3/internal/api/token.go#L83),
la ausencia de email y teléfono produce un error en la línea 106. Esto descarta
llamar al grant con un DNI arbitrario en un campo nuevo; no demuestra ausencia
de todas las posibilidades federadas del producto.

### S02 — Administración no equivale a login

[createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser)
es API exclusivamente de servidor y advierte sobre la clave privilegiada. El
[admin.go consultado](https://github.com/supabase/auth/blob/4eee58f296d9698a1c2c0ae14d7a0b379c7622d3/internal/api/admin.go#L416)
rechaza crear un usuario sin email ni teléfono. Añadir DNI a metadata/perfiles
no modifica cómo se verifica la contraseña ni genera por sí mismo una sesión.

### S03 — Federación con email opcional y sesión Supabase

[Custom OAuth/OIDC Providers](https://supabase.com/docs/guides/auth/custom-oauth-providers)
documenta `email_optional: true` para permitir login sin email, tanto con OAuth2
como con OIDC. OIDC descubre endpoints y JWKS desde el issuer; el cliente inicia
`signInWithOAuth` con un identificador `custom:`. PKCE del proveedor está activado
por defecto y no debe confundirse con el PKCE de vuelta a la aplicación.
La misma guía limita Free a tres custom providers; no prueba el plan del proyecto.

En [external.go](https://github.com/supabase/auth/blob/4eee58f296d9698a1c2c0ae14d7a0b379c7622d3/internal/api/external.go#L176)
el callback acepta ausencia de emails si `emailOptional` es verdadero; encuentra
o crea la identidad externa, y emite tokens Supabase en su recorrido OAuth. La
decisión de vinculación usa provider y subject externos. La contraseña la verifica
el IdP, no este callback. El código es corroboración estática; no prueba que el
proyecto de CUEVA tenga esa versión, opción o configuración habilitada.

### S04 — Primer acceso federado y alta administrativa

El mismo [external.go, creación de cuenta](https://github.com/supabase/auth/blob/4eee58f296d9698a1c2c0ae14d7a0b379c7622d3/internal/api/external.go#L301)
rechaza crear la cuenta externa cuando `DisableSignup` está activo (líneas
342–345). Por tanto, deshabilitar todo signup y esperar que un usuario DNI-only
nuevo pueda entrar por OAuth sería una contradicción del diseño.

El [Before User Created Hook](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook)
puede inspeccionar el usuario entrante y rechazar la creación. No se debe asumir
que ya existe la fila o que `auth.identities` está insertada: el hook corre antes
de crear al usuario. El payload de ejemplo tiene `identities` vacío.
**Inferencia de diseño:** restringir el alta administrativa en un realm IdP
dedicado y comprobar una autorización privada de aprovisionamiento; la prueba
futura debe demostrar la procedencia confiable del subject, el rechazo de altas
no autorizadas y el tratamiento de carreras. Metadata aportada por un cliente no
es prueba suficiente. La disponibilidad del hook según plan y proyecto no se verificó.

### S05 — Linking y conservación de identidad

[Identity Linking](https://supabase.com/docs/guides/auth/auth-identity-linking)
describe vinculación automática por email coincidente y linking manual desde
una sesión. No se encontró en esa guía un control público que permita declarar
que el linking automático queda desactivado para CUEVA.
**Inferencia:** un único proveedor dedicado y la omisión de email en sus claims
de Auth reducen ese vector; email de acceso/contacto puede permanecer en el IdP
y registro privado. Hay que probar que no se publica por otra vía y que cambiar
username/email conservando subject no crea otra identidad. No transferir
automáticamente historial por coincidencia de email o DNI.

### S06 — Keycloak como verificador maduro candidato

[Guía oficial de administración](https://www.keycloak.org/docs/latest/server_admin/index.html)
documenta contraseñas temporales con cambio obligatorio en el primer login y
perfiles con atributos opcionales configurables. Se debe hacer email opcional
tanto en contexto administrativo como en el de usuario, y revisar las acciones
de perfil/verificación que podrían volverlo obligatorio. El
[perfil en el commit consultado](https://github.com/keycloak/keycloak/blob/24ed1dadf3f246a555adb6d3d4a99e9b3003fb3b/docs/documentation/server_admin/topics/users/user-profile.adoc)
explica el atributo Required y sus contextos.

El [autenticador de username/password](https://github.com/keycloak/keycloak/blob/24ed1dadf3f246a555adb6d3d4a99e9b3003fb3b/services/src/main/java/org/keycloak/authentication/authenticators/browser/AbstractUsernameFormAuthenticator.java)
busca al usuario por nombre o email y luego valida su contraseña. **Inferencia:**
usar DNI normalizado como username cuando existe, permitir login por email único
y usar username interno opaco para cuenta email-only conserva una sola credencial
sin inventar una dirección de correo. El username opaco no es una solución de
Supabase password grant: el IdP real es quien almacena/verifica el secreto.
Renombrar username al agregar/corregir DNI debe conservar ID/subject y requiere
prueba; no equivale a soporte nativo de múltiples alias DNI.

No activar Direct Access Grants como atajo: el flujo de navegador debe completar
las acciones obligatorias antes de entregar el authorization code. No dar a Nico
o al socio privilegios irrestrictos sobre el realm. No aprobar entrega por email,
WhatsApp o cualquier canal por inferencia. La recuperación sin correo necesita
procedimiento humano de comprobación de identidad y entrega acordado.

### S07 — Alternativa: JWT externo directo

[Third-party Auth](https://supabase.com/docs/guides/auth/third-party/overview) y
[Custom OIDC third-party](https://supabase.com/docs/guides/auth/third-party/custom-oidc)
describen aceptar JWT del IdP: issuer HTTPS, firma asimétrica, `kid`, rol
`authenticated` y callback `accessToken` del cliente. **No es** una sesión
Supabase Auth y no debe tratarse como si hubiera `auth.users`/`auth.sessions`
equivalentes. `auth.uid()` castea `sub` a UUID y falla para subjects no UUID;
la autorización debe distinguir al menos `(iss, sub)` por posibles colisiones.
La guía declara que no hay soporte de Custom OIDC third-party en config.toml/CLI.
Requiere revisar integraciones/plan y la operación del IdP; no se configuró ninguna.

### S08 — Sesiones y revocación no son automáticamente transitivas

[User sessions](https://supabase.com/docs/guides/auth/sessions) documenta access
token, refresh token y `session_id`, y advierte que ciertos límites de sesión se
evalúan al refrescar. La federación crea dos ámbitos de sesión. **Inferencia:**
cerrar/revocar en Keycloak no demuestra revocación inmediata de refresh/access
tokens Supabase ni viceversa. La prueba debe cubrir ambos dominios y la aplicación
de una versión de autorización/revocación en servidor y RLS frente a JWT aún
vigentes. No declarar que un logout o cambio de contraseña basta para ese efecto.

### S09 — Sesiones SSR, abuso y autorización

La [guía SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
requiere validar el token y no confiar en getSession para autorización. La
[guía avanzada](https://supabase.com/docs/guides/auth/server-side/advanced-guide)
distingue getClaims de la consulta actual a Auth y explica el modelo de cookies
legibles por el cliente. No se demuestra HttpOnly compatible con un cliente que
necesita leer/refrescar tokens. El [rate limiting nativo](https://supabase.com/docs/guides/auth/rate-limits)
protege endpoints de Supabase, no acredita protección del IdP externo.
La [guía RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
fundamenta revisar políticas de filas/operaciones además de autenticación.
No se seleccionó ni instaló una versión de supabase-js o del SDK SSR para CUEVA;
su versión mínima compatible debe fijarse y probarse en el incremento posterior.

### S10 — Límites de corroboración del cambio temporal

En el código Keycloak fijado,
[UserResource](https://github.com/keycloak/keycloak/blob/24ed1dadf3f246a555adb6d3d4a99e9b3003fb3b/services/src/main/java/org/keycloak/services/resources/admin/UserResource.java)
permite modificar credenciales/acciones desde administración. El
[serializador de credenciales](https://github.com/keycloak/keycloak/blob/24ed1dadf3f246a555adb6d3d4a99e9b3003fb3b/server-spi-private/src/main/java/org/keycloak/models/utils/ModelToRepresentation.java)
no rellena temporary en la representación inspeccionada. Por tanto consultar
acciones vacías o credenciales no basta para acreditar cambio por el alumno.
[UpdatePassword](https://github.com/keycloak/keycloak/blob/24ed1dadf3f246a555adb6d3d4a99e9b3003fb3b/services/src/main/java/org/keycloak/authentication/requiredactions/UpdatePassword.java)
emite eventos de actualización de credencial. Su transporte/correlación confiable
con la operación de alta/reset y la sesión de CUEVA no se probaron; no hay un hook
ya integrado. Esa insuficiencia es el bloqueo E3 del diseño, no un control resuelto.

### S11 — Email pendiente sin imponerlo al alumno DNI-only

El [workflow fijado de actualización de email](https://github.com/keycloak/keycloak/blob/24ed1dadf3f246a555adb6d3d4a99e9b3003fb3b/docs/documentation/server_admin/topics/login-settings/update-email-workflow.adoc)
describe verificación forzada del cambio y cancelación administrativa del pendiente.
[UpdateEmail](https://github.com/keycloak/keycloak/blob/24ed1dadf3f246a555adb6d3d4a99e9b3003fb3b/services/src/main/java/org/keycloak/authentication/requiredactions/UpdateEmail.java)
puede añadir la acción al encontrar EMAIL_PENDING: un login DNI puede quedar
esperando verificación. Probar cancelación que invalide el enlace y quite solo la
acción pertinente, sin eliminar DNI/cuenta, es obligatorio en E4. La documentación
no prueba la operación en CUEVA ni autoriza omitir verificación para destrabarla.

## Conclusión de investigación y evidencia faltante

Hay una **vía documentada candidata**, IdP maduro con username/password más
Custom OIDC `email_optional`; no hay un grant Supabase DNI/password nativo
demostrado. Esto justifica evaluar la arquitectura, **no declarar factibilidad
operativa PASS**. Permanecen NOT_RUN: alta real DNI-only, cambio temporal, login
por ambos identificadores, PKCE, persistencia del UUID, denegaciones con fixtures
no vacíos, carreras, linking, reset y revocación entre sistemas.

Decisiones mínimas para avanzar: aceptar o rechazar un IdP adicional, responsable
operativo, presupuesto/hosting y procedimiento humano de entrega/recuperación;
además, habilitar un entorno aislado con permisos explícitos para las pruebas.
Una licencia abierta del IdP no equivale a costo operativo cero ni autoriza
instalar infraestructura. Los hallazgos de este archivo no modifican el maestro.
