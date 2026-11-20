# CUEVA-UX-STUDENT-NAV-003 — Mi cuenta en el menú inferior

**Rama:** `feature/cueva-student-mobile-account-nav`
**BASE_SHA:** `89cbdecf0b0ed12922c152a135cd66ca503ad93c`
**Estado:** REVIEW / PR borrador, no fusionado

## Pedido

Agregar el ícono de **Mi cuenta** a la navegación inferior del alumno, manteniendo el logo central grande de CUEVA que lleva a Inicio y el menú de persona en la cabecera, sin modificar permisos.

## Implementación

- La barra inferior del alumno en móvil tiene cinco destinos, en este orden: Rutina, Cuotas, Inicio (logo central), Avisos, Mi cuenta.
- Mi cuenta utiliza el icono existente `StudentIcon` (`user`), enlaza a `/mi-perfil` y se marca con `aria-current="page"` cuando la sección está activa.
- El quinto enlace se oculta en la navegación superior de escritorio, donde ya existe el menú de cuenta, evitando duplicación.
- La cabecera, cierre de sesión, las opciones de tema, el logo y las rutas anteriores permanecen intactos.

## Propuestas tipográficas (visualizaciones, NO implementadas)

La base actual usa `Arial, Helvetica, sans-serif`. Se comparan `Manrope` (deportiva, limpia, encabezados fuertes), `Plus Jakarta Sans` (cuidada y contemporánea) y `DM Sans` (amable, legibilidad en pantallas móviles). La aprobación de una fuente es decisión visual posterior; no agregamos dependencias ni cargamos fuentes de terceros hasta elegir.

## Aceptación

- Barra inferior: cinco destinos visibles a 320/360/390 px, toques >= 44px, sin desbordes.
- Logo CUEVA en el centro de la grilla de cinco columnas y mayor que los otros iconos.
- En Mi perfil, el enlace Mi cuenta aparece activo; la cuenta sigue accesible desde el popover superior.
- En desktop (>840px), no se duplica el enlace de Mi cuenta en la barra horizontal.
- No se altera Auth, RLS, Supabase, componentes del administrador, pagos, biblioteca de ejercicios ni fuentes protegidas.

SKILLS_SELECTED/APPLIED: `cueva-feature-development` (implementación mínima, rama aislada, e2e), `cueva-acceptance-audit` (verificación de PR/CI antes de integración).
SKILL_SOURCES: `.agents/skills/cueva-feature-development/SKILL.md`, `.agents/skills/cueva-acceptance-audit/SKILL.md`, `AGENTS.md`.
