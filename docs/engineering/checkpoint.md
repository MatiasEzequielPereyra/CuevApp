# Checkpoint CUEVA

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
