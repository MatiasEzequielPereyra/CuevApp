# Backlog de CUEVA

## Estado vigente reconciliado — 2026-11-16

HEAD de `main`: `640324bc0fbf97b0777ddd7080c33ff13c378e45`. PR #53 está integrado; el portal del alumno y la RPC de ejercicios asignados ya forman parte del código de `main`. Esto no equivale a afirmar que los componentes de Supabase Hosted estén aplicados: la última evidencia alojada registrada en PR #59 observó ausentes `cueva_notification_inbox` y `cueva_student_assigned_exercises()`. Mantener el rollout alojado y sus pruebas postflight como pendiente hasta verificarlo.

Estado de tracks a distinguir:

- CUEVA-003B Vencimientos: integrado y cerrado como baseline; no reabrir ni modificar.
- CUEVA-004 / Mi Membresía y comprobantes: funcionalidades integradas en código; consultar el checkpoint y el estado alojado antes de afirmar operación completa.
- CUEVA-005 Notificaciones: código integrado en `main`; rollout alojado y verificación de envíos reales pendientes. No confundir con “NOT_STARTED” de la tabla histórica inferior.
- CUEVA-006 Rutinas: editor, publicación, biblioteca y lectura de la última rutina están integrados; el registro persistente de resultados/historial del alumno y la experiencia retomable siguen siendo trabajo pendiente.
- CUEVA-008 / PWA: instalación y entrada desde el ícono están implementadas; la lectura offline segura de rutinas y la aceptación integral siguen pendientes de validar.

Las tablas y estados de las secciones inferiores describen planificación histórica de octubre/noviembre y no prevalecen sobre este resumen ni sobre los cierres posteriores del checkpoint. No usarlos como estado actual sin una nueva auditoría.


## Estado vigente — 2026-11-13

Rutinas por días y bloques, biblioteca de ejercicios y videos, Mi Membresía,
comprobantes, vencimientos y mejoras de Pagos ya están en el código publicado.
CUEVA-005 está integrado en `main`. Queda pendiente el rollout de notificaciones
en Supabase y la verificación de envíos reales. Los estados locales de abajo son
históricos. Ver [checkpoint](checkpoint.md) para el estado observado de GitHub,
Vercel y Supabase.

## Incremento vigente — CUEVA-006C, 2026-11-06

REVIEW local: catálogo de rutinas/plantillas, días, bloques con vueltas comunes,
objetivos por peso/repeticiones o tiempo y selección múltiple paginada. Video desde
galería (50 MB, solo admin) aprobado posteriormente por el usuario; lectura privada
por ejercicios de la última publicación. Legado preservado y conversión explícita.
[Entrega y límites](CUEVA-006C-review.md). Integración, bucket/migraciones alojadas,
revisión independiente y producción pendientes. No completa resultados, temporizador,
offline ni el MVP. Las notas previas de videos pendientes son historia de entregas.

## Cambio vigente — CUEVA-006B, 2026-11-06

REVIEW local: catálogo básico y constructor principal por bloques/ejercicios.
El usuario reemplaza expresamente la nota principal de 006A por estructura;
las notas previas quedan como observaciones sin conversión. Plantillas estructuradas
y consulta de objetivos; registro de resultados, videos, imágenes, archivos y
offline siguen pendientes. [Encargo](CUEVA-006B-task.md). 006A continúa REVIEW;
no confundir su evidencia anterior con pruebas nuevas de este incremento.

## Incremento vigente — CUEVA-006A, 2026-11-06

REVIEW local: rutinas libres, una nota por ficha, borrador autoguardado en
base con revisión, publicación explícita e historial, plantillas copiadas y
consulta de la última publicación por el alumno vinculado. [Encargo](CUEVA-006A-task.md)
y [modelo](../architecture/routines.md). Integración, migración y validación
alojadas pendientes del Orchestrator. Ejercicios estructurados, videos, resultados
de entrenamiento y lectura offline continúan pendientes; CUEVA-006 completo
no se declara terminado. El cierre de acceso vigente del checkpoint prevalece
sobre estados históricos de identidad/correo que se conservan debajo.

**Estado vigente 2026-11-03:** el acceso usa correo obligatorio e invitación con contraseña propia; el primer administrador está operativo. El correo integrado es temporal solo para el propietario; altas y recuperación de alumnos siguen bloqueadas. CUEVA-UI-001 prepara el panel visual; alumnos, pagos y comprobantes todavía no tienen datos operativos. Ver [checkpoint](checkpoint.md). Los estados contradictorios inferiores son históricos.

**Actualización posterior:** CUEVA-002J ACCEPTED LOCAL; plantillas, bootstrap y
procedimiento local comprobados. Preparación alojada con acceso apagado y primera
prueba controlada pendientes; ver checkpoint. No se cambian proveedor ni requisitos.

**Estado vigente 2026-11-03:** CUEVA-002I aceptada localmente para integrar apagada;
Auth alojado aún pendiente. SMTP Gmail guardado, entrega no probada. Siguiente
incremento: [CUEVA-002J](CUEVA-002J-task.md), plantillas reales y preparación
operativa de bootstrap/reconciliación. Los estados antiguos de abajo son historia.

**Actualización 2026-10-29:** el usuario confirmó correo obligatorio para todos
los alumnos y eliminó el acceso por DNI. Esta decisión reemplaza los requisitos
anteriores de ingreso DNI/sin correo que aparecen abajo como historia; el alta
sigue a cargo de administradores. Próximo encargo: [CUEVA-002C](CUEVA-002C-task.md).

El [contexto maestro](../product/CUEVA-MASTER-PRODUCT-CONTEXT-V1.md) define V1.
Los tracks no equivalen a tareas aceptadas ni autorizan implementar todo su alcance. CUEVA-001A: **DEPLOYED**, aceptación independiente e integración verificadas en PR #1. CUEVA-001 tiene su fundación desplegada; quedan las funciones de los tracks posteriores. El encargo actual es [CUEVA-002A](CUEVA-002A-task.md), **ACCEPTED** como investigación documental, sin Auth implementada ni mecanismo aceptado.

| Track | Estado | Alcance que debe conservarse | Dependencias / aceptación futura |
| --- | --- | --- | --- |
| CUEVA-001 | DEPLOYED | Fundación, contexto, arquitectura propuesta, marca, temas y verificación local. CUEVA-001A es este incremento. | Auditoría, integración y primer despliegue verificados; ver checkpoint. |
| CUEVA-002 | IN_PROGRESS | CUEVA-002A aceptada como investigación: diseño documental; alta administrativa DNI/email o ambos, identidad única, contraseña temporal individual y cambio obligatorio, perfiles y permisos del socio. | D007 PROPOSED; sin Auth implementada; E1–E6 no probados y E3 bloqueado. Requiere auditoría y decisiones operativas. |
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

- CUEVA-002A: [diseño documental](../architecture/identity-feasibility.md), D007
  PROPOSED. Vía candidata IdP + Custom OIDC con email opcional, no factibilidad
  operativa PASS. Pendientes: decisión de proveedor/operador/costos y proceso de
  entrega/recuperación; E1–E6 sin prueba integrada. CUEVA-002B solo se propone como
  spike aislado posterior y condicionado, no está READY ni autorizado todavía.

- ESLint 9 fuera de soporte: evaluar cadena compatible antes de ampliarla; no forzar peers incompatibles ni confundir npm audit sin hallazgos con soporte vigente.
- SVG aceptado para la fundación como reconstrucción; maestro vectorial pendiente.

## Próximo incremento acotado

[CUEVA-002B-LOCAL](CUEVA-002B-LOCAL-task.md): READY, laboratorio local de cambio
temporal. No autoriza proveedor remoto ni sustituye E6 de la prueba integrada.

## Gestión administrativa de alumnos

CUEVA-ALUMNOS-001 incorpora fichas separadas de las cuentas, correo obligatorio y
DNI opcional exclusivamente administrativo. Alta/búsqueda/edición locales para
revisión; migración alojada y publicación pendientes. Sin invitaciones ni pagos.

## Cuotas y pagos — incremento administrativo

CUEVA-003A en REVIEW local: configuración de precio, períodos mensuales explícitos,
pagos parciales/completos y anulaciones trazables. Aplicación alojada e integración
pendientes. Sin anticipos, cobros online, adjuntos, recordatorios ni acceso económico
para alumnos. Ver [informe](CUEVA-003A-review.md).

## Invitaciones de alumnos

Preparación de incorporación desde ficha con opción predeterminada y estado de
invitación. Conservación de ficha y control de duplicados; migración/habilitación
de correo alojadas requieren revisión del Orchestrator.

Reconciliación de invitación SMTP 535: incremento local acotado
[CUEVA-INVITACION-RECUPERACION-001](CUEVA-INVITACION-RECUPERACION-001-task.md),
REVIEW; laboratorio nuevo 66/66 PASS. Recupera la identidad preparada exacta; no reabre altas, no implementa
reconciliador general ni cambia proveedor. Estado remoto de PR25 prevalece sobre
las notas históricas: migración aplicada, entrega/primer acceso de alumno sin verificar.


## Especificación vigente: finanzas, comprobantes y notificaciones

Las decisiones aprobadas posteriores para vencimientos individuales, auditoría de cambios, recordatorios de 5 y 1 día, canales, reintentos, recuperación, comprobantes, pagos administrativos, vinculación de archivos, retención y sección **Mi Membresía** están consolidadas en [CUEVA-FINANZAS-COMPROBANTES-NOTIFICACIONES-V1.md](../product/CUEVA-FINANZAS-COMPROBANTES-NOTIFICACIONES-V1.md). Ese documento prevalece sobre las reglas antiguas de este backlog y del contexto maestro cuando exista contradicción.

### Tracks actualizados por la especificación

| Track | Estado de referencia auditado | Trabajo pendiente |
| --- | --- | --- |
| CUEVA-003 — cuotas y vencimientos | Motor financiero base integrado; vencimiento individual parcial | Recurrencia mensual, calendario individual, cambios auditados, medios de pago finales y pruebas de límites de mes |
| CUEVA-004 — comprobantes | Pendiente en la auditoría de infraestructura | Storage privado, validación, presentaciones, revisión, asociación con pagos, estados automáticos y retención |
| CUEVA-005 — notificaciones | Pendiente en la auditoría de infraestructura | Scheduler, dos recordatorios, canales, configuración, reintentos, alertas y recuperación |
| CUEVA-MEM — Mi Membresía | Requisito aprobado; pendiente | Consulta de cuota, saldo, vencimiento, historial y comprobantes |

Los estados son observaciones de auditoría, no garantías de producción. Verificar nuevamente antes de implementar.
