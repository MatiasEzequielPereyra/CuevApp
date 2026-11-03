# Primera prueba alojada — registro operativo

## Resultado final

Primera incorporación real completada. Con consentimiento explícito se activó
correo integrado, se confirmó template estándar y se publicó L en PR19/main
`0892ebea0b09bca308fdf5ecd2709d91904ef0f1`. Deployment privado
`dpl_GajeQvGVJSPtVV4unxFE6FdRjxfy` READY, comando de invitación APPLIED y
estado preparado verificado. El usuario recibió la invitación, eligió contraseña
y confirmó Perfil alumno. Se promovió la cuenta exacta a admin en transacción,
con comprobaciones de email confirmado, gate, sesión, generación y unicidad.
Resultado leído: admin/ready=true, un único administrador. Sin guardar contraseña,
token, enlace ni UUID personal en este documento público.

Sigue activo el modo temporal owner-only; altas/reset de alumnos deshabilitados,
correo general Gmail pendiente. El correo esperado servidor se conserva porque
configura este modo. No invocar bootstrap otra vez. Se restauró buildCommand:null.
El usuario pidió cerrar con las comprobaciones ya realizadas; no iniciar otra
investigación ni repetir suites por esta actualización documental.

## Historia de la ejecución

2026-11-03, America/Buenos_Aires. El usuario autorizó explícitamente crear la
cuenta inicial de Nico, enviar una invitación y activar una primera prueba;
después de verificar su incorporación, asignarle administrador general. El correo
está registrado fuera de este repositorio público. La contraseña la elige el usuario.
Esta autorización persiste; no solicitarla de nuevo para la misma operación.

Código fijado: main `1a6aff046996527fadc835be3bbb3a7e7dfc9bd0`, PR17 MERGED,
árbol igual al HEAD revisado `0240390cf223f659c313d7fd9333ade70cf1a150`.
CI SUCCESS en runs 41647997596 y 41647934005. Revisión Standards/Spec sin
bloqueos para K; laboratorio independiente 16 PASS/1 NOT_RUN. Sin cambios en
runtime/migración respecto a los candidatos I/J aceptados.

## Ejecución observada

1. Check privado desde Production `dpl_UhmKegevTzmjbgVtoL2gZDnibsjR`, READY:
   comando comprobado en logs; resultado CHECK, authUsersPresent=false,
   profilesCount=0, empty=true. Acredita uso SDK de la Secret y acceso al inventario,
   sin extraer/leer/exportar su valor. No acredita correo ni flujo web.
2. Tras autorización, flags de Production en 1. Deployment normal
   `dpl_4CqhuzcSBYTATmDf9Z1dQp9LSWtU` READY, SHA exacto, HTTPS /ingresar200
   con formulario activo y /aceptar-invitacion200. Ventana de prueba controlada;
   signup sigue cerrado, no disponibilidad general aceptada.
3. Primer apply `dpl_7K2U3MGspGzM2jhh8wfBu93dULKi` ERROR con código fijo
   INVITATION_AMBIGUOUS_RECONCILE_NO_RETRY. Se inspeccionó antes de repetir:
   cuentas/perfiles/estado privados 0. Auth logs clasificaron
   SMTP_CREDENTIALS_REJECTED sin extraer logs sensibles. Gmail rechazó autenticación.
4. Se cerraron flags y se publicó `dpl_H8PwWoxcmdTnH8QniVuKm5xgTmak`, READY:
   /ingresar200 deshabilitado, /aceptar-invitacion404. Sin drops ni cuentas borradas.
5. Usuario reemplazó la contraseña SMTP y confirmó Save changes. Tras recarga y
   carga completa del formulario: SMTP activo y Save deshabilitado. No se leyó la
   contraseña. Host/puerto/usuario/remitente se comprobaron visualmente: la vista
   DOM de algunos campos está redactada y su placeholder no demuestra discrepancia.
6. Se reactivaron flags para la prueba autorizada y se promovió el deployment
   normal ya comprobado; /ingresar volvió a responder con formulario activo.
   Segundo apply solicitado una sola vez, `dpl_69bJbXDMQGBMfxNR2RCpEVEQPdNM`:
   ERROR, mismo código fijo y clasificación SMTP_CREDENTIALS_REJECTED. Inspección
   posterior: cuentas/perfiles/estados siguen en cero. No se repitió sin corregir.
7. Se cerraron nuevamente flags y se promovió el deployment cerrado H8PwWox.
   HTTP /aceptar-invitacion404 comprobado. Google, en la cuenta exacta del gimnasio,
   mostró App passwords no disponible; la pantalla 2-Step Verification confirmó
   que está desactivada. Se dejó el botón visible y se solicitó que el usuario
   complete esa configuración con su teléfono/autenticador. Después debe generar
   una contraseña de aplicación y guardarla solo en SMTP. No basta la contraseña
   normal de Google. No volver a enviar hasta resolver ese requisito concreto.
8. El usuario informó haber activado la verificación en dos pasos. Google pidió
   verificar identidad al abrir App passwords de la cuenta exacta; se dejó esa
   pantalla y se indicó completar verificación, generar CUEVA Supabase y guardar
   la clave únicamente en SMTP. Generación/guardado efectivos pendientes; no se
   volvió a enviar por una simple confirmación de cambio de contraseña normal.
9. Google rechazó la verificación de identidad. El usuario eligió correo integrado
   de Supabase temporalmente. Team confirmó destinatario Owner. Al preparar el
   cambio, el panel avisó que resetearía plantillas y deshabilitaría su edición.
   Se canceló la confirmación y se verificó SMTP personalizado conservado. Es
   necesario adaptar el callback estándar con las mismas puertas y guardarlo
   como modo temporal solo propietario; task L. No se hizo otro envío.

En cada operación privada, finally restauró buildCommand:null mediante la API.
La UI comprobó Override desactivado después del primer check; la última
restauración requiere verificación posterior. package.json/CI no invocan el script.

Google exige verificación en dos pasos para crear contraseñas de aplicación:
[fuente oficial](https://support.google.com/accounts/answer/185833?hl=es).
La configuración de factores y cualquier nueva contraseña las completa el usuario,
sin compartir códigos ni claves con el agente. La autorización del primer alta
persiste; lo pendiente es la configuración efectiva del correo, no otra aprobación.

## Continuación segura

Inspeccionar resultado fijo APPLIED/STOPPED y catálogo antes de cualquier reintento.
Si APPLIED, guardar únicamente UUID confirmado y comprobar correo esperado,
perfil alumno, generación/nonce preparado y gate cerrado sin leer hashes de clave.
El usuario debe recibir el correo y establecer contraseña directamente en el sitio.
No pedir contraseña/enlace/token en el chat. Promoción de una sola fila por SQL/MCP
después de comprobar identidad exacta, control del correo y cuenta activa; sin
operación pendiente, con una única cuenta y validación real de sesión por Auth.

Reconciliación alojada, aislamiento de dos cuentas alojadas, reset y sesiones
anteriores en el entorno final siguen NOT_RUN. No declarar terminado CUEVA-002 ni
el MVP por enviar una invitación. No trasladar la quiescencia Docker al proveedor.
