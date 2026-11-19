# Continuar CUEVA desde otra PC

Checkpoint operativo del Orchestrator, verificado el **19 de noviembre de 2026**.
Este archivo distingue código publicado, esquema aplicado y trabajo en revisión.
Revalidar los estados remotos antes de ejecutar el siguiente paso.

## Punto de partida

- Repositorio: https://github.com/MatiasEzequielPereyra/CuevApp
- Sitio: https://cueva-gym.vercel.app
- Supabase: proyecto `vbkzoojkdkcugxhneyzi`, región `ca-central-1`.
- Vercel: proyecto `cueva-app`, equipo `matiasezequielpereyras-projects`.
- `main` funcional: `508cb62ba64609293d1ea6057cf84f9bec373bb5`, squash del PR #63.
- Production: `dpl_H31uxB9dXxh91d2ED2JZmjTT6GvC`, READY, con ese mismo SHA.
- Los commits documentales posteriores a esta foto pueden cambiar `main` sin
  cambiar la implementación. Comparar siempre el diff y el SHA publicado.

El acceso exige correo. DNI es opcional en la ficha administrativa. El ingreso
usa invitación y contraseña elegida por el alumno. Se conserva el diseño del
portal aprobado, su SVG, temas y navegación. Nico es el administrador general.
No se incluyen contraseñas, tokens, enlaces de invitación ni sesiones.

## PR y estado de integración

| PR | HEAD verificado | Estado real |
| --- | --- | --- |
| [#64 Contraseñas](https://github.com/MatiasEzequielPereyra/CuevApp/pull/64) | merge `a019bded9c4d3340feab2d32c2116e0d4e9796d8` | Integrado antes de #68. |
| [#68 Hidratación y foco](https://github.com/MatiasEzequielPereyra/CuevApp/pull/68) | candidato `e0bdd681fb11e9f9d31785608bc113328d7b456d` | Integrado en `0832c9e`; Production verificado. |
| [#63 Cambio de correo](https://github.com/MatiasEzequielPereyra/CuevApp/pull/63) | candidato `de2f3424b9b026d85e62da203bf75450b3a156fd` | Integrado en `508cb62`; esquema y Production verificados. |
| [#67 Menciones en rutinas](https://github.com/MatiasEzequielPereyra/CuevApp/pull/67) | `f1de91cb4c601c3fd9bdf094605dc8da922c9340` | CHANGES_REQUIRED. Sin merge ni migración de Menciones aplicada. |

#63 se integró después de comprobar Foundation SUCCESS del evento push en su
HEAD y la cancelación del duplicado pull_request del mismo SHA; no se presentó
el cancelado como PASS. Sus variantes SQL están aprobadas. Se verificó la
plantilla con `ConfirmationURL`, Secure email change activo y Site URL canónica.
Se agregó únicamente el retorno exacto
`https://cueva-gym.vercel.app/mi-perfil?correo=confirmado` a la lista permitida,
conservando la URL de invitación anterior. No se cambiaron SMTP ni flags de Auth.
Vercel sirve el SHA del merge y el ingreso respondió HTTP 200. El flujo de doble
confirmación con buzones y sesión reales alojados sigue NOT_VERIFIED; no se
enviaron correos de prueba.

#67 tiene nueve checks SUCCESS en el HEAD indicado. La actualización tras #68
había fallado: dos fixtures competían por el directorio de Next y el ensayo de
foco no devolvía el documento lateral nuevo. El ejecutor agregó dependencia de
proyectos en Playwright y la respuesta sintética faltante. Son cambios en
`playwright.config.ts` y `tests/e2e/student-plan-focus.spec.ts`; conservar las
aserciones de Tab/Enter. La revisión independiente final encontró dos P2:
selección de sugerencias de una consulta anterior mientras carga la nueva, y
validación SQL que acepta `mention.text` numérico en vez de exigir una cadena.
Ver [auditoría y aceptación esperada](PR67-final-audit-20261119.md). El ejecutor
recibió ambos hallazgos y el conflicto de `package.json` con el main de #63.
No intentar mergear el HEAD verde anterior: requiere correcciones y CI nueva.
La intermitencia histórica WebKit sigue registrada.

Evidencia de #67: [Foundation del HEAD](https://github.com/MatiasEzequielPereyra/CuevApp/actions/runs/44442788255)
y [matriz SQL del HEAD](https://github.com/MatiasEzequielPereyra/CuevApp/actions/runs/44442788361).
Consultar los informes de cada rama y el diff exacto; no reejecutar todos los
laboratorios históricos si el cambio no los afecta.

## Supabase: no repetir la migración de correo

Consulta alojada del 19/11: **31 migraciones** registradas.

| Cambio | Archivo Git y SHA-256 | Estado alojado |
| --- | --- | --- |
| Sincronización de correo | `20261116130000_cueva_student_email_sync.sql` — `3dc84045aec40ba292bb07ca7c9427d26f9f24591a6bcf6c7c667e8df0293bcb` | APLICADA como versión `20261118185514`, nombre `cueva_student_email_sync`. |
| Ejercicios asignados | `20261114120000_cueva_student_assigned_exercises.sql` — `c2c391b8dfb72e9d10015fafff09ee6072cf40a56544fab20754bf03f533537c` | PENDIENTE; la RPC pública y privada faltaban. |
| Menciones | `20261116120000_cueva_routine_text_mentions.sql` — `14f5990bb518dc910ea7bf013ba2c7ef2bb293a8efcaaebac246d2ef0918e2f8` | PENDIENTE; ambas tablas laterales faltaban. |

El hash de Menciones identifica el candidato auditado con un P2 pendiente.
No aplicarlo tal cual: reemplazarlo por el SQL corregido y su hash revisado.

La RPC `cueva_my_routine_video_ids()` ya existe; **no repetir**
`20261115160000_cueva_my_routine_video_ids.sql` por su nombre de archivo.
El historial alojado usa versiones distintas de Git: cotejar esquema y contenido,
aplicar una lista explícita y registrar el mapeo. No usar `db push` indiscriminado.

Correo se aplicó con `lock_timeout=5s` y `statement_timeout=90s` dentro de su
transacción, sin cambiar sus instrucciones funcionales. SHA-256 del payload
operativo: `b14e94a4546a51f02a7d764ae8512cf83211ad0c5412bff72144dab3ad0e662e`.
Postflight comprobó trigger activo, función interna sin EXECUTE para anon,
authenticated ni service_role, cero divergencias Auth/ficha/invitación y huellas
de fichas e invitaciones idénticas antes/después. No se enviaron correos.
El flujo real de doble confirmación alojada todavía es NOT_VERIFIED.

Las migraciones pendientes deben respetar RLS, identidad estable, gate de primer
ingreso, advisory lock, CAS, reintentos idempotentes y publicaciones históricas.
La aplicación de Menciones exige postflight de borradores, plantillas y
publicaciones y sus permisos. El esquema nuevo debe preceder al despliegue del
código que lo usa. No improvisar una reversión destructiva.

## Autorización y respaldo

El usuario autorizó explícitamente el 18/11: **respaldo nuevo y las tres
migraciones de la tabla anterior**, seguidos de verificación, integración y
publicación. La de Correo ya consumió su paso de aplicación. No pedir otra vez
el mismo permiso si el alcance y el SQL siguen idénticos. Esto no autoriza
cambiar SMTP, activar envíos automáticos, enviar correos de prueba ni ampliar
el alcance de datos. Los merges/despliegues ordinarios aprobados tienen
autorización permanente del protocolo.

El respaldo previo se terminó y verificó el 18/11 a las 15:55 de Argentina:

- Carpeta local de la PC de origen:
  `C:\Users\pereyram\AppData\Local\CUEVA-Backups\CUEVA-PR63-67-b12d471240b442d19792ff8ecaf93c40`.
- Archivo `cueva-release.dump.dpapi`: 662038 bytes.
- SHA-256: `934559842a51871ed6c18d985247fe2f5457def13d195eb42a2ea57761f00013`.
- Prueba `status.json`: VERIFIED; pg_dump custom, lectura completa del archivo
  por pg_restore y cifrado/descifrado DPAPI en memoria con hashes iguales.
- Se eliminó la copia sin cifrar. No se retuvo la contraseña PostgreSQL.
- **No se hizo un ensayo completo de restauración.** El cifrado DPAPI depende
  del usuario Windows de origen; el respaldo no está en GitHub ni es una copia
  portable utilizable directamente desde otra PC.

Antes de aplicar las migraciones pendientes, evaluar la vigencia del respaldo
y disponer de una copia recuperable para el entorno desde el que se opera.
Si hace falta una nueva copia, pedir la contraseña sólo por entrada privada,
nunca por chat, archivos versionados, argumentos de proceso ni logs. La
contraseña PostgreSQL no es la de Gmail ni la de la cuenta de Supabase.

## Siguiente secuencia

1. Actualizar `main` y las referencias remotas en un checkout limpio. Leer
   `AGENTS.md`, este archivo, checkpoint, README y los informes vigentes.
   Revalidar HEAD, CI y el SHA servido por Vercel; no asumir que siguen iguales.
2. #63 ya está integrado y publicado. Comprobar la conclusión de CI del merge
   si sigue en curso; no repetir su migración ni enviar pruebas sin permiso
   para el destinatario. Mantener el límite de aceptación alojada documentado.
3. Recibir #67 actualizado con main, ambos P2 corregidos y conflicto resuelto.
   Auditar sólo el delta afectado y verificar el resultado combinado y CI exacta.
   El ejecutor corrige; el Orchestrator no implementa correcciones de producto.
4. Con respaldo vigente y preflight, aplicar únicamente Ejercicios asignados
   y Menciones si siguen faltando, usando los bytes aprobados. Respetar el orden,
   límites de espera y postflight. Registrar las versiones alojadas generadas.
5. Integrar #67 después del esquema y CI del candidato final. Verificar el SHA
   de Production y los flujos afectados. Conservar NOT_VERIFIED donde falte una
   sesión real alojada. Actualizar checkpoint y este documento al cerrar.

Notificaciones: las 12 migraciones anteriores están aplicadas; Cron sigue sin
instalar. No hay autorización nueva para habilitar el worker global, configurar
Brevo/VAPID o enviar avisos a todos los períodos elegibles. Resultados de
entrenamiento y rutinas offline siguen pendientes de producto.

## Prompt para el siguiente Orchestrator

> Continuá CUEVA leyendo primero AGENTS.md,
> docs/engineering/CONTINUAR-CUEVA.md, checkpoint y el orden de README.
> Revalidá GitHub, Supabase y Vercel. Correo y su migración ya están publicados:
> no repitas el SQL. El usuario ya autorizó el respaldo
> y las tres migraciones enumeradas; faltan dos. Auditá los HEAD actuales y
> verificá CI de #63 y completá #67 corrigiendo los dos P2 según la auditoría. El ejecutor corrige;
> vos auditás, integrás y publicás. Conservá el diseño aprobado y optimizá
> pruebas según el diff. No almacenes claves ni confundas CI con prueba alojada.

SKILLS_SELECTED / SKILLS_APPLIED: `cueva-release`, `cueva-acceptance-audit`,
`cueva-supabase-security`, `supabase:supabase`, `pr`.
SKILL_SOURCES: `.agents/skills/<nombre>/SKILL.md` y guías del host.
Este checkpoint documenta verificaciones de solo lectura y la operación de
correo ya autorizada; su publicación documental no ejecuta migraciones nuevas.
