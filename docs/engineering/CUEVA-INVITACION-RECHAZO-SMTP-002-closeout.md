# Cierre alojado — invitación recuperada

Fecha: 2026-11-06, America/Buenos_Aires. Estado: **ACCEPTED / desplegado**.

## Identidad de la entrega

- Candidato: `7eebebb43379bf40080fef62bcde4f1bf4593409`.
- Integración: [PR29](https://github.com/MatiasEzequielPereyra/CuevApp/pull/29),
  commit `963b402830391dbc9fa4f6728280272a76de5dba`.
- Migración aplicada: `20261105175913`, `cueva_invitation_reauthorization`.
- Production verificado: `dpl_Ci6kCajPzJFKRV73rCETbqG4yEEF`, READY, mismo SHA,
  alias `https://cueva-gym.vercel.app`.

## Auditoría e integración

Revisión independiente Standards/Spec sin bloqueos. Matriz local51/51 PASS y los
nueve hashes comprobados contra los bytes del candidato; no se repitieron matrices
históricas. CI completo del PR42078845438 SUCCESS, árbol de prueba idéntico al
candidato. Push42078834170 cancelado durante instalación de Chromium por duplicar
esa verificación; no se registra como PASS. No hubo correcciones de implementación
del Orchestrator. Dependencia SMTP aislada instalada desde lockfile: audit0.

Postflight alojado confirmó RLS, trigger inmutable, FK y ausencia de permisos API
de lectura/escritura sobre el historial. Los avisos preexistentes de dos RPC
SECURITY DEFINER guarded y protección de contraseñas permanecen registrados en el
PR; el nuevo historial privado genera INFO esperado por ausencia de políticas.

## Operación real observada

La captura humana privada produjo preflight DB/TLS/identidad válido y
SMTP_AUTH_VERIFIED_NO_MAIL contra Brevo con TLS/AUTH. El expediente quedó ligado
por hash antes de CHECKED_NO_SEND eligible. Se ejecutó un único apply autorizado:
APPLIED accepted. No se borraron/recrearon cuentas ni se editó ready manualmente.

Lectura posterior: job sent, reconciliación accepted, generación3, operación nula
y una fila de historial. Snapshot anterior uncertain/fuente1 íntegro; identidad
previa, sucesor y hash de autorización coincidentes. Cuentas/perfiles2/2,
administrador1, sin duplicados en el caso operado.

Brevo informó un mensaje enviado y entregado al destinatario autorizado, cero
rebotes. El usuario confirmó la página de su cuenta tras elegir contraseña propia.
Lectura final: rol alumno, correo confirmado, ready=true, login y sesión posteriores
al corte, correos de ficha/trabajo/Auth coincidentes y sin operación pendiente.
No se afirma haber probado logout alojado ni toda la matriz de alta ordinaria.

## Configuración y continuidad

Production verificado con CUEVA_PRODUCT_AUTH_ENABLED=1, CUEVA_EMAIL_TEMPLATE_READY=1 y
CUEVA_DEFAULT_MAIL_OWNER_TEST=0. El despliegue con esta configuración quedó READY y con
el alias público. Una petición sin capacidad de invitación obtuvo400/no-store,
confirmando rechazo seguro en el callback habilitado. No se enviaron otros correos
desde esta operación.

Proveedor Brevo gratuito autorizado por el usuario, remitente CUEVA verificado y
SMTP guardado en Supabase. Se aceptó la sustitución del dominio remitente de Gmail
por Brevo. El bloqueo de Google deja de ser una dependencia del envío.

Expedientes y credenciales no forman parte de este documento. Datos personales,
IDs de usuario/ficha, claves, sesiones, nonces y enlaces se omiten de Git.
No quitar reservas/historial ni crear otro intento ante una futura ambigüedad:
seguir el procedimiento operativo y auditar el caso concreto.

Este cambio de documentación no modifica runtime ni requiere un despliegue propio.
Retomar el backlog funcional y el diseño aceptado; no reabrir DNI/Keycloak/SMTP
por referencias históricas a REVIEW o E3 BLOCKED.
