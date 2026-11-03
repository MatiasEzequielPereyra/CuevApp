# CUEVA-002L — Primer acceso con el correo integrado, solo propietario

El usuario eligió explícitamente usar temporalmente el correo de Supabase para
probar el primer alta de Nico. El correo del gimnasio es Owner del proyecto,
verificado en Team. Google bloqueó la generación de app password por verificación
de identidad. No insistir con credenciales SMTP ni cambiar factores de Google.

El panel confirma que deshabilitar SMTP personalizado **restaura las plantillas
estándar** y bloquea su edición. Se canceló esa confirmación: SMTP personalizado
y plantillas siguen guardados; acceso público apagado, cuentas/perfiles/estado 0.

## Incremento acotado

- Compatibilidad temporal con el enlace estándar ConfirmationURL de GoTrue y su
  callback con fragment de sesión. Aplicable únicamente a la cuenta inicial
  esperada por entorno, con flag propietario explícito apagado por defecto.
- SDK oficial, validación real de usuario/sesión contra Auth y señal OTP autenticada
  comprobada en el proveedor. No basta decodificar JWT ni confiar en type del cliente.
  Si la señal no puede acreditarse, entregar el bloqueo sin inventar garantía.
- Preservar nonce/generación/preflight/bind_session y contraseña propia por el flujo
  I; nada de marcar ready por operador para evitar la incorporación. Ningún cambio
  de migración ni RPC de privilegios nuevo, ni cambio general de identidad.
- Tokens del fragment solo en memoria, quitarlos de la URL y transmitirlos solo
  al POST de mismo origen necesario. Sin logs, localStorage, artefactos ni mensajes
  con tokens/enlaces/capacidades. Preservar Origin, límites de cuerpo y no-store.
- Mantener el flujo de plantilla personalizada y el cierre por defecto existentes.
- Prueba real local con plantilla estándar sin traducir href: enlace → callback
  validado → contraseña propia → perfil alumno. Negativos: nonce/generación/correo
  incorrectos, sesión password aunque conozca nonce, replay y datos antes de clave.
- Next docs y Supabase docs actuales antes de escribir. Laboratorio exclusivo,
  imágenes fijadas y cleanup; no tocar otros proyectos, cuentas o correos reales.

Ejecutor entrega commit local REVIEW y evidencia redactada. Sin push, configuración
alojada ni activación. El Orchestrator revisa antes de cambiar el remitente real.
La autorización de cuenta/envío/promoción condicionada ya está dada; no repetirla.
Esto no habilita el correo integrado para alumnos ni acepta disponibilidad general.
Modelo heredado; razonamiento alto recomendado, riesgo alto de autenticación.
