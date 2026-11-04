# CUEVA-ALUMNOS-INVITACION — encargo consolidado

Fuente: instrucción del usuario en este chat, 2026-11-04, posterior a Alumnos y Pagos.
Implementar la invitación al guardar una ficha, con opción marcada por defecto para
acceder a CUEVA, estado visible, ficha conservada ante errores y reintento seguro.
Completar implementación, autoauditoría y pruebas para revisión independiente y merge
posterior del Orchestrator. Guardar sin invitar debe seguir disponible.

La cuenta se provisiona de forma explícita y el alumno elige su contraseña usando
el mecanismo existente. No se asocian cuentas anteriores solo por coincidencia de
correo; no se modifican roles ni cuentas reales del gimnasio. La restricción de
correo temporal solo propietario continúa hasta su habilitación operativa por el
Orchestrator. No se envían correos reales, aplican migraciones alojadas, publican
cambios ni modifican credenciales desde este encargo local.

Ante estado ambiguo, evitar nuevos envíos automáticos y conservar la evidencia
para reconciliación. Entregar migración, código, prueba local reproducible,
capturas e informe REVIEW, sin push/PR/merge ni despliegue desde el ejecutor.
