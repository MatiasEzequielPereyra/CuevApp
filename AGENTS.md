# CUEVA

Antes de continuar una tarea, leer [checkpoint](docs/engineering/checkpoint.md)
y seguir el orden de lectura de [README](README.md). El checkpoint distingue
implementación local, revisión independiente, integración y despliegue.
Los requisitos funcionales y la precedencia de fuentes se encuentran allí.

## Skills del proyecto

Las instrucciones reutilizables están en `.agents/skills/<nombre>/SKILL.md`.
Antes de cada tarea, seleccionar **solo** las skills pertinentes, leerlas y
registrar `SKILLS_SELECTED`, `SKILLS_APPLIED` y `SKILL_SOURCES`.
Si una herramienta no descubre skills automáticamente, inspeccionar esa carpeta
explícitamente. La existencia de una skill no demuestra que haya sido aplicada.

- `cueva-architecture`: cambios estructurales y decisiones de arquitectura.
- `cueva-supabase-security`: autenticación, RLS, migraciones y datos privados.
- `cueva-finance`: cuotas, pagos, vencimientos, comprobantes y recordatorios.
- `cueva-feature-development`: implementación acotada y handoff del ejecutor.
- `cueva-acceptance-audit`: revisión independiente, CI y aceptación.
- `cueva-release`: integración, publicación y comprobación de releases.

Las skills complementan, pero **no reemplazan**, este archivo, el checkpoint,
las decisiones posteriores aceptadas ni las autorizaciones del usuario. No
confundir estados REVIEW históricos con versiones operativas: verificar GitHub,
Supabase y Vercel cuando correspondan. No editar fuentes de procedencia
protegidas por `docs/engineering/source-manifest.json`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
