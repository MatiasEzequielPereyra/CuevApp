---
name: cueva-feature-development
description: Usar para implementar una tarea acotada de frontend, backend, API o UX en CUEVAPP con rama aislada, pruebas y handoff verificable.
---

# Desarrollo de funcionalidades CUEVAPP

## Inicio obligatorio
1. Leer `AGENTS.md`, checkpoint y README; verificar el `main` actual y los PR existentes. No trabajar sobre la rama o checkout de otro ejecutor.
2. Seleccionar una sola tarea con TASK_ID, BASE_SHA, alcance, exclusiones, criterios de aceptación y riesgos.
3. Crear una rama/worktree aislado desde el SHA verificado; no sobrescribir cambios ajenos. Leer la documentación Next.js instalada antes de tocar sus APIs.
4. Aplicar skills adicionales según el riesgo: `cueva-supabase-security` para auth/DB y `cueva-finance` para dinero; no seleccionar todas por rutina.

## Implementación
- Priorizar el menor diff útil. Respetar la UX de Nico: administración simple, móvil y escritorio, claro/oscuro, sin datos simulados como reales.
- Validar entradas y permisos en backend. Mantener la distinción entre borrador y publicación cuando haya rutinas; preservar contenido publicado y los datos de alumnos.
- No editar los archivos de procedencia del `docs/engineering/source-manifest.json` ni relajar `scripts/verify-sources.mjs`.
- No introducir nuevas dependencias, cron jobs, emails reales o cambios de infraestructura sin justificar y autorizar su alcance.
- No integrar ni desplegar desde el rol de ejecutor. La producción no es un entorno de pruebas.

## Verificación y entrega
- Según el diff, ejecutar `npm run lint`, `npm run typecheck`, `npm run build`, `npm test`, `npm run verify:sources`, `npm run verify:security` y pruebas negativas específicas.
- No declarar PASS si no se ejecutó un control; distinguir pruebas locales, CI y entorno alojado.
- Entregar TASK_ID, BASE_SHA, HEAD_SHA, rama, archivos, cambios, checks con resultados, riesgos, PR y worktree; no ocultar fallas ni modificar tests para forzar verde.
