# Checkpoint CUEVA

Actualizado: 2026-10-28, America/Buenos_Aires. Responsable: ORCHESTRATOR CUEVA.

- CUEVA-001A: **MERGED**, con aceptación independiente documentada.
- MVP: **IN_PROGRESS**. La fundación no implementa todavía funciones del gimnasio.
- Despliegue: **BLOCKED**, infraestructura pendiente de configuración y validación.
- Supabase: **NOT_VERIFIED**. Sin nuevas tentativas de acceso ni escrituras.
- Siguiente encargo: [CUEVA-002A](CUEVA-002A-task.md), **READY**, investigación y
  diseño de identidad DNI/email; no autoriza implementar autenticación.

## Identidad e integración

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

## Despliegue pendiente

La inspección no encontró un proyecto Vercel vinculado a CuevApp. El equipo
accesible usa Hobby, limitado a uso personal no comercial según la fuente citada
en la auditoría. Se requiere resolver hosting apropiado para el gimnasio.
No se creó infraestructura, contrató plan ni introdujeron secretos.

- DEPLOYMENT_URL: NOT_AVAILABLE.
- DEPLOYMENT_STATUS: BLOCKED.
- PRODUCTION_SHA_VERIFIED: NOT_VERIFIED.
- POST_DEPLOY_SMOKE_TESTS: NOT_RUN.
- ROLLBACK_READINESS: NOT_VERIFIED; no hay despliegue previo verificado.

## Procedencia y continuidad

Las fuentes originales y el logo se conservan íntegros; ver
[manifest de fuentes](source-manifest.json). Mantener su precedencia según README.
La instrucción de no reintentar Supabase/Mozilla continúa vigente; investigación
con documentación pública no equivale a verificar ese proyecto remoto.

`node_modules/`, `.next/`, `next-env.d.ts`, `test-results/` y `evidence/runs/` son
salidas locales ignoradas. Los logs seleccionados están en `evidence/`.
Los siguientes pasos son el encargo CUEVA-002A y la resolución separada de hosting.
No marcar el MVP completo ni el despliegue aprobado por haber integrado código.
