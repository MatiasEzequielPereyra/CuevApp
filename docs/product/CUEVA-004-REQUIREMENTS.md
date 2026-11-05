# CUEVA-004 — Especificación funcional y criterios de aceptación

**Estado:** reglas funcionales de presentación y revisión aprobadas; pendiente de diseño técnico, revisión de arquitectura e implementación.  
**Alcance:** adjuntar, revisar y conservar comprobantes de pagos realizados fuera de CUEVA.  
**No incluye:** pasarela, checkout, cobros con tarjeta, débitos ni procesamiento de pagos online.

## 1. Decisiones aprobadas

- Los pagos se realizan fuera de CUEVA (por ejemplo, transferencia o efectivo).
- El alumno puede adjuntar un comprobante asociado a un período de cuota.
- Nico, su socio y los alumnos pueden adjuntar comprobantes, según permisos.
- Solo un administrador puede confirmar o rechazar un comprobante.
- Adjuntar un archivo no confirma que el dinero haya sido recibido.
- Un pago en efectivo puede registrarse manualmente sin archivo.
- Estados mínimos: **Pendiente de revisión**, **Confirmado** y **Rechazado**.
- Formatos permitidos: **JPG/JPEG, PNG y PDF**.
- Tamaño máximo: **10 MB por archivo**.
- Cada presentación admite **exactamente un archivo**.
- Puede existir como máximo **un comprobante pendiente de revisión por período y alumno**.
- El rechazo exige un **motivo obligatorio y claro**, visible para el alumno.
- Si un comprobante es rechazado, el alumno puede presentar otro para el mismo período.
- Cada nueva presentación es independiente. La presentación rechazada anterior se conserva con su motivo y trazabilidad; no se sobrescribe ni elimina.
- Los archivos deben ser privados y su acceso debe estar restringido mediante autorización del servidor y políticas de datos/storage.

## 2. Validación y mensajes al usuario

La validación debe ejecutarse en cliente para feedback temprano y repetirse obligatoriamente en servidor. La validación del cliente nunca sustituye los controles del servidor.

Verificar como mínimo:
- tamaño real del archivo, con máximo de 10 MB;
- extensión permitida;
- MIME declarado;
- firma/magic bytes y estructura real del archivo, no solo su nombre o MIME;
- que el archivo pueda leerse/procesarse y no esté corrupto;
- que el usuario tenga permiso para adjuntarlo al período seleccionado.

Rechazar archivos que no superen las validaciones. No crear una presentación en estado pendiente ni asociar el archivo al período si la validación o la carga no finaliza correctamente. Evitar dejar objetos huérfanos ante fallos parciales, con limpieza segura y verificable.

Mensajes claros y accionables:
- **Formato no permitido:** “Este archivo no es compatible. Adjuntá una imagen JPG, PNG o un documento PDF”.
- **Excede el tamaño:** “El archivo supera los 10 MB. Elegí uno más liviano”.
- **Corrupto o ilegible:** “No pudimos leer el archivo. Volvé a descargar el comprobante o adjuntá una captura nueva”.
- **Fallo de carga/red:** “No se pudo subir el comprobante. Revisá tu conexión e intentá nuevamente”.

Los mensajes no deben revelar rutas internas, nombres de buckets, detalles de infraestructura ni información sensible. Diferenciar errores de validación de errores transitorios de red/servidor. Permitir reintentar cuando corresponda.

## 3. Flujo funcional

1. El alumno consulta sus períodos y selecciona el período correspondiente.
2. Adjunta JPG/JPEG, PNG o PDF de hasta 10 MB.
3. Cliente y servidor validan el archivo; el servidor vuelve a comprobar autorización, tamaño, tipo real y legibilidad.
4. Solo después de una carga y persistencia exitosas se crea la presentación en **Pendiente de revisión**.
5. Un administrador autorizado consulta el comprobante y decide confirmar o rechazar.
6. Si confirma, la integración con el libro de pagos debe registrar el pago de forma transaccional e idempotente, conforme a las reglas de CUEVA-003. No duplicar movimientos por reintentos.
7. Si rechaza, el administrador debe ingresar un motivo obligatorio y no vacío; se conserva el motivo y la identidad/fecha de la decisión.
8. No puede existir más de una presentación pendiente para el mismo alumno y período. El control debe ser efectivo también ante solicitudes simultáneas.
9. Después del rechazo, el alumno puede presentar un nuevo comprobante para el mismo período. La nueva presentación no modifica el registro rechazado anterior y contiene exactamente un archivo.

## 4. Privacidad y seguridad

- No utilizar URLs públicas permanentes ni hacer público el bucket/objeto.
- Verificar autorización en servidor en cada operación de carga, lectura, descarga, revisión y cambio de estado.
- Aplicar aislamiento por alumno/período y permisos administrativos; no confiar en IDs enviados por el cliente.
- Aplicar RLS y controles del servidor en conjunto, según la arquitectura real del repositorio.
- No exponer credenciales privilegiadas en el navegador.
- No aceptar como válida una extensión o MIME aislados: comprobar contenido real.
- Limitar tamaño tanto en cliente como en servidor y en la configuración de infraestructura aplicable.
- Definir protección antimalware acorde a capacidades reales de la infraestructura. No afirmar que existe escaneo si no está implementado y probado; si no hay escáner disponible, documentar el control compensatorio y el riesgo antes de producción.
- Evitar registrar contenido del comprobante o URLs firmadas en logs.
- Las URLs temporales, si se usan, deben generarse solo tras autorización y con expiración acotada.
- Las operaciones deben ser auditables y resistentes a reintentos.

## 5. Criterios de aceptación

### Archivos
- [ ] JPG y JPEG válidos de hasta 10 MB se aceptan.
- [ ] PNG válido de hasta 10 MB se acepta.
- [ ] PDF válido de hasta 10 MB se acepta.
- [ ] Se rechaza cualquier formato no permitido aunque se renombre con extensión permitida.
- [ ] Se rechaza un archivo cuyo contenido no coincida con el tipo declarado.
- [ ] Se rechazan archivos corruptos, vacíos o ilegibles con mensaje accionable.
- [ ] Se rechaza un archivo mayor a 10 MB, sin crear una presentación pendiente.
- [ ] El límite se aplica también en servidor; manipular el cliente no lo evita.
- [ ] Los errores de carga no dejan presentaciones pendientes falsas ni archivos huérfanos persistentes.

### Permisos y estados
- [ ] Un alumno solo puede adjuntar y consultar comprobantes de sus propios períodos.
- [ ] Un alumno no puede confirmar ni rechazar comprobantes.
- [ ] Un administrador autorizado puede revisar y resolver comprobantes.
- [ ] Un comprobante nuevo queda pendiente solo después de carga/persistencia exitosas.
- [ ] No se admite una segunda presentación mientras exista otra pendiente para el mismo alumno y período, incluso ante solicitudes simultáneas o reintentos.
- [ ] El administrador no puede rechazar sin ingresar un motivo no vacío; el motivo queda visible para el alumno.
- [ ] Cada presentación admite exactamente un archivo; no se puede adjuntar un segundo archivo a la misma presentación.
- [ ] El rechazo conserva el motivo obligatorio, la identidad del administrador y la fecha de la decisión.
- [ ] Un comprobante rechazado permanece consultable según permisos y no se sobrescribe.
- [ ] El alumno puede presentar otro comprobante para el mismo período después del rechazo.
- [ ] La nueva presentación es un registro separado y mantiene vínculo al mismo período.
- [ ] Confirmar un comprobante registra el pago asociado una sola vez y actualiza el saldo según CUEVA-003.
- [ ] Adjuntar un comprobante nunca actualiza por sí solo el saldo como pago confirmado.
- [ ] El registro manual de efectivo sigue funcionando sin adjunto.

### Privacidad y robustez
- [ ] Un usuario no autorizado no puede acceder al archivo mediante URL directa ni manipulando identificadores.
- [ ] Los archivos no son públicamente accesibles.
- [ ] Las verificaciones de permisos se ejecutan en servidor.
- [ ] Los reintentos no duplican presentaciones ni movimientos financieros.
- [ ] La interfaz diferencia errores de validación de fallos transitorios y permite reintentar cuando corresponda.
- [ ] Se prueban teclado, móvil y estados de carga/error/éxito sin bloquear el resto de la pantalla.

## 6. Casos de prueba mínimos

1. Subida de JPG/JPEG, PNG y PDF válidos.
2. Archivo de 10 MB exactos y archivo apenas superior.
3. Archivo de tipo no permitido renombrado como .jpg.
4. MIME falsificado y firma incompatible.
5. Archivo truncado/corrupto y archivo vacío.
6. Fallo de red durante carga y reintento.
7. Usuario A intenta leer/subir en período de usuario B.
8. Alumno intenta invocar confirmación/rechazo directamente.
9. Administrador confirma dos veces por doble clic/reintento.
10. Administrador intenta rechazar sin motivo: la acción se bloquea; con motivo, el rechazo queda auditado y visible para el alumno.
11. Mientras hay un comprobante pendiente, el alumno intenta enviar otro para el mismo período: se rechaza la segunda presentación, incluso con solicitudes concurrentes.
12. Tras el rechazo, el alumno presenta un nuevo archivo único para el mismo período; ambos registros y su historial permanecen.
13. Confirmación y creación del movimiento financiero ante fallo parcial/transacción/reintento.
14. Pago en efectivo sin comprobante.
15. Acceso a objeto privado por usuario no autorizado y expiración de URL temporal, si se utiliza.

## 7. Aspectos técnicos pendientes de definición

Las reglas funcionales de presentación están cerradas. Antes de implementar todavía debe resolverse, a partir de la arquitectura real:
- Política concreta de conservación/eliminación de archivos y registros, respetando el historial financiero.
- Mecanismo antimalware viable en la infraestructura disponible y control compensatorio si no existe. No afirmar que hay escaneo hasta implementarlo y probarlo.
- Reglas de idempotencia y vinculación transaccional con movimientos de CUEVA-003, verificadas contra el código integrado.
- Diseño de concurrencia que garantice un único comprobante pendiente por alumno/período (por ejemplo, una restricción transaccional adecuada; no asumir mecanismo antes de inspeccionar el esquema).
- Requisitos de accesibilidad y copy final de interfaz, sin alterar las reglas aprobadas.

## 8. Restricciones de ejecución

- No implementar cobros online.
- No modificar dashboards ni navegación (tarea de Mati).
- No asumir nombres de tablas, buckets, endpoints, funciones o políticas.
- Antes de implementar, inspeccionar el estado actualizado de `main`, documentación técnica, `AGENTS.md`, migraciones y el modelo de cuotas/pagos ya integrado.
- No ejecutar SQL, migraciones, cambios en Supabase alojado, despliegues ni operaciones sobre datos reales sin autorización explícita.
- Implementar en una rama aislada basada en el `main` vigente, coordinando conflictos con otros desarrolladores.
- Entregar pruebas y evidencia real; no declarar validación sin ejecutarla.
