# CUEVA-UX-STUDENT-ACCOUNT-MENU-001 — Cuenta del alumno por iconos

**Estado:** implementación en rama aislada para revisión, sin integración ni publicación.
**Base:** `aa7cd36041412aa1b14a4d2b0f6145728084cb5d` (`main` al crear la rama).
**Rama:** `feature/cueva-student-account-menu`.

## Decisión del producto

En todas las páginas del alumno, mostrar arriba a la derecha un icono de persona que abre un desplegable compacto **sin nombres visibles**, con botones de iconos para:

- Mi cuenta (`/mi-perfil`), para consultar y cambiar correo/contraseña como antes.
- Cerrar sesión por el POST existente `/api/acceso/salir`.
- Apariencia Claro, Oscuro y Sistema, usando las preferencias existentes.

Los nombres se conservan para tecnologías de asistencia y tooltip, pero no como etiquetas visuales. En móvil, la navegación inferior se concentra en Inicio, Rutina, Cuotas y Avisos; Perfil sale de esa barra y el cierre de sesión deja de aparecer al pie de Mi perfil.

## Límites

No tocar la autenticación, los formularios de correo/contraseña, las rutas financieras, las políticas de Supabase, migraciones, datos, ni el selector de tema del administrador. Reutilizar el almacenamiento de apariencia existente. El popover nativo cierra al pulsar Escape o fuera; los controles deben ser accesibles por teclado y medir al menos 44 px.

## Aceptación

- Menú disponible en las páginas del alumno y acceso al perfil desde cualquier sección.
- En el desplegable no aparece texto visible, pero todos los controles tienen nombre accesible.
- Logout sigue haciendo POST; ninguna navegación sustituye ni omite la protección de sesión.
- Claro, Oscuro y Sistema conservan su selección y funcionan en móvil/escritorio.
- Sin desbordamiento horizontal a 320/360/390 px, con navegación inferior de cuatro destinos; el alumno no pierde formularios ni el inicio.
- Pruebas de navegador y CI verificadas sobre el HEAD exacto antes de cualquier integración.

SKILLS_SELECTED: `cueva-feature-development`.
SKILLS_APPLIED: aislamiento de rama, revisión del shell actual, cambio acotado de UX y pruebas.
SKILL_SOURCES: `.agents/skills/cueva-feature-development/SKILL.md`.
