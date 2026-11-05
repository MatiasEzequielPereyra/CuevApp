# Una nueva autorización tras rechazo de autenticación SMTP

Procedimiento local para REVIEW. No autoriza ejecución alojada por el ejecutor.
[Encargo original íntegro](CUEVA-INVITACION-RECHAZO-SMTP-002-task.md).
Prevalece sobre la prohibición absoluta de un segundo intento del procedimiento
PR26 solamente en el caso exacto descrito aquí. No es una liberación genérica.

## Condiciones exactas

El ledger actual debe ser uncertain, terminado (finished_at no nulo), con generación
fuente1, sin autorización anterior enlazada. La ficha/trabajo/UUID/correo deben ser
exactos; trabajo review y lease igual al attempt_id retenido. Gate generación2,
ready=false, allowed_session nulo y operación invite-resend con ese mismo attempt_id.
Perfil alumno, cuenta no confirmada, sin login ni ninguna sesión, no borrada/baneada.
La reserva usa advisory de sesión y locks transaccionales existentes.

Un operador autorizado debe revisar el expediente privado del intento retenido:
rechazo SMTP534/5.7.9 Application-specific password required, o535/5.7.8
BadCredentials, solicitud concluida, ausencia de aceptación SMTP y quiescencia real.
No alcanza uncertain, HTTP500, un timeout, fecha transcurrida ni ausencia de login.
El diagnóstico es una clasificación canónica de ese rechazo documentado; conservar
el log original sin reescribirlo, ligado por providerResponseSha256. Si hay resultado
ambiguo, aceptación, otra identidad u operación pendiente desconocida: detener.

El proveedor actual autorizado es Brevo, no Google. No exigir desbloquear Gmail ni
modificar SMTP/flags desde esta herramienta. El humano/Orchestrator verifica el
proveedor y su configuración guardada antes de intentar esta operación.

## Instalación posterior a auditoría

1. Verificar el commit aprobado. No editar/reaplicar migraciones históricas de PR26.
2. Aplicar únicamente la migración nueva
   `20261105125521_cueva_invitation_reauthorization.sql`, una vez aprobada, después
   de PR26. No ejecuta un reintento ni modifica ready: agrega historial privado,
   su trigger inmutable y enlace previous_attempt_id al ledger actual.
3. Postflight de catálogo: historial con RLS y sin permisos de tablas para
   PUBLIC/anon/authenticated/service_role; trigger que rechaza UPDATE/DELETE incluso
   al operador normal; FK del enlace al historial. No hay RPC ni grants nuevos.
4. Instalar las dependencias aisladas: desde tools/cueva-smtp, `npm ci --ignore-scripts`.
   Para el laboratorio se incluyen devDependencies; en operación basta omitirlas.
   Nodemailer10.3.1 es cliente; smtp-server3.21.3 es exclusivamente el simulador local.
   No se cambió package.json/lockfile de la aplicación.

## TLS y credenciales privadas

Mantener el transporte de PR28: Session pooler exacto y pg.Client de sesión,
rejectUnauthorized:true, sin query/sslmode ni overrides inseguros. El certificado
raíz público se obtuvo desde Database Settings según el registro de
[PR28](https://github.com/MatiasEzequielPereyra/CuevApp/pull/28):
[Supabase Root2021 CA](https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt),
fingerprint SHA256 de certificado DER
`807025AD50D4ED219D2C9C7D299C004F824EB00CF7F65AFEF607D07B72E6CAFA`.
No confundir ese fingerprint con el hash de bytes de un archivo PEM.

El Orchestrator verifica fuente/fingerprint del certificado público y pasa su ruta
en NODE_EXTRA_CA_CERTS únicamente al crear los procesos Node de operación: Node lo
lee al iniciar. No instalar confianza global, bajar TLS ni exportar secretos para
resolver un error. Quitar PGOPTIONS/PGSSLNEGOTIATION y overrides Node inseguros del
entorno hijo controlado, como en PR28. Esta entrega no volvió a descargar ni probar
el certificado/endpoint alojado; conserva esa precondición operativa acreditada.

Tres credenciales distintas, aportadas solo por el canal privado efímero del operador:
contraseña DB (URI en memoria), clave de servicio Supabase y clave SMTP de Brevo.
También login SMTP técnico exacto. La contraseña de aplicación Gmail NO sustituye
ninguna. No pedir valores en chat, comandos con valores, historial, .env, Git,
capturas o logs; no extraer/descifrar la clave sensible de Vercel ni leer la clave
oculta de Supabase. Si falta una credencial existente, detener. Se conserva el
procedimiento de captura enmascarada/memoria de
[operación PR26](CUEVA-INVITACION-RECUPERACION-001-operations.md).

## Expediente y nuevo preflight sin correo

Todos los archivos siguientes quedan fuera de cualquier repositorio, en directorio
privado con ACL restrictiva. El modo0600 solicitado por Node no reemplaza ACL Windows.
Conservar autorización y evidencia anteriores intactas. Preparar una solicitud nueva:

- studentId/authUserId/email: identificadores capturados y correo congelado.
- jobLease y previousAttemptId: ambos el attempt_id actual retenido.
- previousAuthorizationHash: evidence_hash del ledger retenido, no recalcularlo
  reserializando la autorización vieja con PowerShell.
- generation:2; expectedState:"review"; attemptId:UUID nuevo, distinto de los IDs
  históricos (el código también rechaza reutilizar el source_lease original).
- priorRejection: smtpCode534 o535, diagnostic canónico indicado arriba,
  observedAt ISO exacto y evidenceSha256 del registro revisado de rechazo.
- requestsQuiescent, originalRequestCompleted y noSmtpAcceptance:true,
  declarados por el operador tras revisar el expediente, no inferidos por código.
- smtpLoginSha256: hash UTF8 del login técnico de Brevo esperado;
  supabaseSmtpConfigReviewed:true tras confirmar host587/login/remitente y que la
  credencial probada corresponde a la configuración guardada por el humano.

El registro de rechazo conserva los campos del expediente PR26 y agrega
previousAttemptId, previousAuthorizationHash, providerResponseSha256 y
smtpEnhancedCode (5.7.9 para534, 5.7.8 para535). Sus identidades/lease/generación,
fecha y clasificación deben coincidir exactamente con la solicitud nueva.

Configurar las variables privadas existentes CUEVA_RECONCILIATION_REQUEST,
CUEVA_RECONCILIATION_EVIDENCE, CUEVA_OPERATIONS_DATABASE_URL, CUEVA_SERVICE_KEY,
CUEVA_SUPABASE_URL y CUEVA_PRODUCT_ORIGIN. Para el preflight, agregar únicamente al
proceso hijo CUEVA_SMTP_USER, CUEVA_SMTP_KEY y CUEVA_SMTP_REPAIR_EVIDENCE (ruta de
archivo nuevo, aún inexistente, fuera del checkout):

```text
node tools/cueva-smtp/preflight.mjs --verify-auth
```

La CLI fija smtp-relay.brevo.com:587, STARTTLS obligatorio, cadena/hostname verificados,
TLS>=1.2 y forceAuth:true. Solo usa verify(), nunca sendMail: EHLO/STARTTLS/AUTH/QUIT,
sin MAIL FROM/RCPT/DATA ni llamadas DB/Auth. Una sesión TLS sin AUTH no genera prueba.
No hay reintento automático ni logging de respuestas/excepciones SMTP. Error/cierre
o clave incorrecta: sin archivo de reparación y sin reserva.

Éxito escribe de forma exclusiva un registro ligado a la nueva autorización y al
hash del rechazo, con checkedAt posterior al rechazo, login hash, proveedor y flags
de TLS/AUTH verificados/sin comandos de correo. Stdout imprime solo un estado fijo
y evidenceSha256. Poner ese hash en smtpRepairEvidenceSha256 de la solicitud nueva.
El binding excluye este último campo para evitar un digest circular. No editar
después los archivos; conservar bytes UTF8/saltos de línea exactos y fechas ISO.

El preflight acredita autenticación de esas credenciales contra ese proveedor, no
que Supabase tenga la misma clave oculta, ni autorización de remitente, cuota,
aceptación SMTP o entrega. El cotejo de configuración guardada sigue siendo una
precondición humana. Los hashes prueban integridad/vínculo, no firman ni autentican
por sí solos un log externo: el operador autorizado debe revisar su procedencia.
Archivos sintéticos del laboratorio se rechazan con local=false en la CLI real.

## Check, reserva y un solo apply

```text
node scripts/reconcile-student-invitation.mjs --check
node scripts/reconcile-student-invitation.mjs --apply
```

Check verifica toda la evidencia y el estado exacto sin archivar, reservar, generar
nonce o enviar. No interpretar NO_SEND como permiso para cambiar attemptId.
Tras CHECKED_NO_SEND eligible y autorización específica revisada, apply:

1. Bloquea y vuelve a validar el mismo estado/cuenta/relaciones.
2. Archiva to_jsonb del ledger previo completo, con su attempt_id, estados/fechas,
   hash de autorización y todos sus campos; liga successor_attempt_id, hash de la
   nueva autorización y hashes del rechazo y reparación. Historial append-only.
3. Actualiza la fila actual en sitio, sin borrarla/recrearla: nuevo attempt_id y
   previous_attempt_id, estado reserved, source_generation2 y lease fuente anterior.
4. En la misma transacción sustituye el marcador exacto, cambia lease público,
   incrementa a generación3 y renueva nonce. ready sigue false. Commit antes de SMTP.
5. Usa la misma invitación y exige el mismo UUID devuelto. Solo aceptación sin
   inconsistencias finaliza sent/accepted y libera ese marcador. El alumno debe
   aceptar el enlace y elegir contraseña propia para habilitar acceso.

Replays de la autorización nueva devuelven NO_SEND; los de la vieja o distintos IDs
no pueden adquirir la reserva, aun con otro preflight exitoso. El historial se
conserva también si el envío nuevo falla. Un rechazo/timeout/respuesta perdida queda
uncertain/review con operación pendiente y generación3; no hay una tercera
autorización genérica ni bucle automático. Una interrupción dura puede conservar
reserved/dispatching/processing: tampoco autoriza robar/reanudar la reserva.

## Rollback y límites

Detener el uso de las herramientas y conservar ledger, historial, identidad, ficha,
perfil, nonce/generación y marcadores. No quitar el trigger ni borrar/recrear filas,
volver a un nonce anterior o liberar ready/operación por SQL manual. Una reversión
de código no retira un correo ya aceptado. Otro intento o reconciliación de estado
ambiguo requerirá un encargo y evidencia distintos.

Autenticación SMTP/DB, TLS del proveedor y envío alojados NO ejecutados por este
ejecutor. No se modifican configuración Brevo/Supabase, SMTP, flags, cuentas ni
migraciones alojadas. La aplicación del mecanismo y el único reintento real quedan
a cargo del Orchestrator después de auditar y verificar proveedor/configuración.

Fuente técnica: [Nodemailer SMTP/verify](https://nodemailer.com/smtp).
