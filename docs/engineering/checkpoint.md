# Checkpoint CUEVA

Actualizado: 2026-10-29, America/Buenos_Aires. Continuidad CUEVA-002A: CODEX EXECUTOR;
la aceptación, integración y despliegue de CUEVA-001A pertenecen al ORCHESTRATOR.

- CUEVA-001A: **DEPLOYED**, fundación aceptada e integrada; smoke remoto verificado.
- MVP: **IN_PROGRESS**. La fundación no implementa todavía funciones del gimnasio.
- Despliegue: **READY**, https://cueva-gym.vercel.app, conectado a main de GitHub.
- Supabase: acceso al dashboard y API pública verificados; configuración pública preparada en Vercel. Cliente, Auth de la aplicación, tablas y RLS: NOT_IMPLEMENTED.
- Supabase para el mecanismo de identidad de CUEVA-002A: **NOT_VERIFIED** por el
  ejecutor; no se repitieron accesos. El antecedente de dashboard/API pública
  del Orchestrator se preserva y no acredita Auth/RLS ni esta propuesta.
- Encargo actual: [CUEVA-002A](CUEVA-002A-task.md), **IN_PROGRESS**, investigación y
  diseño de identidad DNI/email; no autoriza implementar autenticación.

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
