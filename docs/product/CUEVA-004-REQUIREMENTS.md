# CUEVA-004 — Especificación funcional y criterios de aceptación

**Estado:** reglas funcionales de presentación y revisión aprobadas; pendiente de diseño técnico, revisión de arquitectura e implementación.  
**Alcance:** adjuntar, revisar y conservar comprobantes de pagos realizados fuera de CUEVA.  
**No incluye:** pasarela, checkout, cobros con tarjeta, débitos ni procesamiento de pagos online.

## 1. Decisiones aprobadas

- Los pagos se realizan fuera de CUEVA (por ejemplo, transferencia o efectivo).
- El alumno puede adjuntar un comprobante asociado a un período de cuota.
- Nico, su socio y los alumnos pueden adjuntar comprobantes, según permisos.
- Solo un administrador puede confirmar o rechazar un comprobante.
- Si un administrador registra un pago y adjunta su comprobante como respaldo, el archivo se vincula al movimiento sin requerir aprobación de otro administrador; el pago no se revierte si falla la carga opcional del archivo.
- Si un administrador adjunta un comprobante sin registrar un pago, queda pendiente de revisión y no puede resolverlo el mismo administrador que lo presentó.
- Adjuntar un archivo no confirma que el dinero haya sido recibido.
- Un pago en efectivo puede registrarse manualmente sin archivo.
- Estados mínimos: **Pendiente de revisión**, **Confirmado** y **Rechazado**.
- Formatos permitidos: **JPG/JPEG, PNG y PDF**.
- Tamaño máximo: **10 MB por archivo**.
- Cada presentación admite **exactamente un archivo**.
- Puede existir como máximo **un comprobante pendiente de revisión por período y alumno**.
- El rechazo exige un **motivo obligatorio y claro**, visible para el alumno.
- Si un comprobante es rechazado, el alumno puede presentar otro para el mismo período.
- Si un comprobante fue confirmado pero el período conserva saldo pendiente, el alumno puede presentar otro para ese mismo período para informar otro pago parcial.
- No se admite una nueva presentación si ya existe una presentación pendiente para ese alumno/período ni si el período está totalmente pagado.
- Cada nueva presentación es independiente. Las presentaciones anteriores se conservan con su estado y trazabilidad; no se sobrescriben ni eliminan.
- Al confirmar una presentación, el administrador debe ingresar/verificar manualmente el importe recibido, la fecha real del pago y el método de pago. No se utiliza OCR como fuente de verdad.
- El importe debe ser positivo y no superar el saldo pendiente. La confirmación reutiliza las reglas financieras e idempotencia de CUEVA-003A.
- Las correcciones de movimientos ya confirmados se realizan mediante el mecanismo financiero de corrección/reversión, no mediante una nueva presentación.
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
5. Un administrador autorizado consulta el comprobante y decide confirmar o rechazar. El administrador que presentó un comprobante sin registrar un pago no puede revisar su propia presentación.
6. Para confirmar, el administrador verifica e ingresa manualmente el importe efectivamente recibido, la fecha real del pago y el método de pago. El archivo es evidencia de revisión; no se extraen esos datos automáticamente ni se utiliza OCR como fuente de verdad.
7. El servidor valida que el importe sea positivo y no supere el saldo pendiente. La confirmación registra el movimiento mediante la operación financiera de CUEVA-003A, de forma transaccional e idempotente, sin duplicarlo por reintentos.
8. Si rechaza, el administrador debe ingresar un motivo obligatorio y no vacío; se conserva el motivo y la identidad/fecha de la decisión.
9. No puede existir más de una presentación pendiente para el mismo alumno y período. El control debe ser efectivo también ante solicitudes simultáneas.
10. Después del rechazo, o de una confirmación que deje saldo pendiente, el alumno puede presentar un nuevo comprobante para el mismo período. Cada presentación es un registro independiente y no modifica las anteriores.
11. No se permite una nueva presentación si el período está totalmente pagado. Cualquier corrección de un movimiento confirmado debe usar el mecanismo financiero de corrección/reversión.

## 4. Privacidad y seguridad

- No utilizar URLs públicas permanentes ni hacer público el bucket/objeto.
- Verificar autorización en servidor en cada operación de carga, lectura, descarga, revisión y cambio de estado.
- Aplicar aislamiento por alumno/período y permisos administrativos; no confiar en IDs enviados por el cliente.
- Aplicar RLS y controles del servidor en conjunto, según la arquitectura real del repositorio.
- No exponer credenciales privilegiadas en el navegador.
- No aceptar como válida una extensión o MIME aislados: comprobar contenido real.
- Limitar tamaño tanto en cliente como en servidor y en la configuración de infraestructura aplicable.
- Analizar todos los archivos en una zona privada de cuarentena antes de habilitar su lectura/descarga o crear la presentación pendiente visible. Un resultado limpio es requisito para liberar el archivo.
- Si el análisis detecta malware, bloquear el archivo, no crear una presentación pendiente y eliminar el objeto malicioso de acuerdo con un procedimiento seguro; registrar el evento sin almacenar contenido sensible en logs.
- Si el escáner no está disponible o falla, mantener el archivo aislado, no liberarlo ni marcarlo como limpio y permitir reintento; no degradar silenciosamente a validación de extensión/MIME.
- No enviar comprobantes a servicios públicos de análisis que puedan compartir muestras o conservarlas para análisis comunitario. Cualquier proveedor externo debe ofrecer garantías contractuales de privacidad, retención y tratamiento de datos.
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
- [ ] Si una presentación fue confirmada y todavía queda saldo pendiente, el alumno puede presentar otro comprobante independiente para el mismo período.
- [ ] No se permite una nueva presentación si ya existe una pendiente para el mismo alumno/período ni si el período está totalmente pagado.
- [ ] Las presentaciones previas rechazadas o confirmadas permanecen consultables según permisos y no se sobrescriben.
- [ ] Al confirmar, el administrador debe ingresar/verificar importe, fecha real del pago y método; OCR no es fuente de verdad.
- [ ] El importe confirmado debe ser positivo y no superar el saldo pendiente calculado por CUEVA-003A.
- [ ] La confirmación registra el pago asociado una sola vez y actualiza el saldo según CUEVA-003A.
- [ ] Las correcciones de movimientos confirmados utilizan el mecanismo financiero de corrección/reversión, no un nuevo comprobante.
- [ ] Adjuntar un comprobante nunca actualiza por sí solo el saldo como pago confirmado.
- [ ] El registro manual de efectivo sigue funcionando sin adjunto.

### Privacidad y robustez
- [ ] Un usuario no autorizado no puede acceder al archivo mediante URL directa ni manipulando identificadores.
- [ ] Los archivos no son públicamente accesibles.
- [ ] Ningún archivo se puede consultar o descargar antes de obtener un resultado antimalware limpio.
- [ ] Un archivo detectado como malicioso no crea una presentación pendiente ni queda accesible.
- [ ] Si el escáner falla o no responde, el archivo permanece aislado y el usuario puede reintentar sin liberar el archivo.
- [ ] Un administrador que adjunta un comprobante junto con el registro de un pago no necesita una segunda aprobación; un fallo del adjunto no duplica ni revierte el pago ya registrado.
- [ ] Un administrador que solo presenta un comprobante no puede aprobar ni rechazar su propia presentación.
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
13. Tras confirmar un pago parcial, el alumno presenta otro comprobante para el mismo período porque aún hay saldo; ambos registros permanecen y solo existe un pendiente simultáneo.
14. Con el período totalmente pagado, se rechaza una nueva presentación.
15. Al confirmar, el administrador ingresa importe, fecha real y método; se bloquea importe cero/negativo y cualquier importe superior al saldo.
16. Doble clic/reintento durante la confirmación no duplica el movimiento; la confirmación y el vínculo del comprobante son transaccionales.
17. Una corrección de pago confirmado sigue el mecanismo de corrección/reversión y no crea una presentación sustitutiva.
18. Pago en efectivo sin comprobante.
19. Acceso a objeto privado por usuario no autorizado y expiración de URL temporal, si se utiliza.

## 7. Aspectos técnicos pendientes de definición

Las reglas funcionales de presentación están cerradas. Antes de implementar todavía debe resolverse, a partir de la arquitectura real:
- Política concreta de conservación/eliminación de archivos y registros, respetando el historial financiero.
- Selección y despliegue del escáner antimalware compatible con la infraestructura; el diseño recomendado es cuarentena privada + worker aislado de análisis + liberación solo tras resultado limpio. No afirmar que hay escaneo hasta implementarlo y probarlo.
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
