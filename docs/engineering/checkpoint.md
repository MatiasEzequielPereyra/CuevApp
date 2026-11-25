# Checkpoint CUEVA

## PR #88 — Compatibilidad de catálogo — 2026-11-25

Main incorporado `545374cb8017f8c894dfd605fb91935c61f86107`, incluidos #83/#75.
Se conserva la RPC de siete campos para el servidor anterior y rollback, con
modo existente bajo lock y CAS del writer nuevo. [Contrato, pruebas y orden de
las dos migraciones pendientes](CUEVA-007-task.md). PostgreSQL aislado75/75;
resultado del contrato real de main con GoTrue/PostgREST y CI final en el PR.
Sin SQL alojado ni activaciones de este ejecutor. El Orchestrator informó34
migraciones y registro público activo, operación ajena a esta corrección.
WebKit Linux reprodujo la pérdida de clic cuando termina el autoguardado entre
presionar y soltar el mouse: desaparecía la fila de acciones y desplazaba el
control. La fila ahora permanece montada y conserva sus bloqueos. Regresión
nativa RED antes / GREEN después; seis escenarios originales de cuatro bloques
también PASS. Evidencia, límites y CI del HEAD final en el PR; no se relajan
aserciones ni tiempos de espera.

## PR #88 — Correcciones de auditoría — REVIEW — 2026-11-24

[Correcciones y secuencia operativa](CUEVA-007-task.md): se conserva la entrada
editable frente a respuestas tardías y se divide el batch respetando máximo100.
Base main `425e23aa3e5d28a1d2ba08c41084e5bba021f297`, candidato anterior
`368709119d14e7bc01aeb1a0e8a53fed45f7f81b`. Navegador real con respuestas
sintéticas 8/8; batch/GET5/5; API3/3; menciones12/12. HEAD final/CI en el PR.
Sin merge, despliegue ni SQL alojado. La publicación requiere comprobar/aplicar
el esquema de entrenamiento bajo autorización operativa separada.
Los estados históricos inferiores no certifican el nuevo HEAD.

## Estado reconciliado — 2026-11-24

Main verificado `425e23aa3e5d28a1d2ba08c41084e5bba021f297` incluye #82 y
#84–#87: CUEVA-006E ya integrada; los fallos y estados abiertos de noviembre
19/20 se conservan abajo como historia. Vencimientos, CUEVA-006D y CUEVA-005
mantienen sus baselines. PR pendientes: #75 documentación y borrado seguro,
#83 registro personal apagado por defecto y #88 entrenamiento en Draft.

[Reconciliación y entrega del 24/11](REPO-STATUS-2026-11-24.md): procedencia,
límites, ramas y prueba de lease. Sin borrados de ramas ni cambios alojados.
Producción READY en main y 33 migraciones son resultados informados por el
Orchestrator el 24/11, no verificaciones remotas nuevas de este ejecutor.
La activación del registro, SQL de entrenamiento, Cron, entrega Push y offline
no se dan por realizados. Esta sección prevalece sobre las fotos inferiores.

## Foto histórica reconciliada — 2026-11-19

El [inventario verificado de GitHub, Supabase, Vercel y 33 ramas](REPO-STATUS-2026-11-19.md)
registra `main` en `aa7cd36041412aa1b14a4d2b0f6145728084cb5d`, CI
general y migraciones locales PASS; producción Vercel READY en ese SHA,
Supabase Hosted ACTIVE_HEALTHY con **33 migraciones** y la RPC
`public.cueva_student_assigned_exercises()` ya alojada. La migración de
sincronización de correo y `cueva_routine_text_mentions` también figuran alojadas.

No hay PRs abiertos. Se auditaron 25 ramas exactas de PRs MERGED, pero **no
fueron borradas**; otras 7 tienen trabajo no integrado o evidencia insuficiente.
La rama funcional CUEVA-006E no está en main y su CI fresh falla en la prueba
de interfaz «Cerrar aviso» (Sentadilla), aunque Verify foundation y las matrices
upgrade/hosted-compatible aprobaron. No debe integrarse sin corrección y auditoría.

CUEVA-005 todavía no tiene `pg_cron` ni `pg_net` en Hosted; no declarar
recordatorios automáticos o entrega Push en producción. Registro de resultados
de ejercicios y rutina offline siguen pendientes. El informe enlazado contiene
los SHAs, referencias, riesgos y acciones pendientes.

**Los informes inferiores se conservan como evidencia histórica a su fecha.**
En particular, el estado REVIEW de PR #67 y la frase «RPC pendiente» del
17/11 quedaron superados por las verificaciones del 19/11.

## Foto histórica — 2026-11-20 · CUEVA-006E

- CUEVA-006D / PR #67 está integrado en main y permanece cerrado.
- CUEVA-006E está implementada en `feature/cueva-006e-exercise-mention-preview`; PR #82 abierto contra `main`, no Draft y mergeable en la última lectura. No está mergeado ni desplegado a producción.
- HEAD de código validado por los cinco workflows asociados al PR: `9807876c0ccf1bbf9ad5c6bcbee5c60213b417a0`. Base `main`: `e9dffe16de5ae76eb01eb24b4de490dd3e33b806`. La reconciliación documental en curso cambia el HEAD; los checks del nuevo commit deben confirmarse antes de integración.
- CI del PR #82: Verify foundation #1313, routine mentions E2E #25, isolated checks #15, Supabase local migrations #679 y Membership SQL #342; todos SUCCESS sobre el HEAD indicado. Ver [PR #82](https://github.com/MatiasEzequielPereyra/CuevApp/pull/82).
- El Preview Vercel del PR fue reportado Ready; no equivale a publicación de producción.
- La sincronización conserva PR #80 (instalación PWA) y PR #81 (fixtures de notificaciones con fechas relativas). Las migraciones de 006E se probaron localmente; no se aplicaron a Supabase hosted.
- CUEVA-003B Vencimientos y CUEVA-006D permanecen cerradas. CUEVA-005 no se reabre.
- Ver [cierre técnico CUEVA-006E](CUEVA-006E-closure.md) para alcance, migraciones, pruebas y límites.

## PR #67 — Correcciones P2 — REVIEW — 2026-11-19

[Entrega vigente](pr67-corrections-20261119.md) sobre main
`5a222ca0138dab4f3acd2c151a91b513d3197652`, que incluye Correo y el arreglo de foco.
Se preservan ambos flujos y scripts, se impiden sugerencias obsoletas y se exige
texto JSON de tipo string antes de escribir. SQL60/60 en PostgreSQL aislado.
El arreglo común de pruebas #72 ya está integrado en esta base; HEAD,
CI y revisión independiente finales se registran en el PR. Sin merge, deploy ni
operación alojada. Las evidencias anteriores son históricas, no del nuevo HEAD.
Skills y fuentes en el informe enlazado.

## CUEVA-CI-FIXTURES-001 — REVIEW — 2026-11-19

[Aislamiento y lifecycle de fixtures](fixture-isolation-review.md) documenta la
reproducción de dos Next en un checkout, el estado sintético incompleto de foco
y la conservación del error original. Sin producto, SQL ni operación alojada.
HEAD, base actualizada y CI exacta se registran en el PR común para integrar
antes de actualizar #63/#67. Skills y resultados en el informe enlazado.

## CUEVA-CI-PICOMATCH-001 — REVIEW — 2026-11-18

El Product Owner autorizó en el chat una excepción temporal del aviso
`GHSA-fc5q-39xc-vjpf` en herramientas de desarrollo. La
[política acotada y su retiro](dependency-audit-policy.md) conservan el audit
de producción bloqueante y rechazan otros avisos. Vence el 2026-11-25.
Esta excepción acepta un riesgo; no corrige picomatch. La base verificada es
`d90be98ffd2f891df3bb8083b10726f985b261c1`. El PR registra el HEAD, las pruebas
y la decisión independiente antes de integrar; no se ejecutan cambios de datos.

Verificación local nueva: 23 pruebas del evaluador aprobadas; audit de producción
sin vulnerabilidades. El audit completo conserva 14 hallazgos causados por el
mismo aviso y el gate los identifica como `ACCEPTED_RISK` temporal. Documentos,
fuentes, manifiesto, escaneo de secretos y diff aprobados. CI e integración se
registran en el PR, sin atribuir estos resultados a la versión alojada.

SKILLS_SELECTED / SKILLS_APPLIED: `cueva-feature-development`,
`cueva-acceptance-audit`, `cueva-release`, `code-review`, `pr`,
`vercel:deployments-cicd`. SKILL_SOURCES: `.agents/skills/<nombre>/SKILL.md`
y guías del host.


## PR #67 — CUEVA-006D — CI validado, draft — 2026-11-18

Base `0832c9ef17a04289528148f76ac2057703db3746`; HEAD documental actualizado
`b9b7d4096f81fc212d1f635576d972dfdc7cc0f0`. La implementación funcional fue
validada en `0c4e9c3`; los commits posteriores son solo documentación. La CI se
repitió sobre `11e9169`: Verify foundation, Membership SQL, Receipt Storage,
Supabase fresh/upgrade/hosted-compatible y Vercel Preview SUCCESS. La rama está
143 commits ahead y cero behind de main. PR abierto, mergeable y draft; sin
reviews ni hilos registrados.

La primera corrida del código `0c4e9c3` tuvo una intermitencia WebKit móvil;
el reintento pasó sin cambios de código, aserciones ni timeouts. La flakiness
sigue siendo riesgo conocido. No se integró #67 ni se aplicó SQL en Supabase
hosted. La revisión humana final y la autorización de merge siguen pendientes.
Ver [informe](pr67-portal-review.md) para runs, jobs, limitaciones y secuencia
operativa.

SKILLS_SELECTED / SKILLS_APPLIED / SKILL_SOURCES: detallados en el informe.

## Estado vigente verificado — 2026-11-17

El [PR #53](https://github.com/MatiasEzequielPereyra/CuevApp/pull/53) integró el
portal del alumno con Inicio, Mi Membresía, Entrenamiento, Notificaciones y
Mi perfil. [Vercel Production](https://vercel.com/matiasezequielpereyras-projects/cueva-app/7e1ZMTQXNZ59dq7bosgxYNd3Ys2M)
sirve el commit de la corrección posterior `d85d7bca01d60b6f8bdca4477885ecb4f85c21ff`.

Supabase Hosted registra 30 migraciones, incluidas las 12 del
[manifiesto de Notificaciones](../operations/CUEVA-005-migration-manifest.json).
La bandeja existe y la RPC `cueva_student_assigned_exercises()` sigue pendiente
de aplicación alojada. Cron sigue sin instalar y la tabla de ejecuciones está
vacía. El correo autorizado llegó al buzón en una prueba aislada. La entrega
efectiva de Push y la aceptación con una sesión alojada quedan pendientes.

Vencimientos conserva su esquema de referencia. El registro e historial de
resultados de entrenamiento y la consulta de rutinas sin conexión siguen
pendientes.

SKILLS_SELECTED / SKILLS_APPLIED: `cueva-acceptance-audit`, `cueva-release`,
`cueva-supabase-security`, `supabase:supabase` y `resolving-merge-conflicts`.
SKILL_SOURCES: `.agents/skills/<nombre>/SKILL.md` y guías de host.

## CUEVA-005 · Corrección de bandeja y registro Push publicada · 2026-11-16

El [PR #65](https://github.com/MatiasEzequielPereyra/CuevApp/pull/65) integró la
corrección en `d85d7bc`. GitHub verificó la lectura desde Chromium en la
[integración con Supabase](https://github.com/MatiasEzequielPereyra/CuevApp/actions/runs/43934997360/job/133537155824).

Base `a432ea2644ea2af4e5ebf81fb0e9958955d06206`. El PATCH de bandeja
rechazaba `Content-Length` decimal por un escape doble en su expresión regular.
Next.js y Supabase local con dos alumnos sintéticos confirmaron PATCH 200 con
`Content-Length`, `read_at` persistente tras recargar y PATCH ajeno 404 sin
cambiar el aviso.

El navegador integrado de ChatGPT generó una suscripción nativa HTTPS a
`jmt17.google.com/fcm/send/…`. Con el validador original el POST local dio 400;
con la corrección dio 200 y `registered: true`. Ese ensayo usó el handler HTTP
real con dependencias de sesión y persistencia sintéticas. La excepción de
destino se limita al host exacto y a la ruta de suscripción identificada en el
[código de Chromium](https://chromium.googlesource.com/chromium/src/+/refs/tags/141.0.7390.94/components/push_messaging/push_messaging_constants.cc).

La integración con Microsoft Edge 157, Next.js y Supabase local verificó
registro nativo, 400 para un host ajeno, un 200 simulado sin confirmación
positiva, registro real 200, confirmación después de recargar y pérdida del
estado habilitado tras revocar. La comprobación de otro alumno devolvió
`registered: false`. El flujo HTTP también pasó origen, sesión, RLS, propiedad,
actualización y límite de diez dispositivos. Para repetirlo, usar el stack
local del workflow `supabase-local.yml` y ejecutar
[`notifications-push.integration.mjs`](../../tests/e2e/notifications-push.integration.mjs)
con `CUEVA_TEST_NATIVE_PUSH_BROWSER=msedge` y un par VAPID efímero coherente
en el servidor local. La integración general ejecuta bandeja y HTTP aun cuando
se omite la opción nativa. Este ensayo cubrió el registro de Push. La entrega
al dispositivo requiere una prueba adicional.

SKILLS_SELECTED / SKILLS_APPLIED: `cueva-feature-development`,
`cueva-supabase-security`, `supabase:supabase`, `diagnosing-bugs`,
`computer-use:computer-use`, `vercel:verification`.
SKILL_SOURCES: `.agents/skills/<nombre>/SKILL.md` y guías del host.

## CUEVA-UX-NUEVO-BLOQUE · Publicado · 2026-11-16

[PR #58](https://github.com/MatiasEzequielPereyra/CuevApp/pull/58), base `84fac4ee239292bb51290074f816ba77216bcf15`,
HEAD auditado `c0322e3c7c1c2dc82880a314b350c10b878cbd8c`, squash `3822520c41b6fe9fb4eb870f22fb69fb420bca66`.
Vercel Production `dpl_GGiVwUzPsepPxtdhH2NFAJuHdDhk` READY con el SHA del merge en
`cueva-gym.vercel.app`. Ingreso respondió HTTP 200 y `/cuenta` redirigió al ingreso
sin sesión. El editor autenticado se verificó en CI.

Nuevo bloque permite elegir vueltas y peso por ejercicio en el selector. El peso
vacío, cero y decimal se conservan como valores distintos. La selección permanece
editable al buscar otros ejercicios. Se conservó el contrato del plan V2.
[CI general](https://github.com/MatiasEzequielPereyra/CuevApp/actions/runs/43778309997)
aprobó 126 pruebas, incluidas las 12 variantes del flujo de cuatro bloques en
Chromium y WebKit. [CI de migraciones](https://github.com/MatiasEzequielPereyra/CuevApp/actions/runs/43778309975)
aprobó fresh, upgrade y hosted-compatible. El árbol del merge coincide con el candidato.

En la revisión previa a integrar el portal, la lectura alojada observó que
faltaban la bandeja y la RPC de ejercicios asignados. El estado vigente figura
al comienzo de este documento.

SKILLS_SELECTED / SKILLS_APPLIED: `cueva-acceptance-audit`, `cueva-release`,
`cueva-supabase-security`, `cueva-finance` y `supabase:supabase`.
SKILL_SOURCES: `.agents/skills/<nombre>/SKILL.md` y guía Supabase de host.

## CUEVA-005 · Preflight auditado · 2026-11-16

Entrega del ejecutor `6187e64560f3f9e1dbe89af14da5381130dd41ef` sobre
`0da414beb60610ced8ab4f3768021061aceb8aea`. La base de integración incluye
el portal publicado en `640324bc0fbf97b0777ddd7080c33ff13c378e45` (PR #53).

Auditoría nativa independiente PASS con las extensiones reales en contenedores
aislados: dos POST HTTP 204, mismo job e historial conservado después de
reanudar, otro job intacto y rechazo de cambios de permisos y configuración.
El ensayo del auditor redujo el intervalo a 12 segundos únicamente en memoria.
El ejecutor registró el recorrido a cinco minutos.
[Control de cola](../operations/CUEVA-005-queue-preflight.sql) ·
[Control de Cron](../operations/CUEVA-005-cron-control.sql) ·
[Ensayo nativo](../../tests/cueva-005-cron-native.ps1).

El preflight registró 18 migraciones alojadas antes de aplicar las doce de
Notificaciones. La secuencia de verificación, respaldo y aplicación figura en
la [guía operativa](../operations/CUEVA-005-rollout-checklist.md).

SKILLS_SELECTED / SKILLS_APPLIED: `cueva-acceptance-audit`,
`cueva-supabase-security`, `cueva-finance`, `cueva-release`,
`supabase:supabase` y `pr`.
SKILL_SOURCES: `.agents/skills/<nombre>/SKILL.md` y guías de host.

## CUEVA-PWA-LOGIN · Publicado · 2026-11-15

[PR #57](https://github.com/MatiasEzequielPereyra/CuevApp/pull/57), base `cbdb9052be2221cd4e1db9e5760bdd007a6e855d`,
HEAD auditado `19f6545540f53919f3d639757152a0819651684c`, squash `f5dc70bbbae5af3a5e12f4e517410787f870f24c`.
[Vercel Production](https://vercel.com/matiasezequielpereyras-projects/cueva-app/7wPr8tz1PkAzFMyj4SVLwaDPavci)
`dpl_7wPr8tz1PkAzFMyj4SVLwaDPavci` READY en `cueva-gym.vercel.app`.

El ícono instalado sigue abriendo `/cuenta`. La entrada redirige a `/ingresar`
sin sesión válida y abre el panel correspondiente con sesión activa.
En producción, la entrada anónima devolvió HTTP 307 sin caché y llegó al
formulario habilitado con HTTP 200 en una redirección. El manifiesto conservó
`start_url=/cuenta` y modo standalone.

[CI general](https://github.com/MatiasEzequielPereyra/CuevApp/actions/runs/43771266757) aprobó 126
pruebas. Chromium y WebKit cubrieron la navegación inicial desde el manifiesto
con sesiones sintéticas de alumno, administrador y sin sesión.
[Supabase local](https://github.com/MatiasEzequielPereyra/CuevApp/actions/runs/43771266825) aprobó las
tres variantes. La comprobación alojada fue HTTP sin credenciales.

## CUEVA-UX-MI-RUTINA · Publicado · 2026-11-15

[PR #55](https://github.com/MatiasEzequielPereyra/CuevApp/pull/55), base `2036d41d7209362ab85cb7a16fed9f3197a5d3eb`,
HEAD auditado `00977d70c57c23fea999fe87e4ec7cc7d880ef0b`, squash en `main` `a1d2da659def5570e35a2a0833dc9ee91dadc802`.
[Vercel Production](https://vercel.com/matiasezequielpereyras-projects/cueva-app/GRdZUYn3ruqAeJDXUAxabXBvDomK)
`dpl_GRdZUYn3ruqAeJDXUAxabXBvDomK` READY. El alias `cueva-gym.vercel.app` sirvió el SHA de integración.

La vista del alumno muestra un día publicado a la vez, con bloques, vueltas,
objetivos y observaciones. La fila con video autorizado abre un reproductor
y devuelve el foco y la posición al cerrarlo. Se conservaron las series V1
y la vista previa administrativa.

Supabase Hosted registró `20261115154313 cueva_my_routine_video_ids`, que corresponde
a `20261115160000_cueva_my_routine_video_ids.sql` en Git. Son dos funciones sin
escrituras en tablas de negocio. El wrapper público usa SECURITY INVOKER y el
helper privado valida titularidad y última publicación. Se verificaron
grants, ausencia de resultados sin identidad y Storage privado. Para revertir,
primero se vuelve al deployment previo y, si se requiere, se pueden retirar
las dos funciones en orden público, privado, sin cascada.

[CI general](https://github.com/MatiasEzequielPereyra/CuevApp/actions/runs/43730553795) aprobó 124
pruebas y [Supabase local](https://github.com/MatiasEzequielPereyra/CuevApp/actions/runs/43730553767)
aprobó las tres bases. Se probó reproducción real desde Storage local con dos
alumnos sintéticos. YouTube usó un reproductor simulado. La auditoría
independiente cubrió 12 combinaciones, incluida la recuperación de un 503.
En producción, la rutina pidió sesión, el endpoint de video rechazó la
solicitud anónima y respondieron ingreso y logo.

[PR #53](https://github.com/MatiasEzequielPereyra/CuevApp/pull/53) queda abierto. Hay que reconciliar
`src/app/mi-rutina/page.tsx` con esta versión y ejecutar CI sobre el resultado.
El HEAD `b9d1cd8` aprobó Verify foundation y falló el laboratorio SQL en el
fixture de Notificaciones que esta integración ya aísla.

## CUEVA-UX-RUTINAS-EDITOR · Publicado · 2026-11-15

[PR #54](https://github.com/MatiasEzequielPereyra/CuevApp/pull/54), base `ed5aec52ff2ad18c7082c7c1138dc8d37e226366`,
HEAD auditado `9baa9d5223fa82affd327b1329502fa360297c58`, squash en `main` `b64b4e152f0246bf835fd0eeb36757bf1f837bf6`.
[Vercel Production](https://vercel.com/matiasezequielpereyras-projects/cueva-app/Hoxdy33sXTehBugQYea4z72i9iy4)
`dpl_Hoxdy33sXTehBugQYea4z72i9iy4` READY. El alias `cueva-gym.vercel.app` sirvió el SHA de integración.

El editor de plantillas y rutinas de alumnos muestra un día de nombre libre a la vez.
«+ Bloque» abre el catálogo con selección múltiple; al confirmar se crea el bloque
con tres vueltas editables y se vuelve al mismo día. El flujo habitual cubre
cuatro bloques de dos o tres ejercicios combinados. Los objetivos aparecen
resumidos y se ajustan tocando el ejercicio. Se mantienen el autoguardado, las
copias independientes, los datos anteriores y la publicación explícita.

[CI general](https://github.com/MatiasEzequielPereyra/CuevApp/actions/runs/43726015050)
aprobó 124 pruebas de navegador con 12 casos nuevos y las
[tres variantes de Supabase local](https://github.com/MatiasEzequielPereyra/CuevApp/actions/runs/43726015058).
La auditoría independiente reprodujo el armado y publicación, la separación del
borrador, la copia de plantillas, el legado V1, orden y vueltas, y error/conflicto
de guardado. Se verificó `/mi-rutina` con una sesión de alumno sintética. En
producción se comprobó acceso restringido sin sesión y respuesta de ingreso y logo.

## CUEVA-UX-ALUMNOS · Publicado · 2026-11-14

[PR #52](https://github.com/MatiasEzequielPereyra/CuevApp/pull/52), base `c0641123bc7112e6dad0ee7f142c9e341042242a`,
HEAD auditado `37601aa4aa1fd59a1b16eb3cb429a53d74cc26ab`, squash en `main` `65e7a54d290aea687e9838c359978b1340fb9bd4`.
[Vercel Production](https://vercel.com/matiasezequielpereyras-projects/cueva-app/4KNJac1yqKJ8AwAvuetLdJMNcrzM)
`dpl_4KNJac1yqKJ8AwAvuetLdJMNcrzM` READY. El alias
[cueva-gym.vercel.app](https://cueva-gym.vercel.app) sirvió el SHA de integración.

El listado permite abrir la ficha desde toda la fila. La ficha reúne edición,
rutina y pagos, muestra el estado de invitación y conserva la eliminación
protegida al final. Alta y edición comparten diseño y conservan el DNI opcional.

[CI](https://github.com/MatiasEzequielPereyra/CuevApp/actions/runs/43618845954) del HEAD aprobado con
112 pruebas Playwright y [tres recorridos Supabase local](https://github.com/MatiasEzequielPereyra/CuevApp/actions/runs/43618846036).
La auditoría independiente cubrió 32 combinaciones de pantalla, navegador
y tema con datos sintéticos. En producción respondieron ingreso, logo y
manifiesto, y Alumnos y Nuevo alumno bloquearon el acceso sin sesión.
El flujo autenticado de escritura se verificó en el entorno de pruebas.

Próxima tarea propuesta. CUEVA-UX-RUTINAS, revisión móvil del catálogo y del
recorrido de asignar, editar y publicar desde la ficha del alumno.

## Estado verificado del repositorio — 2026-11-13

`main` de implementación `8471e39cda6a6e4feb1b24dcb9ded438f0bc9464`.
Vercel Production `dpl_EnCA8Daua7gjXJYNzwymPyPAULfw` READY sirve ese SHA en
`cueva-gym.vercel.app`. CI de `main` aprobada en Verify foundation, Membership
SQL y Supabase local migrations. El alias confirma la versión publicada del
código. La operación de cada función depende también de su esquema y entorno.

| Alcance | Integración | Estado observado |
| --- | --- | --- |
| Rutinas estructuradas, por días y bloques | [PR33](https://github.com/MatiasEzequielPereyra/CuevApp/pull/33), [PR34](https://github.com/MatiasEzequielPereyra/CuevApp/pull/34) | Código publicado, migraciones de rutinas y videos registradas. [Cierre de 006B](CUEVA-006B-closeout.md) y preflight de 006C más abajo. |
| Ejercicios y biblioteca de videos | [PR35](https://github.com/MatiasEzequielPereyra/CuevApp/pull/35) | Código publicado. |
| Mi Membresía y comprobantes privados | [PR36](https://github.com/MatiasEzequielPereyra/CuevApp/pull/36), [PR37](https://github.com/MatiasEzequielPereyra/CuevApp/pull/37) | Código publicado y migraciones `cueva_membership_read` y `cueva_payment_receipts` registradas. |
| Vencimientos y gestión de pagos | [PR38](https://github.com/MatiasEzequielPereyra/CuevApp/pull/38), [PR41](https://github.com/MatiasEzequielPereyra/CuevApp/pull/41), [PR42](https://github.com/MatiasEzequielPereyra/CuevApp/pull/42) | Código publicado y migración `cueva_003b_due_dates` registrada. |
| Notificaciones y alertas | [PR45](https://github.com/MatiasEzequielPereyra/CuevApp/pull/45) | Código integrado y publicado. El historial alojado termina en `20261111190623 cueva_003b_due_dates`. Las migraciones CUEVA-005 y su operación alojada siguen pendientes de [preflight y rollout](../operations/CUEVA-005-rollout-checklist.md). |

En esta actualización se verificaron GitHub, el alias de Vercel y el historial
Supabase del proyecto CUEVA. Los recorridos alojados de usuario no se repitieron.

Se retiraron ocho ramas remotas con cambios integrados y la rama temporal de
validación de [PR44](https://github.com/MatiasEzequielPereyra/CuevApp/pull/44).
Ese PR se cerró porque el menú y la prueba de Alertas ya están en `main` por PR45.
Se limpiaron ocho ramas locales integradas o equivalentes sin worktree activo.
Quedaron tres ramas remotas documentales con contenido propio:

- `codex/cueva-dashboard-002` conserva un encargo antiguo de navegación por rol.
- `docs/cueva-004-requirements` conserva borradores y cambios al contexto maestro. La especificación vigente está en [Finanzas, comprobantes y notificaciones](../product/CUEVA-FINANZAS-COMPROBANTES-NOTIFICACIONES-V1.md).
- `docs/cueva-work-plans` conserva planes de coordinación de Mati y Facu con una base anterior a las entregas actuales.

SKILLS_SELECTED / SKILLS_APPLIED: `cueva-acceptance-audit`, `cueva-release` y `pr`.
SKILL_SOURCES: [auditoría](../../.agents/skills/cueva-acceptance-audit/SKILL.md),
[release](../../.agents/skills/cueva-release/SKILL.md) y skill `pr` de host.
Los estados REVIEW inferiores corresponden a entregas históricas.

## CUEVA-006C — aceptación independiente y preparación alojada

Candidato de runtime `38e450d439c2545474b02a0e643065cdb1c319cd`: **ACCEPTED**.
[PR34 y registro verificable de integración/despliegue](https://github.com/MatiasEzequielPereyra/CuevApp/pull/34).
P2-001 cerrado: separación de YouTube/Storage, regresión independiente 4/4 PASS
con Node22/Chromium y API sintética. Modelo independiente5/5, fuentes4/4, escaneo
385 archivos y nueve hashes/capturas verificados. CI push/PR SUCCESS del candidato;
el commit documental posterior requiere su CI antes de integrar.

Respaldo privado expresamente autorizado: tabla cueva_private.cueva_006c_release_backup,
RLS sin grants a roles API; copia comprobada contra 1 borrador, 1 plantilla,
2 publicaciones y 7 ejercicios. No es un backup externo de desastre.
Migraciones de días y videos aplicadas desde los bytes revisados al proyecto
vbkzoojkdkcugxhneyzi. Datos originales comparados con el respaldo: sin cambios.
Bucket privado, 50MiB, MP4/MOV/WebM; plan free conservado, sin contratar servicios.

Smoke alojado transaccional **PASS_ROLLED_BACK**: template/draft/publicación/reintento
admin, consulta de publicación/recurso propios del alumno, borradores/plantillas
ocultos, writer alumno y recurso anónimo denegados. Claims existentes usados solo
dentro de SQL; no acredita recorrido HTTP autenticado ni subida de video real.
No quedaron fixtures. Recuperación conservadora: preservar datos/esquema y corregir
hacia delante; no regresar a un runtime sin lectura v2 después de guardar v2.
Advisors conservan avisos previos; el respaldo agrega un INFO esperado de RLS sin
policy, deliberadamente sin acceso de aplicación.

Integración/alias/SHA y smoke HTTP posteriores se registran en PR34: consultarlo
para el estado actual, sin inferir producción de Preview READY.
No se modifica la rama de Facu, pagos, Auth, SMTP o cuentas.
SKILLS_SELECTED/APPLIED: cueva-acceptance-audit, cueva-supabase-security, cueva-release;
fuentes: sus SKILL.md en .agents/skills. Los estados REVIEW inferiores son históricos.

## CUEVA-006C — REVIEW local, 2026-11-06

Base remota verificada `7663e51f7b60c269a9bb7f13f0f69d26358b609d`;
rama `codex/cueva-006c-rutinas`, checkout preparado reutilizado.
[Encargo y ampliación aprobada](CUEVA-006C-task.md): catálogo de plantillas,
días libres, bloques con vueltas compartidas, selección múltiple, peso/repeticiones
o tiempo. Usuario agregó carga de video desde galería: hasta 50 MB, solo admin.
[Modelo y conservación de legado](../architecture/routine-days.md).
Laboratorio real PostgreSQL/Auth/PostgREST/Storage: 121/121 PASS; nueve capturas,
teclado, ambos temas y axe. Modelo 5/5, controles generales y CI en el
[informe de entrega](CUEVA-006C-review.md). Commit/PR identificados en el handoff.
Sin cambios de pagos, vencimientos, Auth o rama de Facu. Sin merge, migraciones
alojadas, archivos reales ni producción. Revisión independiente y operación
alojada pendientes; estos resultados locales no acreditan aceptación o despliegue.

## CUEVA-006B — REVIEW local, 2026-11-06

Cambio expreso: constructor de ejercicios principal; nota como complemento.
[Encargo](CUEVA-006B-task.md) y [modelo](../architecture/structured-routines.md).
Continuación fuente `fd315ca0bd6a9db3131449b2cd58ae6eb43b8759` de 006A,
que permanece REVIEW. Origin/main avanzó solo con skills a
`2ca0d519bbf188bcf09b1982ec08f632b8b44b9b`; se reaplicó 006A sobre esa base
en esta rama, commit equivalente `8060032`. No se modificó la rama original ni
el checkout del Orchestrator. Rama `codex/cueva-006b-rutinas-estructuradas`.
El diff acumulado de auditoría será desde ese main, incluyendo 006A aún sin aceptar.
Catálogo y estructura versionada implementados. Prueba nueva 92/92 PASS;
lint/tipos/build/documentos/fuentes/seguridad/diff PASS. Nueve capturas nuevas,
teclado, axe y conservación de contenido previo. Ocho moderadas dev preexistentes,
sin altas/críticas ni cambios de dependencias. [Informe](CUEVA-006B-review.md).
Sin operaciones alojadas. Migraciones, revisión e integración pendientes del
Orchestrator; 006A no se declara aceptado. Commit final identificado en handoff.

## CUEVA-006A — REVIEW local, 2026-11-06

Base efectiva `fb801dd557a8cb45b25d12cffc0170bd7e1ff79c`, igual a origin/main
verificado. Rama `codex/cueva-006a-rutinas`; checkout del ejecutor reutilizado
limpio, sin alterar el checkout del Orchestrator. [Encargo](CUEVA-006A-task.md)
y [modelo](../architecture/routines.md). Rutinas de texto libre, borradores CAS,
publicación explícita, plantillas independientes y consulta del alumno.
Laboratorio nuevo 104/104 PASS; lint/tipos/build/documentos/fuentes/seguridad/diff
PASS. Ocho capturas, teclado, axe y temas; eliminación protegida. Ocho moderadas
preexistentes en dependencias dev, sin altas/críticas ni cambios de lockfile.
[Informe y reproducción](CUEVA-006A-review.md). Árbol limpio al entregar mediante
commit identificado en handoff. Revisión independiente, integración y migración
alojada pendientes del Orchestrator. Sin operaciones alojadas, push, PR, merge ni deploy.

## Cierre alojado vigente — invitación y primer acceso, 2026-11-06

**CUEVA-INVITACION-RECHAZO-SMTP-002 ACCEPTED y operativo.** PR29 MERGED,
commit de implementación `963b402830391dbc9fa4f6728280272a76de5dba`.
Producción `dpl_Ci6kCajPzJFKRV73rCETbqG4yEEF` READY con ese SHA y alias
`cueva-gym.vercel.app`. Ver [cierre verificable](CUEVA-INVITACION-RECHAZO-SMTP-002-closeout.md)
y [registro de integración](https://github.com/MatiasEzequielPereyra/CuevApp/pull/29).

Brevo autenticó con TLS sin correo; check eligible y un único apply accepted.
Un correo enviado/entregado según Brevo, sin rebotes. El usuario confirmó ingreso
y contraseña propia; lectura alojada confirmó perfil alumno, correo confirmado,
ready=true, sesión posterior al corte y ausencia de operación pendiente.
Se conservaron ficha/UUID/perfil, historial anterior y administrador existente.

Production: CUEVA_PRODUCT_AUTH_ENABLED=1, CUEVA_EMAIL_TEMPLATE_READY=1 y
CUEVA_DEFAULT_MAIL_OWNER_TEST=0. Brevo está guardado como SMTP; finalizó el modo de correo
solo propietario. Las altas siguen reservadas a administración. No se habilitaron
Preview/Development ni se almacenaron claves en Git.

Las secciones REVIEW/NOT_VERIFIED inferiores describen entregas locales e historia.
No repetir los laboratorios de identidad, transporte o SMTP sin un fallo/cambio
nuevo. Continuar con los módulos pendientes del backlog; este cierre no declara
terminado el MVP ni verifica nuevos flujos de pagos/rutinas.

## CUEVA-INVITACION-RECHAZO-SMTP-002 — REVIEW local, 2026-11-05

Base main verificada `31fcd33c100422ec9a1657ff34bd246f03908920`, rama
`codex/cueva-invitacion-rechazo-smtp-002`; checkout del ejecutor limpio al comenzar.
[Encargo íntegro](CUEVA-INVITACION-RECHAZO-SMTP-002-task.md) y
[operación acotada](CUEVA-INVITACION-RECHAZO-SMTP-002-operations.md).
Según el handoff del Orchestrator, transporte/credenciales y check reales pasaron;
un único apply terminó retenido por SMTP534. Esa observación no se repitió aquí.
Brevo configurado por el humano; autenticación/primer envío alojados no verificados.
Se implementa autorización nueva solo para gen2/uncertain/pending con evidencia
de rechazo y reparación, historial append-only y sustitución transaccional.
Sin conexión autenticada remota, envío real, migración alojada ni cambios de flags.
Matriz nueva51/51 PASS; lint/tipos/documentos/fuentes/seguridad/diff PASS, paquete
SMTP aislado con audit sin vulnerabilidades. Build no requerido. Ver
[informe y evidencia](CUEVA-INVITACION-RECHAZO-SMTP-002-review.md). No se repitieron
66/66 ni48/13; integración y única operación alojada a cargo del Orchestrator.

## CUEVA-INVITACION-RECUPERACION-TRANSPORTE-001 — REVIEW, 2026-11-05

Base efectiva main verificada `126e933de770f02b7060b095b8a77d0685f53c69`, que
incluye PR26 `67d44e2d954bd09af0ea821b718a8151cd9af28a` y el candidato auditado
`db0835bce40ad9604c0e1c45db0109c4b7846e9c`. Rama
`codex/cueva-invitacion-transporte-001`; se reutiliza solo el checkout del ejecutor.
[Encargo](CUEVA-INVITACION-RECUPERACION-TRANSPORTE-001-task.md): alternativa
Session pooler exacta, pg.Client y TLS verificado, sin cambios del flujo previo.
No conexión autenticada remota, envío ni migración. Operación alojada a cargo del
Orchestrator; TCP observado por él no certifica TLS, credenciales o envío.
Pruebas acotadas48/48 y laboratorio de sesión13/13 PASS; lint/tipos/documentos/
fuentes/seguridad/diff PASS. Build no requerido; app/config/dependencias intactas.
Ver [entrega y límites](CUEVA-INVITACION-RECUPERACION-TRANSPORTE-001-review.md).

## CUEVA-ALUMNOS-ELIMINAR — ACCEPTED LOCAL, 2026-11-04

Base main verificada `67d44e2d954bd09af0ea821b718a8151cd9af28a`, rama
`codex/cueva-alumnos-eliminar`. El usuario autorizó agregar eliminación segura y
mergear si queda revisada. Fichas sin historial/cuenta, confirmación explícita;
no borra Auth ni cuotas/pagos. [Encargo](CUEVA-ALUMNOS-ELIMINAR-task.md) y
[pruebas/operación](CUEVA-ALUMNOS-ELIMINAR-review.md). Laboratorio 49/49 PASS;
verificaciones completas PASS y [revisión independiente sin bloqueos](CUEVA-ALUMNOS-ELIMINAR-audit.md). Integración en curso.
Migración alojada y estado de publicación se registran aparte.

## CUEVA-INVITACION-RECUPERACION-001 — REVIEW local, 2026-11-04

Base verificada `a0dabf081a82867eb93d9f177f42e3c3cceb1a41`, igual a origin/main.
Rama `codex/cueva-invitacion-recuperacion-001`; checkout reutilizado limpio antes
de comenzar. PR25 MERGED y registro remoto consultado: código/migración publicados,
ensayo único rechazado 535, identidad preparada/review conservada; credencial SMTP
posteriormente reemplazada, todavía no probada. Las notas previas sobre migración
de invitaciones pendiente son históricas; prevalece [PR25](https://github.com/MatiasEzequielPereyra/CuevApp/pull/25).

Herramienta privada acotada, sin endpoint ni nuevo permiso API; ver
[encargo](CUEVA-INVITACION-RECUPERACION-001-task.md) y
[operación/rollback](CUEVA-INVITACION-RECUPERACION-001-operations.md).
Prueba nueva 66/66 PASS y lint/tipos/build/documentos/fuentes/seguridad PASS. Ver [entrega y evidencia](CUEVA-INVITACION-RECUPERACION-001-review.md). Migración/envío/primer acceso alojados
NOT_RUN/NOT_VERIFIED por este ejecutor. No se modifican SMTP, flags ni cuentas reales.

## CUEVA-ALUMNOS-001 — correcciones para nueva revisión, 2026-11-04

Se conserva estado **REVIEW**. Corregidas búsqueda literal, marco administrativo
compartido con Alumnos activo y fecha inicial en Buenos Aires. Laboratorio local
43/43 PASS, panel 10/10, build/tipos/lint/documentos/fuentes/seguridad PASS.
Ver [informe actualizado](CUEVA-ALUMNOS-001-review.md). Migración alojada,
integración y publicación pendientes; sin cambios en Auth, SMTP ni cuentas reales.

Actualizado: 2026-11-04, America/Buenos_Aires. Continuidad y auditoría: ORCHESTRATOR CUEVA.

## CUEVA-ALUMNOS-001 — aceptación local y coordinación

Candidato corregido `27cf4e8aaf80c0027225349e0dd768d864512c42`: **ACCEPTED LOCAL**;
[auditoría](CUEVA-ALUMNOS-001-audit.md). Tres P2 resueltos, revisión independiente
final sin bloqueos y laboratorio acotado 43/43 PASS. Marco administrativo compartido.
El estado de CI, migración alojada y publicación se registra en el PR de la rama
`codex/cueva-alumnos-001`: verificar ese registro antes de afirmar estado remoto.
Fichas administrativas independientes de Auth; correo general sigue pendiente.

El panel UI-001 ya se integró en PR21/main
`fa87f778287434dbad016435b28b7d895a05f90e`; las referencias inferiores a su revisión
son historia. El usuario aprobó su apariencia. Ver el [roadmap paralelo](parallel-roadmap.md)
y el [encargo de acceso](CUEVA-ACCESO-001-task.md), que no autorizan interferir con
otro checkout ni dar implementaciones por terminadas.

## CUEVA-UI-001 — revisión independiente

Candidato `635140403cf826f268f040325dde6350a4c7e264`: **ACCEPTED LOCAL**;
[auditoría](CUEVA-UI-001-audit.md), Standards/Spec sin bloqueos y suite específica
10/10 PASS. Integración y publicación pendientes de CI; consultar el PR de la rama
`codex/cueva-ui-001` para el resultado remoto. El panel presenta funciones pendientes,
sin datos ficticios; no amplía permisos, correo ni disponibilidad de alumnos.
La entrega REVIEW al final de este documento se conserva como antecedente.

## Cierre vigente — primer administrador operativo

**Nico incorporado y promovido a admin.** El usuario confirmó contraseña propia y
pantalla Tu cuenta/Perfil alumno. Se verificaron cuenta exacta, correo confirmado,
gate activo, generación1, sesión posterior al corte y ausencia de operación, con
una única cuenta/perfil/estado. Promoción transaccional de una sola fila; lectura
posterior confirmó role=admin, ready=true, admin_count=1. No se leyó su contraseña.

L integrado en [PR19](https://github.com/MatiasEzequielPereyra/CuevApp/pull/19),
main `0892ebea0b09bca308fdf5ecd2709d91904ef0f1`, árbol igual al revisado.
CI19 SUCCESS. Production `dpl_GajeQvGVJSPtVV4unxFE6FdRjxfy` READY con ese SHA.
Bootstrap privado APPLIED, invitación preparada y correo recibido según la
incorporación confirmada por el usuario. buildCommand:null restaurado por API.

Correo integrado de Supabase activado por elección expresa del usuario; templates
estándar confirmados en el panel. PRODUCT_AUTH_ENABLED1, DEFAULT_MAIL_OWNER_TEST1,
EMAIL_TEMPLATE_READY0 y correo esperado servidor: **modo temporal solo propietario**.
Altas/reset de alumnos bloqueados. Gmail sigue pendiente de verificación Google;
no reintentar ni crear cuentas de prueba adicionales. No hace falta pedir de nuevo
permiso para la cuenta o promoción ya realizadas. Contexto previo debajo es histórico.

Se cierra esta etapa sin otra implementación ni pruebas manuales repetidas, según
la indicación del usuario. Acceso general de alumnos, pagos, rutinas y aceptación
completa del MVP siguen pendientes; no declarar MVP terminado.

## L — compatibilidad default aceptada localmente

Ejecutor `a18cd60bb9f23264f5a5e8d94606665230ba6e3c`, **ACCEPTED LOCAL**;
[auditoría](CUEVA-002L-audit.md). Repetición independiente L22 PASS/1 NOT_RUN:
enlace estándar, owner/OTP/nonce/sesión y contraseña propia, cookies solo post-bind.
Modo temporal explícito y altas/reset de alumnos bloqueados. Sin nueva migración
ni cambios de script K, dependencias o permisos. SMTP real aún no cambiado,
cuentas 0 y flags apagadas; aplicación separada tras CI/merge según plan auditado.

PR18 documental integrado en main `8bab2cb2f245da4919d9dc54d8b43e661c51b2ab`,
production `dpl_8Uj4fqcesbqT4LtUjxk87NzHZYSN` READY y ruta de invitación404.
La autorización del usuario para el primer alta y el correo temporal permanece.

## Decisión vigente: correo integrado solo para primera prueba

Google bloqueó la verificación de identidad para generar la clave de aplicación,
incluso tras informar el usuario activación de 2FA. El usuario eligió temporalmente
correo de Supabase para el alta inicial autorizada. Team confirma el correo de
Nico como Owner, destinatario permitido del remitente de prueba (2 correos/hora).

El panel advirtió que volver al SMTP integrado restaura las plantillas estándar.
Se canceló esa confirmación y se conservó SMTP personalizado: **aún no cambiado**.
Siguiente implementación acotada [CUEVA-002L](CUEVA-002L-task.md): callback estándar
solo para propietario, guardado por flag y misma incorporación segura. Sin alterar
migración ni marcar ready a mano. Acceso apagado, cero cuentas; no reenviar hasta
aceptar esta compatibilidad. Gmail para alumnos y operación general siguen pendientes.

## Primera prueba real autorizada

El usuario autorizó expresamente cuenta de Nico, invitación única, prueba controlada
y posterior promoción tras verificar incorporación. No volver a solicitar esa misma
autorización. [Registro operativo](CUEVA-first-access.md): check privado de Vercel
PASS con inventario vacío; Secret válida para SDK sin leerla. Main actual
`1a6aff046996527fadc835be3bbb3a7e7dfc9bd0`, PR17 integrado y CI PASS.

Primer envío falló por rechazo de autenticación SMTP; inspección posterior confirmó
0 cuentas/perfiles/estados y se cerró acceso. El usuario corrigió/guardó SMTP.
Segundo apply `dpl_69bJbXDMQGBMfxNR2RCpEVEQPdNM` también falló: SMTP rechazó
autenticación; cero cuentas/perfiles/estados confirmado. Flags nuevamente en 0,
deployment cerrado H8PwWox promovido y ruta de invitación404 verificada.
Google confirmó inicialmente verificación en dos pasos desactivada. El usuario
informó después haberla activado; al abrir App passwords Google pidió verificar
identidad. Usuario completando verificación y generación de clave de aplicación
real para guardarla únicamente en SMTP. No se leyó ni pidió la clave.
No enviar otra vez hasta resolverlo ni volver a pedir autorización de primera cuenta.
La contraseña y primer acceso reales requieren intervención del usuario; no usar
contraseñas del historial. Los estados anteriores de abajo son historia.

## Integración J y candidato K

J integrado en [PR16](https://github.com/MatiasEzequielPereyra/CuevApp/pull/16),
main `10bc33ac324b47fbb1c6c12772342ad7490c4fce`, production READY con alias y
HTTP200 /ingresar deshabilitado; ver [handoff](CUEVA-002J-release.md).
K ejecutor `50d57839c5891b3567b22616fba81e937eba9b22` aceptado localmente;
repetición independiente 16 PASS/1 NOT_RUN. [Auditoría](CUEVA-002K-audit.md) y
[procedimiento privado](CUEVA-002K-bootstrap.md). Sin hook automático ni endpoint.
Su check alojado y cualquier invitación todavía NOT_RUN. Acceso público apagado.

## Preparación alojada aplicada — acceso todavía apagado

Migración I aplicada una sola vez, versión alojada `20261103133258`;
RLS/catálogo/permisos y denegación HTTP anónima verificados. Site URL, allowlist
y dos plantillas exactas guardadas y verificadas tras recargar. Cuentas Auth y
perfiles en cero; no se enviaron correos reales. Ver [registro](CUEVA-002-hosted-setup.md).
El único aviso de advisors es informativo por RLS sin policy de acceso directo
en el estado privado, intencionalmente cerrado.

La clave servidor de Vercel está guardada sin lectura/exportación y los dos
opt-ins siguen en 0. Su validez, Gmail y flujo autenticado alojados aún pendientes.
El dashboard no permite redirectTo en Invite; siguiente [CUEVA-002K](CUEVA-002K-task.md),
operación privada puntual con el secreto ya configurado, sin endpoint público.
Alta de Nico y prueba controlada no ejecutadas ni autorizadas por esta preparación.

## CUEVA-002J — paquete operativo aceptado localmente

HEAD ejecutor `8caced7eba239135b6034e1903075afecb1024b7`: **ACCEPTED LOCAL**;
ver [auditoría](CUEVA-002J-audit.md) y [procedimiento](CUEVA-002J-operations.md).
Repetición independiente 25 PASS/1 NOT_RUN: plantillas renderizadas, bootstrap
sintético y reconciliación local. No cambia runtime ni la migración I.
Correo real, primer admin real y aceptación alojada pendientes. El siguiente
paso operativo es aplicar/configurar lo revisado con acceso apagado y luego
acordar una primera prueba controlada; no otro cambio de proveedor de identidad.
PR/CI y configuración remota se registran por separado tras su ejecución.

## CUEVA-002I — aceptación local y correo configurado

HEAD ejecutor `da1de8b63e0e94d62014c5047b214912a90321b9`: **ACCEPTED LOCAL
para integrar apagado**; ver [auditoría](CUEVA-002I-audit.md). Repetición independiente:
lint/tipos/build, documentos 2, navegador 25 y laboratorio PASS. Alta administrativa,
contraseña propia, perfiles y recuperación coordinada se probaron localmente;
esto no acredita Auth/RLS alojados. Migración versionada, todavía NO APLICADA.

El usuario guardó SMTP de Gmail; el panel volvió a confirmar habilitado y sin
cambios pendientes el 2026-11-03. No se leyó ni guardó la contraseña. Entrega
real, plantillas y alta de Nico pendientes. No hay cuentas reales creadas.
Vercel tiene URL, clave publicable y origen del candidato, solo Production;
ambas banderas CUEVA_PRODUCT_AUTH_ENABLED y CUEVA_EMAIL_TEMPLATE_READY están en 0.
El usuario cargó CUEVA_SERVICE_KEY directamente. Metadatos verificados:
tipo Secret (sensitive), solo Production; no se leyó su valor ni se probó aún.
Acceso de producto apagado.
Siguiente: [CUEVA-002J](CUEVA-002J-task.md), preparación operativa comprobable.
[PR #15](https://github.com/MatiasEzequielPereyra/CuevApp/pull/15) MERGED,
main `e264810408a3750cfb68a851d0810de5dd03cf94`, deployment
`dpl_6wfYf6Cba66DNHW9aQEawwiKa3Bo` READY y smoke HTTP PASS. Ver
[handoff](CUEVA-002I-release.md). Código, configuración, migración y pruebas
integrados coinciden con el árbol revisado. El squash duplicó un bloque histórico
del checkpoint por ascendencia documental divergente; se retira aquí ese duplicado.

## Supabase alojado — reconexión verificada

Actualización 2026-11-02: acceso MCP al proyecto `vbkzoojkdkcugxhneyzi`
verificado tras reconexión del usuario. Inventario: tablas public/private 0,
migraciones 0, usuarios Auth 0, buckets 0, asesor de seguridad sin lints.
El registro público se deshabilitó y se verificó tras recargar el panel;
confirmación de correo sigue activa. Es un ajuste de alta administrativa,
no evidencia de funcionamiento del acceso de CUEVA.

En aquella inspección el panel Emails indicaba SMTP sin configurar; el estado
posterior de SMTP guardado se registra arriba. Plantillas por defecto al inspeccionar.
Correo real, URLs del producto, migración y permisos de aplicación siguen pendientes.
No se crearon usuarios, tablas ni migraciones remotas. Próxima tarea candidata:
[CUEVA-002I](CUEVA-002I-task.md), aún sin aceptación ni aplicación alojada.

## Auditoría CUEVA-002H local

Actualización 2026-11-02: integración experimental en Next.js **ACCEPTED LOCAL**
sobre HEAD `f24b95f2230c19e53b5144b41f5d09443c8d25ba`; ver
[auditoría](CUEVA-002H-audit.md). Repetición independiente del flujo con dos
alumnos sintéticos PASS. El código solo opera en desarrollo opt-in loopback;
en producción el laboratorio devuelve 404. Ingreso público, recuperación y
configuración alojada siguen **BLOCKED/NOT_RUN**. No habilitar mediante una bandera.

Observación remota solo lectura 2026-11-02: dashboard saludable, email y confirmación
habilitados, pero altas públicas todavía permitidas. El conector MCP rechazó el
acceso por permisos; no se modificó el proyecto alojado. Estas observaciones no
acreditan Auth/RLS ni la configuración de entrega de correo.

## CUEVA-002H local — entrega para revisión

Integración de laboratorio en Next.js real, con dos alumnos sintéticos y
servicios locales, en **REVIEW**; ver [informe](../../experiments/cueva-002h-local/README.md)
y [evidencia](../../experiments/cueva-002h-local/evidence.json). La ruta de
laboratorio requiere desarrollo y configuración loopback explícita y permanece
deshabilitada en producción. El ingreso publicado no está activo. Reset
coordinado de producto, Supabase alojado, correo real, HTTPS y operación de
privilegios siguen **NOT_RUN**; no se acepta el SQL experimental para despliegue.

## Auditoría CUEVA-002G y siguiente incremento

Actualización 2026-11-02: prototipo local **ACCEPTED** sobre HEAD ejecutor
`07af375978236a566bb39eaecb514147439013ce`; ver [auditoría](CUEVA-002G-audit.md).
El Orchestrator repitió el flujo en Chromium con Auth/PostgREST reales locales.
No es integración en Next ni verificación del proyecto alojado. El acceso real
sigue **BLOCKED**. Siguiente: [CUEVA-002H](CUEVA-002H-task.md), integración local
en la aplicación, sin activar ingreso público hasta auditoría y pruebas reales.

## Prototipo local CUEVA-002G

El [prototipo de acceso](../../experiments/cueva-002g-local/README.md) ejercita
invitación, elección de contraseña y login con navegador y servicios locales.
Es una entrega para revisión, no integración con Next.js ni acceso operativo.
El bypass de operador directo y otras puertas permanecen abiertos: producción
y login de CUEVA **BLOCKED**; Supabase alojado y correo real **NOT_RUN**.

## Auditoría CUEVA-002F local

Investigación local aceptada en HEAD `de73e7cba9d9e4d0e536236cd0b1bea70e976795`;
ver [auditoría](CUEVA-002F-audit.md). Los casos coordinados observados pasaron,
pero el operador directo puede eludirlos. Acceso de producción **BLOCKED**;
privilegios, caídas reales, pooling, SSR y Supabase alojado siguen sin verificar.

## Investigación local CUEVA-002F

La [prueba de coordinación](../../experiments/cueva-002f-local/README.md) observó
resultados favorables en casos limitados de reset coordinado y concurrencia. Un
operador con credencial directa del proveedor puede evitar esa coordinación.
**REVIEW** de investigación; implementación, integración real y acceso **BLOCKED**.
No se ha probado SSR, restricciones del operador ni Supabase alojado.

## Auditoría CUEVA-002E local

Investigación local aceptada en HEAD `e4b8f3249d854abda8db3b3f52740ffe62d4deb8`;
ver [auditoría](CUEVA-002E-audit.md). Ambas alternativas de incorporación tienen
fallas reproducidas; implementación y acceso real **BLOCKED**. La aceptación es
solo del resultado de investigación, no del SQL ni del coordinador experimental.

## Investigación local CUEVA-002E

La [prueba de incorporación y RLS](../../experiments/cueva-002e-local/README.md)
comparó dos prototipos locales y encontró fallas en ambos. El trigger confunde
cambios administrativos con los del alumno; el coordinador sin operación atómica
puede activar acceso tras un reset concurrente. **BLOCKED** para implementar o
habilitar login. Supabase alojado, SSR, correo real y otras rutas siguen NOT_RUN.

## Auditoría CUEVA-002D local

Investigación local aceptada en HEAD `f2866a3bce03c83c40fefebd40887a3f74f0a204`;
ver [auditoría](CUEVA-002D-audit.md). La invitación local, contraseña e ingreso
pasaron; verificar la invitación emite una sesión antes de establecer contraseña.
Protección de primer ingreso y datos **BLOCKED**; Supabase alojado, RLS, SSR y
correo real **NOT_RUN**. No se habilitó ingreso real ni se crearon cuentas reales.

## Investigación local CUEVA-002D

La [prueba local de invitación](../../experiments/cueva-002d-local/README.md)
completó el flujo básico tras corregir el search_path de la base descartable.
La verificación de invitación emitió una sesión antes de elegir contraseña: el
control de incorporación en servidor y datos sigue **BLOCKED**. La pantalla sigue
deshabilitada; alta integral, SSR, RLS y correo alojado no se han validado.

## Primer acceso por invitación

Ante las alternativas de contraseña temporal o invitación, el usuario eligió la
opción más sencilla el 2026-10-29. Se selecciona invitación por correo: el
gimnasio inicia el alta y cada alumno establece su propia contraseña. Reemplaza
la entrega de contraseña temporal, no la necesidad de un primer acceso seguro.
La invitación y sus restricciones requieren implementación y pruebas reales;
el acceso publicado sigue deshabilitado. No se autorizan altas públicas.

## Auditoría de vista previa CUEVA-002C

Vista previa y evaluación documental **ACCEPTED** en HEAD ejecutor
`78c715e85495c56b2da5bfd8a0aab3a667f5be68`; ver [auditoría](CUEVA-002C-audit.md).
La autenticación real de CUEVA-002C continúa **BLOCKED**, sin cuentas, cliente
Supabase, roles ni RLS implementados. La vista no recibe ni envía credenciales.
El PR y handoff indican el resultado de integración y despliegue posteriores.

## CUEVA-002C — Entrega local para revisión

Vista previa estática del acceso por correo en `/ingresar`: campos y botón
deshabilitados, sin envío de credenciales. [Evaluación de identidad](../architecture/email-auth-assessment.md).
Auth real **BLOCKED**: alta cerrada, primer ingreso, recuperación, revocación y
RLS no se han verificado; no se han modificado usuarios ni infraestructura remota.
Esta entrega no demuestra el cierre de esos controles ni autoriza habilitar login.

## Decisión posterior de producto: acceso por correo

El 2026-10-29 el usuario confirmó que el correo será obligatorio para todos los
alumnos y que se elimina el DNI como forma de acceso. Esta decisión prevalece
sobre los requisitos anteriores de ingreso por DNI o sin correo, conservados
como historia. No determina si se guarda DNI como dato administrativo.
El alta permanece exclusivamente administrativa. Se mantiene la exigencia de
primer acceso seguro y cambio de contraseña, pendiente de diseño y prueba.
Se prioriza evaluar Supabase Auth nativo; no se adopta Keycloak ni se afirma que
el bloqueo E3 del laboratorio anterior esté resuelto. Ver
[CUEVA-002C](CUEVA-002C-task.md). Auth, roles, RLS y correo real siguen pendientes.

## Auditoría CUEVA-002B-LOCAL

Investigación local **ACCEPTED** sobre HEAD del ejecutor
`01072f5d3283cbf961fe6045ee86d71e78085b74`; ver [auditoría](CUEVA-002B-LOCAL-audit.md).
E3 permanece **BLOCKED**, D007 **PROPOSED**; deduplicación, Supabase alojado,
linking, RLS y revocación cruzada **NOT_RUN**. La aceptación no adopta un proveedor.
La integración y despliegue posteriores se verifican por el PR y su handoff.

- CUEVA-001A: **DEPLOYED**, fundación aceptada e integrada; smoke remoto verificado.
- MVP: **IN_PROGRESS**. La fundación no implementa todavía funciones del gimnasio.
- Despliegue: **READY**, https://cueva-gym.vercel.app, conectado a main de GitHub.
- Supabase: acceso al dashboard y API pública verificados; configuración pública preparada en Vercel. Cliente, Auth de la aplicación, tablas y RLS: NOT_IMPLEMENTED.
- Supabase para el mecanismo de identidad de CUEVA-002A: **NOT_VERIFIED** por el
  ejecutor; no se repitieron accesos. El antecedente de dashboard/API pública
  del Orchestrator se preserva y no acredita Auth/RLS ni esta propuesta.
- Encargo actual: [CUEVA-002A](CUEVA-002A-task.md), **ACCEPTED** como investigación documental, sin aprobar D007; investigación y
  diseño de identidad DNI/email; no autoriza implementar autenticación.

## Auditoría CUEVA-002A

HEAD entregado b7b98e3cf79089c6fcbc1edf69e4811f6194f027 auditado independientemente.
Ver [dictamen](CUEVA-002A-audit.md): documentos aceptados; D007 sigue PROPOSED.
Integración remota pendiente de CI en el momento de registrar esta decisión;
el PR y handoff final identifican su resultado sin SHA autorreferencial.
Siguiente: [CUEVA-002B-LOCAL](CUEVA-002B-LOCAL-task.md), laboratorio local acotado,
sin Supabase alojado ni adopción de proveedor. El relato de entrega que sigue
es histórico del ejecutor y no sustituye esta aceptación posterior.

## Identidad e integración

Precheck CUEVA-002A: carpeta física y `.git` locales, árbol limpio y main local
idéntico a origin/main después de `git fetch origin main`.
BASE_SHA inicial de ejecución: `535ff7fade52aa1380f1769dbbd76afcb7b798fa`.
El delta desde la fundación `064cbfaadc3c68145adb2411989584bbc32782c5` modifica
solo README, decisiones, tarea 002A, backlog, checkpoint y auditoría; ningún cambio
en runtime, dependencias, configuración o pruebas. Rama de ejecución:
`codex/cueva-002a-identity-design`, creada desde origin/main verificado.
El 2026-10-29 origin/main avanzó a `2423b14a4835b08ec8d3e487b03d606ef36f1f5e`
durante el trabajo. El nuevo delta solo cambió README, backlog, checkpoint y el
registro first-deployment. Se comunicó la divergencia y se rebasó la propuesta
preservando esos antecedentes. **BASE_SHA final: `2423b14a4835b08ec8d3e487b03d606ef36f1f5e`.**
No se repitió despliegue ni acceso Supabase. El diseño y
sus fuentes están en [viabilidad de identidad](../architecture/identity-feasibility.md)
y el [registro de verificación](CUEVA-002A-verification.md). D007 sigue PROPOSED;
no se adoptó ni implementó un IdP.

CUEVA-002A entrega diseño, fuentes, diagramas y matriz de 24 pruebas futuras.
Verificación documental sobre `87ac5a1eedb38f2cca452e723b8bee7523f9d538`: tests
documentales 2/2, fuentes 4/4, escaneo sin hallazgos y diff check PASS. El commit
final solo registra evidencia/REVIEW, no aceptación. La viabilidad operativa no es
PASS: E1–E6 sin prueba integrada; E3 bloqueado por falta de corroboración confiable
del cambio temporal. Falta decisión de IdP/operador/costo y entrega/recuperación.
CUEVA-002B es una propuesta condicionada de prueba aislada, no implementación
general ni tarea autorizada. Esta rama no se publicó; PR NOT_CREATED_LOCAL_ONLY,
integración y despliegue de CUEVA-002A NOT_RUN. El despliegue previo permanece
registrado abajo y no se revalidó como parte de esta entrega.

- Repositorio: https://github.com/MatiasEzequielPereyra/CuevApp
- Ruta física verificada: `C:\Users\pereyram\Desktop\CuevApp`, sin enlace observado.
- BASE_SHA inicial: NOT_APPLICABLE_EMPTY_REMOTE.
- BOOTSTRAP_SHA: `fe9db1792fbbf41d9ccdb071676781b64b203ed2`.
- IMPLEMENTATION_SHA: `4df756fe8f25ddd21b0bab5c421e1512d77ccfb0`.
- HEAD de entrega: `18290f472398d72ec09a32a29861833e567f6dc0`.
- HEAD del PR con auditoría: `b09817e59103bdde873a5715ccd0bcdac2a32554`.
- [PR #1](https://github.com/MatiasEzequielPereyra/CuevApp/pull/1): MERGED mediante squash.
- MAIN_SHA_AFTER_FOUNDATION_MERGE: `064cbfaadc3c68145adb2411989584bbc32782c5`.
- Fecha de merge: 2026-10-28T13:10:38Z. Se comprobó estado MERGED, referencia remota
  y ausencia de diferencias entre el árbol del PR revisado y el merge.

Este checkpoint se versiona después de ese merge. El SHA anterior identifica la
integración de la fundación, no el commit de este documento ni un main perpetuo.
Cada tarea debe obtener y verificar el HEAD actual antes de continuar.

## Evidencia y decisiones

La [auditoría independiente](independent-audit.md) registra Standards sin hallazgos
accionables y Spec sin incumplimientos bloqueantes. La revisión principal completó
Spec; su subagente terminó por límite de uso y no se cuenta como revisión completa.

Verificación independiente sobre el HEAD entregado: instalación desde lockfile,
lint, typecheck, build, 2 pruebas documentales y 16 de navegador PASS; fuentes 4/4,
manifest de evidencia 35/35 y cero vulnerabilidades reportadas por npm.

CI sobre el HEAD del PR: ambas corridas SUCCESS:
[push](https://github.com/MatiasEzequielPereyra/CuevApp/actions/runs/40693656499) y
[pull request](https://github.com/MatiasEzequielPereyra/CuevApp/actions/runs/40693722190).
No hay cambios de código, dependencias o pruebas entre el SHA de implementación,
el HEAD entregado y el árbol integrado.

D001–D005 aceptadas para esta fundación; D006 aceptada con deuda de mantenimiento
por ESLint 9 fuera de soporte. Ver [decisiones](../architecture/decisions.md).
El SVG fue aceptado como reconstrucción fiel para la fundación; no es el maestro
vectorial original. Móviles físicos, Safari/Firefox y lector de pantalla manual:
NOT_RUN. Esta aceptación no certifica Auth, RLS, pagos ni PWA offline.

El [informe del ejecutor](review-report.md) y la [galería](../../evidence/index.html)
conservan el estado REVIEW histórico. Este checkpoint y la auditoría registran la
aceptación posterior; no se reescribe evidencia histórica.

## Despliegue verificado

El usuario aclaró que es un proyecto personal no comercial y autorizó publicarlo
con el plan Hobby existente. No se contrató ningún plan ni dominio pago.
Ver [registro del primer despliegue](first-deployment.md).

- DEPLOYMENT_URL: https://cueva-gym.vercel.app
- DEPLOYMENT_STATUS: READY; producción técnica de Vercel, aplicación en desarrollo.
- DEPLOYMENT_ID: dpl_A3dSnkuytkg85zaY9cirHyezUJFn
- PRODUCTION_SHA_VERIFIED: 535ff7fade52aa1380f1769dbbd76afcb7b798fa
- POST_DEPLOY_SMOKE_TESTS: PASS, HTTP 200 página/logo y tema en navegador.
- ROLLBACK_READINESS: deployment inicial identificado como candidato de retorno;
  procedimiento de rollback todavía NOT_RUN. No hay migraciones que revertir.

GitHub está enlazado con producción en main. Los próximos merges aprobados disparan
build/despliegue automáticamente; el Orchestrator debe verificar SHA, READY y smoke.
No confundir creación de preview con publicación de producción: el primer deployment
fue confirmado por la API con target production.

## Procedencia y continuidad

Las fuentes originales y el logo se conservan íntegros; ver
[manifest de fuentes](source-manifest.json). Mantener su precedencia según README.
El usuario autorizó posteriormente verificar las conexiones y abrió sesión en el
navegador compatible. Supabase sigue denegando ambos conectores MCP, pero el dashboard
correcto fue observado Healthy y Auth settings respondió HTTP 200 con la clave pública.
No se volvió a controlar Mozilla. No hubo SQL, cuentas ni cambios de permisos.

`node_modules/`, `.next/`, `next-env.d.ts`, `test-results/` y `evidence/runs/` son
salidas locales ignoradas. Los logs seleccionados están en `evidence/`.
El siguiente paso es CUEVA-002A; el hosting ya está operativo.
No marcar el MVP completo ni el despliegue aprobado por haber integrado código.

## CUEVA-002B-LOCAL: investigación local

El laboratorio desechable y su evidencia están en
[experiments/cueva-002b-local](../../experiments/cueva-002b-local/README.md).
Estado del ejecutor: REVIEW; revisión independiente e integración: pendientes.
El flujo de cambio obligatorio fue observado localmente, pero E3 permanece BLOCKED
por falta de correlación confiable entre reset, evento de cambio y sesión. Un refresh
anterior sobrevivió al reset en el ensayo. D007 sigue PROPOSED. Supabase alojado,
RLS, linking y revocación cruzada: NOT_RUN. Sin despliegue por esta tarea.

La ampliación posterior completa un cambio real después de un reset administrativo
y observa la sesión resultante; ver la evidencia del laboratorio. Coinciden `code_id`
en los eventos de cambio/login y `sid` entre login/token en esa ejecución, sin
quedar establecido un vínculo confiable con la generación del reset. E3 sigue BLOCKED.

## CUEVA-UI-001 — entrega del ejecutor

Panel administrador visual sobre la cuenta existente: **REVIEW**, pendiente de
revisión independiente, integración y publicación. Ver [informe y capturas](CUEVA-UI-001-review.md).
Datos del panel y operaciones de alumnos/pagos/comprobantes siguen pendientes;
las capturas usan un usuario ficticio y no verifican una sesión real alojada.
Sin cambios en autenticación, permisos, base de datos o correo por esta tarea.

## CUEVA-ALUMNOS-001

Implementación local de fichas administrativas independiente de Auth. Migración
alojada y publicación pendientes del Orchestrator. Ver [modelo e instrucciones](../architecture/students.md)
y [encargo](CUEVA-ALUMNOS-001-task.md). No se habilitan invitaciones ni pagos.

Entrega del ejecutor CUEVA-ALUMNOS-001: **REVIEW**; ver
[informe y evidencias](CUEVA-ALUMNOS-001-review.md). Migración probada solo localmente,
RLS real y flujo de fichas verificados. Aplicación alojada, revisión independiente
y publicación pendientes. No se modificaron cuentas reales ni correo.

## CUEVA-003A — cuotas y pagos administrativos

Entrega local **REVIEW**, pendiente de auditoría, migración alojada e integración.
Precio versionado, períodos y movimientos exactos con anulación trazable;
[modelo](../architecture/payments.md) e [informe](CUEVA-003A-review.md).
No habilita consultas de alumnos ni correo. Aplicación alojada y publicación NOT_RUN.

## Invitación desde ficha — entrega local REVIEW

Invitación marcada por defecto al guardar una ficha, con registro persistente y
reintentos seguros; ver [modelo](../architecture/student-invitations.md). El correo
general permanece sujeto al control operativo vigente; no se alteran cuentas reales.

Entrega de invitaciones: **REVIEW**, prueba local real y verificaciones completas PASS. [Informe y evidencias](CUEVA-ALUMNOS-INVITACION-review.md). Correo general alojado y migración siguen pendientes del Orchestrator; no confundir estado de proveedor aceptado con entrega real.
