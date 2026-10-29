# CUEVA-002A — Registro documental

Fecha de preparación: 2026-10-28/29, America/Buenos_Aires.
Estado: **REVIEW**. BASE_SHA real actualizado:
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

Ejecutadas el 2026-10-29 sobre el commit documental limpio
`87ac5a1eedb38f2cca452e723b8bee7523f9d538`, posterior al rebase.
Windows, Node 22.14.0, npm 10.9.2. El [registro JSON](evidence/cueva-002a/checks.json)
conserva comando, hora de inicio/fin, exit code y salida completa.

| Comando | Resultado |
| --- | --- |
| `npm run test:docs` | PASS, 2/2; integridad de fuentes y enlaces locales mantenidos. |
| `npm run verify:sources` | PASS, 4/4 fuentes con SHA-256 y longitud íntegros. |
| `npm run verify:security` | PASS, 79 archivos en ese commit, cero coincidencias. |
| `git diff --check BASE_SHA HEAD` | PASS, sin salida; sin errores de whitespace en el delta. |

Para reproducir las comprobaciones sobre el HEAD de entrega:

```sh
npm run test:docs
npm run verify:sources
npm run verify:security
git diff --check
```

Además se revisó el diff completo y se compararon contra BASE_SHA runtime,
dependencias, configuración, pruebas, README/AGENTS, originales, auditoría previa,
registro del despliegue y toda la evidencia histórica: sin diferencias. Los
únicos cambios de esta tarea están en docs, incluido el registro de sus checks.
No se afirma autenticación segura ni factibilidad operativa PASS. Supabase para
este mecanismo: NOT_VERIFIED; acceso al proyecto por este ejecutor: NOT_RUN. El
antecedente de dashboard/API pública del Orchestrator se conserva sin reinterpretar.

El commit final añade el JSON de verificación y registra REVIEW en checkpoint,
backlog y este informe. El diseño y las fuentes de arquitectura permanecen iguales
al commit comprobado. Su SHA final se identifica en el handoff externo, evitando
un SHA autorreferencial dentro de este documento. No es un commit de aceptación.

Build, lint, typecheck y navegador: NOT_RUN en CUEVA-002A por alcance exclusivamente
documental. La [auditoría de fundación](independent-audit.md) registra su evidencia
anterior, que no certifica identidad ni se presenta como repetida hoy.

## Dictamen, riesgos y condiciones para continuar después de REVIEW

La investigación documenta una vía candidata con IdP maduro y OIDC con email
opcional. D007: PROPOSED. Falta acreditar E1–E6. E3 está técnicamente bloqueado:
acciones requeridas vacías y consulta de credenciales no acreditan cambio por el
alumno; falta demostrar la correlación confiable de operación, actor y sesión.
También se identificó que una verificación de email pendiente puede detener el
login DNI del candidato: cancelación segura y no obligatoriedad se prueban en E4.

La revisión de fuentes se apoyó en un agente de investigación pública y se
contrastaron los hallazgos con las guías/código fijados. No constituye auditoría
independiente del Orchestrator ni prueba del servicio integrado. Las consultas de
documentación fueron 2026-10-28/29; los hashes de tags se corroboraron públicamente.

Revisión de D007, decisión de IdP/operación/costos y entrega/recuperación sin email,
y entorno aislado autorizado. CUEVA-002B solo se propone con esos gates. E1–E6
siguen sin prueba integrada. No hay autorización de push, PR, merge, despliegue,
SQL, infraestructura ni configuración remota.
