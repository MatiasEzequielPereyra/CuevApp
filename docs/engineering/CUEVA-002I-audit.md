# Auditoría CUEVA-002I

2026-11-03, America/Buenos_Aires. Base
`75a6a534be10cf67fecdcf92f7e8126cea6b0602`; HEAD ejecutor
`da1de8b63e0e94d62014c5047b214912a90321b9`.

**ACCEPTED LOCAL para integrar apagado. Habilitación alojada BLOCKED.**
El merge no ejecuta SQL, no configura secretos y no crea cuentas.

## Standards y seguridad

Revisión independiente del candidato y del delta de recuperación directa.
SDK SSR oficial, validación de usuario por Auth, secretos solo servidor,
verificación de Origin y límite real de cuerpo. La migración privada usa
RLS, sesiones existentes, generación, nonce de un solo uso y exclusión durable.
Los wrappers públicos requieren service_role; el alumno no escribe perfiles.
La credencial de servicio y el operador de Supabase son autoridades confiables.

La entrega anticipada del correo podía consumir el OTP antes de preparar el
estado. El candidato agrega preflight 409 y prueba el reintento del mismo token.
La revisión exigió distinguir recuperación directa nativa de un bypass del gate:
el alumno activo accede a su perfil mediante control del correo; la cuenta pendiente
y la cuenta cerrada por reset no ven perfiles ni pueden iniciar activación con esa
sesión. No se probó cambio de contraseña o revocación de sesiones anteriores por
esa vía directa. Se retiró el correo real del documento público de bootstrap.

## Spec

Revisión principal contra CUEVA-002I y decisiones posteriores: correo obligatorio,
invitación administrativa, contraseña elegida por el alumno y cierre por defecto.
Se acepta el incremento local; no el funcionamiento alojado ni el bootstrap.
Las pruebas heredadas de /laboratorio están identificadas y no se atribuyen al
flujo de producto. El SQL experimental no se aplica como migración alojada.

## Verificación independiente

- `npm run verify`: lint, tipos, build, 2 pruebas documentales y 25 de navegador PASS.
- `verify:sources`: 4/4; `verify:security`: PASS, 153 archivos; diff check PASS.
- `node lab.mjs`: exit 0; 44 PASS, 2 OBSERVED, 1 NOT_RUN; recursos propios limpiados.
  Evidencia redactada en experiments/cueva-002i-local/evidence.json. La ejecución
  comprende pruebas heredadas y de producto; sus alcances no se suman como garantías.
- Configuración Vercel inspeccionada sin descifrar valores: solo las dos variables
  públicas previas, sin los opt-ins ni la credencial servidor del candidato.
- Workflow revisado: instala, verifica y compila; no aplica migraciones.

## Límites de release

SMTP personalizado figura habilitado y guardado en el panel tras intervención
del usuario. Entrega real NOT_RUN. Plantillas, allowlist, bootstrap administrativo,
procedimiento de operaciones interrumpidas, HTTPS y Auth/RLS alojados requieren
preparación y pruebas separadas. No liberar locks por timeout. No habilitar el
candidato solo para probarlo con usuarios reales. CI remoto y despliegue se
registran por el PR y el handoff después de integrar.
