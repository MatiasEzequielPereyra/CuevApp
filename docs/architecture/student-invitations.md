# Invitaciones desde fichas — modelo y operación

Guardar la ficha es una operación independiente del envío. El formulario ofrece
Enviar invitación para acceder a CUEVA, marcado por defecto en altas y ausente en
edición. Desmarcar guarda solo la ficha. Una respuesta de alta perdida puede
reintentarse con el mismo UUID y datos normalizados: se recupera la ficha existente,
no se crea otra, y se consulta el registro de invitación antes de operar.

## Registro y permisos

La migración `20261104120000_cueva_student_invitations.sql` agrega un registro por
ficha con correo congelado, actor autenticado, fechas, lease de operación, estado
y UUID Auth único. No cambia las migraciones históricas ni las funciones de login,
contraseña, sesión o roles existentes. La ficha sigue independiente de Auth; su
vínculo solo se registra desde el UUID devuelto por una creación explícita de esta
operación. Una cuenta que ya existe se rechaza para revisión, nunca se adopta por
email. Los usuarios nuevos reciben el perfil alumno mediante la preparación ya
existente, sin acceso a datos hasta elegir contraseña y completar el gate.

Solo admin con sesión habilitada puede solicitar/reservar por RPC. Un lock de fila
de la ficha serializa solicitudes y cambios de correo. Los roles API no tienen
escritura directa; admin puede leer únicamente las columnas de estado autorizadas,
sin lease. Alumno y visitante no ven registros ni pueden pedir o finalizar envíos.
Las funciones SECURITY DEFINER tienen search_path vacío y validación explícita;
las capacidades de preparación/finalización están restringidas a service_role.
El servidor valida al administrador con su cliente antes de usar la credencial
privilegiada, exclusiva del servidor, para crear la cuenta y enviar correo. Ese
secreto jamás se entrega al navegador.

## Estados y fallos

- blocked: pedido conservado, correo general cerrado; sin cuenta Auth ni email.
- processing: reserva exclusiva en curso; nunca se roba por tiempo transcurrido.
- sent: proveedor aceptó el envío, no prueba entrega en la bandeja. No se reenvía.
- failed: no se capturó un UUID de creación; el reintento vuelve a comprobar que no
  exista una cuenta con ese correo antes de crear nada. Si existe, requiere revisión.
- review: cuenta preparada pero resultado incierto, envío fallido o inconsistencia;
  ningún reintento automático ni botón que aparente reenviar. La ficha se conserva.

Un fallo ambiguo de red/proceso puede dejar processing. Se trata como revisión,
no como permiso para duplicar envíos. PostgreSQL y SMTP no comparten transacción:
no se promete entrega exactamente una vez. Se evita reenviar ante ambigüedad, y
se prueba conteo real de correos en los caminos exitosos/concurrentes.

Mientras blocked/failed y sin UUID asignado, editar el correo de la ficha actualiza
el pedido pendiente. Desde processing o con UUID asignado, el correo queda bloqueado
para edición ordinaria. Otros datos de la ficha siguen editables. Esto evita
retargetear una identidad o un correo que ya pudo enviarse.

## Aplicación y habilitación posterior

1. Auditar commit, migración y pruebas locales. Aplicar la nueva migración íntegra
   después de acceso y alumnos, en una transacción. No se aplicó alojada aquí.
2. Mantener mientras corresponda el modo temporal solo propietario. Instalar la
   plantilla existente `supabase/templates/invite.html`, que usa RedirectTo con
   nonce/generation/type y agrega TokenHash. Verificar URL y allowlist exactas de
   `docs/engineering/CUEVA-002J-operations.md`; nunca habilitar previews o dominios
   externos para resolver un redirect roto.
3. Antes de abrir correo general, comprobar remitente/proveedor para destinatarios
   reales del gimnasio, plantilla y primer acceso alojado bajo autorización del
   Orchestrator. Solo entonces habilitar la configuración general existente. No
   se cambian SMTP, flags alojadas ni cuotas del proveedor desde esta entrega.
4. Las fichas blocked permanecen pendientes: administración elige Enviar o
   reintentar desde cada ficha una vez habilitado. No hay envío masivo oculto.

## Reconciliación ante ambigüedad

Conservar ficha, registro, UUID y estados de acceso. Operador autorizado contrasta
UUID capturado, correo reservado, cuenta y gate, intentos del proveedor y respuesta
original. Si el proveedor aceptó o el alumno completó la incorporación, documentar
ese resultado; no mandar otra invitación. Si falló antes de crear cuenta, el camino
failed vuelve a comprobar inexistencia antes del reintento. Una cuenta existente o
un resultado incierto requiere una operación de reconciliación auditada para ese
caso: no editar ready ni vincular por email, no borrar/recrear cuentas para eludir
el estado y no reusar un lease. La interfaz no ofrece resolver estos casos sensibles
por un botón genérico. Enlaces vencidos/recuperación siguen el procedimiento de
acceso; este incremento no agrega reenvío indiscriminado ni cambia recuperación.

Fuentes: [createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser),
[inviteUserByEmail](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail),
[plantillas](https://supabase.com/docs/guides/auth/auth-email-templates).

La acción histórica de invitación desde Mi cuenta se canaliza por la misma ficha y
reserva. Si no existe una ficha para ese correo, exige registrarla primero. No
conserva un segundo camino de envío que ignore el estado/idempotencia. La búsqueda
por correo en ese punto identifica la ficha administrativa; nunca adopta una cuenta
Auth por coincidencia de correo.
