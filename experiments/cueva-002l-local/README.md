# CUEVA-002L — owner/default mail, REVIEW local

Ensayo acotado de [la excepción temporal](../../docs/engineering/CUEVA-002L-owner-default-mail.md).
Sin cambios alojados, correo real, claves de navegador ni modificaciones a K o
migración I. El ingreso de producción permanece sujeto a aplicación separada.

Desde esta carpeta, con Node22, dependencias de raíz, Chromium y Docker activo:

```sh
node lab.mjs
```

Solo recursos `cueva-002l-*`, puertos loopback y datos sintéticos. La URL externa
de GoTrue se fija al puerto real antes de arrancarlo y no se configuran plantillas
custom en Auth. El navegador abre el href default literalmente; el callback de
GoTrue se observa solo en memoria. `finally` limpia la app, proxy, contenedores
y red propios sin manipular otros proyectos.

El fixture negativo inicial crea un usuario sintético confirmado con contraseña
y nonce pendiente por RPC; demuestra que password AMR y claims falsificados no
autorizan la incorporación ni crean cookies. Luego elimina solo ese fixture y
verifica inventario vacío antes del bootstrap verdadero de prueba. No se marca
ready mediante SQL para superar el gate.

El flujo positivo usa invitación K real, OTP de GoTrue, borrado del fragmento,
POST explícito, bind I y contraseña elegida. El perfil sigue oculto hasta elegirla.
La promoción SQL posterior es únicamente un fixture para comprobar que incluso
un admin ve el aviso y no puede enviar invitaciones/reset de alumnos en modo
owner-only; no es una capacidad de L ni una promoción real del administrador.

Los fallos HTTP503 y conexión cortada se inyectan en un proxy loopback exclusivo
antes del bind. Ningún código de fallos entra a la aplicación. Se exige cero
cookies auth en rechazos/fallos y estado pendiente; un callback repetido se rechaza.
La flag apagada devuelve404 en la ruta temporal. La conservación del flujo custom
se verifica por repetición separada del laboratorio J con la flag temporal apagada;
ver [evidencia de regresión](custom-regression-evidence.json).

[Resultados redactados](evidence.json). No guardar URLs de correo, Location,
fragmentos, JWT, contraseñas o cuerpos de POST en evidencia. AMR otp se observó
en el proveedor real fijado, pero no prueba tipo invite frente a otras vías OTP.
Hosted/default SMTP, entrega al owner real y HTTPS autenticado: **NOT_RUN** aquí.

Verificación final: laboratorio L 22 PASS/1 NOT_RUN y regresión J 25 PASS/1 NOT_RUN,
ambos con exit 0 y seis limpiezas. Lint, typecheck, build, documentos 2/2,
navegador de raíz 25/25, fuentes 4/4, seguridad por patrones y diff check PASS.
El escaneo no acredita ausencia de todos los secretos posibles ni sustituye la
revisión independiente. SDK, dependencias, migración I y script K intactos.
