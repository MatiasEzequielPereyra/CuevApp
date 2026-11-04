# CUEVA-ALUMNOS-ELIMINAR — eliminación de fichas por error

Solicitud del usuario, 2026-11-04: agregar eliminación de fichas creadas por error,
con confirmación, y si queda bien revisado integrar en main. Esta instrucción
autoriza publicación de rama, PR y merge de este incremento; no cambia las
autorizaciones de envíos, cuentas reales, SMTP ni otros tracks.

Base verificada `67d44e2d954bd09af0ea821b718a8151cd9af28a` (main tras PR26),
checkout limpio reutilizado, rama `codex/cueva-alumnos-eliminar`.

- Mostrar Eliminar alumno en la ficha, con confirmación explícita que identifique
  alumno/correo e informe que el borrado es permanente. Cancelar/Escape no borran.
- Solo administración con sesión habilitada. Comprobar nuevamente en base de datos
  que no tenga períodos/cuotas, pagos ni identidad. Con historial, conservar todo e
  indicar Inactivo desde Editar ficha; no añadir archivo ni bloqueo de acceso nuevos.
- Un pedido blocked/failed sin UUID, cuenta por ese correo ni envío en curso puede
  eliminarse junto con la ficha. processing/review/sent o UUID capturado protegen.
- No borrar ni modificar Auth, perfiles, pagos, cuotas, recuperación o invitaciones
  enviadas. Sin cascadas, eliminación masiva ni permisos DELETE directos.
- Concurrencia con pagos/invitación y repeticiones deben mantener las relaciones.
  Ante estado desconocido, rechazar sin aparentar éxito.
- Probar flujo real local, negativos, teclado, celular/escritorio, verificaciones
  del proyecto y revisión independiente antes de integrar. Conservar evidencia.
- Una migración instala únicamente la capacidad; no ejecuta eliminaciones de datos.
  Su aplicación alojada y estado de publicación se registran separados del merge.
