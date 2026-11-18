# Auditoría de dependencias — excepción temporal de picomatch

TASK_ID: CUEVA-CI-PICOMATCH-001. Base: `d90be98ffd2f891df3bb8083b10726f985b261c1`.
Autorización del Product Owner en el chat, 2026-11-18: aceptar temporalmente el
riesgo de este aviso en las herramientas de desarrollo para desbloquear los PR.
La excepción no corrige la vulnerabilidad ni declara seguro el paquete.

## Alcance y vencimiento

Únicamente [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf),
en `picomatch` indirecto, versiones fijadas `2.3.2` y `4.0.7`. El registro npm
consultado el 2026-11-18 publica `4.0.7` como última versión y el aviso no
identifica una versión corregida. No se baja Next.js ni se altera el lockfile.

La aceptación vence el **2026-11-25 a las 23:59:59 UTC**. El reloj real de CI
determina la vigencia; no hay una variable de entorno para prolongarla.
Después del vencimiento, el mismo hallazgo vuelve a bloquear. Una auditoría
limpia sigue aprobando aunque la excepción haya vencido.

`npm run verify:dependencies` conserva el informe completo y distingue los
hallazgos temporalmente aceptados. Recorre todas las causas de cada hallazgo:
una dependencia afectada indirectamente sólo se acepta si todas sus causas
terminan en ese aviso y todos sus nodos están marcados `dev: true` en el
lockfile. No se acepta por nombre de paquete ni por el total de hallazgos.

Siguen bloqueando:

- El audit de producción con umbral `moderate`, sin excepciones.
- Cualquier otro aviso de severidad moderada o superior, incluso en picomatch.
- Severidad crítica, versiones distintas, paquetes productivos o directos de
  picomatch, causas ausentes/cíclicas y respuestas inválidas o fallidas del registro.

El gate conserva la auditoría crítica completa y las comprobaciones habituales
de aplicación, permisos, fuentes y secretos. No se habilitan merges con otros
checks fallidos.

## Exposición comprobada y límite

`npm explain picomatch` ubica las dos instalaciones en las herramientas
incluidas por `eslint-config-next`: `fast-glob`/`micromatch`, el parser de
TypeScript y el resolvedor de importaciones mediante `tinyglobby`.
`eslint.config.mjs` y los patrones de proyecto provienen del repositorio.
La inspección de `src` no encontró importaciones directas de esas librerías.
El audit de producción no registra vulnerabilidades en esta base.

Esto reduce el alcance observado a la revisión de archivos del repositorio;
no prueba que sea imposible explotar la herramienta. Código/configuración de
un PR no confiable y paquetes de terceros siguen siendo entradas no confiables.
No ejecutar auditorías o lint de un fork con secretos o privilegios de producción.

## Operación, comprobación y retiro

1. Ejecutar `npm ci`, `npm run test:dependencies`,
   `npm audit --omit=dev --audit-level=moderate` y `npm run verify:dependencies`.
2. Revisar el informe completo `evidence/runs/npm-audit.json`, salida ignorada
   por Git y adjunta al artefacto de CI. Una aceptación temporal debe quedar visible.
3. Integrar el PR de política únicamente después de revisión independiente y CI.
   Actualizar las ramas afectadas desde main sin sobrescribir trabajo ajeno;
   cada PR mantiene su revisión funcional y sus otros checks.
4. Antes del vencimiento, verificar publicación de un parche, actualizar las
   dependencias compatibles y lockfile en otro PR, y comprobar audit completo
   sin excepción. Retirar entonces la aceptación temporal.
5. Para detenerla inmediatamente, revertir el PR de política. Vuelve a regir
   el audit completo bloqueante anterior; los reportes históricos se conservan.
   No hay migraciones, cambios de Auth, datos o infraestructura que revertir.

## Evidencia de entrega

Los resultados y HEAD exactos se registran en el PR de esta tarea. Las pruebas
del evaluador incluyen la cadena real sintética y rechazos de producción,
avisos adicionales, vencimiento, versiones, severidad crítica y errores de datos.
La auditoría completa original sigue informando el hallazgo; sólo cambia la
decisión temporal autorizada de CI.

SKILLS_SELECTED / SKILLS_APPLIED: `cueva-feature-development`,
`cueva-acceptance-audit`, `cueva-release`, `code-review`, `pr`,
`vercel:deployments-cicd`.
SKILL_SOURCES: `.agents/skills/<nombre>/SKILL.md` y guías del host.
