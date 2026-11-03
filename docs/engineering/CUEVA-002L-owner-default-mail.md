# CUEVA-002L — prueba temporal con correo predeterminado

**REVIEW local; no habilitado ni aplicado por este ejecutor.** Fallback limitado
a la primera invitación de la cuenta propietaria verificada fuera del repositorio.
No habilita incorporación ni recuperación general de alumnos y no cambia
proveedor de identidad, migración, gate privado ni bootstrap K.

## Configuración cerrada

Producción requiere `CUEVA_PRODUCT_AUTH_ENABLED=1` y una de estas condiciones:

- Flujo habitual: `CUEVA_EMAIL_TEMPLATE_READY=1`.
- Prueba temporal: `CUEVA_DEFAULT_MAIL_OWNER_TEST=1` y
  `CUEVA_FIRST_ADMIN_EMAIL` válido, esperado y verificado por el operador.

La segunda condición no declara lista una plantilla personalizada. Con flag
temporal apagado se conserva el cierre anterior. Cuando las plantillas no están
listas y se usa la excepción temporal, las altas/reset administrativos y el POST
habitual token_hash permanecen cerrados; la cuenta muestra que el correo del
gimnasio aún está pendiente. No ofrecer recuperación predeterminada general.

No enviar cfg completa al cliente: incluye secreto de servicio. El componente
recibe únicamente nonce, generación y selector del flujo. No guardar el correo
real, clave SMTP, JWT ni tokens en el repositorio.

## Enlace y autorización

El correo predeterminado de GoTrue usa su URL `/verify`; el proveedor consume el
OTP y redirige a la aplicación con tokens en el fragmento. El componente cliente
borra ese fragmento al montarse antes de interpretarlo, conserva los tokens solo
en una ref en memoria y espera un clic explícito para el POST de mismo origen.
No usa SDK de navegador, localStorage, sessionStorage, inputs ocultos con tokens,
props con JWT, logs ni una segunda URL con credenciales.

El servidor conserva el límite real de 8192 bytes y Origin exacto. Para el POST
temporal exige selector invite, generación 1 y nonce privado preparado; verifica
el JWT exacto mediante `getUser` real de Auth y compara el correo esperado. Solo
después lee sub, session_id y AMR del JWT que Auth autenticó.

La versión fijada GoTrue v2.197.0 emitió **AMR `[otp]`** para una invitación default
real. Aunque la referencia de claims enumera también `invite`, no se observó ese
valor en este flujo. Se exige exactamente un método otp; una sesión password
con nonce válido y una modificación de claims sin firma válida se rechazan.

**AMR otp no distingue invite, recovery o magiclink.** El `type=invite` de la query
es un selector, no prueba del tipo de autenticación. La autorización combina OTP
real del correo esperado, nonce privado de la preparación de primera invitación,
generación 1 y sesión reciente/existente comprobada por el bind I. Un OTP legítimo
obtenido por el mismo dueño de correo no se describe como ataque ni se promete
distinguirlo por ese claim. No se ha probado aquí cada otra vía OTP del proveedor.

El SDK SSR prepara sus cookies en un buffer exclusivo de la solicitud. Se exige
que `setSession` devuelva el mismo JWT exacto autenticado y el mismo usuario;
si lo refresca o normaliza a otro JWT, se cierra sin bindear el SID anterior.
Solo se publican cookies HttpOnly después de que el bind privado confirme usuario,
nonce, generación y sesión. Fallo, falso o excepción descartan el buffer; no se
llama signOut del proveedor para una sesión que nunca se publicó. Un resultado
ambiguo de bind puede haber consumido nonce y deja la cuenta cerrada para revisión,
sin reintento automático ni afirmación de disponibilidad.

El bind **no pone ready=true**. La sesión debe elegir contraseña mediante el flujo
I antes de ver su perfil. Promoción inicial sigue siendo operación separada y
revisada. No hay cambio SQL ni elevación manual de ready en el código del producto.

## Pruebas y aplicación separada

[Laboratorio y evidencia](../../experiments/cueva-002l-local/README.md): plantilla
default real, API_EXTERNAL_URL apuntando al Auth loopback publicado y href usado
literalmente. Se observan AMR y callback sin guardar tokens. Se comprueban nonce,
generación, origen, propietario distinto con OTP real, password AMR, claims
falsificados, replay, datos denegados antes de contraseña y cuenta alumno después.

Dos fallos de bind se inyectan exclusivamente en un proxy loopback del laboratorio:
HTTP503 y conexión cortada antes de llegar a la base. Ambos deben dejar cero cookies
auth y el gate pendiente; no hay bandera ni endpoint de fallos en producción.
La expiración justo entre getUser y setSession y todas las normalizaciones del SDK
no se simulan; su comparación cerrada se revisa estáticamente.

El Orchestrator decidirá después de auditar: cambio de SMTP/default (que puede
restablecer plantillas), despliegue exacto con configuración temporal y ventana
acordada, inventario vacío y primera invitación K autorizada. Este paquete no hace
ninguna de esas operaciones. No repetir intentos de Gmail ni pedir exportar claves.
Mantener `CUEVA_FIRST_ADMIN_EMAIL` mientras esta prueba lo necesite. Para cerrar la
ventana, apagar producto y excepción temporal y verificar el despliegue; no borrar
cuentas o datos para volver a empezar. El correo general de alumnos sigue pendiente.

Fuentes primarias consultadas el 2026-11-03:
[claims JWT y AMR](https://supabase.com/docs/guides/auth/jwt-fields),
[flujo implícito](https://supabase.com/docs/guides/auth/sessions/implicit-flow),
[setSession](https://supabase.com/docs/reference/javascript/auth-setsession),
[getUser](https://supabase.com/docs/reference/javascript/auth-getuser),
[verificación del proveedor fijado](https://github.com/supabase/auth/blob/v2.197.0/internal/api/verify.go).
Se leyeron también las guías instaladas Next de componentes cliente/servidor,
Route Handlers y cookies, y la revisión React pertinente.
