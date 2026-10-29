# CUEVA-002A — Registro documental

Fecha de preparación: 2026-10-28/29, America/Buenos_Aires.
Estado: IN_PROGRESS. BASE_SHA real actualizado:
`2423b14a4835b08ec8d3e487b03d606ef36f1f5e`.
Rama: `codex/cueva-002a-identity-design`.

## Alcance y trazabilidad

La fundación aceptada es `064cbfaadc3c68145adb2411989584bbc32782c5`.
El delta hasta la base de ejecución es documental (seis archivos); se obtuvo
origin/main antes de editar: `535ff7fade52aa1380f1769dbbd76afcb7b798fa`.
Durante el trabajo el remoto avanzó a `2423b14a4835b08ec8d3e487b03d606ef36f1f5e`:
solo README, backlog, checkpoint y first-deployment. Se comunicó y rebasó el diseño,
resolviendo los dos conflictos documentales sin perder el despliegue ni el acceso
público anterior registrado por el Orchestrator. El borrador anterior fue
`2418ee008acb63e4531100cca16d60c8e1a9a0d3` (recuperable por hash/reflog local).
La ruta física y `.git` están dentro del directorio autorizado; no hay AGENTS
adicionales aplicables en docs. El árbol estaba limpio al crear la rama.

Los cambios de esta tarea son diseño, fuentes, D007 y continuidad. No se alteran
aplicación, dependencias, configuración, pruebas, originales ni evidencia histórica.

## Entregables

- [Propuesta y matriz T01–T24](../architecture/identity-feasibility.md).
- [Fuentes primarias y versiones inspeccionadas](../architecture/identity-research-sources.md).
- [D007 PROPOSED](../architecture/decisions.md).
- [Checkpoint](checkpoint.md) y [backlog](backlog.md).

## Comprobaciones requeridas

Pendientes de ejecutar sobre el commit documental:

```sh
npm run test:docs
npm run verify:sources
npm run verify:security
git diff --check
```

Además: diff completo contra BASE_SHA, igualdad de originales y evidencia
histórica, y ausencia de archivos fuera de docs. No se afirma autenticación segura
ni factibilidad operativa PASS. Supabase NOT_VERIFIED; acceso remoto NOT_RUN.

Build, lint, typecheck y navegador: NOT_RUN en CUEVA-002A por alcance exclusivamente
documental. La [auditoría de fundación](independent-audit.md) registra su evidencia
anterior, que no certifica identidad ni se presenta como repetida hoy.

## Condiciones para continuar después de REVIEW

Revisión de D007, decisión de IdP/operación/costos y entrega/recuperación sin email,
y entorno aislado autorizado. CUEVA-002B solo se propone con esos gates. E1–E6
siguen sin prueba integrada. No hay autorización de push, PR, merge, despliegue,
SQL, infraestructura ni configuración remota.
