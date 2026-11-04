# CUEVA-ALUMNOS-ELIMINAR — verificación e integración

Estado: IN_PROGRESS; revisión independiente e integración pendientes.
Base `67d44e2d954bd09af0ea821b718a8151cd9af28a`, rama
`codex/cueva-alumnos-eliminar`. [Encargo](CUEVA-ALUMNOS-ELIMINAR-task.md).

## Cambio

Eliminar alumno aparece en el detalle. Confirma nombre y correo, inicia foco en
Cancelar, mantiene Tab/Shift+Tab dentro del diálogo, permite Escape y deshabilita
salida/envíos duplicados mientras está pendiente. Muestra errores sin ocultar el
diálogo y tras éxito vuelve al listado con aviso; al recargar la ficha ya no existe.
Se revisaron las capturas reales a 390 oscuro y 1440 claro, sin desbordamientos.

La API exige Origin exacto, JSON acotado, UUID, correo observado y confirmación
true, con administración verificada antes de llamar RPC. No usa service_role.
La función privada SECURITY DEFINER y wrapper público invoker exigen administrador
y sesión/gate actuales; sin grant DELETE directo ni autorización por metadatos.

Usa el mismo advisory transaccional de pagos antes del lock de ficha; luego bloquea
el trabajo de invitación. Comprueba períodos, cuenta por correo o UUID capturado y
estados de envío. La coincidencia de correo únicamente impide borrar; no asocia ni
modifica identidades. Borra solo el pedido blocked sin provisión y la ficha.
Las FK se conservan sin cascada; cualquier referencia inesperada hace rollback de
toda la función y devuelve protegido. Repetir un UUID ya ausente es éxito idempotente.
Si el correo cambió tras cargar el detalle, exige recarga antes de eliminar.

Sin la migración o ante errores del chequeo, el botón queda deshabilitado con
explicación y el endpoint rechaza. No se publica una acción que aparente éxito si
la capacidad todavía no está instalada. La eliminación confirmada es irreversible;
revertir código no restaura datos borrados. Detener/revocar la capacidad ante un
problema; jamás compensar borrando historial, cuentas o relaciones.

## Pruebas locales nuevas

[Laboratorio 49/49 PASS](../../experiments/cueva-invitations-local/deletion-evidence.json),
incluidas seis comprobaciones de limpieza. Casos afectados: preview sin escritura,
confirmación/cancelación/Escape/foco, estado posterior y replay; pedidos pendientes
sin provisión; protección de cuota impaga/pago/anulación/cuenta/UUID/estados de envío, incluido failed sin UUID por posible creación ambigua;
chequeo tras abrir diálogo y correo obsoleto; confirmación ausente, Origin, tamaño,
UUID, método; alumno/visitante, denegación DELETE directo; borrado paralelo;
concurrencia real con transacciones de cuota y reserva de invitación; ausencia de
huérfanos cuando elimina primero; respuesta perdida sin reintento automático y
capacidad ausente. Ningún envío SMTP ni operación Auth desde la eliminación.

Reproducción, desde experiments/cueva-invitations-local:

```powershell
$env:CUEVA_STUDENT_DELETION_ONLY='1'
node lab.mjs
Remove-Item Env:CUEVA_STUDENT_DELETION_ONLY
```

Se reutiliza el laboratorio existente con imágenes fijadas, nombres/red exclusivos,
puertos dinámicos ligados a 127.0.0.1 y límites de recursos. Cierra Next/Chromium y
elimina solo sus contenedores/red. Sin reiniciar Docker ni tocar Vendify. No se
repiten los laboratorios completos de identidad, invitación o pagos.

Capturas sintéticas: [celular](../../evidence/screenshots/delete-student-390.png) y
[computadora](../../evidence/screenshots/delete-student-1440.png).

## Aplicación

Migración nueva `20261104185308_cueva_delete_empty_student.sql`, después de acceso,
alumnos, cuotas e invitaciones. Instala dos funciones y sus permisos, sin DML de
datos de alumnos. Verificar búsqueda vacía, invoker público, definer privado,
revocación a PUBLIC/anon/service_role, grant a authenticated y chequeo interno de
administrador/sesión. La aplicación no exige la migración privada de reconciliación
para esta capacidad. Las FK existentes mantienen protegidos los casos de ese track.

Instalación alojada, PR/CI, merge y deployment: pendientes de registro al finalizar.
No se elimina ningún alumno real como prueba. Acceso por cuenta, correo y recuperación
conservan sus estados/limitaciones propios; esta tarea no los certifica.
