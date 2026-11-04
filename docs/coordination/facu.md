# Plan de trabajo — Facu

## Objetivo
Definir y preparar el alcance funcional de cuotas, registro de pagos externos y comprobantes (`CUEVA-003` y `CUEVA-004`), sin superponerse con la implementación de dashboards de Mati.

## Decisión funcional confirmada: no habrá cobros dentro de CuevApp
En esta etapa:
- El alumno paga fuera de la aplicación, por ejemplo en efectivo o mediante transferencia.
- No habrá pasarela de pago, checkout, cobro con tarjeta ni integración para debitar/cobrar dinero desde CuevApp.
- La aplicación podrá registrar pagos que ya se realizaron externamente.
- Un administrador podrá registrar y confirmar el pago recibido.
- El alumno podrá adjuntar un comprobante para revisión; adjuntar un comprobante no significa que el pago esté confirmado.
- No se debe interpretar esta decisión como autorización para crear una integración de cobro en línea.

## Alcance asignado

### 1. Cerrar definiciones pendientes de CUEVA-003 — Cuotas y pagos
Partir de las reglas ya confirmadas en el contexto maestro:
- Una cuota mensual general, sin planes diferenciados en V1.
- El administrador puede cambiar el precio general.
- Los períodos históricos conservan su precio y los movimientos históricos no se reescriben.
- Cada alumno tiene una fecha de vencimiento individual.
- Se permiten pagos parciales y varios movimientos para un mismo período.
- Deben evitarse pagos duplicados por reintentos técnicos.
- El historial debe conservar alumno, período, importe, fecha, método, estado, administrador que confirmó y comprobante asociado cuando corresponda.
- Las correcciones deben ser trazables; no se debe borrar ni sobrescribir silenciosamente información financiera.
- No habrá bloqueo automático y universal de Rutinas por deuda.

Resolver y documentar, sin inventar reglas:
- Cómo se generan y delimitan los períodos mensuales.
- Cómo se imputan varios pagos parciales a un período.
- Cómo se trata un pago superior al saldo o un eventual crédito.
- Cómo se registra una excepción manual de renovación/vencimiento.
- Qué procedimiento se usa para corregir o revertir un pago confirmado, conservando auditoría.
- Formato monetario, moneda y reglas de redondeo que correspondan.

### 2. Cerrar definiciones pendientes de CUEVA-004 — Comprobantes
Conservar las reglas ya confirmadas:
- Alumno y administradores pueden adjuntar comprobantes.
- Solo un administrador puede confirmar un pago.
- Estados mínimos: pendiente de revisión, confirmado y rechazado.
- El comprobante adjunto no equivale a dinero confirmado.
- El efectivo puede registrarse manualmente sin adjunto.
- Los archivos deben ser privados y tener controles de acceso y validación.

Definir y documentar:
- Si un comprobante rechazado puede volver a presentarse y bajo qué condiciones.
- Tipos de archivo permitidos y tamaño máximo.
- Requisitos de validación y controles de seguridad del archivo.
- Qué información y trazabilidad se conserva ante rechazo, reemplazo o nueva presentación.

### 3. Preparar especificaciones, no implementar todavía
- Elaborar criterios de aceptación verificables para CUEVA-003 y CUEVA-004.
- Proponer modelo de datos y operaciones a nivel de diseño, sin asumir tablas existentes.
- Identificar requisitos de autorización, RLS, auditoría e idempotencia para revisión posterior.
- Separar claramente requisitos confirmados, decisiones pendientes y propuestas.
- Preparar tareas técnicas para una futura implementación aislada.

### 4. Mantener CUEVA-005 separado
Los recordatorios por correo pertenecen a CUEVA-005 y no deben mezclarse con el alcance actual.
La regla de producto documentada es un único recordatorio un día antes del vencimiento, en `America/Argentina/Buenos_Aires`, sujeto a las condiciones de elegibilidad y deduplicación ya especificadas. La integración y el proveedor siguen pendientes.

## Exclusiones explícitas
- No implementar pasarela de pago, checkout ni cobros dentro de la app.
- No modificar dashboards ni navegación: esa tarea corresponde a Mati.
- No editar componentes de interfaz de dashboards.
- No modificar `main`, fusionar, desplegar ni tocar producción.
- No ejecutar SQL ni modificar Supabase, Auth, RLS, Storage o datos alojados.
- No crear migraciones ni endpoints antes de cerrar reglas y revisar la arquitectura.
- No asumir que el esquema financiero existe: la auditoría del repositorio no encontró implementación ni migraciones de cuotas, pagos o comprobantes.
- No diseñar un bloqueo automático de Rutinas por deuda.

## Entregables
1. Documento de decisiones funcionales de CUEVA-003.
2. Documento de decisiones funcionales de CUEVA-004.
3. Criterios de aceptación y casos límite.
4. Propuesta técnica revisable, con dependencias y riesgos.
5. Lista de preguntas realmente pendientes, sin reabrir decisiones ya confirmadas.

## Coordinación con Mati
- Mati trabaja en dashboards y navegación; Facu no modifica esos archivos.
- No pedirle a Mati que invente datos financieros para completar tarjetas.
- Si una vista requiere cuotas o pagos aún no implementados, documentar qué dato necesitará y mostrar un estado vacío hasta que exista una fuente real.
- Compartir con Mati las definiciones aprobadas que afecten textos, estados o conceptos visibles.
- Coordinar antes de cualquier cambio que pueda afectar archivos, contratos o rutas compartidas.

## Criterio de finalización
CUEVA-003 y CUEVA-004 quedan preparados para implementación cuando las reglas pendientes estén resueltas, los criterios de aceptación cubran los casos normales y excepcionales, y la propuesta técnica haya sido revisada. Esto no autoriza por sí solo cambios en producción ni en Supabase.
