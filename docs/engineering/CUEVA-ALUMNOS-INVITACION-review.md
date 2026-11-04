# CUEVA-ALUMNOS-INVITACION — entrega del ejecutor

Estado: REVIEW; revisión independiente, aplicación alojada, integración y publicación pendientes.
Base inicial `28fec062d85ae306b1c94a3b234d5789fe264ee0`; rama
`codex/cueva-alumnos-invitacion`. Encargo del usuario en este chat: invitación marcada
por defecto al crear ficha, estado visible, reintentos y conservación ante fallos.

[Modelo, permisos y operación](../architecture/student-invitations.md).
El laboratorio de invitaciones usa Next/Auth/PostgREST/Postgres/Mailpit reales con
usuarios sintéticos y la plantilla versionada servida por la imagen de pruebas ya
utilizada en J. No se modifican proveedores, flags alojadas, cuentas reales ni SMTP.

El flujo probado conserva la ficha, crea explícitamente una identidad nueva,
prepara el gate y envía su enlace. Los reintentos de alta y de envío comparten el
registro; los paralelos no producen otros mensajes. Usuario previo se rechaza para
revisión sin adopción automática. Correo cerrado conserva pending bloqueado sin
crear cuentas; se prueba el reintento después de abrirlo solo en el entorno local.
Fallo real de SMTP se prueba deteniendo exclusivamente el mail local propio y
exigiendo revisión antes de otro envío. Los enlaces se consumen desde el href que
renderiza la plantilla real, no reconstruidos desde otro flujo.

Limitación operativa: mergear no habilita el correo general por sí solo. El
Orchestrator debe aplicar la migración y verificar el proveedor/plantilla alojados
antes de levantar la restricción de propietario existente. No se promete entrega
exactamente una vez en SMTP: processing/review requieren reconciliación si el
resultado es ambiguo. La aplicación no roba reservas ni borra/recrea cuentas para
resolverlas. No se agrega reenvío automático de enlaces expirados ni recuperación.

Base efectiva final: `3e397f60be811e1b40cf84092d0553885ec7d5a5`. Pagos se integró durante el trabajo y se rebasó conservando su acceso desde ficha y rutas de proxy. Se resolvieron solapamientos sin cambios en su lógica económica.

Laboratorio final: 42/42 comprobaciones PASS, incluidas limpieza, plantilla real, SMTP detenido, modo propietario, habilitación local y compatibilidad con la base final. [Resultados redactados](../../experiments/cueva-invitations-local/evidence.json).

Lint, typecheck, build, documentos 2/2, fuentes 4/4, escaneo de seguridad y diff check PASS. No se modificó el lockfile ni se repitieron los laboratorios completos de identidad. Se revisaron manualmente permisos, reserva concurrente, relación explícita de UUID, secreto servidor, datos conservados y caminos de reintento/ambigüedad. Los secretos y enlaces completos no se guardan en evidencia ni capturas.

Capturas con identidades sintéticas:
- [Celular oscuro](../../evidence/screenshots/invitation-390-dark.png) / [claro](../../evidence/screenshots/invitation-390-light.png)
- [Computadora oscura](../../evidence/screenshots/invitation-1440-dark.png) / [clara](../../evidence/screenshots/invitation-1440-light.png)

Reproducción: dependencias del repositorio instaladas, Docker existente, Chromium y las imágenes fijadas del laboratorio. Ejecutar `node lab.mjs` desde experiments/cueva-invitations-local. Se reutilizan las imágenes y la plantilla de J. Procesos propios Next/Chromium se cierran y se eliminan contenedores/red exclusivos cueva-invites; el fallo SMTP detiene solo el mail local propio. No se modifican Docker, Vendify ni servicios alojados. No se crean cuentas reales ni envían correos reales. El caso de recepción real en el proveedor del gimnasio y su entrega en bandeja sigue NOT_RUN.
