# CUEVA-UX-MANROPE-MEMBERSHIP-004 — Tipografía y tarjeta de membresía

**Estado:** REVIEW (sin merge ni deploy de esta tarea)
**Repositorio:** `MatiasEzequielPereyra/CuevApp`
**Rama:** `feature/cueva-manrope-membership-card`
**BASE_SHA:** `7e58c981f67f37f4ce30693ca25cd641841f9c07` (incluye PR #78 fusionado)

## Decisiones del usuario (2026-11-19)

1. Adoptar **Manrope** como tipografía de la aplicación completa; conservar el SVG del logo de CUEVA sin alterarlo.
2. Hacer **toda la tarjeta Tu cuota** del Inicio del alumno clicable a `/mi-membresia`, con hover visible como la tarjeta Entrenamiento, no solo el texto «Ver mi membresía».
3. Evaluar la posibilidad de **interpretar texto libre de Nico como rutina por días/bloques editable**. Solo se realiza diseño/análisis: **no** implementar un parser automático hasta definir su contrato y controles.

## Implementación UX

- `src/app/layout.tsx`: `next/font/google` con `Manrope`, `subsets: ["latin"]`, `display: "swap"` y variable CSS `--font-cueva-manrope` en el documento; fuente autoalojada al compilar por Next.js.
- `src/app/globals.css`: reemplazo de Arial por Manrope para todos los paneles con fallback; sin cambiar la marca, colores ni las variables de tema.
- `src/components/routines/student-home.tsx`: el `section` de la cuota pasa a ser el `Link` completo, con `aria-labelledby`. El antiguo `Link` anidado pasa a `span` para evitar enlaces anidados; se mantienen saldo, vencimiento, estado y texto.
- Estilo de borde `--dash-accent` al hover y foco; accesible con ratón, teclado y toque.

## Aceptación y límites

- Menú inferior de cinco destinos del PR #78 se conserva intacto.
- Manrope abarca alumno, administración y acceso, con fallback para pruebas aisladas sin clase del layout.
- La cuota enlaza desde cualquier punto, sin interacciones anidadas; sigue informando estado aun cuando no existe una cuota.
- No se modifican API, permisos, Auth, SQL, RLS, datos, flujos de pagos ni publicación de rutinas.
- Se requiere CI Verify (lint, typecheck, build, Playwright) y Supabase local migrations en el SHA final. No confundir preview READY con prueba autenticada de producción.
- Si el build de Next no puede resolver Manrope, no integrar sin corregir y repetir las pruebas.

## Diseño pendiente: texto libre → bloques

El modelo vigente ya incluye `Note.format="text" | "blocks"`, `text_content`, `mentions` asociadas a `exercise_id` y `PlanV2.days[].blocks[].exercises[]`. La importación futura debe tomar una **copia del texto** y generar un **borrador estructurado revisable**, nunca publicar sin confirmación. Empezar por un parser determinista con formatos esperados (día, bloque, ejercicios, repeticiones, kilos, tiempo); considerar asistencia por IA solo si mejora las ambigüedades, con validación estricta contra catálogo, límites SQL existentes y aprobación final de Nico. Preservar texto, revisiones y snapshot publicado.

SKILLS_SELECTED/APPLIED: cueva-feature-development (implementación aislada y tests), cueva-acceptance-audit (preparación de gates), vercel:deployments-cicd (compatibilidad de build).
SKILL_SOURCES: `.agents/skills/cueva-feature-development/SKILL.md`; `.agents/skills/cueva-acceptance-audit/SKILL.md`; `skills://plugins/vercel/deployments-cicd/skill.md`; `AGENTS.md`.
