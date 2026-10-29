# Backlog de CUEVA

El [contexto maestro](../product/CUEVA-MASTER-PRODUCT-CONTEXT-V1.md) define V1.
Los tracks no equivalen a tareas aceptadas ni autorizan implementar todo su alcance. CUEVA-001A: **DEPLOYED**, aceptación independiente e integración verificadas en PR #1. CUEVA-001 tiene su fundación desplegada; quedan las funciones de los tracks posteriores. El siguiente encargo es [CUEVA-002A](CUEVA-002A-task.md), **READY**: investigar y documentar la solución segura de identidad DNI/email; implementación de Auth todavía no autorizada.

| Track | Estado | Alcance que debe conservarse | Dependencias / aceptación futura |
| --- | --- | --- | --- |
| CUEVA-001 | DEPLOYED | Fundación, contexto, arquitectura propuesta, marca, temas y verificación local. CUEVA-001A es este incremento. | Auditoría, integración y primer despliegue verificados; ver checkpoint. |
| CUEVA-002 | READY | Alta administrativa DNI/email o ambos, identidad única, contraseña temporal individual y cambio obligatorio, perfiles y permisos del socio. | Investigar contrato DNI-only con Auth; autorización en servidor/RLS y denegaciones reales. |
| CUEVA-003 | NOT_STARTED | Cuota mensual general, vencimiento individual, pagos parciales, movimientos idempotentes, saldos e historial económico. | CUEVA-002; Nico decide excepciones de renovación y mora; sin bloqueo universal por deuda. |
| CUEVA-004 | NOT_STARTED | Comprobantes privados, validación de archivos, revisión pendiente/confirmado/rechazado, confirmación administrativa. | CUEVA-003; alumno no confirma; adjuntar no acredita dinero. |
| CUEVA-005 | NOT_STARTED | Un email un día antes del vencimiento en America/Argentina/Buenos_Aires, cuota pendiente total/parcial, email habilitado, deduplicación e intentos. | CUEVA-003; proveedor pendiente; Email pendiente no impide usar la cuenta; aceptación no equivale a entrega del correo. |
| CUEVA-006 | NOT_STARTED | Una nota principal por alumno tipo Keep, borradores autoguardados, publicación explícita, plantillas copiadas, ejercicios opcionales y resultados persistentes retomables. | CUEVA-002; versiones publicadas y resultados históricos se preservan; texto no se interpreta automáticamente. |
| CUEVA-007 | NOT_STARTED | Biblioteca común autorizada, cámara/galería/YouTube, instrucciones y videos reutilizables. | CUEVA-002 y asociación con CUEVA-006; límites de almacenamiento pendientes. No retrasar pagos/rutinas. |
| CUEVA-008 | NOT_STARTED | PWA instalable, manifest/íconos, lectura offline de rutinas y aceptación integral. | Tracks esenciales aceptados; privacidad de caché, pruebas reales finales, integración y despliegue por Orchestrator. |

## Posterior al MVP (V1.1/V2)

- Asistencia manual/QR dinámico; dispositivo de exhibición pendiente.
- Push, sistema completo de avisos internos y mensajes manuales.
- Estadísticas, gráficos, constancia y progreso avanzado (V1 solo conserva resultados).
- Cobros online, integraciones sociales, apps nativas y automatizaciones avanzadas.

## Pendientes de producto e infraestructura

Nombre del socio, color secundario, dominio, proveedor de correo, límites de video,
retención de datos, excepciones administrativas y configuración final de hosting.
No bloquean esta fundación; no se resuelven por inferencia.

## Deuda de mantenimiento

- ESLint 9 fuera de soporte: evaluar cadena compatible antes de ampliarla; no forzar peers incompatibles ni confundir npm audit sin hallazgos con soporte vigente.
- SVG aceptado para la fundación como reconstrucción; maestro vectorial pendiente.
