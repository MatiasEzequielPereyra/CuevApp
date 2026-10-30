# Checkpoint CUEVA

Actualizado: 2026-10-29, America/Buenos_Aires. Continuidad y auditoría: ORCHESTRATOR CUEVA.

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
