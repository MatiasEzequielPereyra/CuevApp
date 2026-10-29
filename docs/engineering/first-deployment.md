# Primer despliegue de CUEVA

Registro: 2026-10-29. ORCHESTRATOR CUEVA. Alcance: publicar la fundación ya
aceptada y preparar configuración pública del backend, sin implementar Auth.

## Decisión y destino

El usuario declaró expresamente que CUEVA es un proyecto personal no comercial,
autorizó Vercel en el plan actual y propuso cueva-app/cueva-gym/cuevapp-gym.
Esta aclaración resuelve el bloqueo de hosting del checkpoint anterior. No se
contrató Pro ni dominio pago. Las fuentes maestras originales no se modifican.

- Repositorio: MatiasEzequielPereyra/CuevApp; producción: main.
- Team: team_cJL8jHMV3R0hsr8C0kOkznph (Hobby).
- Proyecto: cueva-app; ID prj_IuCNdIG2xpwWNgizkrF1kbP1wMPa.
- URL principal: https://cueva-gym.vercel.app
- Dominio asignado inicialmente: cueva-app-zeta.vercel.app; también conservado.
- Deployment: dpl_A3dSnkuytkg85zaY9cirHyezUJFn, target production, READY.
- SHA: 535ff7fade52aa1380f1769dbbd76afcb7b798fa, main verificado y CI aprobado.
- Framework: Next.js; Node 22.x; build completado en 29 s según Vercel.

El mensaje inicial del conector lo llamó preview; get_deployment confirmó target
production. La evidencia de API prevalece para clasificar el deployment.
El listado específico de dominios confirmó cueva-gym.vercel.app verificado.

## Verificación

- Página principal y /brand/cueva-symbol.svg: HTTP 200; SVG con MIME image/svg+xml.
- Navegador sobre el dominio público: contenido CUEVA, logo, aviso de construcción,
  anclas y selector de tema presentes. Selección Oscuro cambia su estado correctamente.
- Build remoto sin error; logs recientes de error/fatal no devolvieron entradas.
  Es una observación limitada a esa ventana, no monitoreo continuo.
- No se certifican aún login, pagos, tablas, permisos o PWA offline.

## Supabase: configuración preparada, aplicación aún sin integración

El usuario inició sesión en el navegador integrado. Se observó el proyecto exacto
vbkzoojkdkcugxhneyzi, Healthy, región Canada Central, sin migraciones según dashboard.
Los dos conectores MCP siguieron denegados; la sesión del navegador no cambia esos
permisos. La lectura de Auth settings con clave publishable devolvió HTTP 200.
Esto prueba acceso al endpoint, no un login de alumno ni políticas de datos.

En Vercel se guardaron y se verificó la presencia de:

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

Solo target production; las previews no recibieron acceso al proyecto de datos.
La clave es pública, no una clave administrativa. No se guardaron contraseñas,
service_role, cadenas de conexión ni claves secretas. Valores omitidos del registro.
La configuración fue guardada después del primer build y se aplicará a nuevos
builds. El código de la fundación no usa todavía estas variables.

Cliente Supabase, autenticación de la aplicación, modelo de datos y RLS: pendientes
de implementación y revisión. No hubo SQL, migraciones ni creación de usuarios.

## Operación desde ahora

Git integration conecta el repositorio y main como rama de producción. Cada merge
aprobado debe generar un deployment nuevo; verificarlo sin duplicar despliegues.
Mantener CI y auditoría del HEAD antes del merge, incluso cuando no haya una regla
remota que lo impida automáticamente. Las previews conservan protección predeterminada.

Ante fallo crítico: detener merges, inspeccionar logs y restaurar un deployment
verificado mediante el procedimiento de Vercel. Este primer deployment es el
candidato inicial; no se ejecutó rollback como prueba ni se promete recuperación
inmediata de datos futuros. El historial de despliegues no reemplaza backups.

La rama local CUEVA-002A estaba en uso por el ejecutor; esta documentación se
preparó en un worktree separado, sin alterar su trabajo. La siguiente investigación
sigue siendo DNI/email; ninguna opción de identidad externa fue adoptada aquí.
