# Primera prueba alojada — registro operativo

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
