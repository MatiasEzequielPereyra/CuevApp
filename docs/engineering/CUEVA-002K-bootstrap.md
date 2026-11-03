# CUEVA-002K — invitación privada desde un build exacto

**REVIEW local.** Resuelve únicamente cómo ejecutar la primera invitación cuando
el secreto está guardado solo en Vercel y el panel Invite no permite `redirectTo`.
No extrae ese secreto, no necesita contraseña de base y no agrega endpoint, hook
de build global ni nueva función/permiso en Supabase. No envía correo por leer o
integrar este archivo. El primer administrador real todavía requiere la decisión
explícita del usuario sobre la cuenta, envío y ventana técnica de prueba.

## Script aislado

[bootstrap-invitation.mjs](../../scripts/bootstrap-invitation.mjs) usa únicamente
el SDK y los RPC ya revisados. No se importa en la aplicación ni se referencia
desde `package.json`, Next config o CI. Su CLI tiene tres modos:

```sh
node scripts/bootstrap-invitation.mjs
node scripts/bootstrap-invitation.mjs --check
node scripts/bootstrap-invitation.mjs --apply
```

- Default: dry-run, sin solicitudes de red; valida destino y describe el plan.
- `--check`: lectura de inventario Auth (primera página de un usuario para detectar
  existencia) y conteo exacto de perfiles; valida acceso de servicio a ambos.
  No necesita correo, no crea usuarios ni manda mensajes. No declara un total
  completo de Auth a partir de esa primera página.
- `--apply`: exige inventario vacío; genera nonce aleatorio de 32 bytes, construye
  redirect exacto con generación 1/type invite, envía una invitación y prepara su
  estado mediante RPC guardando solo SHA-256. Devuelve UUID y rol alumno; **no
  promueve administrador**. No suministra contraseña temporal ni imprime enlaces.

Ante error de inventario se detiene. Ante respuesta perdida/error después de
invitar o preparar, informa estado incierto y no reintenta. Una ejecución posterior
con cuenta existente se detiene sin reenviar. Si una cuenta se creó sin estado,
requiere reconciliación: no borrarla ni forzar vacío para repetir.

Esto no hace atómico Auth/correo/base ni bloquea otros canales. Antes de apply el
operador debe excluir otros builds, scripts, dashboard y escritores administrativos.
No cancelar/reintentar un build ambiguo suponiendo que no produjo efectos; examinar
Auth, perfiles y estado privado antes. El inventario no es un lock entre servicios.

## Ejecución alojada propuesta, no realizada

1. Orchestrator audita y fija SHA exacto del paquete integrado. Comprueba destinos,
   inventario, migración/RPC y configuración de correo. Mantiene las banderas del
   producto en 0. No descarga variables ni copia secretos al chat o archivos.
2. Crear un deployment Production del proyecto `cueva-app` desde ese SHA, usando
   un `projectSettings.buildCommand` explícito para la operación. La API puede
   persistir ese ajuste para futuros deployments: antes, registrar el original;
   restaurarlo inmediatamente mediante un paso `finally` y verificar después la
   configuración. No prometer un override efímero. El baseline observado por el
   Orchestrator es `buildCommand:null` (Override desactivado, default del framework).
   Primera ejecución propuesta:

   ```sh
   node scripts/bootstrap-invitation.mjs --check && npm run build
   ```

   Usa el Secret ya guardado en Production. No necesita email ni clave de base.
   Su éxito solo acredita inventario/acceso SDK de servicio, no envío ni Auth web.
3. Solo después de la autorización específica de primera cuenta/correo y ventana,
   crear otro deployment exacto con el override:

   ```sh
   node scripts/bootstrap-invitation.mjs --apply && npm run build
   ```

   Variables por entorno de ese deployment: `CUEVA_FIRST_ADMIN_EMAIL` (cuenta
   verificada fuera del repo) y `CUEVA_BOOTSTRAP_COMMIT_SHA` (SHA completo revisado).
   Las variables de Supabase/origen y el Secret siguen en Production. No guardar
   el correo real en el código ni usar otro secreto de bootstrap.
4. Apply comprueba `VERCEL_ENV=production`, `VERCEL_PROJECT_ID` igual a
   `prj_IuCNdIG2xpwWNgizkrF1kbP1wMPa`, y `VERCEL_GIT_COMMIT_SHA` exactamente igual
   a `CUEVA_BOOTSTRAP_COMMIT_SHA`; si falta algo, se detiene antes de red. Es una
   protección contra ejecución accidental, no un límite contra el operador raíz.
   No simular esos metadatos para sortear un rechazo; verificar la configuración.
5. La invitación puede haberse enviado aunque falle el build posterior. Su UUID
   confirmado no demuestra entrega ni activación. Conservar solo resultado y UUID;
   no guardar tokens, nonce, enlaces o errores raw. Nunca reenviar automáticamente
   mediante retries del deployment. Restaurar `buildCommand:null` con el mecanismo
   de actualización del proyecto incluso si falla la creación o el build, comprobar
   Override desactivado y verificar logs/configuración antes de continuar. Si no se
   pudo restaurar, detener otros despliegues y reportar el bloqueo concreto.
6. Un enlace no puede activarse mientras las rutas están apagadas. Acordar y
   preparar antes la ventana controlada, comprobar HTTPS y ejecutar primer acceso
   real con contraseña elegida por Nico. No contabilizar el correo enviado como
   aceptación alojada ni abrir disponibilidad general para esa prueba.
7. Tras verificar usuario exacto, control del correo y gate activo, un operador
   confiable promueve ese UUID/correo por SQL/MCP revisado, transaccional, una fila,
   sin nuevo RPC público. Verificar perfil y sesión. Esta promoción está fuera del
   script K. Ante fallo, conservar cierre y datos; no usar drops como rollback.

El operador revisará logs de build solo con salidas redactadas. El script imprime
únicamente modos/códigos fijos, banderas de inventario, UUID confirmado y rol; no
errores originales del SDK. La clave de servicio sigue siendo servidor y no está
disponible localmente por el hecho de estar configurada en Vercel.

## Evidencia y límites

El [laboratorio K](../../experiments/cueva-002k-local/README.md) usa servicios
locales reales y correo sintético. Comprueba check sin mensajes, dry-run sin red,
destinos/build incorrectos cerrados, invitación preparada, duplicado sin reenvío,
enlace renderizado literal y cuenta activada como alumno. Sin promoción automática.

Vercel one-off, validez de la Secret real, correo Gmail, cuenta inicial real y
prueba alojada: **NOT_RUN por este ejecutor**. No cambia el runtime ni migración
I/J. Este paquete permite preparar una operación concreta; no acredita su ejecución.
