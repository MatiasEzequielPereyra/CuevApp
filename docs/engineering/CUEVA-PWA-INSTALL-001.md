# CUEVA-PWA-INSTALL-001 — Instalación móvil en primera visita

**Base:** `a6018c8cb74face91f19da21f85ddf099f97dbd5`.

## Diagnóstico
El manifest solamente declaraba `/brand/cueva-symbol.svg` de tamaño `any`; Chrome requiere íconos PNG de 192 y 512 px para promover `beforeinstallprompt`. Tampoco existía una interfaz para instalar o instrucciones por sistema. El service worker `/sw.js` es para Push y se registra al activar notificaciones, por lo que no se altera ni se fuerza su registro en el login.

## Flujo nuevo
- Manifest: PNG 192 y 512 servidos por una ruta Node + Sharp con tamaños cerrados y logo basado en el SVG aprobado. SVG original preservado. Meta Apple usa PNG 180.
- Componente liviano global montado en el layout y visible en primera visita **móvil**, aun sin evento nativo.
- Android: aviso CUEVA con explicación del menú de Chrome. Cuando Chromium emite `beforeinstallprompt`, botón real `Instalar ahora` que llama `prompt()` solo tras el clic; no se fuerza una ventana nativa.
- iOS Safari / Chrome: instrucciones de Compartir → Agregar a pantalla de inicio (sin intentar `prompt()`).
- App abierta en `standalone`/fullscreen o `navigator.standalone`: aviso oculto. `appinstalled` registra la instalación en almacenamiento local; la opción `Ya la instalé` permite ocultarlo permanentemente desde el navegador.
- `Ahora no` y cierre: recordatorio después de 7 días, sin repeticiones al cambiar de página. Storage denegado no bloquea el sitio.
- No se usa `getInstalledRelatedApps` para afirmar instalación en otro navegador: **no existe una detección universal de una PWA instalada en otra app/navegador en iOS**. La supresión segura funciona en el modo instalado y cuando el navegador conserva el evento o la preferencia.
- Solo UX, manifest y ruta pública de íconos. Sin autenticación, DB, dinero, cuotas, push, migraciones ni emails.

## Aceptación
`npm run verify` completo; pruebas navegador Android e iOS simulados para primera visita, persistencia de descarte/instalación, `beforeinstallprompt` por gesto real, ventanas nativas no forzadas, ausencia de aviso en `standalone`, y respuestas de PNG con cabeceras y dimensiones válidas. Confirmación con teléfonos reales en producción queda NOT_VERIFIED hasta que se ejecute. No hacer merge antes de auditoría de aceptación.

SKILLS_SELECTED / APPLIED: cueva-feature-development, cueva-acceptance-audit, vercel/react-best-practices.
SKILL_SOURCES: `.agents/skills/<nombre>/SKILL.md`, `skills://plugins/vercel/react-best-practices/skill.md`.
