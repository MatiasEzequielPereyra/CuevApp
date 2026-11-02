# CUEVA-002H — Integración local de acceso en Next.js

Implementar en Next.js real el flujo de correo/invitación, aceptación explícita,
elección de contraseña, ingreso y salida, con SDK oficial SSR y autorización
servidor/RLS. Leer las guías de Next instaladas y documentación Supabase actual.
Correo obligatorio, altas administrativas; invitación sustituye contraseña temporal.

Verificar localmente con Auth/PostgREST/Postgres y navegador reales: dos alumnos,
aislamiento de datos antes y después del alta, rechazo de acceso anónimo, replay,
origen cruzado, contraseñas erróneas, sesión inválida y cierre de sesión. Los
experimentos anteriores aportan evidencia, no código aprobado para copiar.
Aplicar mínimo privilegio y separar administrador de gimnasio de operador raíz
confiable del proveedor. No prometer resistencia a quien controla la base o secretos.

Crear checkout propio; no alterar trabajo ajeno ni contenedores de otros proyectos.
Solo recursos locales exclusivos loopback y fixtures sintéticos. No crear usuarios
reales, modificar Supabase alojado o Vercel ni activar ingreso productivo. Por
defecto el despliegue conserva acceso deshabilitado. Sin secretos en código o logs.
Entregar commit local y handoff, pruebas y límites explícitos; sin push ni deploy.
Si algún control no se demuestra, mantenerlo BLOCKED y no simular autenticación.
