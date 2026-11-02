# CUEVA-002I — candidato para revisión

**REVIEW local; acceso productivo BLOCKED.** La integración de producto usa
Supabase SSR, una migración candidata y una puerta privada por cuenta. Ninguna
migración se ha aplicado al proyecto alojado. El acceso está apagado por defecto.
Para producción se requieren ambos opt-ins, origen y Supabase HTTPS exactos,
claves de servidor y la plantilla de correo comprobada; no activar hasta auditoría
y pruebas alojadas. El entorno de desarrollo admite únicamente loopback.

## Pruebas y límites

`node lab.mjs` ejecuta Next.js y Auth, PostgREST, PostgreSQL y Mailpit locales,
con imágenes fijadas por digest y datos sintéticos. Los resultados redactados se
encuentran en `evidence.json`. La plantilla predeterminada del correo de prueba
se traduce a la ruta de la aplicación: no prueba plantilla real ni entrega por
Gmail. El rol admin se crea modificando el fixture local por operador de base;
el alta inicial real del administrador no está implementada ni autorizada aquí.

El gate de la migración mantiene la cuenta cerrada durante cada operación, usa
generación y nonce aleatorio con hash privado, sesión habilitada y verificación
de existencia y antigüedad de sesión. Los RPC privilegiados requieren service
role, confiable y exclusivo del servidor; el administrador del gimnasio no lo
recibe. Una operación incompleta permanece bloqueada sin timeout. Cualquier
recuperación manual exige personal confiable y confirmar que ninguna solicitud
anterior a Auth sigue en vuelo; el procedimiento operativo real sigue pendiente.

Preflight responde 409 antes de consumir un OTP si la invitación todavía no está
preparada o la recuperación sigue en curso. Un reset posterior al preflight puede
invalidar el enlace mientras se consume el OTP: se cierra el acceso, no existe
atomicidad entre servicios ni promesa de disponibilidad en esa carrera. El sistema
confía en el proveedor y operadores con control de Auth/base. No se probó que el
administrador inicial se pueda crear de forma segura, ni expiraciones naturales,
rate limiting de producto, protección contra fugas de URL en logs operativos,
entrega real, HTTPS, producción alojada o la recuperación segura de locks huérfanos.

Las pruebas de doble usuario y bypass de operador del flujo antiguo `/laboratorio`
figuran en evidencia por continuidad y **no prueban el flujo de producto**. El
ensayo del candidato usa perfiles de admin y alumno sintéticos, y traduce el enlace
de Mailpit. La carrera de dos RPC prueba exclusión en PostgREST, no todas las
carreras entre Auth, base, correo y la aplicación.

Supabase se observó inicialmente sin tablas, migraciones, usuarios ni buckets y
sin hallazgos en advisors; no acredita Auth/RLS. El Orchestrator informó cierre
posterior de altas públicas y SMTP Gmail habilitado. La plantilla personalizada,
entrega y acceso alojado siguen **NOT_RUN** para este ejecutor.

## Reproducción

Con Docker ya operativo, Node 22, dependencias de raíz y Chromium: ejecutar
`node lab.mjs` en esta carpeta. El script crea únicamente recursos `cueva-002i-*`,
puertos loopback y credenciales sintéticas efímeras. El resultado ignorado
`results.json` puede copiarse a evidencia solo tras comprobar su contenido
redactado. El `finally` elimina sus contenedores y red; una interrupción forzada
puede requerir revisar y limpiar únicamente esos recursos. No reiniciar Docker ni
manipular otros proyectos.
