# CUEVA-AUTH-SELF-REGISTRATION-001 — Registro personal por correo

**Fecha:** 2026-11-20  
**Estado:** implementación en rama aislada, sujeto a auditoría y pruebas; **NO ACTIVADO EN PRODUCCIÓN**  
**Base inicial:** `e9dffe16de5ae76eb01eb24b4de490dd3e33b806`  
**Rama:** `feature/cueva-self-service-registration-001`

## Decisión posterior de producto

El alumno debe poder ir a **Registrarse** desde el login, elegir nombre, apellido, correo y contraseña y recibir **automáticamente** en ese buzón un correo de confirmación de CUEVA, sin que Nico tenga que enviar la invitación administrativa. Se conserva el ingreso de los alumnos ya invitados y la administración exclusiva de cuotas, rutinas y pagos.

El correo enviado es una **confirmación de registro por Supabase Auth**; no se falsea una invitación administrativa ni se crea una cuenta con permisos por introducir un email.

## Diseño y seguridad

- `CUEVA_SELF_REGISTRATION_ENABLED=1` es opt-in en servidor y solo válido con el correo personalizado habilitado. Por defecto no aparece el enlace y el endpoint devuelve 404.
- `/registrarse`: nombre, apellido, correo, contraseña y confirmación. POST `/api/acceso/registrarse` verifica Origin, tipo/tamaño de cuerpo y formato de campos. Solo llama `auth.signUp` con la clave **publicable**, sin exponer credenciales privilegiadas. Supabase envía un correo de confirmación con `emailRedirectTo` fijo. El resultado no revela si una cuenta ya existía.
- `/confirmar-registro`: solo acepta token_hash de tipo `signup`; verifica OTP en Auth, valida la sesión y llama a la función transaccional a través de un helper **server-only**. Token no aparece en páginas HTML ni en URL final.
- La migración añade `cueva_private.complete_self_registration(user_id,session_id)`; solo se expone mediante wrapper `public.cueva_complete_self_registration` con `EXECUTE` exclusivo para `service_role`. El servidor comprueba el JWT mediante `auth.getUser(access_token)`, el `session_id` del token y la identidad exacta. PostgreSQL vuelve a comprobar una sesión real de `auth.sessions`.
- La función requiere `email_confirmed_at` y `confirmation_sent_at`; rechaza una cuenta auto-confirmada sin correo, un usuario ya vinculado, una identidad admin y una ficha cuyo correo coincide con el introducido. **No enlaza automáticamente una ficha existente por correo**; devuelve `needs_review` sin revelar sus datos.
- Solo para una cuenta nueva, crea una ficha privada **inactiva**, un enlace inmutable por UUID en `cueva_student_invitations` con estado `self_registered`, `cueva_profiles(role='alumno')` y un gate de sesión preparado. La creación es atómica y serializada contra el usuario Auth; reintentos no crean dos fichas. Sin permiso para autoasignarse rol admin ni modificar pagos/rutinas.
- El administrador ve `Registro personal confirmado` y no dispone de un botón de invitación para esa cuenta; puede conservar los procesos administrativos de pagos y, si es elegible, recuperación de contraseña.

## IMPORTANTE: fichas y cuentas preexistentes

Una ficha administrativa anterior creada por Nico podría compartir el correo elegido. Por privacidad, el nuevo registro **NO toma posesión de esa ficha**. La cuenta queda pendiente de conciliación, y deberá diseñarse un vínculo administrativo auditado por UUID, con verificación de identidad, control de duplicados e historial. El requisito de no enviar invitaciones no implica permiso de apropiarse de datos de alumnos anteriores.

## Requisitos operativos previos a habilitarlo

1. Auditoría independiente del PR, suite Verify foundation (lint/ts/build/tests) y migraciones **fresh, upgrade y hosted-compatible**, incluidas pruebas negativas de acceso y regresión del login/invitaciones anteriores.
2. Verificar el proyecto Supabase **CUEVAPP** correcto. Hacer preflight, registro de respaldo/rollback y aplicar la migración **solo tras autorización**. No modificar datos históricos.
3. En Supabase Auth, mantener el inicio de sesión por Email; permitir signups y exigir **Confirm email**. No habilitar autoconfirmación. Configurar el SMTP autorizado de Brevo y remitente/dominio del gimnasio, así como límites de correo, antifraude/CAPTCHA cuando corresponda.
4. Instalar la plantilla **Confirm signup** desde `supabase/templates/confirmation.html` (no confundir con Invite). El template debe construir `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=signup`. Validar el HTML/escape correcto.
5. Ajustar **Site URL** y allowlist de redirects a `https://cueva-gym.vercel.app/confirmar-registro` exactamente; no permitir previews por comodidad. Confirmar la prueba de un correo real con una cuenta sintética autorizada y un primer acceso completo, antes de permitir público.
6. Recién después establecer `CUEVA_SELF_REGISTRATION_ENABLED=1` en la configuración **Production** de Vercel y desplegar la configuración. Sin ese paso, el login habitual continúa, y el registro público sigue apagado.

## Pruebas y negativos

- Unit tests: registro anónimo sin service key, CSRF Origin, límites de campos, contraseña, duplicado no enumerable, fallo del proveedor, autoconfirmación no permitida; enlace inválido, verificación negativa y usuario en estado `needs_review`; session_id JWT inválido y bloqueo de RPC.
- pgTAP: `anon` y `authenticated` no pueden ejecutar el writer privilegiado, usuario no confirmado/auto-confirmado rechazado, rol admin intocable, coincidencia de ficha no vinculada, ficha nueva inactiva y privada, UUID propio, idempotencia, permisos sin leer otras fichas.
- Playwright: login presenta Registrarse solo cuando está habilitado, registro contiene campos propios y mensaje genérico, estados deshabilitados y pantalla de vuelta al ingreso.
- Pruebas alojadas con usuarios reales: **NOT_RUN** hasta autorización y activación manual.

## Rollback

Conservar la función de negocio desligada mediante `CUEVA_SELF_REGISTRATION_ENABLED` apagado ante fallos. No borrar ni reescribir cuentas ni fichas creadas. La migración es aditiva; una corrección posterior deberá preservar el estado `self_registered` y sus vínculos históricos. No revertir SQL destructivamente en producción.

SKILLS_SELECTED: `cueva-feature-development`, `cueva-supabase-security`, `cueva-architecture`, `supabase:supabase`.  
SKILLS_APPLIED: lectura de código/migraciones reales, revisión read-only del proyecto Supabase conectado, diseño de gate de sesión/UUID, tests de permisos y flujos negativos, rama aislada.  
SKILL_SOURCES: `.agents/skills/cueva-feature-development/SKILL.md`, `.agents/skills/cueva-supabase-security/SKILL.md`, `.agents/skills/cueva-architecture/SKILL.md`, `skills://plugins/supabase/supabase/skill.md`, `AGENTS.md`.


## Actualización de integración — 2026-11-24 — REVIEW

Base incorporada: `425e23aa3e5d28a1d2ba08c41084e5bba021f297`.
Candidato recibido: `1526fc71886cb5a21b073ae9c5166ef695e6682b`.
Único conflicto en `package.json`: la lista de pruebas conserva tanto
`test:self-registration` como `test:routines:video-source` de main. Sin cambios
en Auth, gates, invitaciones, perfil, SQL ni configuración operativa.
`CUEVA_SELF_REGISTRATION_ENABLED` sigue opt-in y apagado por defecto.

Verificación local nueva sobre el árbol combinado: registro 14/14, contraseñas
11/11, correo 6/6 y video-source 6/6; navegador Chromium 51/51
(self-registration, student-portal, access-form y access-preview); lint, tipos y
build aprobados. Documentos, fuentes y seguridad se ejecutan antes del commit.
CI del HEAD final se registra en el PR; las corridas del candidato anterior no
certifican esta actualización. Sin registro público, correo, flags ni SQL alojados.

SKILLS_SELECTED / SKILLS_APPLIED: `cueva-feature-development`,
`cueva-supabase-security`, `resolving-merge-conflicts`, `supabase:supabase`.
SKILL_SOURCES: `.agents/skills/cueva-feature-development/SKILL.md`,
`.agents/skills/cueva-supabase-security/SKILL.md` y guías correspondientes del host.
