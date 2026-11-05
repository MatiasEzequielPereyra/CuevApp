# CUEVA-004 — Propuesta de diseño técnico

**Estado:** propuesta para revisión; no implementada ni aprobada para producción.  
**Base inspeccionada:** `main` en `31fcd33c100422ec9a1657ff34bd246f03908920` (2026-11-05).  
**Alcance:** comprobantes de pagos realizados fuera de CUEVA. No incorpora cobros online.

## 1. Hallazgos de la implementación actual

- CUEVA-003A está integrado: `cueva_prices`, `cueva_periods`, `cueva_payments`, `cueva_reversals` y `cueva_private.billing_operations`.
- La escritura económica pasa por `public.cueva_billing_write`; la función privada serializa operaciones, aplica idempotencia y evita sobrepagos. La consulta administrativa utiliza `public.cueva_billing_snapshot`.
- `src/app/pagos/page.tsx`, `src/app/api/pagos/route.ts` y `BillingForm` son actualmente administrativos. `studentAdmin()` exige perfil `admin`.
- La API de pagos recibe JSON pequeño; no es un canal de subida de archivos ni debe reutilizarse para enviar binarios.
- `cueva_students` contiene las fichas administrativas. `cueva_student_invitations` vincula `student_id` con `user_id`, mientras que `cueva_profiles` identifica el rol Auth (`admin` / `alumno`). La ficha no expone actualmente una política de lectura propia al alumno.
- No se encontró implementación de comprobantes, bucket dedicado, tabla de comprobantes ni políticas de Storage para este flujo en los archivos revisados.
- El checkpoint actual describe el PR28, pero conserva como base efectiva anterior el SHA de antes de PR28. Para esta tarea prevalece el HEAD real de `main`, no esa referencia histórica.

## 2. Invariantes funcionales aprobados

- Un alumno puede presentar un comprobante para uno de sus propios períodos.
- Nico, su socio y los alumnos pueden adjuntar comprobantes según permisos; solo administradores confirman o rechazan.
- Si un administrador registra un pago y adjunta el respaldo, el archivo se vincula al movimiento sin segunda aprobación. Si adjunta solo el archivo, queda pendiente y no puede resolver su propia presentación.
- Un archivo por presentación, JPG/JPEG, PNG o PDF, máximo 10 MB.
- Máximo un comprobante pendiente por alumno y período, incluso ante solicitudes concurrentes.
- Rechazar exige un motivo obligatorio, no vacío y visible para el alumno.
- Tras un rechazo se conserva el archivo, el motivo, el actor y la fecha. Se permite una nueva presentación para el mismo período, como un registro independiente.
- Una presentación nueva no sobrescribe otra. Cada una contiene exactamente un archivo.
- Adjuntar no confirma dinero. Solo una confirmación administrativa crea el movimiento económico.
- Pagos externos, sin pasarela, checkout ni cobro online.
- Los pagos parciales y varios movimientos por período siguen siendo válidos según CUEVA-003A.

## 3. Modelo de datos propuesto (nombres ilustrativos)

No crear estas tablas hasta verificar el esquema final y aprobar una migración.

### Registro de presentaciones

Propuesta de tabla `cueva_receipts`:

- `id`: UUID de presentación.
- `period_id`: FK a `cueva_periods`.
- `student_id`: FK a `cueva_students`.
- `submitted_by`: UUID Auth del usuario que adjuntó el archivo.
- `storage_path`: ruta opaca del único objeto privado.
- `original_filename`: nombre saneado solo para presentación; nunca se usa como ruta.
- `detected_mime`: tipo verificado por servidor.
- `size_bytes`: tamaño medido por servidor.
- `sha256`: huella calculada en servidor para integridad/diagnóstico, no como autorización.
- `status`: `pending`, `confirmed` o `rejected`.
- `rejection_reason`: obligatorio cuando `status = rejected`; nulo en otros estados.
- `reviewed_by`, `reviewed_at`: actor y fecha de la decisión administrativa.
- `payment_id`: FK nullable a `cueva_payments`, único cuando no es nulo, para enlazar una confirmación con un único movimiento.
- `created_at`: fecha del servidor.

Restricciones esperadas:
- Un índice único parcial sobre `(student_id, period_id)` donde `status = 'pending'`. La garantía debe residir en PostgreSQL, no solo en la interfaz.
- `payment_id` único para impedir asociar el mismo movimiento a dos presentaciones.
- Checks coherentes entre estado, motivo, revisión y vínculo de pago.
- No permitir UPDATE/DELETE directos desde roles de cliente. Las transiciones se realizan mediante operaciones acotadas y auditables.
- No permitir cambiar `student_id`, `period_id` o `storage_path` después de crear la presentación, salvo un flujo administrativo explícito y auditado que todavía no está definido.

El historial de reenvíos se conserva como filas separadas. La consulta por período mostrará todas las presentaciones anteriores y su estado, respetando autorización.

## 4. Almacenamiento y validación de archivos

Propuesta: bucket privado dedicado a comprobantes. El nombre final se decide al implementar; no reutilizar el bucket de avatares ni inventar uno ya existente.

- Configurar límite de 10 MB y MIME permitidos en el bucket como primera barrera.
- Mantener el bucket privado. Las descargas se realizan con sesión autorizada o URL firmada de duración corta, generada después de autorizar cada acceso.
- No almacenar URLs públicas ni exponer rutas internas al alumno.
- Usar rutas generadas por servidor, no nombres aportados por el cliente; no sobrescribir objetos.
- Verificar tamaño real, extensión, MIME, magic bytes y capacidad de parseo/lectura. Rechazar archivos vacíos, truncados, corruptos o con tipo real incompatible.
- Validar en cliente para feedback rápido y repetir siempre en servidor.
- No crear fila pendiente hasta que el archivo haya sido validado, almacenado y comprobado.
- Si falla la persistencia de la fila tras subir el objeto, ejecutar compensación segura y verificable para evitar objetos huérfanos. Si la limpieza falla, registrar una incidencia técnica sin exponerla al usuario.
- Los mensajes de error deben ser accionables y no revelar bucket, ruta, stack trace ni secretos.

### Antimalware y liberación segura

La validación de extensión, MIME, magic bytes y parseo detecta archivos inválidos, pero no sustituye un análisis antimalware. No se encontró evidencia de un escáner ya integrado; no afirmar que existe.

**Flujo recomendado: cuarentena privada + análisis aislado + liberación explícita.**

1. Recibir el archivo en una ubicación privada de cuarentena, con nombre/ruta generados por servidor. No crear todavía una presentación pendiente visible ni generar una URL de descarga.
2. Aplicar límites de tamaño, extensión, MIME, firma y parseo en servidor.
3. Enviar el objeto a un worker/servicio de análisis aislado, sin credenciales de base de datos ni permisos generales sobre Storage.
4. Actualizar firmas del motor antimalware y registrar versión del motor, fecha, resultado y hash del archivo; no registrar su contenido ni URLs firmadas.
5. Si el resultado es limpio, mover/copiar de forma controlada al almacenamiento privado definitivo y recién entonces crear la presentación pendiente o asociar el respaldo al pago administrativo.
6. Si se detecta malware, bloquear y eliminar el objeto de acuerdo con el procedimiento seguro; registrar el evento mínimo necesario y mostrar un mensaje que indique que el archivo no pudo aceptarse.
7. Si el análisis falla, expira o el servicio no está disponible, mantener el archivo en cuarentena sin acceso de lectura/descarga y permitir reintento. No convertir un error del escáner en un resultado limpio.
8. Definir expiración y limpieza de cuarentena para cargas abandonadas y objetos huérfanos, con métricas/alertas para fallos de análisis.

**Selección tecnológica recomendada:** primero verificar si el hosting o proveedor de almacenamiento ofrece un escáner administrado compatible, con garantías contractuales de privacidad, retención limitada y no redistribución de archivos. Si no existe una opción adecuada o su costo no se justifica, utilizar ClamAV en un worker/contenedor aislado, con firmas actualizadas automáticamente y monitoreo de fallos. No ejecutar ClamAV dentro de una función serverless de la aplicación ni confiar en un proceso de análisis dentro de la petición HTTP de Vercel.

No utilizar VirusTotal público ni servicios que puedan compartir muestras: los comprobantes pueden contener datos personales y financieros. Un proveedor externo solo es aceptable tras revisar tratamiento, región, retención, subprocesadores y condiciones de privacidad.

El tamaño pequeño esperado del gimnasio permite empezar con un worker aislado y bajo volumen, pero la elección final depende de la infraestructura disponible, el costo y la operación de actualizaciones. No desplegar ni contratar un servicio pago sin revisar esos factores y obtener autorización cuando corresponda.


## 5. Identidad y autorización

Punto crítico de integración: no confiar en `student_id` enviado por el navegador.

- Para cada solicitud, verificar sesión con el mecanismo existente y obtener el usuario autenticado desde el servidor.
- Resolver en servidor la ficha administrativa vinculada a ese usuario usando la relación de invitación ya existente (`cueva_student_invitations.user_id` ↔ `student_id`), después de verificar rol `alumno`, estado de acceso y unicidad de la relación.
- Si la relación falta, es ambigua o no está activa, denegar por defecto. No buscar ni vincular por email en tiempo de carga.
- El administrador se valida con el helper de sesión/rol existente; no confiar en parámetros de rol del cliente.
- La lectura/descarga de cada comprobante y período debe volver a comprobar ownership o permiso administrativo.
- Diseñar políticas Storage para los objetos y políticas de base de datos para los metadatos. Son controles independientes; RLS de la tabla de comprobantes no protege automáticamente `storage.objects`.
- No usar `service_role` en el navegador. Si una operación del servidor usa el cliente privilegiado existente, el servidor debe verificar identidad, rol, período y propiedad antes de cada operación; preferir sesión del usuario y políticas RLS cuando sea viable.
- Mantener los endpoints fuera de cache y con respuestas `no-store`, validación de Origin y límites de cuerpo adecuados.

## 6. Flujos de adjuntos administrativos

Se distinguen dos casos para evitar autoaprobaciones implícitas:

### A. Administrador registra un pago y adjunta respaldo

- El administrador registra el movimiento mediante el flujo existente de CUEVA-003A.
- El archivo se analiza antes de quedar disponible.
- Si el análisis termina limpio, se vincula al movimiento como respaldo documental; no se crea una revisión pendiente ni se exige aprobación de otro administrador.
- La carga del archivo es opcional y no debe formar parte de una transacción que revierta un pago válido ya registrado. Si falla el adjunto, el movimiento permanece y el administrador puede reintentar la carga sin duplicarlo.
- Conservar actor y fecha de registro del pago, además de actor y fecha de carga del archivo.

### B. Administrador adjunta solo un comprobante

- Se crea una presentación pendiente después de validación, análisis limpio y persistencia.
- El administrador que la presentó no puede confirmarla ni rechazarla.
- El otro administrador autorizado debe resolverla con el mismo flujo y trazabilidad que una presentación de alumno.
- Adjuntar el archivo no crea ni modifica un pago.

La autorización de lectura/descarga debe seguir aplicándose en ambos casos. La etiqueta de estado del comprobante no reemplaza el estado ni el registro del movimiento financiero.


## 6. Operaciones y transacciones

Se recomienda separar operaciones acotadas:

1. **Presentar comprobante:** comprobar usuario/período, validar archivo, almacenar en cuarentena, analizar, liberar al almacenamiento privado definitivo y crear fila `pending` solo tras resultado limpio. La concurrencia se resuelve con la restricción única parcial. Una colisión devuelve un mensaje claro de que ya hay uno en revisión.
2. **Consultar/listar:** alumno ve solo sus presentaciones; admin ve las que puede revisar. Los archivos se sirven solo tras autorización y solo después del resultado antimalware limpio.
3. **Rechazar:** operación administrativa que exige motivo no vacío, registra actor/fecha y cambia estado una sola vez. Reintentos idénticos deben ser idempotentes.
4. **Confirmar:** operación administrativa que debe asociar la presentación con un único movimiento de `cueva_payments` y actualizar estado en una misma transacción. No implementar dos escrituras independientes desde el navegador.

### Importe y fecha al confirmar

El comprobante no proporciona por sí solo un dato financiero confiable para crear el movimiento. La implementación actual de `cueva_billing_write` requiere importe, fecha de pago y método; permite pagos parciales.

Por eso, antes de implementar confirmación hay que decidir y diseñar cómo el administrador introduce/verifica el importe y la fecha que se registrarán. No extraer automáticamente valores del archivo ni usar OCR como fuente de verdad. La operación final debe reutilizar las reglas de CUEVA-003A, incluida la idempotencia y el rechazo de importes superiores al saldo.

## 7. Compatibilidad con CUEVA-003A

- No modificar las tablas ni reglas existentes de precios, períodos, pagos y anulaciones salvo extensión mínima necesaria y revisada.
- No duplicar el libro de pagos ni calcular saldos desde la tabla de comprobantes.
- El comprobante confirmado referencia el movimiento financiero generado; no reemplaza al movimiento.
- Si el pago es parcial, el saldo se calcula como ya lo hace CUEVA-003A.
- Si se rechaza, no se crea movimiento ni se altera el saldo.
- Un período puede recibir presentaciones sucesivas a lo largo del tiempo, pero nunca más de una pendiente simultáneamente. La posibilidad de una nueva presentación tras una confirmación dependerá del saldo y de la regla de negocio final para pagos parciales; el límite aprobado es sobre pendientes simultáneos.

## 8. Coordinación y archivos sensibles a conflictos

- PR28 modifica scripts/documentación de reconciliación de invitaciones y checkpoint; no cambia el ledger, la API de pagos ni el esquema de comprobantes.
- La rama de dashboards `codex/cueva-dashboard-002` está 9 commits detrás de `main`; su único commit propio es el encargo documental UI-002. No usarla como base.
- `docs/cueva-work-plans` también está 9 commits detrás y contiene `facu.md`; se revisó como referencia de coordinación, pero los estados antiguos de cuotas/comprobantes allí no prevalecen sobre el Product Master y el código actual.
- La rama `codex/cueva-alumnos-eliminar` está divergida y contiene cambios de `src/app/alumnos/page.tsx`, `src/proxy.ts`, migración de alumnos y helpers de laboratorio. No reutilizar ni fusionar esa rama. Revisar nuevamente antes de tocar archivos compartidos.
- Evitar modificar la pantalla de pagos administrativa salvo que el alcance de revisión administrativa lo requiera. No tocar dashboards de Mati.
- No editar Auth, invitaciones, reconciliación SMTP ni configuración de transporte salvo dependencia demostrada.

## 9. Pruebas requeridas antes de aceptar implementación

- JPG/JPEG, PNG y PDF válidos; 10 MB exactos y límite excedido.
- Extensión/MIME falsificados, firma incorrecta, archivo vacío, truncado/corrupto y PDF/imagen no parseable.
- Un archivo por presentación; segundo archivo rechazado.
- Una presentación pendiente bloquea una segunda para el mismo alumno/período, incluso con concurrencia.
- Rechazo sin motivo bloqueado; rechazo con motivo auditado y visible al alumno.
- Reenvío tras rechazo conserva ambos registros y objetos.
- Alumno A no puede cargar, listar, descargar, confirmar ni rechazar elementos de B manipulando IDs/rutas.
- Usuario no vinculado o con relación ambigua no puede adjuntar.
- Admin puede revisar; alumno no puede resolver.
- Confirmación crea un solo movimiento; doble clic/reintento no duplica; fallo transaccional no deja estado/pago desincronizados.
- Pago parcial y saldo actualizado conforme al ledger.
- Rechazo no altera saldo.
- Objeto privado inaccesible sin autorización y URLs firmadas expiradas.
- Fallo de red/carga/DB y compensación de objeto huérfano.
- Regresión del registro manual de efectivo y del flujo administrativo actual de CUEVA-003A.
- Teclado, lector de pantalla, móvil y estados de carga/error/éxito.

## 11. Decisiones que permanecen pendientes antes del código

1. **Importe y fecha al confirmar una presentación de alumno:** definir y aprobar la interacción administrativa para verificar/introducir los datos que exige `cueva_billing_write`.
2. **Nueva presentación después de un comprobante confirmado:** decidir si se permite cuando queda saldo pendiente, en coherencia con pagos parciales. El límite de un pendiente simultáneo ya está aprobado.
3. **Selección del escáner:** verificar opciones administradas compatibles y su privacidad/costo; si no hay una opción adecuada, evaluar worker aislado con ClamAV. La arquitectura de cuarentena y fail-closed queda recomendada, pero no se ha contratado ni desplegado infraestructura.

## 12. Límites de esta propuesta

- No se creó migración, tabla, bucket, endpoint, componente ni dependencia.
- No se ejecutó SQL, no se modificó Supabase alojado, Storage, Auth, RLS, datos reales ni producción.
- No se realizaron pruebas locales ni build desde esta sesión; la inspección fue documental y de archivos en GitHub.
- Antes de implementar, releer `AGENTS.md`, checkpoint y guías vigentes de Next.js desde `node_modules`, verificar configuración real de Storage y estado de las migraciones alojadas con autorización separada.
