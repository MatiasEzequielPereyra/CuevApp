# Preparación alojada del acceso — 2026-11-03

**Estructura y configuración aplicadas; ingreso apagado. No hay cuentas creadas.**
Proyecto exacto `vbkzoojkdkcugxhneyzi`, conexión MCP CHAT. Esta preparación no
certifica el flujo autenticado ni la entrega Gmail.

## Migración I

Fuente revisada e integrada en PR15:
[20261102151526_cueva_product_access.sql](../../supabase/migrations/20261102151526_cueva_product_access.sql).
SHA256 de archivo: `8ff25884dbbc8bb2d6fe35b996e5c8afe336856cc329a825d72b7db4463882f3`.
La aplicación mediante MCP devolvió success=true; historial posterior registra
versión **20261103133258**, nombre **cueva_product_access**. La versión alojada
fue generada por el mecanismo; no se afirma que coincida con el timestamp del
archivo de origen. Fue una aplicación actual observada, no adopción histórica.

Precheck: cero tablas de aplicación, cuentas Auth, buckets y migraciones; esquema
privado inexistente, tres roles necesarios presentes, columnas Auth compatibles.
No había datos de aplicación sobre los que efectuar un rollback. Desactivación
prevista: conservar banderas apagadas y preservar estructura/cuentas; sin drops.

Catálogo posterior: RLS activo en ambas tablas, policy SELECT propia por usuario
y gate/sesión; sin INSERT/UPDATE de authenticated ni SELECT de anon en perfiles.
Sin acceso directo al estado privado para authenticated/service_role. Los seis
wrappers públicos son invoker: solo servicio puede ejecutarlos, ni anon ni alumno.
HTTP anónimo con clave publicable: perfiles 401 y preflight con parámetros 401.
Una primera petición sin argumentos de RPC respondió 404 por firma; no se contó
como prueba de autorización. Cuentas y perfiles siguen en cero.

Advisors: una información `rls_enabled_no_policy` en el estado privado, que carece
intencionalmente de policy de acceso directo. No se abrió acceso para silenciarla.
[Descripción del asesor](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
Sin otros avisos en la revisión. Permisos con usuarios alojados: NOT_RUN.

## Configuración guardada

- SMTP Gmail habilitado/guardado por el usuario. No se leyó la contraseña.
- Site URL `https://cueva-gym.vercel.app`; única Redirect URL
  `https://cueva-gym.vercel.app/aceptar-invitacion*`. Verificado al recargar.
- Invite user y Reset password: contenidos exactos de supabase/templates,
  verificados por lectura del campo del editor después de recargar. Asuntos
  Te invitamos a CUEVA y Recuperá tu acceso a CUEVA. No se enviaron correos reales.
  El editor inicialmente anexó contenido a la plantilla anterior; se reemplazó
  por completo y se verificó la versión exacta persistida antes de cualquier envío.
- Vercel Production: URL, clave publicable y origen preparados; CUEVA_SERVICE_KEY
  tipo Secret guardado directamente por el usuario, solo Production. No se exportó
  ni se leyó. Validez de la credencial servidor todavía NOT_VERIFIED.
- Ambas banderas CUEVA_PRODUCT_AUTH_ENABLED y CUEVA_EMAIL_TEMPLATE_READY están
  en 0; no configurar la bandera local en Vercel.

## Siguiente paso concreto

El formulario Invite del dashboard solo permite correo, sin redirectTo, por lo
que no se usó: produciría un enlace sin los parámetros requeridos. Preparar una
operación privada de Vercel con el secreto ya configurado, sin nuevo endpoint ni
descarga de credenciales; ver [CUEVA-002K](CUEVA-002K-task.md). No cambiar el build
normal ni ejecutar una invitación por ese hecho. El alta de Nico, envío y prueba
controlada siguen pendientes de autorización específica y entrada de contraseña
por el usuario. No se reutiliza ninguna contraseña del historial del chat.
