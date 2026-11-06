# CUEVA — Especificación vigente: cuotas, vencimientos, comprobantes y notificaciones

**Versión:** 1.0  
**Fecha de consolidación:** 2026-11-06  
**Estado:** Requisitos funcionales aprobados; implementación pendiente o parcial según el inventario técnico.  
**Repositorio base:** `main` en `963b402830391dbc9fa4f6728280272a76de5dba`  
**Alcance:** Especificación para implementación. Este documento no ejecuta ni autoriza por sí mismo cambios en Supabase o producción.

> **Precedencia:** esta especificación incorpora las decisiones posteriores aprobadas por el Product Owner y reemplaza cualquier regla contradictoria anterior sobre vencimientos, recordatorios, comprobantes, retención y revisión administrativa. El contexto histórico se conserva como antecedente, no como requisito vigente.

## 1. Principios obligatorios

- CUEVA debe simplificar el trabajo administrativo del gimnasio, no agregar pasos innecesarios.
- Automatizar decisiones seguras y pedir intervención administrativa solo cuando sea realmente necesaria.
- Mantener trazabilidad financiera y documental.
- La interfaz nunca es la autoridad para permisos, saldos, límites o estados: validar también en servidor y base de datos.
- No reconstruir el motor financiero ya integrado; extender sus contratos existentes.
- No confundir archivo adjunto con pago confirmado.
- No usar OCR como fuente de verdad para registrar pagos.
- No implementar antimalware ni cuarentena en este alcance: está expresamente postergado.
- No agregar checkout ni cobros en línea para alumnos. Los pagos se realizan externamente.

## 2. Cuotas, períodos y vencimientos

### 2.1 Cuota

- En V1 existe una cuota mensual general, sin múltiples planes.
- Los administradores pueden cambiar el precio general.
- Los períodos históricos conservan el precio que tenían al crearse.
- Los pagos históricos no se recalculan ni modifican cuando cambia el precio.
- Los pagos parciales están permitidos. El saldo pendiente persiste hasta completar el importe.
- Un pago tardío no desplaza automáticamente los vencimientos futuros.
- No existe interés ni recargo automático universal. Las excepciones se resuelven caso por caso.

### 2.2 Fecha individual de vencimiento

Cada alumno tiene un día de vencimiento individual, inicialmente derivado de su fecha de alta o referencia de renovación. No se debe normalizar automáticamente a todos los alumnos.

Ejemplo: alta el día 18 → vencimiento el día 18 de los meses siguientes.

Regla para días 29, 30 y 31:
- Si el mes no tiene el día de referencia, usar el último día de ese mes.
- En el siguiente mes que sí disponga del día original, recuperar el día de referencia original; no arrastrar el último día del mes corto como nueva referencia.

### 2.3 Cambios administrativos de vencimiento

- Cualquiera de los dos administradores puede modificar el vencimiento.
- Antes de confirmar, mostrar fecha anterior, fecha nueva y alcance.
- Por defecto, el cambio afecta al próximo período que todavía no comenzó.
- Modificar el período actual requiere confirmación explícita.
- El motivo es opcional para cambios ordinarios.
- No se permiten cambios manuales ordinarios sobre períodos totalmente pagados.
- Una corrección excepcional de un período pagado requiere un procedimiento separado, justificación obligatoria y auditoría reforzada.

Auditoría obligatoria de cada cambio:
- Alumno afectado.
- Administrador responsable.
- Fecha y hora exactas.
- Fecha anterior y fecha nueva.
- Alcance del cambio.
- Motivo opcional o justificación obligatoria según el tipo de operación.
- Resultado de la operación, incluyendo fallas relevantes.

Ambos administradores pueden consultar el historial. Los registros deben estar protegidos contra edición o eliminación desde la interfaz y, cuando sea viable, también mediante controles de base de datos.

Si ya se envió un recordatorio para la fecha anterior:
- Conservar el registro del envío original.
- Recalcular o cancelar solamente recordatorios pendientes/no procesados.
- No borrar ni reescribir el historial de notificaciones ya procesadas.

### 2.4 Medios de pago

Valores admitidos:
- Efectivo.
- Transferencia.
- Tarjeta de débito.
- Tarjeta de crédito.
- Otro, con descripción obligatoria.

Transferencia incluye homebanking y billeteras (por ejemplo Mercado Pago, MODO, Personal Pay y equivalentes) cuando se utilizan para transferir dinero. Cheque y criptomonedas quedan excluidos.

La fecha real del pago es independiente del vencimiento y de la fecha en que se adjunta un comprobante.

## 3. Recordatorios y notificaciones

### 3.1 Recordatorios por período

Para cada período con saldo pendiente se generan dos recordatorios:
- Cinco días antes del vencimiento.
- Un día antes del vencimiento.

Reglas:
- Cancelar los dos recordatorios si el período queda totalmente pagado.
- Los pagos parciales mantienen los recordatorios mientras exista saldo.
- No generar el recordatorio de cinco días cuando la fecha de vencimiento ya pasó.
- No generar recordatorios para períodos totalmente pagados.
- Cada período impago se procesa de forma independiente y el mensaje debe identificar el período y el saldo pendiente.
- No duplicar recordatorios para el mismo período, tipo y vencimiento.

### 3.2 Zona horaria, horario y frecuencia

- Zona horaria: `America/Argentina/Buenos_Aires`.
- Horario inicial de envío: 12:00.
- Procesamiento del servicio: cada cinco minutos.
- La frecuencia de procesamiento no cambia la hora efectiva programada de envío.

### 3.3 Configuración administrativa del horario

- Ambos administradores pueden modificar un horario común para los dos tipos de recordatorio.
- El cambio afecta únicamente notificaciones pendientes y no procesadas.
- Los registros enviados o procesados conservan los datos originales.
- Registrar administrador, timestamp exacto, horario anterior, horario nuevo, zona horaria, fecha de vigencia y resultado.
- Ambos administradores pueden consultar el historial; no debe ser editable ni eliminable desde la UI.

### 3.4 Canales y preferencias

Canales:
- **Email:** siempre activo; el alumno no puede desactivarlo.
- **Notificación interna:** siempre activa; el alumno puede marcarla como leída. Permanece sin leer hasta esa acción; no se exige un historial/archivo visible.
- **Push:** habilitado por defecto, pero el alumno puede desactivarlo.

La interfaz de preferencias solo expone el interruptor de push. Email y notificaciones internas no se pueden desactivar. Push se envía únicamente si el navegador/sistema operativo concedió permiso. En iOS/iPadOS, contemplar web push desde iOS/iPadOS 16.4 o posterior y la instalación de la PWA en pantalla de inicio.

### 3.5 Reintentos

Ante un fallo de envío, reintentar en esta secuencia:
1. Primer reintento: 15 minutos después.
2. Segundo reintento: 30 minutos después.
3. Tercer reintento: 60 minutos después.
4. Cuarto reintento: 3 horas después.

Después del cuarto reintento fallido:
- Marcar el envío como fallido definitivamente.
- Alertar a los administradores.
- Conservar diagnósticos técnicos restringidos para soporte.

Registrar cada intento, canal, fecha/hora, resultado y referencia de operación. No duplicar envíos. La falla de un canal no detiene los demás. No alertar a administradores por cada fallo transitorio: la alerta se emite al agotarse los cuatro reintentos.

La alerta administrativa debe ser breve e incluir alumno, período, tipo de recordatorio, canal fallido, estado de reintentos agotados y fecha. Los diagnósticos técnicos detallados (respuesta/código del proveedor, timestamp por intento, contador, canal, operation ID y razón técnica) quedan restringidos al soporte autorizado.

### 3.6 Interrupciones y recuperación

Si el servicio está caído en el horario previsto:
- Al recuperarse, enviar cuanto antes el recordatorio atrasado si todavía es relevante y el vencimiento no pasó.
- Si el vencimiento ya pasó, descartar el recordatorio atrasado.
- Registrar interrupción, recuperación, decisión (envío tardío o descarte) y motivo.
- No duplicar recordatorios ya procesados.

### 3.7 Períodos vencidos múltiples

- Generar y procesar recordatorios independientemente para cada período impago.
- Identificar claramente período e importe pendiente.
- No enviar recordatorio de cinco días para un período cuyo vencimiento ya pasó.
- Excluir períodos totalmente pagados.
- Evitar duplicaciones.

## 4. Comprobantes de pago

### 4.1 Presentación y límites

- El alumno puede adjuntar un comprobante al período de cuota correspondiente.
- Un administrador también puede adjuntar comprobantes.
- Un comprobante adjunto no equivale a un pago confirmado.
- Máximo un archivo por presentación.
- Formatos admitidos: JPG/JPEG, PNG y PDF.
- Tamaño máximo: 10 MB por archivo.
- Máximo una presentación pendiente por alumno y período, incluso ante solicitudes concurrentes. La restricción debe estar garantizada por base de datos, no solo por UI.
- Si existe una presentación pendiente, no se permite otra para ese período.
- Si la anterior fue rechazada, puede presentarse una nueva.
- Si la anterior fue confirmada y queda saldo, puede presentarse otra para ese saldo.
- Si el período está totalmente pagado, no se aceptan nuevas presentaciones.

### 4.2 Validación de archivos

El cliente puede validar para ofrecer feedback rápido, pero la validación del servidor es autoritativa. Comprobar formato real, extensión, MIME, tamaño e integridad del archivo.

Mensajes de error comprensibles para:
- Formato no admitido.
- Archivo demasiado grande.
- Archivo corrupto o ilegible.
- Error de carga.
- Error inesperado de procesamiento.

Un archivo inválido/corrupto no debe crear una fila pendiente. Ante un error, no dejar presentaciones incompletas; permitir reintentar sin duplicados.

### 4.3 Privacidad y autorización

- Almacenamiento privado.
- Acceso restringido y comprobado en servidor.
- RLS y controles de autorización.
- El alumno solo puede consultar/abrir sus propios comprobantes.
- Los administradores pueden consultar comprobantes de todos los alumnos.
- No generar enlaces públicos permanentes; usar acceso autorizado y enlaces temporales.
- No implementar antimalware ni cuarentena en este alcance.

### 4.4 Revisión administrativa

Solo los administradores confirman o rechazan comprobantes de alumnos. Ambos administradores pueden revisar cualquier presentación administrativa, incluida una que ellos mismos hayan adjuntado.

Para aprobar un comprobante, el administrador verifica e ingresa manualmente:
- Importe positivo.
- Fecha real del pago.
- Medio de pago aprobado.

El importe no puede superar el saldo pendiente. La confirmación debe utilizar el motor financiero existente (`cueva_billing_write`), preservando idempotencia, pagos parciales y prevención de sobrepagos. No usar OCR como fuente de verdad.

El rechazo exige motivo obligatorio, visible para el alumno. Conservar archivo, motivo, actor y timestamp.

### 4.5 Pagos administrativos y comprobantes

Hay dos flujos administrativos:

**A. Registrar un pago y adjuntar comprobante opcional**
- El administrador registra el pago externo con los datos requeridos.
- Puede adjuntar un comprobante como parte del mismo flujo.
- Si la carga o asociación del archivo falla, el pago ya registrado permanece registrado.
- Reintentar adjuntar el archivo no debe duplicar el pago.
- Registrar por separado quién creó el pago y quién adjuntó el comprobante y cuándo.

**B. Adjuntar un comprobante sin registrar el pago**
- Se crea una presentación pendiente de revisión.
- Cualquiera de los dos administradores, incluido quien la presentó, puede aprobarla o rechazarla.
- Se aplican las mismas validaciones de archivo y auditoría.

### 4.6 Vincular comprobantes administrativos con pagos registrados posteriormente

Si un administrador adjunta primero un comprobante sin registrar el pago y después registra el pago correspondiente:
- Detectar comprobantes pendientes del mismo alumno y período.
- Si hay uno, ofrecerlo directamente para vincular.
- Si hay varios, permitir seleccionar el que corresponda.
- Si no hay ninguno, registrar el pago normalmente.
- La vinculación no crea otro pago ni cambia el importe.
- Mantener IDs independientes de pago y comprobante; la vinculación es una asociación auditable, no el registro financiero en sí.

La experiencia debe evitar búsquedas y carga duplicada cuando el sistema pueda identificar el caso con seguridad.

### 4.7 Período saldado mientras existe comprobante pendiente

Si otra operación salda completamente el período antes de revisar un comprobante pendiente:
- Cerrar automáticamente la presentación como **“Sin efecto: período ya saldado”**.
- No tratarla como rechazo.
- No generar un pago adicional.
- Notificar al alumno y a los administradores.
- Conservar presentación, archivo y trazabilidad.

### 4.8 Fechas y trazabilidad

Distinguir:
- **Fecha de pago:** fecha real en que se realizó el pago; se utiliza en el registro financiero.
- **Fecha de presentación:** momento en que se adjuntó el comprobante.
- **Fecha de resolución:** momento de aprobación, rechazo o cierre automático como “Sin efecto: período ya saldado”.

Registrar actor administrativo y timestamp de resolución. La corrección/reversión de un pago confirmado se realiza mediante el procedimiento financiero de corrección/reversión, no creando otra presentación para reemplazarlo.

### 4.9 Retención de archivos

- Comprobante rechazado: conservar el archivo durante 12 meses desde la fecha de rechazo; después eliminar el archivo y conservar metadatos y auditoría.
- Comprobante confirmado: conservar el archivo durante 24 meses desde la confirmación del pago; después eliminar el archivo y conservar el registro financiero y auditoría.
- Una corrección o reversión posterior no provoca eliminación anticipada.
- La eliminación de archivos vencidos debe automatizarse y registrarse.
- Registrar fallas y reintentos de eliminación y alertar ante fallas persistentes.
- La política aplica al archivo, no al historial financiero ni a la auditoría.

## 5. Integración con el alumno: «Mi Membresía»

El alumno dispone de una sección llamada **Mi Membresía** que agrupa:
1. Estado de membresía.
2. Cuota actual: importe, pagos realizados y saldo.
3. Fecha de vencimiento.
4. Historial de períodos y pagos.
5. Comprobantes, archivos y estados de revisión.

Debe permitir abrir comprobantes autorizados y volver a presentar cuando las reglas de la sección 4 lo permitan. Los datos financieros deben proceder del ledger/backend; no inventar ni calcular saldos independientes en frontend. No incluir checkout ni pagos online.

## 6. Contratos de integración con la base existente

La auditoría técnica de noviembre de 2026 observó:
- `cueva_periods.due_on` ya existe.
- `cueva_billing_write` gestiona escrituras financieras transaccionales, idempotencia, pagos parciales y prevención de sobrepagos.
- `cueva_billing_snapshot` proporciona lectura del estado financiero.
- No se encontró recurrencia automática de períodos ni auditoría específica de cambios de vencimiento.
- No se encontraron buckets de Storage, tablas/funciones de comprobantes, jobs de notificaciones ni scheduler desplegado en esa inspección.

Estas observaciones son una línea base histórica, no sustituyen la inspección del estado actual antes de implementar. La implementación debe reutilizar el motor financiero y sus contratos; no crear un segundo ledger ni recalcular pagos por separado.

## 7. Orden recomendado y criterios de entrega

1. **Vencimientos:** cerrar generación de períodos, calendario individual, cambios auditados y pruebas de límites de mes.
2. **Notificaciones:** definir persistencia/idempotencia y luego scheduler, canales, horario, reintentos, alertas y recuperación.
3. **Comprobantes:** almacenamiento privado, validación, presentaciones, revisión, asociación a pagos, estados automáticos y retención.
4. **Mi Membresía:** exponer información financiera y comprobantes desde contratos ya implementados.
5. **Validación transversal:** RLS, concurrencia, idempotencia, aislamiento, regresiones y pruebas de entorno.

Cada entrega debe indicar archivos y migraciones modificados, pruebas ejecutadas, resultado de CI, estado de integración, estado de migraciones alojadas y límites de verificación. Código integrado, migración aplicada y producción validada son estados distintos.

## 8. Fuera de alcance explícito

- Antimalware y cuarentena de archivos.
- Checkout y cobros online.
- Nuevos roles administrativos.
- Cambios en el dashboard, que está a cargo de Mati.
- Intereses o recargos automáticos universales.
- OCR como fuente de verdad.
- Alteración o borrado de historial financiero.
- Cambios ordinarios de vencimiento de períodos totalmente pagados.

## 9. Regla de precedencia documental

Este archivo es la especificación vigente para los temas de cuotas/vencimientos, comprobantes y notificaciones. Ante contradicción con documentación anterior, prevalece este archivo por contener las decisiones posteriores aprobadas. No eliminar documentos históricos sin preservar su trazabilidad; agregar enlaces y avisos de obsolescencia cuando corresponda.
