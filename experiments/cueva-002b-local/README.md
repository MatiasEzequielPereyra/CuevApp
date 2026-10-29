# CUEVA-002B-LOCAL: laboratorio de cambio obligatorio

Estado: REVIEW de investigación local; **E3 BLOCKED**. D007 continúa PROPOSED.
Este resultado no adopta un proveedor ni certifica autenticación de CUEVA.

## Alcance y reproducción

- Keycloak 26.8.1, imagen oficial fijada por digest en `lab.mjs`; Node 22 y npm 10, Docker existente y Chromium de Playwright.
- Desde este directorio: `npm ci`, `npx playwright install chromium`, `npm test`. La instalación de Chromium solo se necesita si falta su versión compatible. La ejecución tarda más de un minuto en esta máquina.
- El script crea un bridge exclusivo y un contenedor sin volúmenes con nombres aleatorios, máximo 1 GiB y 2 CPU; publica únicamente en `127.0.0.1` y usa un callback local de puerto libre. No modifica firewall ni otros contenedores. Usa `start-dev` y HTTP solo en loopback: configuración desechable, no de producción.
- Crea realm y cliente públicos sintéticos, registro y direct grant cerrados, PKCE S256 obligatorio e historial de 3 contraseñas. Ajusta el perfil para no requerir correo ni nombres. Las contraseñas y el administrador son aleatorios y solo existen durante la ejecución, en memoria y en el entorno efímero del contenedor; quien controle Docker localmente puede inspeccionar ese entorno mientras vive el contenedor. Docker tiene logs desactivados; no se generan capturas ni trazas. No se guardan URL de callback, códigos, tokens ni credenciales.
- `results.json` es una salida local ignorada. [evidence.json](evidence.json) contiene únicamente resultados redactados de una ejecución real. Una salida 0 indica que terminaron los casos automatizados, no que E3 haya pasado; `E3_end_to_end` debe leerse separadamente.
- En `finally` se cierra navegador y callback y se detiene exclusivamente el contenedor propio y elimina su red; el contenedor usa `--rm`. Ante interrupción forzada que impida `finally`, identificar los nombres `cueva-002b-*` y detener/eliminar **solo** esos recursos tras comprobar que pertenecen a la ejecución. Nunca reiniciar Docker ni limpiar recursos globalmente. La imagen compartida y Chromium se conservan.

## Interpretación y límites

El consumidor usa `openid-client` 6.8.8, Authorization Code, state, nonce y PKCE; Playwright maneja el navegador real. Las afirmaciones se refieren al realm, cliente y secuencia de la evidencia, no a toda configuración de Keycloak. Un código no emitido durante el cambio tampoco invalida sesiones ya existentes. La historia de contraseña es la política configurada en este realm, no una garantía universal.

La observación del evento de usuario `UPDATE_CREDENTIAL` identifica usuario y cliente, pero en esta ejecución carece de `sessionId`, mientras el ID token sí tiene `sid`. El evento administrativo de reset tiene actor, ID y ruta del usuario; no se observó un identificador de generación de reset enlazado al cambio y a la sesión del consumidor. El evento previo permanece consultable después del reset. La mera repetición de una consulta no prueba entrega duplicada ni deduplicación. No existe en este laboratorio un consumidor confiable de eventos que vincule esos hechos o rechace replays; ese caso sigue NOT_RUN y E3 BLOCKED. Una alternativa mínima para revisar requiere una señal server-side auténtica que vincule generación de reset, cambio realizado por el usuario y sesión, con manejo comprobado de concurrencia, antigüedad y duplicados; si se requiere extender el proveedor, esa extensión necesita diseño y autorización propios.

Reset y cierre de sesión son operaciones distintas. El resultado de refresh después del reset y del logout explícito se encuentra en la evidencia: no asumir que el reset revoque sesiones automáticamente ni que una sesión de otro proveedor se revoque. La eliminación de la acción por un operador privilegiado del IdP es una capacidad administrativa y no una prueba de que un alumno o administrador de producto tenga ese permiso. No se promete protección frente al operador que controla el IdP.

La ejecución no prueba entrega/recuperación de credenciales en el gimnasio, controles de producción ni comportamiento bajo carga. **Supabase alojado, linking, email opcional federado, RLS y revocación cruzada: NOT_RUN.** E1–E6 integrados siguen pendientes. La operación observada exige mantener un IdP, administrar perfiles, eventos, sesiones y entrega segura de claves; esa complejidad es significativa para el tamaño del MVP, sin inferir costo mensual. La elección del proveedor, operador y presupuesto sigue pendiente.

## Fuentes primarias

- [Guía oficial de contenedor Keycloak 26.8.1](https://www.keycloak.org/getting-started/getting-started-docker) y [anuncio 26.8.1](https://www.keycloak.org/2026/10/keycloak-2681-released).
- [Administración Keycloak 26.8.1](https://www.keycloak.org/docs/26.8.1/server_admin/) y [API de administración](https://www.keycloak.org/docs-api/26.8.1/rest-api/).
- [openid-client: authorizationCodeGrant](https://github.com/panva/openid-client/blob/main/docs/functions/authorizationCodeGrant.md).
