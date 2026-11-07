# CUEVA-003B — Vencimientos individuales y recurrencia

**Estado:** Implementación y CI automatizada aprobadas en la rama; auditoría independiente encontró y corrigió riesgos de idempotencia y confirmaciones desactualizadas. Pendiente de CI sobre el HEAD final y revisión de resultados.  
**TASK_ID:** CUEVA-003B  
**BASE_SHA:** `7663e51f7b60c269a9bb7f13f0f69d26358b609d`  
**BRANCH:** `feature/cueva-003b-vencimientos`  
**SKILLS_SELECTED:** `cueva-feature-development`, `cueva-finance`, `cueva-supabase-security`.  
**SKILLS_APPLIED:** contratos financieros, controles de seguridad, idempotencia transaccional, precondición de concurrencia para vencimientos, interfaz administrativa y pruebas automatizadas.  
**SKILL_SOURCES:** `.agents/skills/cueva-feature-development/SKILL.md`, `.agents/skills/cueva-finance/SKILL.md`, `.agents/skills/cueva-supabase-security/SKILL.md`.

## 1. Objetivo

Completar el calendario de vencimientos de CUEVA sin reconstruir el ledger de CUEVA-003A. Cada alumno tendrá un día de vencimiento individual y estable. La creación de períodos calculará la fecha correspondiente automáticamente, respetando meses cortos y recuperando el día original cuando vuelva a existir.

Los administradores podrán modificar vencimientos según la especificación vigente, con confirmación previa y auditoría append-only. Los pagos, importes, períodos históricos y anulaciones existentes no se reescriben.

## 2. Base verificada

- `main` verificado en `7663e51f7b60c269a9bb7f13f0f69d26358b609d`; incluye PR #31 ya integrado.
- PR abiertos: ninguno al momento de iniciar esta tarea.
- Rama preexistente `feature/cueva-finanzas-implementacion` detectada; no se reutiliza ni modifica por posible trabajo previo.
- Rama aislada nueva creada desde el SHA exacto de `main`: `feature/cueva-003b-vencimientos`.
- `cueva_students.joined_on` existe y es la referencia inicial aprobada para derivar el día.
- `cueva_periods.due_on` existe, pero CUEVA-003A lo solicita manualmente en cada alta de período.
- La RPC `cueva_billing_write` crea períodos, conserva precio histórico y evita duplicados; no implementa recurrencia ni auditoría de vencimientos.
- `src/lib/students/date.ts` ya resuelve la fecha local de Buenos Aires; no contiene aún la regla de vencimiento mensual.

## 3. Alcance

1. Persistir la referencia individual de vencimiento sin depender de cálculos del navegador ni alterar `joined_on`.
2. Derivar el vencimiento mensual desde el día de referencia original:
   - Si existe ese día, utilizarlo.
   - Si no existe, utilizar el último día del mes.
   - No modificar el día de referencia por el ajuste temporal.
   - Ejemplo: referencia 31 → febrero 28/29 → marzo 31.
3. Integrar el cálculo en la creación de períodos existentes, manteniendo unicidad por alumno/mes y selección del precio vigente.
4. Permitir a cualquiera de los dos administradores cambiar el vencimiento con vista previa de fecha anterior, nueva fecha y alcance antes de confirmar.
5. Aplicar por defecto el cambio al próximo período todavía no iniciado. Cambiar el período actual requiere confirmación explícita.
6. Bloquear cambios ordinarios sobre períodos totalmente pagados. No implementar todavía el procedimiento excepcional de corrección de períodos pagados.
7. Guardar auditoría append-only con alumno, actor, timestamp servidor, fecha anterior/nueva, alcance, motivo cuando corresponda y resultado. Ambos administradores pueden consultar; ninguno puede editar/eliminar desde UI.
8. Si posteriormente se implementan recordatorios, los cambios conservarán cualquier envío ya procesado y solo recalcularán/cancelarán notificaciones pendientes. En esta tarea no se crean notificaciones ni jobs.
9. Mantener pagos, precios, períodos ya creados y operaciones idempotentes sin mutaciones históricas no autorizadas.

## 4. Decisiones de implementación a respetar

- Fuente inicial del día: día de `cueva_students.joined_on`. No cambiar la fecha de alta.
- La referencia de día debe ser persistente e independiente de un `due_on` ya ajustado por fin de mes; nunca inferir el día recurrente desde el último vencimiento calculado.
- El calendario y los límites se evalúan en `America/Argentina/Buenos_Aires`; los timestamps de auditoría provienen del servidor.
- La base de datos es autoridad para cálculo, autorización, bloqueo de períodos pagados y auditoría.
- Extender `cueva_billing_write` con operaciones acotadas e idempotentes, o introducir wrappers compatibles sin abrir escrituras directas. No permitir que el navegador envíe un actor confiable ni un saldo.
- Conservar RLS, sesión habilitada, rol admin, `search_path` seguro, grants mínimos y aislamiento de tablas privadas.
- No usar `service_role` desde la aplicación.
- No añadir dependencias, cron, scheduler, email, push, Storage ni cambios alojados.
- No modificar archivos protegidos por `docs/engineering/source-manifest.json`, ni relajar verificadores.
- No tocar dashboard, autenticación, invitaciones, rutinas ni áreas no relacionadas.

## 5. Criterios de aceptación

### Calendario
- Días de referencia 1, 18, 28, 29, 30 y 31.
- Febrero común y bisiesto.
- Abril, junio, septiembre y noviembre.
- Transición de mes corto al siguiente mes largo sin deriva.
- Años bisiestos y cambio de año.
- Límites de fechas admitidos por el modelo.

### Períodos y pagos
- Creación automática de `due_on` desde la referencia individual.
- Reintento idéntico no duplica período ni auditoría.
- Dos solicitudes concurrentes para el mismo alumno/mes no duplican período.
- Precio aplicable e importe histórico permanecen iguales a CUEVA-003A.
- No se modifica ningún pago, reverso, precio ni período histórico al cambiar una regla futura.
- Período totalmente pagado rechaza cambio ordinario.
- Período parcial o impago admite el cambio según alcance autorizado.

### Auditoría y seguridad
- Registro con actor real, timestamp servidor, fechas, alcance y resultado.
- Auditoría no modificable/eliminable por roles de aplicación.
- Admin autorizado puede consultar; alumno y visitante no pueden leer ni escribir.
- Intentos directos a RPC/tablas respetan los mismos límites que UI.
- Payload inválido, fecha inválida, período ajeno, clave idempotente reutilizada con datos distintos y carreras se rechazan de forma segura.
- Los fallos no dejan una fecha modificada sin su auditoría correspondiente.

### Regresión y calidad
- Flujos actuales de precio, período, pagos parciales/completos, reversos y snapshot permanecen funcionales.
- UI usable en móvil/escritorio, claro/oscuro y teclado, siguiendo el marco administrativo existente.
- Lint, typecheck, build, tests, verify:sources y verify:security pasan; pruebas SQL locales reales y negativas pasan.
- Evidencia local sintética reproducible. No usar datos reales.

## 6. Exclusiones

- Scheduler/cron de creación masiva automática de períodos.
- Recordatorios y canales de notificación (CUEVA-005).
- Comprobantes y Storage (CUEVA-004).
- Mi Membresía (track posterior).
- Correcciones excepcionales de períodos ya pagados.
- Aplicar migraciones en Supabase alojado, publicar o desplegar.
- Modificar o integrar ramas de otros ejecutores.

## 7. Riesgos y controles

- **Referencia de calendario ambigua:** separar día recurrente persistente de la fecha puntual de cada período.
- **Carreras de creación/cambio:** resolver en transacción, con locks/restricciones y una única fuente de verdad.
- **Auditoría parcial:** modificación y evento de auditoría deben confirmar o revertir juntos.
- **Regresión financiera:** extender RPC existente con compatibilidad y repetir el laboratorio CUEVA-003A afectado; no cambiar el ledger.
- **Compatibilidad de Next.js 16.4.3:** antes de editar APIs Next, leer la guía instalada pertinente en `node_modules/next/dist/docs/`.

## 8. Estado de ejecución

La capa SQL de calendario individual y auditoría fue implementada y superó las 64 aserciones pgTAP, migraciones efímeras y verificación general/seguridad en CI (commit `b87c918`). La capa UI inicial se integra en la ficha económica administrativa `/pagos?alumno=<id>`: consulta calendario e historial bajo RLS, permite vista previa de fecha anterior/nueva, alcance próximo período (predeterminado) o período actual (confirmación explícita), motivo opcional e idempotencia de envío. Se conserva el marco visual administrativo existente.

La UI y las migraciones superaron los workflows automatizados en el commit `1bb7882`. Posteriormente se añadieron protecciones adicionales: las claves exitosas no se convierten en intentos rechazados cuando se reutilizan con otro payload, y cada cambio de vencimiento exige que el día anterior enviado coincida con la regla vigente bajo el bloqueo transaccional. Estas últimas correcciones requieren la ejecución de CI sobre el HEAD resultante. No se modificó Supabase alojado ni producción. No se creó scheduler, notificaciones, comprobantes ni acceso económico de alumnos.
