# CUEVA-002I — Candidato de acceso productivo

Preparar implementación revisable en Next.js de acceso por correo, invitación,
elección de contraseña, cuenta y gestión de altas exclusivamente administrativa.
Correo obligatorio; cada alumno elige su clave desde una invitación. Preservar
el cierre por defecto hasta pruebas alojadas aceptadas. El laboratorio H no se
habilita mediante bandera ni se copia como SQL de producción.

## Controles y entrega

- SDK SSR oficial; secreto de servicio solo servidor. No usar pg ni conexión
  superusuario en la aplicación. Privilegios de administrador del gimnasio
  separados del operador confiable de Supabase.
- Estado privado con autorización servidor/RLS y usuario/sesión vigente. Invitación
  o recuperación vinculadas a generación y sesión autorizada; tokens antiguos,
  metadata editable y login ordinario no habilitan el primer acceso.
- Exclusión durable de operaciones autorizadas de cambio/reset y manejo cerrado
  de resultados ambiguos. Sin liberar locks por timeout mientras pueda continuar
  una operación vieja. No prometer serializar APIs internas del proveedor.
- Pruebas reales locales con dos alumnos, admin, navegador y Auth/PostgREST,
  incluyendo aislamiento, replay, errores y carreras concretas. Riesgos hipotéticos
  se distinguen de fallas demostradas; no exigir resistencia imposible a raíz.
- Migración creada por CLI y versionada, probada y auditada antes de aplicar.
  Documentar recuperación operativa y configuración SMTP/plantillas/URLs.

El Orchestrator verificó que el proyecto alojado está vacío en los esquemas de
aplicación, sin migraciones, usuarios ni buckets; signup público se cerró. Esto
no certifica el candidato. SMTP personalizado no está configurado.

Ejecutor en checkout aislado, sin datos o cuentas reales, cambios alojados,
push/PR/deploy ni intervención en recursos de Vendify. Entregar commit local,
informe y evidencia real redactada; límites explícitos y handoff REVIEW solo al
terminar el incremento acotado. El Orchestrator decide aceptación y aplicación.
