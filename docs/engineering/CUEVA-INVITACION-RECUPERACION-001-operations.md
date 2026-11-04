# Reconciliación privada de una invitación rechazada por SMTP

Estado del incremento: REVIEW local. No autoriza ejecutar este procedimiento
alojado desde el ejecutor. [Encargo](CUEVA-INVITACION-RECUPERACION-001-task.md).

## Capacidad y precondiciones

Herramienta exclusiva del operador: `scripts/reconcile-student-invitation.mjs`.
Conexión SQL administrativa privada y clave de servicio en memoria. Sin nueva ruta
web, RPC pública, pantalla ni permiso de alumnos, visitantes o service_role sobre
el registro nuevo. No se cambia el código del alta ni la recuperación de contraseña.
La herramienta no llama createUser, generateLink, resetPassword ni updateUser.

Identifica ficha por UUID, trabajo por su lease original, identidad por UUID ya
capturado, generación y estado review esperados, y correo exacto congelado. En una
transacción bloquea ficha/trabajo/gate/perfil/usuario y contrasta todas las relaciones.
Exige perfil alumno, correo Auth y ficha iguales al reservado, cuenta sin confirmar,
sin login, sin sesiones Auth (ni siquiera anteriores al corte), sin eliminación o
baneo, ready=false, allowed_session nulo, nonce válido y operación nula. No busca
ni adopta identidades por correo. Perfil admin o cuenta confirmada se detienen.

El rechazo histórico no puede deducirse de review, de una respuesta HTTP 500 ni de
la ausencia de sesión. El operador debe acreditar en un registro privado el 535
BadCredentials de esa solicitud concreta, completada y sin aceptación SMTP, y
asegurar que todas las peticiones anteriores y operadores externos están detenidos.
El SHA256 de esa evidencia y la declaración explícita son parte de la solicitud;
la herramienta lee el registro privado y verifica su hash, las identidades exactas,
generación, fecha no anterior al trabajo y el rechazo 535. No certifica por sí misma
la autenticidad del proveedor ni descarga logs alojados.
Esta confianza administrativa es una precondición, no una señal inventada por SQL.
Si solo hay un timeout, fallo genérico, aceptación o duda: NO ejecutar apply.

## Aplicación posterior a revisión

1. Confirmar commit aprobado y base, guardar inventario privado de ese único caso.
   El antecedente remoto está en PR25; no copiar identificadores personales a Git.
2. Aplicar íntegra y transaccionalmente la migración nueva
   `20261104182640_cueva_invitation_reconciliation.sql`, después de acceso, alumnos
   e invitaciones. Crea solo ledger privado con RLS/revocaciones y permite el nuevo
   kind invite-resend en el gate. No editar las migraciones históricas ni reaplicar
   la invitación anterior: su versión alojada difiere del nombre local, según PR25.
3. Verificar tabla privada sin grants API, constraint y datos preexistentes intactos.
   Conservar SMTP/flags cerrados para la operación general. La herramienta permite
   este único envío explícito sin abrir el formulario al público. Plantilla invite
   versionada, Site URL y allowlist existentes deben estar verificadas por operador.
4. Obtener las credenciales existentes mediante el canal privado autorizado; jamás
   copiarlas al chat, argumentos de comandos, archivos versionados o logs. Variables:
   CUEVA_SUPABASE_URL, CUEVA_PRODUCT_ORIGIN, CUEVA_SERVICE_KEY,
   CUEVA_OPERATIONS_DATABASE_URL, CUEVA_RECONCILIATION_REQUEST y
   CUEVA_RECONCILIATION_EVIDENCE (las dos últimas son rutas privadas).
   La CLI fija el proyecto/origen reales, PostgreSQL directo TLS verificado y el
   puerto 5432. No se desactiva TLS ni se permite apuntar a otro proyecto/pooler.
5. Preparar JSON privado fuera del checkout, acceso restringido al operador. Campos:
   studentId, jobLease, authUserId, attemptId (nuevo UUID conservado para replay),
   generation (entero observado), expectedState="review", email (exacto normalizado),
   priorRejection={smtpCode:535, diagnostic:"BadCredentials", evidenceSha256,
   observedAt:fecha ISO}, requestsQuiescent=true, noSmtpAcceptance=true,
   originalRequestCompleted=true. No incluir contraseñas, tokens o nonce. No cambiar
   el documento entre check/apply/replay: su hash identifica la autorización exacta.
   El archivo de evidencia es un JSON revisado por el operador desde el log original:
   source="operator-reviewed-smtp-rejection", studentId, jobLease, authUserId,
   email y generation iguales a solicitud, smtpCode=535, diagnostic="BadCredentials",
   observedAt igual a priorRejection.observedAt y las tres declaraciones verdaderas
   originalRequestCompleted, noSmtpAcceptance, requestsQuiescent. Calcular SHA256
   de sus bytes UTF8 exactos, incluyendo salto de línea si lo hay; ponerlo en
   priorRejection.evidenceSha256. Guardar también el log original en el expediente
   privado. Estos archivos no van a Git, evidencia pública, trazas o capturas.
6. Ejecutar `node scripts/reconcile-student-invitation.mjs --check`. Solo consultas
   con locks y rollback, sin SMTP, nonce, registro ni cambios. CHECKED_NO_SEND eligible
   indica que las precondiciones actuales se cumplen; apply las vuelve a comprobar.
7. Ejecutar una sola vez `node scripts/reconcile-student-invitation.mjs --apply`.
   APPLIED accepted significa respuesta de la API con el UUID capturado y registro
   finalizado; NO prueba entrega en bandeja. El resultado no imprime identificadores,
   correo, enlaces ni secretos. Cualquier STOPPED/NO_SEND/uncertain exige inspección.
8. Verificar por lectura privada mismo UUID/perfil/ficha, trabajo sent, generación
   incrementada exactamente una vez, gate ready=false y operación nula. El alumno
   usa el enlace real de invitación, elige contraseña y completa el gate existente.
   Recepción y primer acceso alojados siguen NOT_VERIFIED hasta observarlos.

El callback de alumnos existente rechaza con 404 si ownerOnly sigue activo. Esta
herramienta no cambia flags ni habilita ese callback: enviar no implica que ya pueda
usarse el enlace en producción. Coordinar su habilitación por el Orchestrator bajo
autorización vigente antes de probar primer acceso; no dejar que el alumno confirme
su cuenta directamente desde Auth para eludirlo. La prueba local usa el callback
general existente explícitamente habilitado solo en el laboratorio.

## Reserva, replay e interrupciones

La tabla privada tiene una sola fila por ficha y UUID Auth; no permite un segundo
intento por cambiar attemptId. Conserva lease/generación originales y hash de la
solicitud, con estados reserved, dispatching, accepted o uncertain. No almacena el
nonce bruto ni el enlace. El lock de sesión advisory serializa comandos y las
precondiciones se vuelven a comprobar bajo locks de fila. Operaciones directas
desde consola/Auth de otro operador están fuera de ese lock: requieren quiescencia.

Al reservar se cambia el lease público a attemptId y estado processing, se incrementa
generación, renueva hash de nonce y fija operation_id con kind invite-resend.
ready permanece false. El lease viejo no puede finalizar ese trabajo. begin_operation,
preflight y bind existentes rechazan una operación pendiente. La herramienta libera
los locks de fila antes de SMTP para que GoTrue pueda actualizar auth.users; conserva
la reserva durable y el advisory de sesión, sin bloquear el proveedor por transacción.

No hay takeover por tiempo ni resumption. Antes de SMTP se persiste dispatching.
Solo una respuesta exitosa con UUID exacto y postcondiciones todavía seguras permite
sent/accepted y liberar el marcador del gate. No se activa ready; se conserva el
nuevo nonce para aceptación y contraseña por el flujo normal.

| Punto de fallo | Estado conservado y acción |
| --- | --- |
| Antes de commit de reserva | Rollback; check/apply vuelve a validar. Si commit se pierde, inspeccionar ledger antes de repetir. |
| Después de reserva, antes de SMTP | reserved o dispatching; gate cerrado; replay NO_SEND. No se asume que un intento pendiente no envió. |
| Rechazo/HTTP 500/excepción/UUID diferente | uncertain y trabajo review; marcador del gate conservado. Sin reenvío automático. GoTrue puede ocultar535 dentro de 500: no se inventa clasificación. |
| SMTP aceptado, respuesta perdida | uncertain/review y gate cerrado aunque exista un correo; replay no envía otro. |
| SMTP aceptado, proceso muerto antes de finalizar | dispatching/processing; gate cerrado; replay NO_SEND. Reconciliación distinta requiere otro encargo y evidencia. |
| Finalizado accepted, respuesta del comando perdida | Replay devuelve accepted sin envío ni escritura, incluso tras completar contraseña. |

Los enlaces de generación/nonce anteriores dejan de pasar preflight desde la
reserva. Con resultado ambiguo tampoco se acepta el enlace nuevo porque el marcador
permanece pendiente. No se promete exactamente una vez en SMTP; se sacrifica la
disponibilidad del intento ambiguo para evitar duplicados y activación indebida.
No existe botón para liberar estas reservas ni para editar ready a mano.

## Rollback conservador

Detener el uso de la herramienta y conservar ledger, trabajo, UUID, perfil y gate.
No volver a generation/nonce anteriores ni quitar marcadores de intentos pendientes.
Revertir código no revoca un correo ya aceptado. Si ya existe accepted, el enlace
permite únicamente la incorporación y contraseña existentes. No borrar cuentas ni
tabla para reintentar. No quitar la constraint ampliada mientras haya invite-resend.
Cualquier segundo intento o cierre de estado ambiguo queda fuera de este incremento.

## Fuentes consultadas

La API [inviteUserByEmail](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail)
envía invitación; el método [resend](https://supabase.com/docs/reference/javascript/auth-resend)
documenta otros tipos de confirmación y no sustituye silenciosamente este flujo.
La conservación de UUID para cuenta preparada se acredita en laboratorio, no se
infiere de la descripción de la API. Changelog consultado el 2026-11-04: CLI v3 cambia
los defaults de destino; se utilizó la CLI local existente 2.81.3 solo para crear el
archivo de migración. Sin comandos alojados, cambios SMTP ni actualizaciones SDK.
