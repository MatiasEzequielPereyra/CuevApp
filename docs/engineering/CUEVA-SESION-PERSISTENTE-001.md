# CUEVA-SESION-PERSISTENTE-001 — Sesión recordada

«Mantener sesión iniciada» viene desmarcada y se aplica cuando Auth acepta el
ingreso. Tanto el envío nativo del formulario como el envío con JavaScript
transmiten la misma elección. La contraseña se envía por POST y CUEVA no la
conserva. Los campos mantienen `username` y `current-password` para el gestor
del navegador. En caso de error, se limpia el campo de contraseña. Si el ingreso
se completa, el formulario se retira al navegar a la cuenta.

## Retención y seguridad

| Ingreso | Retención de cookies de Auth y preferencia |
| --- | --- |
| Casilla marcada | Duración del SDK instalado, 400 días por escritura. Cada renovación válida vuelve a aplicar la duración al conjunto de fragmentos activos y a la preferencia. El navegador puede imponer un límite menor. |
| Casilla desmarcada | Cookies de sesión, sin `Max-Age` ni `Expires`. Conservan esa condición al renovar. La restauración de la sesión del navegador puede recuperar esas cookies incluso después de cerrar la aplicación. |
| Sesión anterior sin preferencia | Se admiten las cookies existentes y se conserva el tratamiento del SDK anterior a este cambio. Un nuevo ingreso aplica la opción elegida en el formulario. |

Las cookies son `HttpOnly`, `SameSite=Lax`, de ruta `/` y `Secure` en producción.
Las eliminaciones del SDK conservan su expiración inmediata. La preferencia
solo decide la retención en el navegador. Supabase conserva su JWT y su
mecanismo de renovación. Las bajas, el cierre de sesión, el cambio de contraseña,
la recuperación y el bloqueo de acceso siguen sometidos a las reglas de Auth y
al gate de la cuenta. [Sesiones de Supabase](https://supabase.com/docs/guides/auth/sessions)
· [Cookies SSR y renovación](https://supabase.com/docs/guides/auth/server-side/advanced-guide)

`/` conduce a `/ingresar`. Si allí Auth valida la sesión y el perfil propio es
visible bajo la política de acceso vigente, la app redirige a `/cuenta`. Esa página
conserva el enrutamiento por rol y vuelve a autorizar. Recuperación, confirmación
e invitación mantienen sus rutas y condiciones propias. Las rutas privadas
renuevan via Proxy o su cliente de servidor. Los workers con autenticación de
servicio quedan fuera del matcher de sesión.

«Cerrar sesión» mantiene el alcance global del cierre de Auth ya existente.
Al completarse, limpia la preferencia y las cookies de este proyecto, incluidos
los fragmentos y el verificador previo. Si Auth devuelve un error de cierre,
se conserva la respuesta de error para poder reintentarlo.

## Verificación

La prueba de integración se ejecuta en la matriz `fresh` de Supabase local.
Usa un perfil temporal de Chromium que se cierra y reabre sin importar
`storageState`. Verifica cookies fragmentadas, renovación real en Auth,
formulario sin JavaScript, autorización, revocación y cierre. La ejecución
estándar vuelve exigible la renovación modificando solo el metadato de
expiración que lee el SDK y conserva los tokens genuinos. El modo de prueba
`CUEVA_SESSION_TEST_REAL_EXPIRY=1` requiere un Auth aislado con JWT de hasta
150 segundos y comprueba que Auth rechaza el JWT original por expiración antes
de volver a la aplicación con el refresh válido. En ese modo conviene emitir
JWT que superen el margen de renovación de 90 segundos del SDK.

Para probar el gestor en un celular, abrir la PWA con el gestor habilitado,
ingresar con una cuenta de prueba y seguir el aviso del sistema si aparece.
Cerrar y reabrir la PWA, verificar la cuenta, cerrar sesión y volver a abrirla
para comprobar que el formulario se pueda autocompletar según la configuración
del dispositivo. El permiso para guardar, sugerir o rellenar corresponde al
dispositivo. Borrar los datos del sitio puede terminar la sesión recordada.
[Atributos de autocompletado](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/autocomplete)

La reversión consiste en restaurar el código anterior. Las cookies existentes
conservan sus atributos hasta la próxima escritura. La versión anterior volverá
a aplicar la duración del SDK al renovar, incluso a una sesión iniciada con la
casilla desmarcada. La reversión no requiere cambios de datos ni de configuración
de Auth.
