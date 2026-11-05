# CUEVA — Requisitos funcionales de vencimientos y notificaciones

**Estado:** decisiones funcionales aprobadas; pendiente de diseño técnico e implementación.  
**Alcance:** calendario individual de vencimientos, cambios administrativos, recordatorios automáticos y notificaciones asociadas.  
**Zona horaria:** `America/Argentina/Buenos_Aires`.

Este documento complementa el Product Master. En caso de contradicción, prevalecen las decisiones explícitas más recientes aprobadas por el usuario.

## 1. Calendario individual de vencimientos

- Cada alumno tiene un día de vencimiento individual.
- Inicialmente, el día de referencia se deriva de la fecha de alta.
- Un alumno que ingresa el día 18 tendrá inicialmente su vencimiento el día 18 del mes siguiente y conservará ese día en los períodos siguientes, salvo modificación administrativa.
- No se normalizan automáticamente las fechas de alumnos nuevos.
- El administrador puede normalizar individualmente el calendario. La nueva referencia persiste para los períodos futuros hasta que un administrador vuelva a modificarla.

### Meses que no contienen el día de referencia

- Si el mes no contiene el día de referencia, el vencimiento se establece en el último día calendario de ese mes.
- El ajuste es solo para ese mes; no reemplaza el día de referencia original.
- En el siguiente mes que sí contenga el día original, se recupera.
- Ejemplo: referencia día 31 → febrero 28/29 → marzo 31 → abril 30 → mayo 31.

## 2. Pagos fuera de término y renovaciones

- Registrar siempre el pago con su fecha real.
- Pagar después del vencimiento no desplaza ni reinicia automáticamente el calendario.
- Por defecto se conserva la fecha original y el próximo período mantiene el calendario vigente.
- Solo una decisión expresa del administrador puede modificar la fecha de referencia.
- Una nueva fecha de referencia permanece vigente para los meses siguientes hasta otro cambio administrativo.
- Un pago parcial no renueva ni salda el período; el saldo pendiente continúa bajo seguimiento.
- No se aplican intereses ni recargos automáticos por mora. La mora se trata caso por caso mediante decisión administrativa.

## 3. Modificación manual y auditoría

### Permisos y alcance

- Solo los administradores pueden modificar vencimientos.
- El cambio se aplica al próximo período todavía no iniciado por defecto.
- Para modificar el período actual, el administrador debe elegir ese alcance expresamente y confirmar la acción.
- No se alteran pagos ni períodos históricos.
- No se modifica retroactivamente un vencimiento ya comunicado, salvo que el administrador confirme expresamente el cambio del período actual.
- La justificación es opcional.
- Ambos administradores pueden consultar la auditoría.

### Registro obligatorio

Cada intento de modificación debe quedar trazado con resultado. Para un cambio aplicado, conservar como mínimo:

- Alumno afectado.
- Administrador actor.
- Fecha y hora del cambio.
- Día/fecha de referencia anterior y nueva.
- Alcance del cambio (próximo período no iniciado o período actual).
- Motivo, si se proporcionó.
- Resultado de la operación.

Los registros de auditoría deben estar protegidos y no ser editables ni eliminables desde la interfaz. La auditoría no reemplaza el historial financiero.

### Efectos sobre recordatorios

- Recalcular los recordatorios pendientes afectados por el nuevo vencimiento.
- Cancelar la programación pendiente correspondiente al calendario anterior.
- Conservar los registros de recordatorios ya enviados o procesados; no borrarlos ni duplicarlos.

## 4. Recordatorios automáticos

Dos recordatorios por período con saldo pendiente:

1. **Preventivo:** 5 días antes del vencimiento.
2. **Refuerzo:** 1 día antes del vencimiento.

### Horario

- Valor inicial: **12:00**.
- Zona horaria: `America/Argentina/Buenos_Aires`.
- Un administrador puede cambiar el horario desde Configuración.
- Un único horario configurado aplica a los dos recordatorios.
- Los alumnos no pueden cambiar el horario.
- Registrar qué administrador modificó el horario y cuándo.
- Los cambios de horario se aplican a recordatorios pendientes todavía no enviados, sin duplicar ni perder los ya procesados.

### Condiciones

- En cada instancia se comprueba el saldo vigente del período.
- Si el período está completamente pagado antes del envío, se cancela esa instancia.
- Si el período tiene saldo parcial pendiente, se mantiene el seguimiento y se envía la instancia que corresponda.
- Si cambia el vencimiento, se recalculan ambas instancias pendientes con la nueva fecha.
- Los envíos ya procesados permanecen registrados.
- La identidad idempotente de una instancia debe distinguir alumno, período/vencimiento y tipo de recordatorio (5 días o 1 día).
- El proceso se ejecuta automáticamente, sin que un administrador tenga que abrir la PWA.

## 5. Canales de notificación

### Correo electrónico

- Obligatorio para los recordatorios de vencimiento.
- El alumno no puede desactivarlo desde sus preferencias.
- Se requiere una dirección válida y habilitada. Si el alumno no tiene email válido, el sistema no puede entregar el correo; esta situación debe quedar identificada y no debe simularse un envío exitoso.
- El contenido debe incluir identidad de CUEVA, nombre del alumno, fecha de vencimiento, aviso preventivo/refuerzo e indicación para consultar su situación.
- No incluir información personal innecesaria.

### Notificación interna

- Obligatoria para cada recordatorio de vencimiento, independientemente de la preferencia push.
- Se muestra dentro del perfil del alumno.
- No habrá una pantalla de historial de notificaciones.
- El alumno puede marcar cada notificación como leída.
- El estado de lectura debe persistir; una notificación leída no debe volver a aparecer como no leída.
- No permitir que la preferencia push desactive la creación o visualización interna.

### Notificación push

- Activada por defecto en las preferencias de CUEVA.
- El alumno puede desactivarla.
- La activación en CUEVA no puede conceder por sí misma el permiso del navegador o sistema operativo; Web Push solo se entrega si el alumno concedió el permiso requerido y existe una suscripción válida.
- Un fallo o falta de permiso push no debe impedir el correo ni la notificación interna.

## 6. Otros eventos notificables aprobados

- Una actualización/publicación de la rutina asignada al alumno genera una notificación interna.
- También genera push si el alumno la mantiene habilitada y concedió el permiso necesario.
- La decisión de esta sección no establece envío de correo para actualizaciones de rutina.
- No agregar otros eventos (mensajes manuales, cambios de cuenta, pagos, etc.) sin aprobación funcional específica.

## 7. Fallos, reintentos y observabilidad

- Registrar intentos, resultados y fallos por canal e instancia de recordatorio.
- Aplicar reintentos controlados ante fallos transitorios, con límites y espera progresiva; no reintentar indefinidamente.
- Diferenciar aceptación del proveedor de correo y entrega confirmada cuando el proveedor ofrezca esa señal.
- No marcar una instancia como enviada exitosamente antes de obtener el resultado definido para el proveedor.
- El fallo de un canal no debe bloquear los otros canales.
- Proteger credenciales, tareas programadas y endpoints; no exponer secretos al cliente.
- La tarea automática debe funcionar aunque Nico no abra CUEVA.

## 8. Criterios de aceptación funcional

### Calendario y pagos

- [ ] Día 31 se ajusta al último día de febrero y vuelve a 31 en marzo.
- [ ] Los ajustes por meses cortos no desplazan la referencia original.
- [ ] Alta el día 18 produce inicialmente vencimientos el día 18 de los meses siguientes.
- [ ] No se normaliza automáticamente la fecha de un alumno nuevo.
- [ ] Un cambio administrativo de día se conserva para períodos futuros.
- [ ] Un pago tardío conserva el calendario por defecto.
- [ ] El pago se registra con su fecha real.
- [ ] Un pago parcial deja saldo pendiente y no renueva/salda el período.
- [ ] No se aplican intereses ni recargos automáticos.

### Modificaciones y auditoría

- [ ] Solo un administrador puede modificar el vencimiento.
- [ ] El alcance predeterminado es el próximo período todavía no iniciado.
- [ ] Modificar el período actual exige selección y confirmación explícitas.
- [ ] La justificación es opcional.
- [ ] Cada cambio registra actor, timestamp, referencia anterior/nueva, alcance y resultado.
- [ ] Ambos administradores pueden consultar los registros.
- [ ] Los registros no pueden editarse ni eliminarse desde la interfaz.
- [ ] Los cambios recalculan recordatorios pendientes sin borrar el historial de envíos.

### Recordatorios y canales

- [ ] Se programan instancias a 5 días y 1 día antes.
- [ ] Ambas utilizan 12:00 por defecto y la zona horaria de Argentina.
- [ ] El administrador puede cambiar el horario y el cambio se audita.
- [ ] El horario configurado aplica a ambas instancias.
- [ ] Período totalmente pagado cancela las instancias pendientes.
- [ ] Saldo parcial mantiene el seguimiento.
- [ ] Cambio de vencimiento recalcula instancias pendientes.
- [ ] Los reintentos no duplican el mismo recordatorio.
- [ ] El correo no puede desactivarse por preferencia del alumno.
- [ ] La notificación interna se crea siempre y puede marcarse como leída.
- [ ] Push está activada por defecto y el alumno puede desactivarla.
- [ ] Sin permiso/suscripción push, correo e interna siguen funcionando.
- [ ] Una actualización de rutina genera notificación interna y push si corresponde.
- [ ] Los envíos se ejecutan sin que un administrador abra la PWA.
- [ ] Fallos y reintentos quedan registrados por canal.

## 9. Decisiones técnicas todavía no prescritas

Este documento no elige ni inventa tablas, columnas, RPC, endpoints, proveedor de email/push, cron, colas, ni políticas RLS. Codex debe:

1. Auditar el estado actual de `main`, migraciones, CUEVA-003A, configuración PWA/service worker y cualquier infraestructura de correo ya existente.
2. Verificar qué parte de notificaciones ya existe y reutilizarla si es correcta.
3. Proponer el diseño técnico mínimo, incluyendo persistencia del estado leído aunque no haya historial visible, idempotencia, concurrencia, scheduling, reintentos, permisos Web Push y auditoría.
4. Documentar cualquier conflicto con autenticación, perfil de email o reglas existentes antes de cambiar contratos.
5. Implementar en una rama aislada y entregar pruebas/evidencia.
6. No ejecutar migraciones en Supabase alojado, cambiar proveedores/secretos ni desplegar sin autorización explícita.

**Estado de implementación:** requisitos aprobados y documentados; no implica que estas funciones estén implementadas ni probadas.
