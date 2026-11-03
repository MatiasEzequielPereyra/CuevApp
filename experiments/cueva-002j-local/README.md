# CUEVA-002J — paquete operativo, REVIEW local

Prueba acotada sobre el flujo I: correo realmente renderizado, bootstrap del
primer administrador sintético y reconciliación cerrada local. **Sin cambios en
UI/runtime/migración de I; acceso alojado apagado.** No hay cuentas reales,
envíos Gmail, cambios de Supabase alojado, push ni despliegue por este ejecutor.

El [procedimiento operativo](../../docs/engineering/CUEVA-002J-operations.md)
describe destinos, secretos por entorno, condiciones de ejecución y aplicación
separada. [Evidencia redactada](evidence.json) de la ejecución final: 25 PASS,
1 NOT_RUN, incluyendo seis comprobaciones de limpieza.

## Qué se comprobó

- Dry-run del script sin efectos; proyecto incorrecto, invitación duplicada,
  promoción previa a activación, correo incorrecto y promoción repetida rechazados.
- Primera invitación a cuenta sintética sobre Auth/perfiles vacíos. La persona
  establece su contraseña con el flujo I y luego el operador promueve exactamente
  ese UUID/correo desde alumno activo a admin: una fila afectada.
- Invitación y recuperación de otro alumno desde el admin real del ensayo. GoTrue
  obtiene las plantillas versionadas de un servidor privado dentro de la red
  Docker; el navegador abre el `href` recibido literalmente. No se extrae el OTP
  para fabricar un enlace que funcione. Se comprueban ruta, origen y parámetros.
- Un redirect externo no se conserva. GoTrue cae al SiteURL sin query; al añadir
  `&token_hash` la plantilla genera una URL inválida en este fixture. Se registra
  como ausencia de capacidad válida, nunca como alta exitosa. No se afirma que
  cualquier ruta del mismo host esté prohibida por GoTrue.
- Reset interrumpido antes de enviar a Auth. Se paran el único Next y Auth; se
  terminan conexiones del proveedor en la base exclusiva y se comprueba cero.
  La reconciliación elimina sesiones de ese alumno, invalida generación/nonce y
  limpia operación manteniendo ready=false. La sesión anterior ve cero perfiles.

La quiescencia del servicio alojado **NOT_RUN**: el laboratorio controla sus propios
procesos y no demuestra control sobre Supabase Auth alojado. No hay un comando de
reconciliación de producción que acepte una confirmación genérica ni un timeout.
El acceso permanece cerrado si un operador no puede demostrar esa precondición.

## Reproducción y límites

Desde esta carpeta, con Node 22, dependencias de raíz, Chromium y Docker ya activo:

```sh
node lab.mjs
```

Solo crea contenedores/red `cueva-002j-*`; puertos host loopback y claves/correos
sintéticos en memoria. El servidor de plantillas reutiliza la imagen Studio
existente fijada por digest, ejecutando solo Node estático, sin publicar un puerto
ni arrancar Studio. Los templates se montan como solo lectura. No reiniciar Docker
ni tocar otros proyectos. `finally` elimina únicamente recursos de esta ejecución.

Los primeros ensayos encontraron un TypeError en la prueba negativa porque esta
intentaba parsear como URL válida el fallback inválido del proveedor. Se añadió
diagnóstico con tipo/líneas, sin mensaje ni enlace sensible, y se corrigió la
expectativa negativa. No se cambió la plantilla o aplicación para hacer pasar ese
caso. La ejecución final y su limpieza terminaron con exit 0.

PASS adicional: lint, documentos 2/2, fuentes 4/4, escaneo de seguridad por patrones
y diff check. Build, typecheck y suite I completa no repetidos: no cambió código
Next/TypeScript, dependencias ni migración; el laboratorio ejecuta Next real para
las nuevas operaciones. CI remoto, HTTPS, correo Gmail y pruebas alojadas NOT_RUN.
No se infiere que el secreto ya configurado en Vercel esté disponible localmente.
